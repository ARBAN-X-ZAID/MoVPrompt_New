import type { CampaignTone, CreativeBrief, DialectRegister, TemplateSceneRecipe } from "./types.js";

/** Versioned campaign-language policy; this is not a claim to model every KA variety. */
export const KUWAITI_DIALECT_POLICY_VERSION = "ar-KW-campaign-2026.08" as const;

const CROSS_DIALECT_TERMS: ReadonlyArray<{ pattern: RegExp; label: string; replacement: string }> = [
  { pattern: /(?<![\p{L}\p{N}])دلوقتي(?![\p{L}\p{N}])/gu, label: "Egyptian: دلوقتي", replacement: "الحين" },
  { pattern: /(?<![\p{L}\p{N}])(?:إزاي|ازاي)(?![\p{L}\p{N}])/gu, label: "Egyptian: إزاي", replacement: "شلون" },
  { pattern: /(?<![\p{L}\p{N}])عايز(?![\p{L}\p{N}])/gu, label: "Egyptian: عايز", replacement: "تبي" },
  { pattern: /(?<![\p{L}\p{N}])(?:أوي|اوي)(?![\p{L}\p{N}])/gu, label: "Egyptian: أوي", replacement: "وايد" },
  { pattern: /(?<![\p{L}\p{N}])لسه(?![\p{L}\p{N}])/gu, label: "Egyptian: لسه", replacement: "للحين" },
  { pattern: /(?<![\p{L}\p{N}])مش(?![\p{L}\p{N}])/gu, label: "Egyptian/Levantine: مش", replacement: "مو" },
  { pattern: /(?<![\p{L}\p{N}])هلق(?![\p{L}\p{N}])/gu, label: "Levantine: هلق", replacement: "الحين" },
  { pattern: /(?<![\p{L}\p{N}])(?:هلأ|هلّق)(?![\p{L}\p{N}])/gu, label: "Levantine: هلأ/هلّق", replacement: "الحين" },
  { pattern: /(?<![\p{L}\p{N}])شو(?![\p{L}\p{N}])/gu, label: "Levantine: شو", replacement: "شنو" },
  { pattern: /(?<![\p{L}\p{N}])بدك(?![\p{L}\p{N}])/gu, label: "Levantine: بدك", replacement: "تبي" },
  { pattern: /(?<![\p{L}\p{N}])كتير(?![\p{L}\p{N}])/gu, label: "Levantine: كتير", replacement: "وايد" },
  { pattern: /(?<![\p{L}\p{N}])هيك(?![\p{L}\p{N}])/gu, label: "Levantine: هيك", replacement: "جذي" },
  { pattern: /(?<![\p{L}\p{N}])دابا(?![\p{L}\p{N}])/gu, label: "Moroccan: دابا", replacement: "الحين" },
  { pattern: /(?<![\p{L}\p{N}])بزاف(?![\p{L}\p{N}])/gu, label: "Moroccan: بزاف", replacement: "وايد" },
  { pattern: /(?<![\p{L}\p{N}])علاش(?![\p{L}\p{N}])/gu, label: "Maghrebi: علاش", replacement: "ليش" },
  { pattern: /(?<![\p{L}\p{N}])هسه(?![\p{L}\p{N}])/gu, label: "Iraqi: هسه", replacement: "الحين" },
  { pattern: /(?<![\p{L}\p{N}])شكد(?![\p{L}\p{N}])/gu, label: "Iraqi: شكد", replacement: "شكثر" },
  { pattern: /(?<![\p{L}\p{N}])كلش(?![\p{L}\p{N}])/gu, label: "Iraqi: كلش", replacement: "وايد" },
  { pattern: /(?<![\p{L}\p{N}])أبغى(?![\p{L}\p{N}])/gu, label: "Saudi: أبغى", replacement: "أبي" },
  { pattern: /(?<![\p{L}\p{N}])تبغى(?![\p{L}\p{N}])/gu, label: "Saudi: تبغى", replacement: "تبي" },
];

const OVERFORMAL_TERMS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /قم بالحجز/gu, replacement: "احجز" },
  { pattern: /يرجى التواصل معنا/gu, replacement: "راسلنا" },
  { pattern: /تواصل معنا الآن/gu, replacement: "راسلنا الحين" },
  { pattern: /سارع بالطلب/gu, replacement: "لا يطوفك، اطلبه الحين" },
  { pattern: /متاح الآن/gu, replacement: "متوفر الحين" },
  { pattern: /لا تفوت الفرصة/gu, replacement: "لا يطوفك" },
  { pattern: /يمكنكم الطلب/gu, replacement: "تقدرون تطلبون" },
  { pattern: /يمكنك الطلب/gu, replacement: "تقدر تطلب" },
  { pattern: /سوف نساعدك/gu, replacement: "راح نساعدك" },
  { pattern: /ماذا تريد/gu, replacement: "شنو تبي" },
];

const KUWAITI_MARKERS = ["الحين", "وايد", "شنو", "شلون", "تبي", "جذي", "لا يطوفك", "حياكم", "راسلنا", "طلبك علينا"];

