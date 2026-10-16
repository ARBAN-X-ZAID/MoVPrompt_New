import { TemplateCampaignPayloadSchema, defaultAdStudioBrandAdSettings, type CampaignResolution } from "@movprompt/contracts";
import { AD_STUDIO_BRAND_AD_RECIPE, ENGINE_VERSION, resolveDurationRecipe } from "@movprompt/creative-engine";
import { validTemplateClaim } from "./campaign-contract.test-fixture.js";

export function adStudioBrandAdFixture(input: { duration?: 8 | 15 | 20; aspectRatio?: "9:16" | "1:1" | "4:5" | "16:9"; resolution?: CampaignResolution; audio?: boolean } = {}) {
  const { duration = 8, aspectRatio = "9:16", resolution = "720p", audio = true } = input;
  const original = validTemplateClaim();
  const payload = TemplateCampaignPayloadSchema.parse({ configuration: original.configuration, productRecipe: original.productRecipe, campaignRecipe: original.campaignRecipe });
  const project = payload.configuration.creatorProject;
  const campaign = payload.campaignRecipe;
  const settings = {
    ...defaultAdStudioBrandAdSettings(),
    brandName: project.product.brand,
    sellingPoints: "Free delivery in Kuwait",
    aesthetics: "Dark, luxury, warm gold light",
    audience: "Women 25 to 40 in Kuwait",
    description: "Handmade oud perfumes made in Kuwait",
    videoIdea: "A woman sprays the perfume on her wrist and smiles.",
  };
  const images = [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "product.png", url: "" as const, storagePath: `users/11111111-1111-4111-8111-111111111111/projects/${project.id}/assets/product.png`, mimeType: "image/png" as const, checksum: "a".repeat(64), source: "upload" as const, referenceRole: "subject" as const, selected: true }];
  const variant = resolveDurationRecipe({ id: AD_STUDIO_BRAND_AD_RECIPE.id, durationRecipes: AD_STUDIO_BRAND_AD_RECIPE.durationRecipes!, duration, photos: images });
  Object.assign(project, { templateId: AD_STUDIO_BRAND_AD_RECIPE.id, adStudioBrandAd: settings, durationSeconds: duration, aspectRatio, resolution, audio, dialectRegister: "polished", scenes: variant.scenes.map(scene => ({ ...scene, title: scene.title.en, purpose: scene.purpose.en, headline: scene.headline.en, voiceover: scene.voiceover.en })) });
  project.product.images = images;
  project.source.assetKeys = images.map(image => image.storagePath);
  Object.assign(campaign, { aspectRatio, resolution, audio, dialectRegister: "polished", adStudioBrandAd: settings });
  const generation = payload.configuration.generation;
  Object.assign(generation, { durationSeconds: duration, aspectRatio, resolution, audio, templateQuoteContext: campaign, references: images.map(image => ({ objectKey: image.storagePath, mimeType: image.mimeType, referenceRole: image.referenceRole })) });
  Object.assign(generation.creativeBrief, { engineVersion: ENGINE_VERSION, templateId: project.templateId, durationVariant: variant.id, templateRecipeVersion: 1, templatePromptVersion: `${project.templateId}-v1`, templateVisualSystem: AD_STUDIO_BRAND_AD_RECIPE.visualSystem, scenes: variant.scenes, qualityPolicy: AD_STUDIO_BRAND_AD_RECIPE.qualityPolicy, dialectRegister: "polished", adStudioBrandAd: settings });
  payload.productRecipe.images = images.map(image => ({ assetId: image.id, name: image.name, objectKey: image.storagePath, mimeType: image.mimeType, checksumSha256: image.checksum, referenceRole: image.referenceRole, selected: image.selected }));
  return TemplateCampaignPayloadSchema.parse(payload);
}
