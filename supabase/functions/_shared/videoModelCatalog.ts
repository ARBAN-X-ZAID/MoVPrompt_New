// SHARED video model catalog — single source of truth for both the frontend
// model picker (`src/lib/director/videoModelCatalog.ts` re-exports from here)
// and the director-agent edge function (which uses the extended playbook
// fields: tier, inputMode, needs, bestFor, cannotDo, preferWhen, promptDialect).
//
// Keep this file dependency-free (no Deno or Node imports) so both runtimes
// can consume it.

export type VideoModelFamily =
  | "kling"
  | "seedance"
  | "veo"
  | "hailuo"
  | "runway"
  | "ltx"
  | "wan";

export type ModelStrength =
  | "cinematic"
  | "photoreal"
  | "stylized"
  | "anime"
  | "portrait"
  | "product"
  | "landscape"
  | "action"
  | "complex_motion"
  | "stable_subject"
  | "long_take"
  | "film_grain"
  | "text_in_frame"
  | "dialogue"
  | "reference";

export type ResolutionTier = "480p" | "720p" | "768p" | "1080p";
export type SpeedTier = "fast" | "balanced" | "slow";
export type CostTier = "low" | "mid" | "high";
export type InputMode =
  | "text-to-video"
  | "reference-to-video"
  | "video-to-video-edit"
  | "motion-control";

export type ModelCapabilities = {
  // ── Legacy fields (consumed by frontend picker & ranking)
  id: string;
  family: VideoModelFamily;
  label: string;
  note?: string;
  audio: boolean;
  maxDurationSec: number;
  maxResolution: ResolutionTier;
  aspects: string[];
  speed: SpeedTier;
  cost: CostTier;
  strengths: ModelStrength[];

  // ── Director-only playbook fields (consumed by director-agent edge function)
  tier: string;                  // human label e.g. "Google Veo 3.1"
  inputMode: InputMode;          // hard input-gate category
  needs?: string;                // required attachments (Omni Edit / Motion Control)
  durationSpec: string;          // human description of allowed durations
  bestFor: string[];             // 2–4 concrete shot types
  cannotDo?: string[];           // machine-checkable hard constraints ("aspect:9:16", "duration:!=8", "audio")
  preferWhen: string;            // tiebreaker vs nearest sibling
  promptDialect?: string;        // how to shape the final prompt for this model
};

const STD = ["16:9", "9:16", "1:1"];
const SEEDANCE_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];

// Common prompt-dialect notes reused across siblings.
const VEO_DIALECT =
  'Wrap spoken lines in double quotes and name the speaker (e.g. Anna: "Line"). Keep dialogue ≤2 short sentences. Put ambient SFX in parentheses.';
const SEEDANCE_DIALECT =
  "Lead with film stock + grade (e.g. '35mm Kodak Vision3 250D, teal-orange grade'), then lens, then shot. Loves anamorphic / film-grain language.";
const KLING_V3_DIALECT =
  "For multi-beat shots decompose into numbered beats (1. … 2. …). Mention named characters/elements with @Name when relevant.";
const KLING_LEGACY_DIALECT =
  "Front-load subject + action + camera; keep the description visual and avoid invented dialogue (no native audio).";
const HAILUO_DIALECT =
  "Lean into illustration vocabulary (anime, cel-shaded, 2.5D, vibrant linework). 16:9 only.";
const LTX_DIALECT =
  "Short, concrete 5-second beats. Avoid long sentences or multi-action prompts.";
const WAN_DIALECT =
  "Keep it concrete and short; describe subject + simple motion + lighting.";
const RUNWAY_DIALECT =
  "Lean into Runway's painterly, music-video aesthetic; specify color palette + mood.";

