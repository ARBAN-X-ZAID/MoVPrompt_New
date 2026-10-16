import { AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID, defaultAdStudioBrandAdSettings, type AdStudioBrandAdSettings } from "@movprompt/contracts";
import { campaignFactValue, campaignSourceForProject, editFact } from "./sourceFacts";
import type { CreatorProject } from "./types";

export function isAdStudioBrandAd(project: Pick<CreatorProject, "templateId">): boolean {
  return project.templateId === AD_STUDIO_BRAND_AD_ID;
}

export function brandAdSettingsForProject(project: CreatorProject): AdStudioBrandAdSettings {
  if (project.adStudioBrandAd) return project.adStudioBrandAd;
  return { ...defaultAdStudioBrandAdSettings(), brandName: campaignFactValue(campaignSourceForProject(project), "brand") };
}

/** The brand name is a confirmed campaign fact, so the form and the source facts change together. */
export function projectWithBrandAdSettings(project: CreatorProject, settings: AdStudioBrandAdSettings): CreatorProject {
  if (!isAdStudioBrandAd(project)) return project;
  const source = editFact(campaignSourceForProject(project), "brand", settings.brandName);
  return { ...project, source, adStudioBrandAd: { ...structuredClone(settings), website: "" }, product: { ...project.product, brand: settings.brandName } };
}

/** Ad Studio follows the owner's sound toggle; other recipes fix their audio. */
export function campaignAudioForProject(project: CreatorProject): boolean {
  return isAdStudioBrandAd(project) ? project.audio : project.templateId === PRODUCT_MODEL_AD_ID;
}
