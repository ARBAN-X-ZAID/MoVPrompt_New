// Per-model render controls for the video generation dialog.
// Mirrors fal.ai input schemas — only fields the model actually accepts are
// surfaced in the UI and forwarded to the edge function.

export type DurationValue = number | "auto";

export type VideoOptions = {
  aspect_ratio?: string;
  duration?: DurationValue;
  resolution?: string;
  audio?: boolean;
  cfg_scale?: number;
  prompt_optimizer?: boolean;
};

export type ModelControls = {
  aspectRatios?: string[];
  /** Discrete set of allowed durations (slider snaps to these). */
  durations?: number[];
  /** Continuous range — used when a model accepts any integer duration in [min,max]. */
  durationMin?: number;
  durationMax?: number;
  durationStep?: number;
  /** Model also accepts `"auto"` as a duration value. */
  durationAuto?: boolean;
  resolutions?: string[];
  audio?: boolean;
  cfgScale?: boolean;
  promptOptimizer?: boolean;
  defaults: VideoOptions;
};

const STD_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const SEEDANCE_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];

const CONTROLS: Record<string, ModelControls> = {
  // Veo
  "veo-3.1": {
    aspectRatios: STD_ASPECTS,
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 8, resolution: "1080p", audio: true },
  },
  "veo-3.1-fast": {
    aspectRatios: STD_ASPECTS,
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 8, resolution: "1080p", audio: true },
  },
  "veo-3.1-lite": {
    aspectRatios: ["16:9", "9:16"],
    durations: [4, 6, 8],
    resolutions: ["720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 8, resolution: "1080p", audio: true },
  },
  "veo-3": {
    aspectRatios: ["16:9", "9:16"],
    durations: [8],
    resolutions: ["720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 8, resolution: "1080p", audio: true },
  },
  "veo-3-fast": {
    aspectRatios: ["16:9", "9:16"],
    durations: [8],
    resolutions: ["720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 8, resolution: "1080p", audio: true },
  },
  "veo-2": {
    aspectRatios: ["16:9", "9:16"],
    durations: [5, 6, 7, 8],
    resolutions: ["720p"],
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "720p" },
  },

  // Kling 3.0 Omni (o3 family) — text-to-video w/ multi-reference + native audio
  "kling-omni": {
    aspectRatios: STD_ASPECTS,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    resolutions: ["720p", "1080p", "4k"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "1080p", audio: false },
  },
  "kling-omni-edit": {
    aspectRatios: STD_ASPECTS,
    durations: [3, 4, 5, 6, 7, 8, 9, 10],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: 5, audio: false },
  },
  "kling-motion-control": {
    aspectRatios: STD_ASPECTS,
    durations: [5, 10],
    defaults: { aspect_ratio: "16:9", duration: 5 },
  },

  // Kling v3 — native audio + extended duration enum (Pro accepts 3–15)
  // Selecting "4k" routes server-side to the dedicated /v3/4k/text-to-video endpoint.
  "kling-v3-pro": {
    aspectRatios: STD_ASPECTS,
    durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    resolutions: ["720p", "1080p", "4k"],
    audio: true,
    cfgScale: true,
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "1080p", audio: true, cfg_scale: 0.5 },
  },
  "kling-v3-standard": {
    aspectRatios: STD_ASPECTS,
    durations: [5, 10],
    resolutions: ["720p", "1080p", "4k"],
    audio: true,
    cfgScale: true,
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "1080p", audio: true, cfg_scale: 0.5 },
  },
  "kling-v3-4k": {
    aspectRatios: STD_ASPECTS,
    durations: [5, 10],
    resolutions: ["4k"],
    audio: true,
    cfgScale: true,
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "4k", audio: true, cfg_scale: 0.5 },
  },

  // Kling (legacy v1–v2.5) — share aspect/duration/cfg_scale, no audio
  ...Object.fromEntries(
    [
      "kling-v2.5-turbo-pro",
      "kling-v2.1-master",
      "kling-v2-master",
      "kling-v1.6-pro",
      "kling-v1.6-standard",
      "kling-v1.5-pro",
      "kling-v1-pro",
      "kling-v1-standard",
    ].map((id) => [
      id,
      {
        aspectRatios: STD_ASPECTS,
        durations: [5, 10],
        cfgScale: true,
        defaults: { aspect_ratio: "16:9", duration: 5, cfg_scale: 0.5 },
      } as ModelControls,
    ]),
  ),

  // Seedance
  "seedance-2.0-ref": {
    aspectRatios: SEEDANCE_ASPECTS,
    durationMin: 4,
    durationMax: 15,
    durationStep: 1,
    durationAuto: true,
    resolutions: ["480p", "720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: "auto", resolution: "1080p", audio: true },
  },
  "seedance-2.0": {
    aspectRatios: SEEDANCE_ASPECTS,
    durationMin: 4,
    durationMax: 15,
    durationStep: 1,
    durationAuto: true,
    resolutions: ["480p", "720p", "1080p"],
    audio: true,
    defaults: { aspect_ratio: "16:9", duration: "auto", resolution: "1080p", audio: true },
  },
  "seedance-v1-pro": {
    aspectRatios: SEEDANCE_ASPECTS,
    durationMin: 3,
    durationMax: 12,
    durationStep: 1,
    resolutions: ["480p", "720p", "1080p"],
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "1080p" },
  },
  "seedance-v1-lite": {
    aspectRatios: SEEDANCE_ASPECTS,
    durationMin: 3,
    durationMax: 12,
    durationStep: 1,
    resolutions: ["480p", "720p", "1080p"],
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "720p" },
  },

  // Hailuo
  // hailuo-02-pro and hailuo-01 do not expose a duration parameter — fixed length.
  "hailuo-02-pro": {
    aspectRatios: ["16:9"],
    resolutions: ["768p", "1080p"],
    promptOptimizer: true,
    defaults: { aspect_ratio: "16:9", resolution: "1080p", prompt_optimizer: true },
  },
  "hailuo-02-standard": {
    aspectRatios: ["16:9"],
    durations: [6, 10],
    resolutions: ["768p"],
    defaults: { aspect_ratio: "16:9", duration: 6, resolution: "768p" },
  },
  "hailuo-01": {
    aspectRatios: ["16:9"],
    defaults: { aspect_ratio: "16:9" },
  },

  // Runway
  "runway-gen3-turbo": {
    aspectRatios: ["16:9", "9:16"],
    durations: [5, 10],
    defaults: { aspect_ratio: "16:9", duration: 5 },
  },

  // LTX
  "ltx-video-13b": {
    aspectRatios: STD_ASPECTS,
    durations: [5],
    defaults: { aspect_ratio: "16:9", duration: 5 },
  },
  "ltx-video": {
    aspectRatios: STD_ASPECTS,
    durations: [5],
    defaults: { aspect_ratio: "16:9", duration: 5 },
  },

  // Wan
  "wan-pro": {
    aspectRatios: STD_ASPECTS,
    durations: [5, 10],
    resolutions: ["480p", "720p"],
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "720p" },
  },
  "wan-v2.2-a14b": {
    aspectRatios: STD_ASPECTS,
    durations: [5, 10],
    resolutions: ["480p", "720p"],
    defaults: { aspect_ratio: "16:9", duration: 5, resolution: "720p" },
  },
};

const FALLBACK: ModelControls = {
  aspectRatios: ["16:9"],
  defaults: { aspect_ratio: "16:9" },
};

// Universal Prompt ("Any model") — exposes a generic duration range for prompt pacing.
const UNIVERSAL: ModelControls = {
  aspectRatios: STD_ASPECTS,
  durationMin: 5,
  durationMax: 15,
  durationStep: 1,
  defaults: { aspect_ratio: "16:9", duration: 10 },
};

export function getModelControls(modelId: string): ModelControls {
  if (modelId === "any") return UNIVERSAL;
  return CONTROLS[modelId] ?? FALLBACK;
}

