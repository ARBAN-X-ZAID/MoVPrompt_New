import { CREATIVE_TEMPLATE_CATALOG, LAUNCH_CREATIVE_TEMPLATE_CATALOG, type CreativeTemplateRecipe } from "@movprompt/creative-engine";

import { templateMediaFor } from "./templateMedia";
import { getCampaignGoalOption, type CreatorAsset, type CreatorProject, type CreatorTemplate } from "./types";

const ACCENTS = ["#c99946", "#77a989", "#d49737", "#b78452", "#a68b69", "#d1763d", "#c08a86", "#8d796a", "#6f8fa8", "#7a88b5"] as const;

function creatorTemplateFromRecipe(template: CreativeTemplateRecipe, index: number): CreatorTemplate {
  const primaryGoal = template.goals[0] ?? "launch";
  return {
    id: template.id,
    name: template.localizedName.en,
    nameAr: template.localizedName.ar,
    eyebrow: template.category.replace(/-/g, " "),
    discoveryCategory: template.discoveryCategory,
    description: template.localizedDescription.en,
    descriptionAr: template.localizedDescription.ar,
    bestFor: template.tags.join(", "),
    duration: template.durationSeconds,
    ...templateMediaFor(template.id, index, primaryGoal),
    languages: [...template.supportedLanguages],
    aspectRatios: [...template.supportedRatios],
    accent: ACCENTS[index % ACCENTS.length]!,
    tags: [...template.tags],
    verticals: [...template.verticals],
    goals: [...template.goals],
    requiredInputs: [...template.requiredInputs],
    dialectRegister: template.dialectRegister,
    qualityStatus: template.qualityStatus,
    scenes: template.scenes.map((scene) => ({
      id: scene.id,
      title: scene.title.en,
      titleAr: scene.title.ar,
      purpose: scene.purpose.en,
      purposeAr: scene.purpose.ar,
      duration: scene.duration,
      headline: scene.headline.en,
      headlineAr: scene.headline.ar,
      voiceover: scene.voiceover.en,
      voiceoverAr: scene.voiceover.ar,
      direction: scene.direction,
      shot: scene.shot,
      camera: scene.camera,
      lighting: scene.lighting,
      continuityAnchor: scene.continuityAnchor,
    })),
  };
}

export const CREATOR_TEMPLATES: CreatorTemplate[] = LAUNCH_CREATIVE_TEMPLATE_CATALOG.map(creatorTemplateFromRecipe);
/** Public selection surfaces only show templates with a verified playable preview. */
export const PREVIEWED_CREATOR_TEMPLATES: CreatorTemplate[] = CREATOR_TEMPLATES.filter(
  (template) => Boolean(template.previewVideo),
);
/** Keep the funded previews plus the explicitly approved poster-only advertising recipe discoverable. */
export const DISCOVERABLE_CREATOR_TEMPLATES: CreatorTemplate[] = CREATOR_TEMPLATES.filter(
  (template) => Boolean(template.previewVideo) || template.id === "new-york-billboard-takeover",
);
const INTERNAL_CREATOR_TEMPLATES: CreatorTemplate[] = CREATIVE_TEMPLATE_CATALOG.map(creatorTemplateFromRecipe);

const REFERENCE_REQUIRED_INPUTS = new Set([
  "primary_reference",
  "product_image",
  "product_reference",
  "real_work_reference",
  "real_room_reference",
  "real_shade_reference",
  "real_dish_media",
  "real_facility_media",
  "all_box_item_references",
  "all_bundle_item_references",
  "consented_before_video",
  "consented_after_video",
  "consented_customer_video",
  "consented_founder_reference",
  "consented_person_reference",
]);

const ALLOWED_CREATOR_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export type CreatorImageAsset = CreatorAsset & { mimeType: "image/jpeg" | "image/png" | "image/webp" };

/**
 * Server-owned or uploaded media must declare an allowlisted still-image type.
 * Legacy values without a MIME type are intentionally not guessed as images.
 */
export function isCreatorImageReference(asset: CreatorAsset): asset is CreatorImageAsset {
  return ALLOWED_CREATOR_IMAGE_MIME_TYPES.has(asset.mimeType?.trim().toLowerCase() ?? "");
}

/** Keep the browser preflight aligned with the recipe rather than assuming every campaign needs a photo. */
export function templateRequiresSourceMedia(templateId: string | null | undefined) {
  return getCreatorTemplate(templateId).requiredInputs.some((input) => REFERENCE_REQUIRED_INPUTS.has(input));
}

/** Footage has its own presenter pathway and must never satisfy an image-only template input. */
export function hasCreatorImageReference(assets: CreatorAsset[]) {
  return assets.some(isCreatorImageReference);
}

export const SAMPLE_PRODUCT = {
  sourceType: "sample" as const,
  sourceUrl: "",
  name: "Kinza Cola",
  description: "A crisp cola presented as an ice-cold everyday refreshment.",
  price: "0.250",
  brand: "Kinza",
  images: [
    {
      id: "sample-product",
      name: "Kinza Cola",
      url: "/create/sample-kinza.jpg",
      mimeType: "image/jpeg",
      source: "sample" as const,
    },
  ],
};

export function getCreatorTemplate(id: string | null | undefined) {
  return CREATOR_TEMPLATES.find((template) => template.id === id)
    ?? INTERNAL_CREATOR_TEMPLATES.find((template) => template.id === id)
    ?? CREATOR_TEMPLATES[0]!;
}

export function createDraftProject(templateId = CREATOR_TEMPLATES[0]!.id): CreatorProject {
  const template = getCreatorTemplate(templateId);
  const now = new Date().toISOString();
  const vertical = template.verticals[0] ?? "ecommerce";
  const goal = template.goals[0] ?? "launch";
  const serviceTemplate = vertical === "salon" || vertical === "clinic" || vertical === "real_estate" || vertical === "services";
  const arabicFirst = template.tags.some((tag) => /arabic|kuwait|ramadan|national/iu.test(tag));
  return {
    id: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
    versionNumber: 1,
    title: "Untitled campaign",
    templateId: template.id,
    status: "draft",
    promotionKind: serviceTemplate ? "business" : "product",
    vertical,
    goal,
    presenterMode: "none",
    location: "",
    bookingUrl: "",
    whatsapp: "",
    product: { sourceType: null, sourceUrl: "", name: "", description: "", price: "", brand: "", images: [] },
    language: arabicFirst ? "ar" : "en",
    arabicDialect: "kuwaiti",
    dialectRegister: template.dialectRegister,
    market: "KW",
    offer: "",
    cta: getCampaignGoalOption(goal).defaultCta,
    brandColor: template.accent,
    logoUrl: "",
    aspectRatio: "9:16",
    resolution: "720p",
    durationSeconds: template.duration,
    subtitles: true,
    audio: true,
    scenes: template.scenes.map((scene) => ({ ...scene })),
    videoUrl: null,
    jobId: null,
    renderRunId: null,
    lastError: null,
    createdAt: now,
    updatedAt: now,
  };
}
