// Builds a compact "session context" block that gets prepended to Free chat
// history so the model can reference panels/style/attachments by name.
// Surfaces helpers used by the Free-chat chip row and the handoff bridges.

import type { Attachment } from "./ingest";

// Loose bubble shape — DirectorChat owns the union, we only read by role.
type AnyBubble = any;

const MAX_BLOCK = 1500;
const MAX_EXCERPT = 180;

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;

export type SessionPanel = {
  index: number; // 1-based
  caption?: string;
  prompt?: string;
};

export type SessionContext = {
  title: string | null;
  panels: SessionPanel[];
  hasStyle: boolean;
  styleSummary?: string;
  finalPrompt?: string;
  mode?: "character_sheet" | "storyboard_panels" | "single_panel";
  modelId?: string;
  lastAttachments: Array<{ name: string; url?: string; kind: string }>;
};

export function extractSessionContext(
  bubbles: AnyBubble[],
  sessionTitle: string | null,
): SessionContext {
  // Walk from the end to find the most recent "result" bubble.
  let latestResult: any = null;
  for (let i = bubbles.length - 1; i >= 0; i -= 1) {
    if (bubbles[i]?.role === "result") {
      latestResult = bubbles[i];
      break;
    }
  }
  // Latest user attachments (look at last 2 user bubbles with attachments).
  const lastAttachments: SessionContext["lastAttachments"] = [];
  for (let i = bubbles.length - 1; i >= 0 && lastAttachments.length < 2; i -= 1) {
    const b = bubbles[i];
    if (b?.role === "user" && Array.isArray(b.attachments)) {
      for (const a of b.attachments as Attachment[]) {
        if (lastAttachments.length >= 2) break;
        lastAttachments.push({
          name: (a as any).name || "attachment",
          url: (a as any).url,
          kind: (a as any).kind || "file",
        });
      }
    }
  }

  const panels: SessionPanel[] = [];
  let finalPrompt: string | undefined;
  let hasStyle = false;
  let styleSummary: string | undefined;
  let mode: SessionContext["mode"];
  let modelId: string | undefined;

  if (latestResult) {
    const data = latestResult.data || {};
    mode = data.mode;
    modelId = data.breakdown?.recommended_model_id;
    finalPrompt = data.prompt || undefined;

    const ls = data.locked_spec;
    if (ls && Object.keys(ls).length) {
      hasStyle = true;
      styleSummary = [
        ls.style,
        ls.aspect_ratio,
        ls.resolution,
        ls.duration_seconds ? `${ls.duration_seconds}s` : null,
        ls.audio,
      ]
        .filter(Boolean)
        .join(" · ");
    }

    const per: string[] | undefined = data.per_shot_prompts;
    const captions: string[] | undefined = data.shot_captions || data.captions;
    if (Array.isArray(per) && per.length) {
      per.forEach((p, i) => {
        panels.push({
          index: i + 1,
          caption: captions?.[i],
          prompt: typeof p === "string" ? p : undefined,
        });
      });
    } else if (finalPrompt) {
      panels.push({ index: 1, prompt: finalPrompt });
    }
  }

  return {
    title: sessionTitle,
    panels,
    hasStyle,
    styleSummary,
    finalPrompt,
    mode,
    modelId,
    lastAttachments,
  };
}

