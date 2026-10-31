import { z } from "zod";
import { TemplateDiscoveryCategorySchema } from "./creator.js";

/** Bilingual is gone from the product, so an owner can only offer these two. */
export const TEMPLATE_SELECTABLE_LANGUAGES = ["en", "ar"] as const;
export const TemplateSelectableLanguageSchema = z.enum(TEMPLATE_SELECTABLE_LANGUAGES);
export type TemplateSelectableLanguage = z.infer<typeof TemplateSelectableLanguageSchema>;

/** Public catalog copy is capped at 240 characters, so overrides must fit it. */
export const TEMPLATE_SETTING_LIMITS = {
  name: 120,
  description: 240,
  outcome: 240,
  tag: 40,
  tags: 20,
  sortOrder: 100_000,
} as const;

function localizedSetting(max: number) {
  return z
    .object({ en: z.string().trim().min(1).max(max), ar: z.string().trim().min(1).max(max) })
    .strict();
}

const distinct = <T>(values: readonly T[]) => new Set(values).size === values.length;

const TemplateTagsSchema = z
  .array(z.string().trim().min(1).max(TEMPLATE_SETTING_LIMITS.tag))
  .max(TEMPLATE_SETTING_LIMITS.tags)
  .refine(tags => distinct(tags.map(tag => tag.toLocaleLowerCase())), "Use each tag once.");

const TemplateEnabledLanguagesSchema = z
  .array(TemplateSelectableLanguageSchema)
  .min(1)
  .max(TEMPLATE_SELECTABLE_LANGUAGES.length)
  .refine(distinct, "Choose each language once.");

const TemplateSortOrderSchema = z.number().int().min(0).max(TEMPLATE_SETTING_LIMITS.sortOrder);

/**
 * Owner settings that live on the catalog head beside the immutable version.
 * Omit a field to leave it alone; send null to go back to the version's value.
 */
export const AdminTemplateDetailsSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    displayName: localizedSetting(TEMPLATE_SETTING_LIMITS.name).nullable().optional(),
    displayDescription: localizedSetting(TEMPLATE_SETTING_LIMITS.description).nullable().optional(),
    displayOutcome: localizedSetting(TEMPLATE_SETTING_LIMITS.outcome).nullable().optional(),
    category: z.string().trim().min(1).max(80).nullable().optional(),
    discoveryCategory: TemplateDiscoveryCategorySchema.nullable().optional(),
    tags: TemplateTagsSchema.nullable().optional(),
    sortOrder: TemplateSortOrderSchema.nullable().optional(),
    enabledLanguages: TemplateEnabledLanguagesSchema.nullable().optional(),
  })
  .strict()
  .refine(
    input => Object.keys(input).some(field => field !== "expectedRevision"),
    "Change at least one template setting.",
  );
export type AdminTemplateDetails = z.infer<typeof AdminTemplateDetailsSchema>;

/** Head fields written by the details route. Absent means the version's value applies. */
export const AdminTemplateOverridesSchema = z
  .object({
    displayName: localizedSetting(TEMPLATE_SETTING_LIMITS.name).nullable(),
    displayDescription: localizedSetting(TEMPLATE_SETTING_LIMITS.description).nullable(),
    displayOutcome: localizedSetting(TEMPLATE_SETTING_LIMITS.outcome).nullable(),
    category: z.string().nullable(),
    discoveryCategory: TemplateDiscoveryCategorySchema.nullable(),
    tags: z.array(z.string()).nullable(),
    sortOrder: TemplateSortOrderSchema.nullable(),
    enabledLanguages: z.array(TemplateSelectableLanguageSchema).nullable(),
  })
  .strict();
export type AdminTemplateOverrides = z.infer<typeof AdminTemplateOverridesSchema>;

export const AdminTemplateDetailsResultSchema = z
  .object({ id: z.string(), revision: z.number().int().min(0), overrides: AdminTemplateOverridesSchema })
  .strict();
export type AdminTemplateDetailsResult = z.infer<typeof AdminTemplateDetailsResultSchema>;

/**
 * Availability choices the version can honor. A head choice that no longer
 * overlaps a later version is stale, not a request to hide the template.
 */
function availableOptions<T>(supported: readonly T[], enabled: unknown): T[] {
  if (!Array.isArray(enabled)) return [...supported];
  const available = supported.filter(option => enabled.includes(option));
  return available.length ? available : [...supported];
}

export function effectiveTemplateLanguages<T extends string>(supported: readonly T[], enabled: unknown): T[] {
  return availableOptions(supported, enabled);
}

export function effectiveTemplateDurations<T extends number>(supported: readonly T[], enabled: unknown): T[] {
  return availableOptions(supported, enabled);
}
