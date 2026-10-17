import { z } from "zod";

export const NATIVE_UGC_TEMPLATE_IDS = ["female-product-review", "ad-studio-brand-ad"] as const;
export function supportsNativeUgc(templateId: string): boolean {
  return (NATIVE_UGC_TEMPLATE_IDS as readonly string[]).includes(templateId);
}

/** Generic native voice direction only. No provider IDs, real-person voices or cloning. */
export const NativeUgcSettingsSchema = z.object({
  version: z.literal(1),
  enabled: z.boolean(),
  characterStyle: z.enum(["realistic_adult", "illustrated_adult", "reference_adult"]),
  script: z.string().trim().max(500),
  delivery: z.enum(["warm", "confident", "calm"]),
  scriptApproved: z.boolean(),
  approvedLanguage: z.enum(["en", "ar", "bilingual"]).optional(),
}).strict();
export type NativeUgcSettings = z.infer<typeof NativeUgcSettingsSchema>;

export function defaultNativeUgcSettings(): NativeUgcSettings {
  return { version: 1, enabled: false, characterStyle: "realistic_adult", script: "", delivery: "warm", scriptApproved: false };
}

export function nativeUgcScriptLimit(durationSeconds: number): number {
  return Math.max(1, Math.floor(durationSeconds * 2));
}

export function nativeUgcIssues(input: { templateId: string; settings?: NativeUgcSettings; language: string; durationSeconds: number; audio: boolean; characterCount: number }): string[] {
  if (!input.settings) return [];
  if (!supportsNativeUgc(input.templateId)) return ["native_ugc_template_unsupported"];
  const value = NativeUgcSettingsSchema.parse(input.settings);
  const issues: string[] = [];
  if (value.enabled && (value.characterStyle === "reference_adult" || input.characterCount > 0)) issues.push("native_ugc_person_reference_unavailable");
  if (value.characterStyle === "reference_adult" && input.characterCount === 0) issues.push("native_ugc_character_required");
  if (value.characterStyle !== "reference_adult" && input.characterCount > 0) issues.push("native_ugc_unselect_character");
  if (!value.enabled) return issues;
  if (!input.audio) issues.push("native_ugc_audio_required");
  if (!value.script.trim()) issues.push("native_ugc_script_required");
  if (!value.scriptApproved || value.approvedLanguage !== input.language) issues.push("native_ugc_script_approval_required");
  const words = value.script.trim().split(/\s+/u).filter(Boolean).length;
  if (words > nativeUgcScriptLimit(input.durationSeconds) || Array.from(value.script).length > input.durationSeconds * 14) issues.push("native_ugc_script_too_long");
  return issues;
}