// Returns null when there's nothing useful to ground on (welcome-only chat).
export function buildSessionContextBlock(
  bubbles: AnyBubble[],
  sessionTitle: string | null,
): string | null {
  const ctx = extractSessionContext(bubbles, sessionTitle);
  if (!ctx.panels.length && !ctx.hasStyle && !ctx.lastAttachments.length) {
    return null;
  }

  const lines: string[] = [];
  lines.push("[Session context — you can reference any of the items below by name]");
  if (ctx.title) lines.push(`Session: "${ctx.title}"`);
  if (ctx.mode) lines.push(`Mode: ${ctx.mode}${ctx.modelId ? ` · model: ${ctx.modelId}` : ""}`);
  if (ctx.hasStyle && ctx.styleSummary) {
    lines.push(`@style → Locked style: ${ctx.styleSummary}`);
  }
  if (ctx.finalPrompt) {
    lines.push(`@final-prompt → ${truncate(ctx.finalPrompt, MAX_EXCERPT)}`);
  }
  if (ctx.panels.length) {
    const isStoryboard = ctx.mode === "storyboard_panels" && ctx.panels.length > 1;
    if (isStoryboard) {
      lines.push(`Panels (${ctx.panels.length}):`);
      ctx.panels.forEach((p) => {
        const cap = p.caption ? ` — ${truncate(p.caption, 60)}` : "";
        const body = p.prompt ? truncate(p.prompt, MAX_EXCERPT) : "(no prompt)";
        lines.push(`  @panel-${p.index}${cap}: ${body}`);
      });
    }
  }
  if (ctx.lastAttachments.length) {
    lines.push("Recent attachments:");
    ctx.lastAttachments.forEach((a) =>
      lines.push(`  - ${a.kind}: ${a.name}${a.url ? ` (${a.url})` : ""}`),
    );
  }
  lines.push(
    "[End session context. Answer the user's question grounded in the above. Resolve @panel-N references to the matching panel.]",
  );

  let block = lines.join("\n");
  if (block.length > MAX_BLOCK) block = block.slice(0, MAX_BLOCK - 1) + "…";
  return block;
}

// Chip tokens shown above the Free-chat composer.
export type ContextChip = { token: string; label: string };

export function buildContextChips(ctx: SessionContext): ContextChip[] {
  const chips: ContextChip[] = [];
  if (ctx.mode === "storyboard_panels" && ctx.panels.length > 1) {
    ctx.panels.forEach((p) =>
      chips.push({ token: `@panel-${p.index}`, label: `Panel ${p.index}` }),
    );
  } else if (ctx.panels.length === 1) {
    chips.push({ token: "@final-prompt", label: "Prompt" });
  }
  if (ctx.hasStyle) chips.push({ token: "@style", label: "Style" });
  if (ctx.finalPrompt && ctx.mode === "storyboard_panels") {
    chips.push({ token: "@final-prompt", label: "Final prompt" });
  }
  return chips;
}

// Window event used by PromptInspector / PromptResultCard to ask the DP.
export const ASK_DP_EVENT = "movprompt:ask-dp";
export type AskDpDetail = { prefill: string };

// ─────────────────────────────────────────────────────────────────────────────
// Session State Recap — derived ground truth injected right before the user's
// latest turn so the Director stops re-asking answered questions.
// ─────────────────────────────────────────────────────────────────────────────

