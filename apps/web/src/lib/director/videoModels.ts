// Shared registry of video-generation models exposed to the Director.
// Keys are stable IDs sent to the `generate-video` edge function; the edge
// function maps them to fal.ai endpoints. Keep the two lists in sync.

export type VideoModelId = string;

export type VideoModel = {
  id: VideoModelId;
  label: string;
  family: "kling" | "seedance" | "veo" | "hailuo" | "runway" | "ltx" | "wan";
  note?: string;
  /** When true, this model must have at least one reference image attached. */
  requiresReference?: boolean;
};

export type VideoModelGroup = {
  label: string;
  models: VideoModel[];
};

export const VIDEO_MODEL_GROUPS: VideoModelGroup[] = [
  {
    label: "Kuaishou — Kling",
    models: [
      { id: "kling-omni", label: "Kling 3.0 Omni", family: "kling", note: "Omni multi-reference, characters + elements" },
      { id: "kling-omni-edit", label: "Kling 3.0 Omni Edit", family: "kling", note: "Edit / restyle an existing video" },
      { id: "kling-motion-control", label: "Kling 3.0 Motion Control", family: "kling", note: "Drive a character with a reference video" },
      { id: "kling-v3-pro", label: "Kling 3.0 Pro", family: "kling", note: "Newest, native audio, multi-shot" },
      { id: "kling-v3-standard", label: "Kling 3.0 Standard", family: "kling", note: "Native audio, multi-shot" },
      { id: "kling-v3-4k", label: "Kling 3.0 4K", family: "kling", note: "Native 4K output" },
      { id: "kling-v2.5-turbo-pro", label: "Kling 2.5 Turbo Pro", family: "kling", note: "Latest, fastest pro tier" },
      { id: "kling-v2.1-master", label: "Kling 2.1 Master", family: "kling" },
      { id: "kling-v2-master", label: "Kling 2 Master", family: "kling" },
      { id: "kling-v1.6-pro", label: "Kling 1.6 Pro", family: "kling" },
      { id: "kling-v1.6-standard", label: "Kling 1.6 Standard", family: "kling" },
      { id: "kling-v1.5-pro", label: "Kling 1.5 Pro", family: "kling" },
      { id: "kling-v1-pro", label: "Kling 1.0 Pro", family: "kling" },
      { id: "kling-v1-standard", label: "Kling 1.0 Standard", family: "kling" },
    ],
  },
  {
    label: "Google — Veo",
    models: [
      { id: "veo-3.1", label: "Veo 3.1", family: "veo", note: "Latest, native audio" },
      { id: "veo-3.1-fast", label: "Veo 3.1 Fast", family: "veo" },
      { id: "veo-3.1-lite", label: "Veo 3.1 Lite", family: "veo", note: "Faster, lower cost" },
      { id: "veo-3", label: "Veo 3", family: "veo" },
      { id: "veo-3-fast", label: "Veo 3 Fast", family: "veo" },
      { id: "veo-2", label: "Veo 2", family: "veo" },
    ],
  },
  {
    label: "ByteDance — Seedance",
    models: [
      { id: "seedance-2.0-ref", label: "Seedance 2.0 Reference", family: "seedance", note: "Multi-reference identity lock (up to 9 images) + native audio", requiresReference: true },
      { id: "seedance-2.0", label: "Seedance 2.0", family: "seedance", note: "Single image-to-video + native audio", requiresReference: true },
      { id: "seedance-v1-pro", label: "Seedance 1 Pro", family: "seedance" },
      { id: "seedance-v1-lite", label: "Seedance 1 Lite", family: "seedance", note: "Faster, lower cost" },
    ],
  },
  {
    label: "MiniMax — Hailuo",
    models: [
      { id: "hailuo-02-pro", label: "Hailuo 02 Pro", family: "hailuo" },
      { id: "hailuo-02-standard", label: "Hailuo 02 Standard", family: "hailuo" },
      { id: "hailuo-01", label: "Hailuo 01", family: "hailuo" },
    ],
  },
  {
    label: "Runway",
    models: [
      { id: "runway-gen3-turbo", label: "Runway Gen-3 Turbo", family: "runway" },
    ],
  },
  {
    label: "Lightricks — LTX",
    models: [
      { id: "ltx-video-13b", label: "LTX Video 13B Distilled", family: "ltx" },
      { id: "ltx-video", label: "LTX Video", family: "ltx" },
    ],
  },
  {
    label: "Alibaba — Wan",
    models: [
      { id: "wan-pro", label: "Wan Pro", family: "wan" },
      { id: "wan-v2.2-a14b", label: "Wan 2.2 A14B", family: "wan" },
    ],
  },
];

export const ALL_VIDEO_MODELS: VideoModel[] = VIDEO_MODEL_GROUPS.flatMap((g) => g.models);

export function findVideoModel(id: string): VideoModel | undefined {
  return ALL_VIDEO_MODELS.find((m) => m.id === id);
}

/**
 * Heuristic: pick the closest model id from a free-form recommendation
 * string (e.g. "Veo 3.1" → veo-3, "Kling 2.5 turbo" → kling-v2.5-turbo-pro).
 */
export function pickRecommendedModel(rec?: string): VideoModel {
  const r = (rec || "").toLowerCase();
  if (!r) return ALL_VIDEO_MODELS[0];

  // Family detection
  let family: VideoModel["family"] | null = null;
  if (/kling/.test(r)) family = "kling";
  else if (/veo/.test(r)) family = "veo";
  else if (/seedance|seed dance|seed-dance/.test(r)) family = "seedance";
  else if (/hailuo|minimax/.test(r)) family = "hailuo";
  else if (/runway|gen-?3/.test(r)) family = "runway";
  else if (/\bltx\b/.test(r)) family = "ltx";
  else if (/\bwan\b/.test(r)) family = "wan";

  if (!family) return ALL_VIDEO_MODELS[0];
  const inFamily = ALL_VIDEO_MODELS.filter((m) => m.family === family);

  // Try to match a version token e.g. "2.5", "1.6", "3"
  const versionMatch = r.match(/(\d+(?:\.\d+)?)/);
  if (versionMatch) {
    const v = versionMatch[1];
    const exact = inFamily.find((m) => m.id.includes(`v${v}`) || m.id.includes(`-${v}`));
    if (exact) return exact;
  }
  return inFamily[0];
}
