import { VERIFIED_PREVIEW_TEMPLATE_IDS } from "./verified-preview-manifest.js";

/** Media revision and recipe revision are explicit, not inferred from the latest recipe.
 * Keep this outside the activation manifest, which legacy demo tooling regenerates.
 */
export function getVerifiedTemplatePreview(templateId: string): {
  objectKey: string;
  durationSeconds: number;
  recipeVersion: number;
} | undefined {
  if (!(VERIFIED_PREVIEW_TEMPLATE_IDS as readonly string[]).includes(templateId)) return undefined;
  if (templateId === "jewelry-product-showcase") {
    return { objectKey: "templates/v3/jewelry-product-showcase-animation.mp4", durationSeconds: 8, recipeVersion: 3 };
  }
  return { objectKey: `templates/v1/${templateId}.mp4`, durationSeconds: 8, recipeVersion: 1 };
}