export function buildSessionStateRecap(bubbles: AnyBubble[]): string | null {
  if (!Array.isArray(bubbles) || bubbles.length === 0) return null;

  const locked: Record<string, string> = {};
  let pinnedSubject: { kind: string } | null = null;
  let lastKeyFrameAspect: string | null = null;
  let chosenModel: string | null = null;
  let lastMode: string | null = null;
  let pendingStep: string | null = null;
  let lastQuestion: { reason: string; question: string } | null = null;
  let lastAnswerToQuestion: string | null = null;
  let pathHint: string | null = null;
  let priorAttachments = 0;
  let hasGeneratedPrompt = false;
  let storyActive = false;

  for (let i = 0; i < bubbles.length; i += 1) {
    const b: any = bubbles[i];
    if (!b) continue;

    if (b.role === "user" && Array.isArray(b.attachments)) {
      priorAttachments += b.attachments.length;
    }
    if (b.role === "model_choice") {
      if (b.chosen) chosenModel = b.chosen;
      pendingStep = b.chosen ? null : "awaiting_model_choice";
    }
    if (b.role === "aspect_choice") {
      if (b.chosen) {
        locked.aspect_ratio = b.chosen;
        pendingStep = null;
      } else {
        pendingStep = "awaiting_aspect_choice";
      }
    }
    if (b.role === "subject_lock_choice") {
      pendingStep = b.chosen ? null : "awaiting_subject_lock_choice";
    }
    if (b.role === "scene_describe") {
      pendingStep = b.submitted ? null : "awaiting_scene_description";
    }
    if (b.role === "location_step") {
      pendingStep = b.stepMode === "done" ? null : "awaiting_location_choice";
    }
    if (b.role === "questions") {
      const q = (b.questions || [])[0];
      if (q) lastQuestion = { reason: b.reason || "", question: q };
      pendingStep = "awaiting_clarification_answer";
      lastAnswerToQuestion = null;
    }
    if (
      b.role === "user" &&
      lastQuestion &&
      pendingStep === "awaiting_clarification_answer"
    ) {
      const text = (b.content || "").trim();
      if (text) {
        lastAnswerToQuestion = text.slice(0, 200);
        pendingStep = null;
      }
    }
    if (b.role === "generated_images") {
      lastMode = b.data?.mode || lastMode;
      if (b.data?.subjectSheet) {
        pinnedSubject = { kind: b.data.subjectKind || "character" };
      }
      if (b.data?.mode === "single_panel" && b.data?.aspectRatio) {
        lastKeyFrameAspect = b.data.aspectRatio;
        locked.aspect_ratio = b.data.aspectRatio;
      }
    }
    if (b.role === "result") {
      hasGeneratedPrompt = true;
      const ls: any = b.data?.locked_spec || {};
      for (const k of [
        "input_mode",
        "duration_seconds",
        "aspect_ratio",
        "audio",
        "resolution",
        "style",
      ]) {
        if (ls[k] !== undefined && ls[k] !== null && ls[k] !== "") {
          locked[k] = String(ls[k]);
        }
      }
      const br: any = b.data?.breakdown || {};
      if (br.recommended_model_id) chosenModel = br.recommended_model_id;
    }
    if (b.role === "story_render" || b.role === "location_picker") {
      storyActive = true;
    }
  }

  if (storyActive) pathHint = "story";
  else if (priorAttachments > 0 || pinnedSubject)
    pathHint = "anchored (reference image / subject locked)";
  else if (lastMode === "single_panel" || lastKeyFrameAspect)
    pathHint = "key-frame-first";
  else if (chosenModel || hasGeneratedPrompt) pathHint = "direct-to-video";

  const lines: string[] = [];
  lines.push(
    "[SESSION STATE — derived ground truth. READ BEFORE asking anything. Never re-ask anything covered below.]",
  );
  if (pathHint) lines.push(`Active path: ${pathHint}`);
  if (chosenModel)
    lines.push(`Locked model: ${chosenModel} (do NOT call ask_model_choice again)`);
  if (pinnedSubject)
    lines.push(
      `Pinned ${pinnedSubject.kind} sheet (do NOT re-ask the user to describe or upload the ${pinnedSubject.kind})`,
    );

  const order = [
    "duration_seconds",
    "aspect_ratio",
    "resolution",
    "audio",
    "style",
    "input_mode",
  ];
  const formatted = order
    .filter((k) => locked[k])
    .map((k) => `${k}=${locked[k]}`)
    .join(" · ");
  if (formatted) lines.push(`Locked spec axes (do NOT re-ask): ${formatted}`);

  if (lastQuestion && lastAnswerToQuestion) {
    lines.push(`Last clarification asked: "${lastQuestion.question}"`);
    lines.push(
      `User's answer: "${lastAnswerToQuestion}" — treat as locked. Advance to the NEXT step; do NOT re-ask or rephrase.`,
    );
  } else if (pendingStep) {
    lines.push(
      `Pending UI step the user currently sees: ${pendingStep}. Do not duplicate — the client already shows it.`,
    );
  }

  if (priorAttachments > 0) {
    lines.push(
      `User attached ${priorAttachments} reference file(s) earlier — still in play. Do NOT ask them to re-upload.`,
    );
  }

  const REQUIRED = ["duration_seconds", "aspect_ratio", "audio"] as const;
  const missing = REQUIRED.filter((k) => !locked[k]);
  if (missing.length && pathHint !== "story") {
    lines.push(
      `Still missing before generate_prompt: ${missing.join(", ")}. Ask ONE next (priority: duration → audio → aspect_ratio).`,
    );
  }

  lines.push(
    "[END SESSION STATE. If the user's latest message contradicts any locked value, prefer the latest message and call it out in directors_note.]",
  );

  if (lines.length <= 2) return null;
  return lines.join("\n");
}
