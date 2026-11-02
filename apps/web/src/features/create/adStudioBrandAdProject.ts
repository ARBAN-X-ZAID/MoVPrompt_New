import { AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID, defaultAdStudioBrandAdSettings, type AdStudioBrandAdSettings } from "@movprompt/contracts";
import { displayCopyForProject, withDisplayCopy } from "./displayCopyProject";
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
  return { ...project, source, adStudioBrandAd: structuredClone(settings), product: { ...project.product, brand: settings.brandName } };
}

/**
 * The form offers only length and language, so a draft saved under the older form
 * must not carry settings its owner can no longer see. Returns null when clean.
 * These are the defaults every new Ad Studio project already sends to the provider.
 */
export function hiddenAdStudioSettingsReset(project: CreatorProject): Partial<CreatorProject> | null {
  const copy = displayCopyForProject(project);
  const hasCopy = Boolean(copy.offer || copy.closingMessage || copy.openingMessage);
  const hasCharacters = project.product.images.some(image => image.referenceRole === "character" && image.selected !== false);
  if (project.aspectRatio === "9:16" && project.resolution === "720p" && project.audio && !project.nativeUgc && !hasCopy && !hasCharacters) return null;
  const cleared = hasCopy ? withDisplayCopy(project, { offer: "", closingMessage: "", openingMessage: "" }) : project;
  return {
    aspectRatio: "9:16",
    resolution: "720p",
    audio: true,
    nativeUgc: undefined,
    ...(hasCopy ? { displayCopy: cleared.displayCopy, cta: cleared.cta } : {}),
    ...(hasCharacters ? { product: { ...project.product, images: project.product.images.map(image => image.referenceRole === "character" ? { ...image, selected: false } : image) } } : {}),
  };
}

/** Ad Studio follows the owner's sound toggle; other recipes fix their audio. */
export function campaignAudioForProject(project: CreatorProject): boolean {
  return project.templateId === "female-product-review" ? project.nativeUgc?.enabled === true : isAdStudioBrandAd(project) ? project.audio : project.templateId === PRODUCT_MODEL_AD_ID;
}
