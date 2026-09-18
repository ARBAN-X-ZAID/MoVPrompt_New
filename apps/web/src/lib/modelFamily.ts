import { MODEL_GROUPS, getModelLabel } from "./models";

export type ModelFamily = "kling" | "seedance" | "veo" | "sora" | "runway" | "other";

export const FAMILY_META: Record<
  ModelFamily,
  { label: string; gradient: string; ring: string; accent: string }
> = {
  kling: {
    label: "Kling",
    gradient: "from-violet-700/40 via-violet-900/30 to-fuchsia-900/40",
    ring: "ring-violet-500/30",
    accent: "text-violet-300",
  },
  seedance: {
    label: "Seedance",
    gradient: "from-emerald-700/40 via-emerald-900/30 to-teal-900/40",
    ring: "ring-emerald-500/30",
    accent: "text-emerald-300",
  },
  veo: {
    label: "Veo",
    gradient: "from-blue-700/40 via-blue-900/30 to-indigo-900/40",
    ring: "ring-blue-500/30",
    accent: "text-blue-300",
  },
  sora: {
    label: "Sora",
    gradient: "from-cyan-600/40 via-fuchsia-700/30 to-pink-700/40",
    ring: "ring-cyan-500/30",
    accent: "text-cyan-300",
  },
  runway: {
    label: "Runway",
    gradient: "from-rose-700/40 via-red-900/30 to-orange-900/40",
    ring: "ring-rose-500/30",
    accent: "text-rose-300",
  },
  other: {
    label: "Other",
    gradient: "from-zinc-700/40 via-zinc-800/30 to-zinc-900/40",
    ring: "ring-zinc-500/30",
    accent: "text-zinc-300",
  },
};

export function modelFamily(slug: string): ModelFamily {
  const s = (slug || "").toLowerCase();
  if (s.startsWith("kling")) return "kling";
  if (s.startsWith("seedance")) return "seedance";
  if (s.startsWith("veo")) return "veo";
  if (s.startsWith("sora")) return "sora";
  if (s.startsWith("runway") || s.startsWith("gen-")) return "runway";
  return "other";
}

export const ALL_FAMILIES: ModelFamily[] = ["kling", "seedance", "veo", "sora", "runway"];

export function variantsForFamily(family: ModelFamily): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const group of MODEL_GROUPS) {
    for (const m of group.models) {
      if (modelFamily(m.value) === family) out.push({ value: m.value, label: m.label });
    }
  }
  return out;
}

export function friendlyModelLabel(slug: string): string {
  if (!slug || slug === "any") return "Any";
  return getModelLabel(slug);
}

// First N keywords from a prompt, lightly cleaned.
export function topKeywords(text: string, n = 3): string[] {
  if (!text) return [];
  const stop = new Set([
    "the","a","an","of","and","or","to","in","on","with","for","is","are","this","that",
    "by","at","as","it","be","from","into","onto","over","under","its","their","they",
  ]);
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stop.has(w));
  const out: string[] = [];
  for (const w of words) {
    if (!out.includes(w)) out.push(w);
    if (out.length >= n) break;
  }
  return out;
}