export const MODEL_CATALOG: ModelCapabilities[] = [
  // ─── Kling 3.0 Omni family (o3) ─────────────────────────────────────────
  {
    id: "kling-omni",
    family: "kling",
    label: "Kling 3.0 Omni",
    note: "Multi-reference characters + elements",
    audio: true,
    maxDurationSec: 15,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "high",
    strengths: ["cinematic", "photoreal", "complex_motion", "long_take", "dialogue", "stable_subject"],
    tier: "Kuaishou Kling 3.0 / Omni (o3)",
    inputMode: "reference-to-video",
    needs: "optional: up to 7 reference images and/or named elements for consistent characters & locations",
    durationSpec: "3–15s",
    bestFor: [
      "multi-shot storyboards with recurring characters",
      "branded product spots with consistent hero objects",
      "narrative scenes mixing 2+ characters in a defined location",
    ],
    cannotDo: [],
    preferWhen: "the brief mentions a character/product/location that must look identical across shots",
    promptDialect: KLING_V3_DIALECT,
  },
  {
    id: "kling-omni-edit",
    family: "kling",
    label: "Kling 3.0 Omni Edit",
    note: "Restyle / edit an existing video",
    audio: true,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "high",
    strengths: ["cinematic", "stylized", "stable_subject"],
    tier: "Kuaishou Kling 3.0 / Omni Edit (o3)",
    inputMode: "video-to-video-edit",
    needs: "REQUIRED: source video (3–10s, mp4/mov, ≤200MB). Optional: up to 4 reference images/elements via @Image1 / @Element1",
    durationSpec: "matches source (3–10s)",
    bestFor: [
      "restyle an existing clip (anime, oil-paint, cyberpunk, etc.)",
      "swap a character into an existing scene",
      "change wardrobe / lighting / background of an existing take",
    ],
    cannotDo: ["requires:source_video"],
    preferWhen: "the user attached a clip and wants to EDIT it, not generate fresh footage",
    promptDialect:
      "Describe the TARGET style/look; do not redescribe the source action — it is preserved from the input clip.",
  },
  {
    id: "kling-motion-control",
    family: "kling",
    label: "Kling 3.0 Motion Control",
    note: "Drive a character with a reference video",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "high",
    strengths: ["photoreal", "complex_motion", "action", "stable_subject"],
    tier: "Kuaishou Kling 3.0 / Motion Control (v3)",
    inputMode: "motion-control",
    needs: "REQUIRED: 1 reference image (character to render) + 1 driving video (motion to copy)",
    durationSpec: "≤10s image-mode, ≤30s video-mode",
    bestFor: [
      "make a still character perform a specific dance/action from a reference clip",
      "transplant gestures or choreography onto a custom subject",
    ],
    cannotDo: ["requires:driving_video", "audio"],
    preferWhen: "the user wants their character to MIMIC the motion of another existing clip",
    promptDialect:
      "Describe only the APPEARANCE of the reference subject (look, wardrobe, lighting). Motion comes from the driving video — do not describe motion.",
  },

  // ─── Kling v3 (audio-capable text-to-video) ─────────────────────────────
  {
    id: "kling-v3-pro",
    family: "kling",
    label: "Kling 3.0 Pro",
    note: "Newest, native audio, multi-shot",
    audio: true,
    maxDurationSec: 15,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "high",
    strengths: ["cinematic", "photoreal", "complex_motion", "long_take", "dialogue"],
    tier: "Kuaishou Kling 3.0 / Pro",
    inputMode: "text-to-video",
    durationSpec: "3–15s",
    bestFor: [
      "cinematic single-take 8–15s shots",
      "complex camera moves with photoreal subjects",
      "long-take dialogue without character-consistency needs",
    ],
    preferWhen: "you need the LONGEST audio-capable Kling shot (up to 15s) at top quality",
    promptDialect: KLING_V3_DIALECT,
  },
  {
    id: "kling-v3-standard",
    family: "kling",
    label: "Kling 3.0 Standard",
    note: "Native audio, multi-shot",
    audio: true,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "fast",
    cost: "mid",
    strengths: ["cinematic", "photoreal", "dialogue"],
    tier: "Kuaishou Kling 3.0 / Standard",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["fast cinematic iterations with dialogue", "social-ready 5–10s shots with sound"],
    cannotDo: ["duration:!in:5,10"],
    preferWhen: "you want kling-v3-pro quality but faster/cheaper and 10s is enough",
    promptDialect: KLING_V3_DIALECT,
  },
  {
    id: "kling-v3-4k",
    family: "kling",
    label: "Kling 3.0 4K",
    note: "Native 4K, single-step",
    audio: true,
    maxDurationSec: 10,
    maxResolution: "1080p", // catalog tier capped; real output is 4K
    aspects: STD,
    speed: "slow",
    cost: "high",
    strengths: ["cinematic", "photoreal", "long_take"],
    tier: "Kuaishou Kling 3.0 / 4K",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["hero shots projected on large screens", "footage that survives heavy color grading"],
    cannotDo: ["duration:!in:5,10"],
    preferWhen: "the user explicitly asks for 4K or theatrical-grade resolution",
    promptDialect: KLING_V3_DIALECT,
  },

  // ─── Kling legacy (no native audio) ────────────────────────────────────
  {
    id: "kling-v2.5-turbo-pro",
    family: "kling",
    label: "Kling 2.5 Turbo Pro",
    note: "Latest, fastest pro tier",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "fast",
    cost: "mid",
    strengths: ["photoreal", "complex_motion", "long_take", "action"],
    tier: "Kuaishou Kling 2.5 / Turbo Pro",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["fast photoreal action with complex motion", "stunt/parkour/sports beats", "VFX-heavy single takes"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "you need Kling's best motion realism but DON'T need audio",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v2.1-master",
    family: "kling",
    label: "Kling 2.1 Master",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "high",
    strengths: ["cinematic", "photoreal", "complex_motion", "long_take"],
    tier: "Kuaishou Kling 2.1 / Master",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["high-quality cinematic photoreal long takes"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "kling-v2.5-turbo-pro misses on look but audio isn't needed",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v2-master",
    family: "kling",
    label: "Kling 2 Master",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "high",
    strengths: ["cinematic", "photoreal", "complex_motion"],
    tier: "Kuaishou Kling 2.0 / Master",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["cinematic photoreal with complex motion (legacy baseline)"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "v2.1 master unavailable or older look is requested",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v1.6-pro",
    family: "kling",
    label: "Kling 1.6 Pro",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "mid",
    strengths: ["photoreal", "stable_subject"],
    tier: "Kuaishou Kling 1.6 / Pro",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["stable photoreal subjects (portraits, products)"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "you need rock-stable subject identity without paying for v2+",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v1.6-standard",
    family: "kling",
    label: "Kling 1.6 Standard",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: STD,
    speed: "fast",
    cost: "low",
    strengths: ["photoreal", "stable_subject"],
    tier: "Kuaishou Kling 1.6 / Standard",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["cheap 720p photoreal drafts"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "budget/speed matter more than 1080p",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v1.5-pro",
    family: "kling",
    label: "Kling 1.5 Pro",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: STD,
    speed: "balanced",
    cost: "mid",
    strengths: ["photoreal"],
    tier: "Kuaishou Kling 1.5 / Pro",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["legacy photoreal baseline"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "1.6 unavailable",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v1-pro",
    family: "kling",
    label: "Kling 1.0 Pro",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: STD,
    speed: "balanced",
    cost: "low",
    strengths: ["photoreal"],
    tier: "Kuaishou Kling 1.0 / Pro",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["legacy 720p photoreal"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "only when explicitly requested",
    promptDialect: KLING_LEGACY_DIALECT,
  },
  {
    id: "kling-v1-standard",
    family: "kling",
    label: "Kling 1.0 Standard",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: STD,
    speed: "fast",
    cost: "low",
    strengths: ["photoreal"],
    tier: "Kuaishou Kling 1.0 / Standard",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["cheapest Kling baseline"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "rarely — only for retro comparisons",
    promptDialect: KLING_LEGACY_DIALECT,
  },

  // ─── Google Veo ────────────────────────────────────────────────────────
  {
    id: "veo-3.1",
    family: "veo",
    label: "Veo 3.1",
    note: "Latest, native audio",
    audio: true,
    maxDurationSec: 8,
    maxResolution: "1080p",
    aspects: STD,
    speed: "slow",
    cost: "high",
    strengths: ["photoreal", "cinematic", "dialogue", "complex_motion", "text_in_frame"],
    tier: "Google Veo 3.1",
    inputMode: "text-to-video",
    durationSpec: "4s, 6s, or 8s",
    bestFor: [
      "talking-head dialogue close-ups",
      "photoreal cinematic with on-screen text/signage",
      "complex motion with sync sound",
    ],
    cannotDo: ["duration:!in:4,6,8"],
    preferWhen: "the brief needs SPOKEN DIALOGUE or readable text in frame",
    promptDialect: VEO_DIALECT,
  },
  {
    id: "veo-3.1-fast",
    family: "veo",
    label: "Veo 3.1 Fast",
    audio: true,
    maxDurationSec: 8,
    maxResolution: "1080p",
    aspects: STD,
    speed: "fast",
    cost: "mid",
    strengths: ["photoreal", "dialogue", "complex_motion"],
    tier: "Google Veo 3.1 / Fast",
    inputMode: "text-to-video",
    durationSpec: "4s, 6s, or 8s",
    bestFor: ["quick dialogue iterations", "social ads needing voice + photoreal"],
    cannotDo: ["duration:!in:4,6,8"],
    preferWhen: "veo-3.1 quality is overkill and you want 2-3× faster turnaround",
    promptDialect: VEO_DIALECT,
  },
  {
    id: "veo-3.1-lite",
    family: "veo",
    label: "Veo 3.1 Lite",
    note: "Faster, lower cost",
    audio: true,
    maxDurationSec: 8,
    maxResolution: "1080p",
    aspects: ["16:9", "9:16"],
    speed: "fast",
    cost: "low",
    strengths: ["photoreal", "dialogue"],
    tier: "Google Veo 3.1 / Lite",
    inputMode: "text-to-video",
    durationSpec: "4s, 6s, or 8s",
    bestFor: ["cheapest Veo with audio for drafts"],
    cannotDo: ["aspect:1:1", "duration:!in:4,6,8"],
    preferWhen: "you need audio but budget is the deciding factor",
    promptDialect: VEO_DIALECT,
  },
  {
    id: "veo-3",
    family: "veo",
    label: "Veo 3",
    audio: true,
    maxDurationSec: 8,
    maxResolution: "1080p",
    aspects: ["16:9", "9:16"],
    speed: "slow",
    cost: "high",
    strengths: ["photoreal", "cinematic", "dialogue"],
    tier: "Google Veo 3",
    inputMode: "text-to-video",
    durationSpec: "8s only",
    bestFor: ["8s cinematic dialogue beats (legacy baseline)"],
    cannotDo: ["aspect:1:1", "duration:!=8"],
    preferWhen: "veo-3.1 unavailable or specifically requested",
    promptDialect: VEO_DIALECT,
  },
  {
    id: "veo-3-fast",
    family: "veo",
    label: "Veo 3 Fast",
    audio: true,
    maxDurationSec: 8,
    maxResolution: "1080p",
    aspects: ["16:9", "9:16"],
    speed: "fast",
    cost: "mid",
    strengths: ["photoreal", "dialogue"],
    tier: "Google Veo 3 / Fast",
    inputMode: "text-to-video",
    durationSpec: "8s only",
    bestFor: ["faster veo-3 dialogue iterations"],
    cannotDo: ["aspect:1:1", "duration:!=8"],
    preferWhen: "veo-3.1-fast unavailable",
    promptDialect: VEO_DIALECT,
  },
  {
    id: "veo-2",
    family: "veo",
    label: "Veo 2",
    audio: false,
    maxDurationSec: 8,
    maxResolution: "720p",
    aspects: ["16:9", "9:16"],
    speed: "balanced",
    cost: "mid",
    strengths: ["photoreal", "cinematic"],
    tier: "Google Veo 2",
    inputMode: "text-to-video",
    durationSpec: "5–8s",
    bestFor: ["silent photoreal cinematic at 720p"],
    cannotDo: ["audio", "aspect:1:1"],
    preferWhen: "you need Veo's photoreal look without paying for v3",
    promptDialect: VEO_DIALECT,
  },

  // ─── ByteDance Seedance ────────────────────────────────────────────────
  {
    id: "seedance-2.0-ref",
    family: "seedance",
    label: "Seedance 2.0 Reference",
    note: "Cinematic, native audio — requires a reference image",
    audio: true,
    maxDurationSec: 15,
    maxResolution: "1080p",
    aspects: SEEDANCE_ASPECTS,
    speed: "balanced",
    cost: "mid",
    strengths: ["cinematic", "photoreal", "film_grain", "portrait", "dialogue", "reference"],
    tier: "ByteDance Seedance 2.0 Reference",
    inputMode: "reference-to-video",
    durationSpec: "4–15s (or 'auto')",
    bestFor: [
      "ads that must match a brand/character/location reference",
      "21:9 anamorphic / scope deliveries with a hero reference",
    ],
    preferWhen: "the user has uploaded a brand, character, or location reference image",
    promptDialect: SEEDANCE_DIALECT,
  },
  {
    id: "seedance-2.0",
    family: "seedance",
    label: "Seedance 2.0",
    note: "Single image-to-video, native audio",
    audio: true,
    maxDurationSec: 15,
    maxResolution: "1080p",
    aspects: SEEDANCE_ASPECTS,
    speed: "balanced",
    cost: "mid",
    strengths: ["cinematic", "photoreal", "film_grain", "portrait", "dialogue", "reference"],
    tier: "ByteDance Seedance 2.0",
    inputMode: "reference-to-video",
    needs: "REQUIRED: 1 starting frame (image-to-video)",
    durationSpec: "4–15s (or 'auto')",
    bestFor: [
      "animate a single hero still with native audio",
      "cinematic 21:9 / 9:16 ads from one product or character frame",
    ],
    preferWhen: "the user has exactly ONE reference image and wants Seedance look + audio without multi-ref complexity",
    promptDialect: SEEDANCE_DIALECT,
  },
  {
    id: "seedance-v1-pro",
    family: "seedance",
    label: "Seedance 1 Pro",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: SEEDANCE_ASPECTS,
    speed: "balanced",
    cost: "mid",
    strengths: ["cinematic", "film_grain", "portrait"],
    tier: "ByteDance Seedance 1 / Pro",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["silent cinematic film-grain portrait/wide"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "you want Seedance's look without audio",
    promptDialect: SEEDANCE_DIALECT,
  },
  {
    id: "seedance-v1-lite",
    family: "seedance",
    label: "Seedance 1 Lite",
    note: "Faster, lower cost",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: SEEDANCE_ASPECTS,
    speed: "fast",
    cost: "low",
    strengths: ["cinematic", "stylized"],
    tier: "ByteDance Seedance 1 / Lite",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["cheap stylized cinematic drafts"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "cost is the deciding factor and audio isn't needed",
    promptDialect: SEEDANCE_DIALECT,
  },

  // ─── MiniMax Hailuo ────────────────────────────────────────────────────
  {
    id: "hailuo-02-pro",
    family: "hailuo",
    label: "Hailuo 02 Pro",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "1080p",
    aspects: ["16:9"],
    speed: "balanced",
    cost: "mid",
    strengths: ["stylized", "portrait", "anime", "complex_motion"],
    tier: "MiniMax Hailuo 02 / Pro",
    inputMode: "text-to-video",
    durationSpec: "fixed (model-defined)",
    bestFor: ["anime/stylized portraits with complex character motion", "2.5D illustration looks"],
    cannotDo: ["audio", "aspect:9:16", "aspect:1:1", "aspect:4:3", "aspect:3:4", "aspect:21:9"],
    preferWhen: "the brief asks for ANIME or strongly STYLIZED illustration in 16:9",
    promptDialect: HAILUO_DIALECT,
  },
  {
    id: "hailuo-02-standard",
    family: "hailuo",
    label: "Hailuo 02 Standard",
    audio: false,
    maxDurationSec: 6,
    maxResolution: "768p",
    aspects: ["16:9"],
    speed: "fast",
    cost: "low",
    strengths: ["stylized", "portrait", "anime"],
    tier: "MiniMax Hailuo 02 / Standard",
    inputMode: "text-to-video",
    durationSpec: "6s or 10s",
    bestFor: ["cheap anime/stylized 6–10s drafts at 768p"],
    cannotDo: ["audio", "aspect:9:16", "aspect:1:1", "aspect:4:3", "aspect:3:4", "aspect:21:9"],
    preferWhen: "you want Hailuo's anime look on a budget",
    promptDialect: HAILUO_DIALECT,
  },
  {
    id: "hailuo-01",
    family: "hailuo",
    label: "Hailuo 01",
    audio: false,
    maxDurationSec: 6,
    maxResolution: "768p",
    aspects: ["16:9"],
    speed: "fast",
    cost: "low",
    strengths: ["stylized", "anime"],
    tier: "MiniMax Hailuo 01",
    inputMode: "text-to-video",
    durationSpec: "fixed (~6s)",
    bestFor: ["legacy stylized/anime baseline"],
    cannotDo: ["audio", "aspect:9:16", "aspect:1:1", "aspect:4:3", "aspect:3:4", "aspect:21:9"],
    preferWhen: "only when explicitly requested",
    promptDialect: HAILUO_DIALECT,
  },

  // ─── Runway ────────────────────────────────────────────────────────────
  {
    id: "runway-gen3-turbo",
    family: "runway",
    label: "Runway Gen-3 Turbo",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: ["16:9", "9:16"],
    speed: "fast",
    cost: "mid",
    strengths: ["cinematic", "photoreal", "stylized"],
    tier: "Runway Gen-3 / Turbo",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["stylized cinematic with Runway's signature painterly look", "music-video moments"],
    cannotDo: ["audio", "aspect:1:1", "duration:!in:5,10"],
    preferWhen: "the brief specifically references Runway's aesthetic",
    promptDialect: RUNWAY_DIALECT,
  },

  // ─── Lightricks LTX ────────────────────────────────────────────────────
  {
    id: "ltx-video-13b",
    family: "ltx",
    label: "LTX Video 13B Distilled",
    audio: false,
    maxDurationSec: 5,
    maxResolution: "720p",
    aspects: STD,
    speed: "fast",
    cost: "low",
    strengths: ["stylized", "stable_subject"],
    tier: "Lightricks LTX Video 13B Distilled",
    inputMode: "text-to-video",
    durationSpec: "5s",
    bestFor: ["very fast 5s stylized drafts with stable subjects"],
    cannotDo: ["audio", "duration:!=5"],
    preferWhen: "you need the cheapest/fastest 5s preview",
    promptDialect: LTX_DIALECT,
  },
  {
    id: "ltx-video",
    family: "ltx",
    label: "LTX Video",
    audio: false,
    maxDurationSec: 5,
    maxResolution: "720p",
    aspects: STD,
    speed: "fast",
    cost: "low",
    strengths: ["stylized"],
    tier: "Lightricks LTX Video",
    inputMode: "text-to-video",
    durationSpec: "5s",
    bestFor: ["fast 5s stylized drafts"],
    cannotDo: ["audio", "duration:!=5"],
    preferWhen: "LTX 13B unavailable",
    promptDialect: LTX_DIALECT,
  },

  // ─── Alibaba Wan ───────────────────────────────────────────────────────
  {
    id: "wan-pro",
    family: "wan",
    label: "Wan Pro",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: STD,
    speed: "balanced",
    cost: "mid",
    strengths: ["photoreal", "stylized"],
    tier: "Alibaba Wan / Pro",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["photoreal/stylized 720p drafts with predictable motion"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "Kling/Seedance are unavailable and budget matters",
    promptDialect: WAN_DIALECT,
  },
  {
    id: "wan-v2.2-a14b",
    family: "wan",
    label: "Wan 2.2 A14B",
    audio: false,
    maxDurationSec: 10,
    maxResolution: "720p",
    aspects: STD,
    speed: "balanced",
    cost: "low",
    strengths: ["stylized"],
    tier: "Alibaba Wan 2.2 / A14B",
    inputMode: "text-to-video",
    durationSpec: "5s or 10s",
    bestFor: ["cheap stylized 720p iterations"],
    cannotDo: ["audio", "duration:!in:5,10"],
    preferWhen: "cost is the deciding factor for non-photoreal work",
    promptDialect: WAN_DIALECT,
  },
];

export const CATALOG_BY_ID: Record<string, ModelCapabilities> = Object.fromEntries(
  MODEL_CATALOG.map((m) => [m.id, m]),
);

export function getCapabilities(id: string): ModelCapabilities | undefined {
  return CATALOG_BY_ID[id];
}

/**
 * Legacy compact one-line summary (kept for backward compatibility with any
 * caller still using it). The Director agent now uses formatPlaybook() instead.
 */
export function catalogPromptLines(): string {
  return MODEL_CATALOG.map((m) => {
    const audio = m.audio ? "audio" : "no-audio";
    return `- ${m.id} — ${m.family}, max ${m.maxDurationSec}s, ${m.maxResolution}, ${audio}, ${m.speed}/${m.cost}, strengths: ${m.strengths.join("+")}`;
  }).join("\n");
}

// ────────────────────────────────────────────────────────────────────────
// Constraints + selection helpers (used by the director-agent edge function
// for runtime validation & auto-correction of LLM model picks).
// ────────────────────────────────────────────────────────────────────────

export type SelectionConstraints = {
  durationSec?: number;
  aspect?: string;
  needsAudio?: boolean;
  inputMode?: InputMode;        // hard input gate (motion-control / edit / reference)
  has4kRequest?: boolean;
  mode?: "draft" | "hero";      // soft preference for cheap/fast vs quality
};

/**
 * Parse a cannotDo token like "aspect:9:16" / "duration:!=8" / "duration:!in:5,10"
 * / "audio" / "requires:source_video" and return true if the constraint
 * VIOLATES the requested constraints (i.e. the model is disqualified).
 */
function violates(token: string, c: SelectionConstraints): boolean {
  if (token === "audio") return c.needsAudio === true;
  if (token === "requires:source_video") return c.inputMode !== "video-to-video-edit";
  if (token === "requires:driving_video") return c.inputMode !== "motion-control";
  if (token.startsWith("aspect:")) {
    const ratio = token.slice("aspect:".length);
    return c.aspect === ratio;
  }
  if (token.startsWith("duration:!=")) {
    const d = Number(token.slice("duration:!=".length));
    return c.durationSec !== undefined && c.durationSec !== d;
  }
  if (token.startsWith("duration:!in:")) {
    const allowed = token
      .slice("duration:!in:".length)
      .split(",")
      .map((s) => Number(s.trim()));
    return c.durationSec !== undefined && !allowed.includes(c.durationSec);
  }
  return false;
}

export type ScoredPick = {
  id: string;
  score: number;
  reason: string;
};

/**
 * Deterministic model picker — runs the same 4-step algorithm the LLM is
 * instructed to use, so we can validate/correct LLM picks server-side.
 * Returns ranked candidates (best first). Empty array means no model fits.
 */
export function rankModels(c: SelectionConstraints): ScoredPick[] {
  const out: ScoredPick[] = [];

  for (const m of MODEL_CATALOG) {
    // STEP 1 — Input gating (hard)
    if (c.inputMode && c.inputMode !== "text-to-video") {
      if (m.inputMode !== c.inputMode) continue;
    } else {
      // text-to-video request: skip models that REQUIRE special inputs
      if (m.inputMode === "video-to-video-edit" || m.inputMode === "motion-control") {
        continue;
      }
    }

    // STEP 2 — Capability gating (hard)
    if (c.durationSec !== undefined && m.maxDurationSec < c.durationSec) continue;
    if (c.aspect && !m.aspects.includes(c.aspect)) continue;
    if (c.needsAudio && !m.audio) continue;
    if (c.has4kRequest && m.id !== "kling-v3-4k") continue;

    // cannotDo tokens: any violation disqualifies
    if (m.cannotDo?.some((t) => violates(t, c))) continue;

    // STEP 3 — Soft score
    let score = 0;
    // Family / strength affinity
    if (c.needsAudio && m.audio) score += 3;
    // Cost / speed bias by mode
    if (c.mode === "draft") {
      if (m.cost === "low") score += 4;
      else if (m.cost === "mid") score += 2;
      if (m.speed === "fast") score += 3;
      else if (m.speed === "balanced") score += 1;
    } else if (c.mode === "hero") {
      if (m.cost === "high") score += 4;
      else if (m.cost === "mid") score += 2;
      if (m.speed === "slow") score += 2;
      else if (m.speed === "balanced") score += 1;
    } else {
      // No explicit mode — modest bias to "balanced" tiers
      if (m.cost === "mid") score += 2;
      if (m.speed === "balanced") score += 1;
    }
    // Mild preference for newer Kling/Veo/Seedance flagships
    if (m.id === "veo-3.1" || m.id === "seedance-v1-pro" || m.id === "kling-v3-pro" || m.id === "kling-omni") {
      score += 2;
    }

    const reason = buildReason(m, c);
    out.push({ id: m.id, score, reason });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

function buildReason(m: ModelCapabilities, c: SelectionConstraints): string {
  const bits: string[] = [];
  if (c.inputMode && c.inputMode !== "text-to-video") bits.push(`required input mode ${c.inputMode}`);
  if (c.needsAudio && m.audio) bits.push("native audio");
  if (c.durationSec !== undefined) bits.push(`${c.durationSec}s ≤ ${m.maxDurationSec}s`);
  if (c.aspect) bits.push(`${c.aspect} supported`);
  if (c.mode === "draft") bits.push(`${m.cost}-cost/${m.speed}-speed for drafts`);
  if (c.mode === "hero") bits.push(`${m.cost}-cost/${m.speed}-speed for hero quality`);
  return bits.length ? bits.join(", ") : "best fit for the brief";
}

/**
 * Apply Step 2b fallback: relax aspect → audio → duration in order until at
 * least one model survives. Returns the relaxed constraints + the order of
 * relaxations performed, or null if nothing survives even fully relaxed.
 */
export function fallbackPick(
  c: SelectionConstraints,
): { picks: ScoredPick[]; relaxed: string[] } | null {
  const relaxed: string[] = [];
  let cur = { ...c };
  let picks = rankModels(cur);
  if (picks.length) return { picks, relaxed };

  // 1. Drop aspect
  if (cur.aspect) {
    cur = { ...cur, aspect: undefined };
    relaxed.push("aspect");
    picks = rankModels(cur);
    if (picks.length) return { picks, relaxed };
  }
  // 2. Drop audio
  if (cur.needsAudio) {
    cur = { ...cur, needsAudio: false };
    relaxed.push("audio");
    picks = rankModels(cur);
    if (picks.length) return { picks, relaxed };
  }
  // 3. Drop duration
  if (cur.durationSec !== undefined) {
    cur = { ...cur, durationSec: undefined };
    relaxed.push("duration");
    picks = rankModels(cur);
    if (picks.length) return { picks, relaxed };
  }
  return null;
}

/**
 * Serialize the playbook into a dense system-prompt block. One entry ≈ 5–7
 * short lines.
 */
export function formatPlaybook(): string {
  return MODEL_CATALOG.map((m) => {
    const lines = [
      `• ${m.id} — ${m.tier} [${m.cost}-cost/${m.speed}-speed]`,
      `    input: ${m.inputMode}${m.needs ? ` | needs: ${m.needs}` : ""}`,
      `    duration: ${m.durationSpec} | aspect: ${m.aspects.join(", ")} | resolution: ${m.maxResolution} | audio: ${m.audio ? "native" : "none"}`,
      `    best for: ${m.bestFor.join("; ")}`,
    ];
    if (m.cannotDo && m.cannotDo.length) lines.push(`    cannot do: ${m.cannotDo.join(", ")}`);
    lines.push(`    prefer when: ${m.preferWhen}`);
    if (m.promptDialect) lines.push(`    prompt dialect: ${m.promptDialect}`);
    return lines.join("\n");
  }).join("\n");
}
