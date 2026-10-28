import { createHash } from "node:crypto";
import { z } from "zod";
import type { CreativeTemplateRecipe } from "@movprompt/creative-engine";
import { AdminReasonSchema } from "@movprompt/contracts";

export const TemplatePublishInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    draftRevision: z.number().int().positive(),
    reason: AdminReasonSchema,
  })
  .strict();
export const TemplateRollbackInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    versionId: z.string().regex(/^[a-f0-9]{24}$/i),
    reason: AdminReasonSchema,
  })
  .strict();
export const TemplateDuplicateInputSchema = z
  .object({
    slug: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
    name: z
      .object({
        en: z.string().trim().min(1).max(120),
        ar: z.string().trim().min(1).max(120),
      })
      .strict(),
    reason: AdminReasonSchema,
  })
  .strict();
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
/** Excludes only metadata and form presentation. Every value capable of changing
 * a shot, sound or reference interpretation stays in the evidence fingerprint. */
export function templateOutputHash(definition: CreativeTemplateRecipe): string {
  const {
    versionNumber: _version,
    localizedName: _name,
    localizedDescription: _description,
    category: _category,
    discoveryCategory: _discovery,
    tags: _tags,
    sortOrder: _sortOrder,
    outcome: _outcome,
    managedForm: _form,
    ...output
  } = definition;
  return createHash("sha256").update(canonical(output)).digest("hex");
}
export function templateDefinitionChanges(
  before: unknown,
  after: unknown,
  prefix = "",
): string[] {
  const a =
    before && typeof before === "object"
      ? (before as Record<string, unknown>)
      : {};
  const b =
    after && typeof after === "object"
      ? (after as Record<string, unknown>)
      : {};
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .flatMap((key) => {
      if (canonical(a[key]) === canonical(b[key])) return [];
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        a[key] &&
        b[key] &&
        typeof a[key] === "object" &&
        typeof b[key] === "object" &&
        !Array.isArray(a[key]) &&
        !Array.isArray(b[key])
      )
        return templateDefinitionChanges(a[key], b[key], path);
      return [path];
    });
}
