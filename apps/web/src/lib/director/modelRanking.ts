// Deterministic, explainable ranking of video models given a Director breakdown.
// Used as fallback when the LLM's recommended_model_id is missing or ambiguous,
// and to surface a "Top picks" shortlist.

import type { Breakdown } from "./api";
import { MODEL_CATALOG, CATALOG_BY_ID, type ModelCapabilities, type ModelStrength } from "./videoModelCatalog";

export type RankedModel = {
  model: ModelCapabilities;
  score: number;
  reasons: string[];
};

const AUDIO_RX = /\b(music|dialogue|dialog|voice|speak|speech|sing|song|sound|audio|ambient|score|vo|voiceover)\b/i;
const QUICK_RX = /\b(quick|draft|fast|preview|sketch)\b/i;
const HIRES_RX = /\b(4k|1080p?|hi[- ]?res|high[- ]?res|cinematic)\b/i;

const TAG_RULES: Array<{ rx: RegExp; tag: ModelStrength }> = [
  { rx: /\b(portrait|face|close[- ]?up|character|model|headshot)\b/i, tag: "portrait" },
  { rx: /\b(product|object|bottle|packshot|commercial)\b/i, tag: "product" },
  { rx: /\b(landscape|vista|mountain|forest|ocean|desert|skyline|aerial|drone)\b/i, tag: "landscape" },
  { rx: /\b(action|chase|fight|run|sprint|explosion|battle|race)\b/i, tag: "action" },
  { rx: /\b(dance|crowd|complex|swirl|whip[- ]?pan|parkour)\b/i, tag: "complex_motion" },
  { rx: /\b(static|still|locked[- ]?off|tableau)\b/i, tag: "stable_subject" },
  { rx: /\b(long[- ]?take|oner|continuous)\b/i, tag: "long_take" },
  { rx: /\b(grain|kodak|portra|35mm|16mm|super[- ]?8|ektachrome|film stock|analog)\b/i, tag: "film_grain" },
  { rx: /\b(anime|manga|cel[- ]?shaded|2d animation)\b/i, tag: "anime" },
  { rx: /\b(stylized|illustrated|painterly|cartoon|cgi|surreal)\b/i, tag: "stylized" },
  { rx: /\b(photoreal|realistic|documentary|naturalistic)\b/i, tag: "photoreal" },
  { rx: /\b(text|title|caption|sign|logo)\b/i, tag: "text_in_frame" },
  { rx: /\b(dialogue|dialog|speak|voice|voiceover|conversation)\b/i, tag: "dialogue" },
];

const FAMILY_RX: Record<string, RegExp> = {
  kling: /\bkling\b/i,
  veo: /\bveo\b/i,
  seedance: /\bseedance|seed[- ]?dance\b/i,
  hailuo: /\bhailuo|minimax\b/i,
  runway: /\brunway|gen[- ]?3\b/i,
  ltx: /\bltx\b/i,
  wan: /\bwan\b/i,
};

function parseDurationHint(hint?: string): number | null {
  if (!hint) return null;
  const m = hint.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function joinedText(b: Breakdown): string {
  return [
    b.subject, b.action, b.mood, b.color_palette, b.environment,
    b.film_emulation, b.model_recommendation, b.duration_hint,
  ].filter(Boolean).join(" \n ");
}

export function rankModels(breakdown: Breakdown): RankedModel[] {
  const text = joinedText(breakdown);
  const wantsAudio = AUDIO_RX.test(text);
  const wantsQuick = QUICK_RX.test(text);
  const wantsHiRes = HIRES_RX.test(text) || /1080|4k/i.test(breakdown.film_emulation || "");
  const durationHint = parseDurationHint(breakdown.duration_hint);
  const matchedTags = new Set<ModelStrength>();
  for (const { rx, tag } of TAG_RULES) if (rx.test(text)) matchedTags.add(tag);

  const familyHint = Object.entries(FAMILY_RX).find(([, rx]) =>
    rx.test(breakdown.model_recommendation || ""),
  )?.[0];

  const ranked: RankedModel[] = MODEL_CATALOG.map((model) => {
    let score = 0;
    const reasons: string[] = [];

    if (wantsAudio) {
      if (model.audio) { score += 3; reasons.push("Native audio"); }
      else { score -= 4; reasons.push("No audio (penalty)"); }
    }
    if (durationHint != null) {
      if (model.maxDurationSec >= durationHint) {
        if (durationHint >= 8) { score += 2; reasons.push(`Supports ${durationHint}s`); }
      } else {
        score -= 3; reasons.push(`Caps at ${model.maxDurationSec}s`);
      }
    }
    let tagHits = 0;
    for (const t of matchedTags) {
      if (model.strengths.includes(t)) tagHits++;
    }
    if (tagHits > 0) {
      const bump = Math.min(tagHits, 3) * 2;
      score += bump;
      reasons.push(`Matches ${tagHits} scene tag${tagHits > 1 ? "s" : ""}`);
    }
    if (breakdown.film_emulation && (model.strengths.includes("film_grain") || model.strengths.includes("cinematic"))) {
      score += 1; reasons.push("Cinematic / film look");
    }
    if (wantsHiRes && model.maxResolution === "1080p") {
      score += 1; reasons.push("1080p capable");
    }
    if (wantsQuick && model.speed === "fast") {
      score += 1; reasons.push("Fast tier");
    }
    if (!wantsHiRes && model.cost === "high") {
      score -= 1;
    }
    if (familyHint && model.family === familyHint) {
      score += 2.5; reasons.push(`Matches "${familyHint}" hint`);
    }

    return { model, score, reasons };
  });

  ranked.sort((a, b) => b.score - a.score || a.model.label.localeCompare(b.model.label));
  return ranked;
}

export type Recommendation = {
  primary: ModelCapabilities;
  alternatives: ModelCapabilities[];
  reasons: string[];
  source: "llm" | "ranking";
};

export function resolveRecommendation(breakdown: Breakdown): Recommendation {
  const ranked = rankModels(breakdown);
  const llmId = (breakdown as any).recommended_model_id as string | undefined;
  const llmAlts = ((breakdown as any).recommended_alternatives as string[] | undefined) || [];

  let primary: ModelCapabilities | undefined =
    (llmId && CATALOG_BY_ID[llmId]) || undefined;
  let source: Recommendation["source"] = "llm";

  if (!primary) {
    primary = ranked[0]?.model;
    source = "ranking";
  }
  if (!primary) primary = MODEL_CATALOG[0];

  const altIds = new Set<string>();
  for (const id of llmAlts) {
    if (CATALOG_BY_ID[id] && id !== primary.id) altIds.add(id);
  }
  for (const r of ranked) {
    if (altIds.size >= 3) break;
    if (r.model.id !== primary.id) altIds.add(r.model.id);
  }
  const alternatives = Array.from(altIds).slice(0, 3).map((id) => CATALOG_BY_ID[id]);

  const primaryReasons = ranked.find((r) => r.model.id === primary!.id)?.reasons || [];
  return { primary, alternatives, reasons: primaryReasons, source };
}