export type DialectValidation = {
  normalized: string;
  score: number;
  warnings: string[];
  markers: string[];
};

export function normalizeKuwaitiArabic(
  value: string,
  options: { register?: DialectRegister; clinical?: boolean } = {},
): DialectValidation {
  let normalized = value.trim().replace(/\s+/gu, " ");
  const warnings: string[] = [];
  for (const term of CROSS_DIALECT_TERMS) {
    if (term.pattern.test(normalized)) {
      warnings.push(term.label);
      normalized = normalized.replace(term.pattern, term.replacement);
    }
    term.pattern.lastIndex = 0;
  }
  if (!options.clinical && options.register !== "polished") {
    for (const term of OVERFORMAL_TERMS) normalized = normalized.replace(term.pattern, term.replacement);
  }
  const markers = KUWAITI_MARKERS.filter((marker) => normalized.includes(marker));
  const score = Math.max(0, 100 - warnings.length * 24 - (normalized && markers.length === 0 && options.register === "conversational" ? 10 : 0));
  return { normalized, score, warnings, markers };
}

function goalCta(goal: CreativeBrief["goal"], cta: string): string {
  if (goal === "whatsapp_orders") return "راسلنا على الواتساب وطلبك علينا";
  if (goal === "bookings") return "احجز موعدك الحين";
  if (goal === "offer") return "لا يطوفك العرض";
  if (goal === "demonstration") return "شوف التفاصيل وجربه بنفسك";
  if (goal === "trust") return "حياكم، وخلكم مطمئنين";
  if (/whatsapp/iu.test(cta)) return "راسلنا على الواتساب";
  return "متوفر الحين";
}

function purposeVoiceover(scene: TemplateSceneRecipe, brief: CreativeBrief, index: number): string {
  const product = brief.product.name;
  if (index === 0) {
    if (brief.tone === "clinical") return `${product}، معلومات واضحة وخطوة بخطوة.`;
    if (brief.goal === "offer") return `لا يطوفك عرض ${product}.`;
    if (brief.goal === "bookings") return `تبي موعد يناسبك؟ خلّها علينا.`;
    return `${product}، هذا اللي يستاهل تشوفه.`;
  }
  if (/proof|trust|ثقة|proof/iu.test(`${scene.purpose.en} ${scene.purpose.ar}`)) {
    return brief.tone === "clinical" ? "نشرح لك التفاصيل مثل ما هي، من غير مبالغة." : "التفاصيل واضحة، والاختيار يصير أسهل.";
  }
  if (index === brief.scenes.length - 1) return goalCta(brief.goal, brief.product.callToAction);
  if (brief.goal === "demonstration") return "شوف شلون يشتغل بكل بساطة.";
  if (brief.tone === "premium") return "تفاصيل مرتبة، وحضور يفرق.";
  if (brief.tone === "clinical") return "كل معلومة معروضة بدقة ومن غير وعود غير مؤكدة.";
  return "بسيط، واضح، ومناسب لك.";
}

export type KuwaitiCampaignCopy = {
  locale: "ar-KW";
  policyVersion: typeof KUWAITI_DIALECT_POLICY_VERSION;
  register: DialectRegister;
  scenes: Array<{ sceneId: string; headline: string; voiceover: string }>;
  fullVoiceover: string;
  score: number;
  warnings: string[];
};

export function compileKuwaitiCampaignCopy(brief: CreativeBrief): KuwaitiCampaignCopy {
  const warnings = new Set<string>();
  let total = 0;
  const scenes = brief.scenes.map((scene, index) => {
    const headlineReview = normalizeKuwaitiArabic(scene.headline.ar, {
      register: brief.dialectRegister,
      clinical: brief.vertical === "clinic",
    });
    const voiceReview = normalizeKuwaitiArabic(purposeVoiceover(scene, brief, index), {
      register: brief.dialectRegister,
      clinical: brief.vertical === "clinic",
    });
    for (const warning of [...headlineReview.warnings, ...voiceReview.warnings]) warnings.add(warning);
    // Spoken dialect is the primary score. Cross-dialect overlay copy is still
    // captured in warnings and penalized at the complete-script level.
    total += voiceReview.score;
    return { sceneId: scene.id, headline: headlineReview.normalized, voiceover: voiceReview.normalized };
  });
  return {
    locale: "ar-KW",
    policyVersion: KUWAITI_DIALECT_POLICY_VERSION,
    register: brief.dialectRegister,
    scenes,
    fullVoiceover: scenes.map((scene) => scene.voiceover).join(" "),
    score: scenes.length ? Math.max(0, Math.round(total / scenes.length) - warnings.size * 12) : 0,
    warnings: [...warnings],
  };
}

export function voiceDirection(tone: CampaignTone, register: DialectRegister): string {
  const energy = tone === "energetic" ? "bright and quick" : tone === "clinical" ? "calm and precise" : tone === "premium" ? "assured and restrained" : "warm and natural";
  return `Native Kuwait Arabic (ar-KW), ${register} register, ${energy}; never Egyptian, Levantine, Emirati, Saudi, or generic Modern Standard Arabic delivery.`;
}
