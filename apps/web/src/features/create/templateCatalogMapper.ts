import { mediaBaseUrl } from "./templateMedia";
import type { PublicTemplate } from "@movprompt/contracts";

import { getCreatorTemplate, creatorTemplateFromRecipe, registerCreatorTemplate, registerTemplateSettings, type TemplateSettings } from "./templates";
import { CreativeTemplateRecipeSchema } from "@movprompt/creative-engine";
import { isFeatureEnabled } from "@/config/features";
import type { CreatorTemplate } from "./types";

/** Everything an owner can change from the admin panel without a new version. */
export function templateSettingsFromCatalog(template: PublicTemplate): TemplateSettings {
  return {
    name: template.name.en,
    nameAr: template.name.ar,
    description: template.description.en,
    descriptionAr: template.description.ar,
    bestFor: template.localizedOutcome?.en ?? template.outcome,
    ...(template.localizedOutcome ? { bestForAr: template.localizedOutcome.ar } : {}),
    eyebrow: template.category.replace(/-/g, " "),
    discoveryCategory: template.discoveryCategory,
    languages: template.supportedLanguages,
    tags: template.tags,
    ...(template.supportedDurations ? { supportedDurations: template.supportedDurations } : {}),
  };
}

export function creatorTemplateFromCatalog(template: PublicTemplate): CreatorTemplate {
  const settings = templateSettingsFromCatalog(template);
  registerTemplateSettings(template.slug, settings);
  const media = template.managedMedia ? {
    ...(template.managedMedia.poster ? {poster:mediaBaseUrl+template.managedMedia.poster}:{}),
    ...(template.managedMedia.preview ? {previewVideo:mediaBaseUrl+template.managedMedia.preview}:{}),
    ...(template.managedMedia.preview?{managedPreview:true}:{}),
    productSamplePhotos:template.managedMedia.productSamples.map(path=>mediaBaseUrl+path),
    presenterSamplePhotos:template.managedMedia.presenterSamples.map(path=>mediaBaseUrl+path),
  } : {};
  const definition = isFeatureEnabled("managedTemplates") ? CreativeTemplateRecipeSchema.safeParse(template.executableDefinition) : null;
  if (definition?.success) return registerCreatorTemplate({
    ...creatorTemplateFromRecipe(definition.data, 0), ...media, ...settings, id: template.slug, familyId: definition.data.id,
    versionId: template.versionId, definition: definition.data, serverPublished: true,
  });
  const managed = isFeatureEnabled("managedTemplates");
  const local = getCreatorTemplate(managed ? template.familyId ?? template.slug : template.slug || template.id);
  const mapped: CreatorTemplate = {
    ...local,
    ...(isFeatureEnabled("managedTemplates") ? media : {}),
    // Browser recipes and create URLs use slugs. MongoDB IDs are resolved
    // separately when obtaining the immutable version for save/quote/start.
    id: template.slug,
    ...(managed ? { familyId: template.familyId ?? template.slug, versionId: template.versionId, serverPublished: true } : {}),
    ...settings,
    duration: template.durationSeconds,
    ...(template.photoPolicy ? { photoPolicy: template.photoPolicy, durationRecipes: template.durationRecipes as unknown as CreatorTemplate["durationRecipes"] } : {}),
    aspectRatios: template.supportedRatios,
    verticals: template.verticals,
    goals: template.goals,
    dialectRegister: template.dialectPolicy.register,
    qualityStatus: template.qualityStatus,
    scenes: template.scenes.length
      ? template.scenes.map((scene, index) => ({
          ...(local.scenes.find((item) => item.id === scene.id) ?? local.scenes[index] ?? local.scenes[0]!),
          ...scene,
        }))
      : local.scenes,
  };
  return managed ? registerCreatorTemplate(mapped) : mapped;
}
