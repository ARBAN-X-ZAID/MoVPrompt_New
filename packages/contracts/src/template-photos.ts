import { z } from "zod";

export const TemplatePhotoRoleSchema = z.enum(["subject", "character", "property", "artwork"]);
export type TemplatePhotoRole = z.infer<typeof TemplatePhotoRoleSchema>;

export const TemplatePhotoPolicySchema = z.object({
  version: z.literal(1),
  groups: z.array(z.object({
    role: TemplatePhotoRoleSchema,
    min: z.number().int().min(0).max(5),
    max: z.number().int().min(1).max(5),
  }).strict()).min(1).max(2),
}).strict();
export type TemplatePhotoPolicy = z.infer<typeof TemplatePhotoPolicySchema>;

/** Photo-driven identity is distinct from the gated footage/avatar presenter path.
 * This attestation is embedded on each owned reference, binding permission and
 * adult identity to that exact asset in the immutable campaign configuration.
 */
export const PhotoReferencePresenterSchema = z.object({
  referenceRole: z.literal("character"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  personRightsConfirmed: z.literal(true),
}).passthrough();
export type PhotoReferencePresenter = z.infer<typeof PhotoReferencePresenterSchema>;

/** This attestation travels with the exact character asset, never a campaign-wide checkbox. */
export const TemplatePhotoMetadataShape = {
  referenceRole: TemplatePhotoRoleSchema.optional(),
  selected: z.boolean().optional(),
  personRightsConfirmed: z.literal(true).optional(),
};

export type TemplatePhotoReference = {
  referenceRole?: TemplatePhotoRole | undefined;
  mimeType?: string | undefined;
  personRightsConfirmed?: true | undefined;
};

export function templatePhotoIssues(policy: TemplatePhotoPolicy, photos: readonly TemplatePhotoReference[]): string[] {
  const issues: string[] = [];
  const defaultRole = policy.groups[0]!.role;
  for (const photo of photos) {
    const role = photo.referenceRole ?? defaultRole;
    if (!policy.groups.some(group => group.role === role)) issues.push("photo_role_unsupported");
    if (photo.mimeType && !["image/jpeg", "image/png", "image/webp"].includes(photo.mimeType)) issues.push("photo_type_unsupported");
    if (role === "character" && photo.personRightsConfirmed !== true) issues.push("character_rights_required");
    if (role === "character" && !PhotoReferencePresenterSchema.safeParse(photo).success && photo.personRightsConfirmed === true) issues.push("character_photo_invalid");
  }
  for (const group of policy.groups) {
    const count = photos.filter(photo => (photo.referenceRole ?? defaultRole) === group.role).length;
    if (count < group.min) issues.push(`${group.role}_photos_required`);
    if (count > group.max) issues.push(`${group.role}_photo_limit_${group.max}`);
  }
  return [...new Set(issues)];
}
