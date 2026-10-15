import { PRODUCT_MODEL_AD_ID, defaultProductModelAdSettings, type ProductModelAdSettings } from "@movprompt/contracts";
import { campaignFactValue, campaignSourceForProject, editFact } from "./sourceFacts";
import type { CreatorProject } from "./types";

export function projectWithModelAdSettings(project: CreatorProject, settings: ProductModelAdSettings): CreatorProject {
  if (project.templateId !== PRODUCT_MODEL_AD_ID) return project;
  let source = campaignSourceForProject(project);
  source = editFact(source, "brand", settings.brandKit.name);
  source = editFact(source, "brand_color", settings.brandKit.primaryColor);
  source = editFact(source, "booking_url", settings.brandKit.website);
  source = editFact(source, "whatsapp", settings.brandKit.whatsapp);
  return {
    ...project, source,
    productModelAd: structuredClone(settings), brandColor: settings.brandKit.primaryColor,
    bookingUrl: settings.brandKit.website, whatsapp: settings.brandKit.whatsapp,
    product: { ...project.product, brand: settings.brandKit.name }, aspectRatio: "9:16", audio: true,
  };
}

export function modelAdSettingsForProject(project: CreatorProject): ProductModelAdSettings {
  if (project.productModelAd) return project.productModelAd;
  const value = defaultProductModelAdSettings();
  const source = campaignSourceForProject(project);
  return { ...value, modelChoice: project.product.images.some(image => image.referenceRole === "character" && image.selected !== false) ? "reference_adult" : value.modelChoice, brandKit: { ...value.brandKit, name: campaignFactValue(source, "brand"), primaryColor: project.brandColor, website: campaignFactValue(source, "booking_url"), whatsapp: campaignFactValue(source, "whatsapp") } };
}
