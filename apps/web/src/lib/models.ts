export interface ModelOption {
  value: string;
  label: string;
  descriptionKey: string;
  /** Native audio support (dialogue / SFX / music in-frame). Shown as an AUDIO badge in the picker. */
  audio?: boolean;
  /**
   * When set, this entry is hidden from the picker unless the model_id
   * matching `availabilityKey` is marked `available = true` in the
   * `model_availability` table. Lets us pre-wire new gateway models
   * (e.g. Gemini Omni Flash) and reveal them automatically when they land.
   */
  gated?: { availabilityKey: string };
}

export interface ModelGroup {
  label: string;
  models: ModelOption[];
}

export const MODEL_GROUPS: ModelGroup[] = [
  {
    label: "Kuaishou (Kling)",
    models: [
      // Kling 3.0 family — native audio
      { value: "kling-3.0", label: "Kling 3.0", descriptionKey: "models.desc.kling-3.0", audio: true },
      { value: "kling-3.0-pro", label: "Kling 3.0 Pro", descriptionKey: "models.desc.kling-3.0-pro", audio: true },
      { value: "kling-3.0-standard", label: "Kling 3.0 Standard", descriptionKey: "models.desc.kling-3.0-standard", audio: true },
      { value: "kling-3.0-4k", label: "Kling 3.0 4K", descriptionKey: "models.desc.kling-3.0-4k", audio: true },
      { value: "kling-3.0-omni", label: "Kling 3.0 Omni", descriptionKey: "models.desc.kling-3.0-omni", audio: true },
      { value: "kling-3.0-omni-edit", label: "Kling 3.0 Omni Edit", descriptionKey: "models.desc.kling-3.0-omni-edit", audio: true },
      { value: "kling-3.0-motion-control", label: "Kling 3.0 Motion Control", descriptionKey: "models.desc.kling-3.0-motion-control" },
      // Kling 2.x — no native audio
      { value: "kling-2.6", label: "Kling 2.6", descriptionKey: "models.desc.kling-2.6" },
      { value: "kling-2.5-turbo", label: "Kling 2.5 Turbo", descriptionKey: "models.desc.kling-2.5-turbo" },
      { value: "kling-2.1-master", label: "Kling 2.1 Master", descriptionKey: "models.desc.kling-2.1-master" },
      { value: "kling-2-master", label: "Kling 2 Master", descriptionKey: "models.desc.kling-2-master" },
      // Kling O1 reasoning line
      { value: "kling-o1-video", label: "Kling O1 Video", descriptionKey: "models.desc.kling-o1-video" },
      { value: "kling-o1-video-edit", label: "Kling O1 Video Edit", descriptionKey: "models.desc.kling-o1-video-edit" },
      // Legacy 1.x
      { value: "kling-1.6-pro", label: "Kling 1.6 Pro", descriptionKey: "models.desc.kling-1.6-pro" },
      { value: "kling-1.6-standard", label: "Kling 1.6 Standard", descriptionKey: "models.desc.kling-1.6-standard" },
      { value: "kling-motion-control", label: "Kling Motion Control", descriptionKey: "models.desc.kling-motion-control" },
    ],
  },
  {
    label: "Google",
    models: [
      { value: "veo-3.1", label: "Veo 3.1", descriptionKey: "models.desc.veo-3.1", audio: true },
      { value: "veo-3.1-fast", label: "Veo 3.1 Fast", descriptionKey: "models.desc.veo-3.1-fast", audio: true },
      { value: "veo-3.1-lite", label: "Veo 3.1 Lite", descriptionKey: "models.desc.veo-3.1-lite", audio: true },
      { value: "veo-3", label: "Veo 3", descriptionKey: "models.desc.veo-3", audio: true },
      { value: "veo-3-fast", label: "Veo 3 Fast", descriptionKey: "models.desc.veo-3-fast", audio: true },
      { value: "veo-2", label: "Veo 2", descriptionKey: "models.desc.veo-2" },
      {
        value: "gemini-omni-flash",
        label: "Gemini Omni Flash",
        descriptionKey: "models.desc.gemini-omni-flash",
        audio: true,
        gated: { availabilityKey: "google/gemini-omni-flash" },
      },
    ],
  },

  {
    label: "ByteDance (Seedance)",
    models: [
      { value: "seedance-2.0", label: "Seedance 2.0", descriptionKey: "models.desc.seedance-2.0", audio: true },
      { value: "seedance-2.0-fast", label: "Seedance 2.0 Fast", descriptionKey: "models.desc.seedance-2.0-fast", audio: true },
      { value: "seedance-1.5-pro", label: "Seedance 1.5 Pro", descriptionKey: "models.desc.seedance-1.5-pro" },
      { value: "seedance-pro", label: "Seedance Pro", descriptionKey: "models.desc.seedance-pro" },
      { value: "seedance-pro-fast", label: "Seedance Pro Fast", descriptionKey: "models.desc.seedance-pro-fast" },
    ],
  },
];

export function getModelLabel(value: string): string {
  if (value === "any") return "Any Model";
  for (const group of MODEL_GROUPS) {
    const m = group.models.find((m) => m.value === value);
    if (m) return m.label;
  }
  return value;
}

export function getModelOption(value: string): ModelOption | undefined {
  for (const group of MODEL_GROUPS) {
    const m = group.models.find((m) => m.value === value);
    if (m) return m;
  }
  return undefined;
}
