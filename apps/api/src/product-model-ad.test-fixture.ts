import { TemplateCampaignPayloadSchema, defaultProductModelAdSettings } from "@movprompt/contracts";
import { ENGINE_VERSION, PRODUCT_MODEL_AD_RECIPE, resolveDurationRecipe } from "@movprompt/creative-engine";
import { validTemplateClaim } from "./campaign-contract.test-fixture.js";

export function productModelAdFixture(duration: 8 | 15 | 20 = 8, character = false) {
  const original = validTemplateClaim();
  const payload = TemplateCampaignPayloadSchema.parse({ configuration: original.configuration, productRecipe: original.productRecipe, campaignRecipe: original.campaignRecipe });
  const project = payload.configuration.creatorProject;
  const campaign = payload.campaignRecipe;
  const settings = defaultProductModelAdSettings();
  settings.brandKit.name = project.product.brand;
  settings.brandKit.primaryColor = project.brandColor;
  if (character) settings.modelChoice = "reference_adult";
  const photos = [{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "product.png", url: "" as const, storagePath: `users/11111111-1111-4111-8111-111111111111/projects/${project.id}/assets/product.png`, mimeType: "image/png" as const, checksum: "a".repeat(64), source: "upload" as const, referenceRole: "subject" as const, selected: true }];
  const images = character ? [...photos, { ...photos[0]!, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "model.png", storagePath: photos[0]!.storagePath.replace("product.png", "model.png"), checksum: "b".repeat(64), referenceRole: "character" as const, personRightsConfirmed: true as const }] : photos;
  const variant = resolveDurationRecipe({ id: PRODUCT_MODEL_AD_RECIPE.id, durationRecipes: PRODUCT_MODEL_AD_RECIPE.durationRecipes!, duration, photos: images });
  Object.assign(project, { templateId: PRODUCT_MODEL_AD_RECIPE.id, productModelAd: settings, durationSeconds: duration, audio: true, dialectRegister: "polished", scenes: variant.scenes.map(scene => ({ ...scene, title: scene.title.en, purpose: scene.purpose.en, headline: scene.headline.en, voiceover: scene.voiceover.en })) });
  project.product.images = images;
  project.source.assetKeys = images.map(image => image.storagePath);
  Object.assign(campaign, { audio: true, dialectRegister: "polished", productModelAd: settings });
  const generation = payload.configuration.generation;
  Object.assign(generation, { durationSeconds: duration, audio: true, templateQuoteContext: campaign, references: images.map(image => ({ objectKey: image.storagePath, mimeType: image.mimeType, referenceRole: image.referenceRole, ...("personRightsConfirmed" in image ? { personRightsConfirmed: true } : {}) })) });
  Object.assign(generation.creativeBrief, { engineVersion: ENGINE_VERSION, templateId: project.templateId, durationVariant: variant.id, templateRecipeVersion: 2, templatePromptVersion: `${project.templateId}-v2`, templateVisualSystem: PRODUCT_MODEL_AD_RECIPE.visualSystem, scenes: variant.scenes, qualityPolicy: PRODUCT_MODEL_AD_RECIPE.qualityPolicy, dialectRegister: "polished", productModelAd: settings });
  generation.creativeBrief.product.bookingUrl = "";
  payload.productRecipe.images = images.map(image => ({ assetId: image.id, name: image.name, objectKey: image.storagePath, mimeType: image.mimeType, checksumSha256: image.checksum, referenceRole: image.referenceRole, selected: image.selected, ...("personRightsConfirmed" in image ? { personRightsConfirmed: true } : {}) }));
  return TemplateCampaignPayloadSchema.parse(payload);
}
