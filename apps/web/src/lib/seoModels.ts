import { MODEL_GROUPS } from "./models";

export interface ModelFamily {
  slug: string;            // URL slug, e.g. "veo", "kling", "seedance"
  name: string;            // Display name
  vendor: string;          // Vendor label
  tagline: string;
  intro: string;           // 1–2 paragraph SEO intro
  bestFor: string[];       // Bullet list
  tips: string[];          // Prompting tips
  modelValues: string[];   // matches model `value` field used in DB
}

export const MODEL_FAMILIES: ModelFamily[] = [
  {
    slug: "veo",
    name: "Google Veo",
    vendor: "Google DeepMind",
    tagline: "Cinematic prompts for Veo 3 and Veo 3.1",
    intro:
      "Google Veo rewards precise cinematography language: lens, movement, lighting and physically grounded action. MovPrompt's AI Director crafts prompts tuned for Veo 3 and Veo 3.1 — including audio cues — so your shots feel directed, not generated.",
    bestFor: [
      "Photoreal scenes with believable physics",
      "Native synchronized dialogue and ambience",
      "Cinematic camera moves with explicit lens choices",
    ],
    tips: [
      "Lead with subject + action, then camera, then lighting.",
      "Keep one clear motion verb per shot — Veo handles intent better than lists.",
      "Use Veo's native audio block for dialogue, foley and ambience.",
    ],
    modelValues: MODEL_GROUPS.find((g) => g.label === "Google")?.models.map((m) => m.value) ?? [],
  },
  {
    slug: "kling",
    name: "Kling",
    vendor: "Kuaishou",
    tagline: "Director-grade prompts for Kling 2.5 → 3.0 Omni",
    intro:
      "Kling responds beautifully to motion arcs, costume and material detail, and clean negative prompts. MovPrompt builds Kling-tuned prompts that respect its strengths — graceful character motion, fabric, hair and rim-lit faces — while suppressing common artifacts.",
    bestFor: [
      "Character-led shots with elegant motion",
      "Editorial fashion, music videos, dance",
      "Image-to-video with strong identity preservation",
    ],
    tips: [
      "Describe the arc of motion, not just the pose.",
      "Use Kling's negative prompt to kill warping, extra fingers and seam artifacts.",
      "Keep camera moves modest — Kling shines on intimate framings.",
    ],
    modelValues: MODEL_GROUPS.find((g) => g.label === "Kuaishou (Kling)")?.models.map((m) => m.value) ?? [],
  },
  {
    slug: "seedance",
    name: "Seedance",
    vendor: "ByteDance",
    tagline: "Fast, punchy prompts for Seedance Pro and 2.0",
    intro:
      "Seedance is fast, expressive and loves bold visual direction. MovPrompt writes Seedance prompts that give the model exactly the structure it wants — shot type, motion, mood — without drowning it in adjectives.",
    bestFor: [
      "High-energy social cuts and ad shots",
      "Stylized, graphic looks and color-forward grades",
      "Iterative re-rolls when speed matters",
    ],
    tips: [
      "One mood, one motion, one lens — Seedance prefers focus.",
      "Push grade and color language hard; it responds to bold direction.",
      "Use shorter prompts than you would for Veo or Kling.",
    ],
    modelValues: MODEL_GROUPS.find((g) => g.label === "ByteDance (Seedance)")?.models.map((m) => m.value) ?? [],
  },
];

export function getFamilyBySlug(slug: string): ModelFamily | undefined {
  return MODEL_FAMILIES.find((f) => f.slug === slug);
}
