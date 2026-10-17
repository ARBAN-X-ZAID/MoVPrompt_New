import { assertNativeUgc, compileNativeUgcPrompt } from "./native-ugc.js";
import type { TemplatePhotoReference } from "@movprompt/contracts";
import { assertTemplatePhotos, LAUNCH_PHOTO_POLICIES, resolveDurationRecipe, type DurationRecipes } from "./duration-recipes.js";
import { getCreativeTemplateVersion } from "./catalog.js";
import type { CompiledCreativeDirection, CreativeBrief } from "./types.js";
import { AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID } from "@movprompt/contracts";
import { assertProductModelAd, productModelAdDirection } from "./product-model-ad.js";
import { assertAdStudioBrandAd, compileAdStudioBrandAdPrompt } from "./ad-studio-brand-ad.js";

export const TEMPLATE_PROMPT_LIMIT = 7_000;
export const TEMPLATE_RETRY_LIMIT = 750;

/** Shared by quote preflight and the worker; never trust client-authored visual instructions. */
export function assertDurationVariant(brief: CreativeBrief, duration: number, photos: readonly TemplatePhotoReference[], publishedRecipes?: DurationRecipes): void {
  const template = getCreativeTemplateVersion(brief.templateId, brief.templateRecipeVersion);
  const recipes = publishedRecipes ?? template.durationRecipes;
  if (!recipes) throw new Error("template_duration_recipe_unavailable");
  assertTemplatePhotos(brief.templateId, photos);
  const expected = resolveDurationRecipe({ id: brief.templateId, durationRecipes: recipes, duration, photos });
  const keys = ["id", "direction", "shot", "camera", "lighting", "continuityAnchor", "duration"] as const;
  if (brief.durationVariant !== expected.id || brief.templateRecipeVersion !== template.versionNumber ||
    brief.templatePromptVersion !== `${template.id}-v${template.versionNumber}` ||
    brief.templateVisualSystem !== template.visualSystem || JSON.stringify(brief.qualityPolicy) !== JSON.stringify(template.qualityPolicy) ||
    brief.scenes.length !== expected.scenes.length ||
    !expected.scenes.every((scene, index) => keys.every(key => scene[key] === brief.scenes[index]?.[key]))) {
    throw new Error("template_duration_recipe_mismatch");
  }
}

export function compileTemplatePrompt(input: {
  brief: CreativeBrief;
  photos: readonly TemplatePhotoReference[];
  aspectRatio: string;
  audio?: boolean;
}): CompiledCreativeDirection {
  const { brief, photos } = input;
  assertDurationVariant(brief, brief.scenes.reduce((sum, scene) => sum + scene.duration, 0), photos);
  assertNativeUgc(brief, photos, input.audio === true);
  if (brief.nativeUgc) {
    if (brief.templateId === AD_STUDIO_BRAND_AD_ID) assertAdStudioBrandAd(brief, photos, input.aspectRatio);
    const { prompt, negativePrompt } = compileNativeUgcPrompt(brief, photos, input.aspectRatio, input.audio === true);
    if (prompt.length > TEMPLATE_PROMPT_LIMIT) throw new Error("compiled_prompt_exceeds_provider_contract");
    return { prompt, negativePrompt, spokenLocale: brief.language === "en" ? "en-US" : brief.language === "ar" ? "ar-KW" : "mixed", dialectScore: 100, dialectWarnings: [], dialectPolicyVersion: "native-ugc-v1", qualityPolicy: brief.qualityPolicy };
  }
  if (brief.templateId === AD_STUDIO_BRAND_AD_ID) {
    const { prompt, negativePrompt } = compileAdStudioBrandAdPrompt(brief, photos, input.aspectRatio, input.audio === true);
    if (prompt.length > TEMPLATE_PROMPT_LIMIT) throw new Error("compiled_prompt_exceeds_provider_contract");
    return { prompt, negativePrompt, spokenLocale: brief.language === "en" ? "en-US" : brief.language === "ar" ? "ar-KW" : "mixed", dialectScore: 100, dialectWarnings: [], dialectPolicyVersion: "ad-studio-brand-ad-v1", qualityPolicy: brief.qualityPolicy };
  }
  const modelAd = brief.templateId === PRODUCT_MODEL_AD_ID;
  const music = modelAd && (brief.templateRecipeVersion ?? 0) >= 2;
  if (modelAd) assertProductModelAd(brief, photos, input.aspectRatio);
  const defaultRole = LAUNCH_PHOTO_POLICIES[brief.templateId]!.groups[0]!.role;
  const hasCharacter = photos.some(photo => photo.referenceRole === "character");
  const referenceMap = photos.map((photo, index) => {
    const role = photo.referenceRole ?? defaultRole;
    const purpose = role === "character"
      ? "Another angle of ONE consented adult presenter, not a product or additional person. Preserve face, skin tone, hair and body identity."
      : role === "property"
        ? "An actual view of the SAME property. Preserve walls, fixtures, furniture and outside view. Different rooms are not different sides of one object."
        : role === "artwork"
          ? "The exact supplied artwork. Keep layout, proportions, colours, existing marks and readable content intact."
          : "A view of the SAME product. Preserve shape, proportions, materials, colours, visible labels and identifying details.";
    return `[Image ${index + 1}]: ${purpose}`;
  });
  let cursor = 0;
  const shots = brief.scenes.map(scene => {
    const start = cursor;
    cursor += scene.duration;
    if (modelAd) return `${start}–${cursor}s | ${scene.title.en}\n${scene.direction}\nCamera: ${scene.camera}`;
    return `${start}–${cursor}s | ${scene.title.en}\nAction: ${scene.direction}\nFrame: ${scene.shot}\nCamera: ${scene.camera}\nLight: ${scene.lighting}\nContinuity: ${scene.continuityAnchor}`;
  });
  const facts = Object.entries(brief.product)
    .filter(([key]) => !brief.displayCopy || ["name", "brand", "description"].includes(key))
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${value}`);
  const jewelry = brief.templateId === "jewelry-product-showcase";
  const gift = brief.templateId === "luxury-gift-reveal";
  const negativePrompt = "No subject substitution, redesigned packaging, invented unseen sides, extra products, changed faces, warped hands, flicker, fabricated rooms or claims. No new lettering, watermarks, speech" + (music ? ", vocals or copied songs." : ", music or sound effects.") + (jewelry
    ? " No cloth, fabric, people, hands, decorative props, added gemstones, invented engravings, spinning jewelry, liquid-metal transformations or artificial glitter."
    : "") + (gift
    ? " No detached hinge, duplicated or extra hands, faces, ribbons, confetti, smoke, invented compartments, rearranged contents, product rotation, repeated zooming, strobe, or fade to black."
    : "");
  const prompt = [
    ...(brief.displayCopy ? ["CLEAN FOOTAGE: no subtitles, captions, promotional panels or added text, even during speech."] : []),
    `MOVPROMPT ${brief.durationVariant}. One ${cursor}-second ${music ? "instrumental-music" : "muted"} commercial, ${input.aspectRatio}, Kuwait. Follow every time range exactly; do not compress into the eight-second example.`,
    "REFERENCE MAP (numbering exactly matches the supplied images)",
    ...referenceMap,
    ...(modelAd ? productModelAdDirection(brief, photos) : []),
    ...(jewelry ? [
      "JEWELRY IDENTITY AND SET LOCK: [Image 1] defines the exact jewelry item or set, not a source for replacement pieces. Preserve every supplied piece, its arrangement and orientation, visible silhouette, proportions, metal color, stone count and placement, settings and engravings. If the upload contains a set, keep that exact piece count; a close crop does not authorize removing or replacing pieces in the full hero. Show only supplied surfaces and supported detail crops. No new gems, hidden construction or unseen backs.",
      `JEWELRY VISUAL STYLE: ${brief.templateVisualSystem}. Use one consistent studio and correctly aligned subdued reflections, never duplicate jewelry. Maintain readable details, stable exposure and true material colors; warm light must not recolor the product. Every full hero keeps all supplied pieces unobscured.`,
    ] : []),
    ...(gift ? [
      "GIFT IDENTITY LOCK: [Image 1] defines the actual packaging, contents, materials, colors, proportions, hinge and revealed final arrangement. It is not the opening frame. Begin with that same package closed on the same surface. Preserve every supplied item and its seating. Do not substitute another product or invent hidden compartments, accessories, decorations, ribbons or offers.",
      `GIFT VISUAL STYLE: ${brief.templateVisualSystem}. One consistent adult hand, no face. Physical opening and changing light carry the story.`,
    ] : []),
    ...(brief.templateId === "female-product-review" && (brief.templateRecipeVersion ?? 0) >= 3 && hasCharacter ? [
      "CHARACTER STYLE LOCK: The character reference defines the presenter's rendering style as well as identity. If it is an illustration or cartoon, keep that same illustrated adult character, linework, shading and proportions throughout; never turn it into a photorealistic person. Do not copy the character's illustrated texture onto the product. Product references independently define the exact product shape, material, colour and label. Integrate the two with coherent contact, shadows and restrained motion. A reference photo does not authorize identity replacement.",
    ] : []),
    modelAd ? "Use the model and product roles defined above, with no identity crossover. Follow the action policy even if a generic beat describes handling."
      : brief.templateId === "female-product-review"
      ? hasCharacter
        ? "Use only the adult identity in the character references for ONE presenter throughout. Product references never define the person's identity. Keep the same face, hair, wardrobe, proportions and lighting between shots."
        : "Use ONE generic adult woman throughout, with dark shoulder-length hair, a plain cream long-sleeve top, natural makeup and a neutral warm expression. Keep face, wardrobe and room unchanged between shots. No celebrity likeness."
      : gift
        ? "One consistent adult hand only, entering from the side. No face and no second hand. The uploaded photo defines the open arrangement, not the first frame."
        : brief.templateId === "new-york-billboard-takeover" ? "Only anonymous soft-focus background pedestrians; never introduce a featured person or celebrity."
          : "No additional featured people or replacement products. Only decorative elements explicitly specified in the shot plan are allowed. The uploaded subject determines identity; the template determines presentation.",
    brief.displayCopy ? "PRODUCT IDENTITY CONTEXT ONLY. Never display these facts as added text." : "FACTS FOR DETERMINISTIC FINISHING (do not invent any absent value)",
    ...facts,
    ...(modelAd ? ["Exact logo and ad copy are applied after the video. Do not generate text in the footage.", "GLOBAL CONTINUITY: Same product, adult, wardrobe, supported grip and stationary car with open passenger door. Stable soft afternoon light and accurate colors. Clean cuts, no invented surfaces."] : []),
    "Preserve existing labels, logos and artwork in the references. Do not generate new text, offers, claims, captions, interfaces or contact details. Leave clean lower-third space for the finishing service. A blank fact stays absent.",
    brief.templateId === "new-york-billboard-takeover"
      ? "The supplied artwork belongs on ONE billboard exactly as provided. Other signs stay neutral and unreadable. Never replace the artwork with invented advertising."
      : "Use the reference subject directly; never insert it into a fictional phone, screen or billboard. Crops may show visible detail; unsupplied sides must never be invented.",
    "TIMED SHOT PLAN",
    ...shots,
    "Keep one motivated camera move at a time, stable exposure and grade, physical motion and clean transitions. Effects stay secondary and never obscure identifying features.",
    music ? `MUSIC: Original fashion-ad instrumental, around 120 BPM: warm bass, soft keys, crisp restrained percussion. Start immediately, accent the cuts and resolve at ${cursor} seconds. No vocals, lyrics, dialogue, narration, copied melodies or loud traffic. Presenter lips remain still.` : "MUTED OUTPUT: no speech, dialogue, music or sound effects. Presenter mouths remain still; no pantomimed speaking or testimonials.",
    negativePrompt,
  ].join("\n\n");
  // Reserve room for a bounded quality retry instead of silently clipping facts.
  if (prompt.length > TEMPLATE_PROMPT_LIMIT) throw new Error("compiled_prompt_exceeds_provider_contract");
  return { prompt, negativePrompt, spokenLocale: brief.language === "en" ? "en-US" : brief.language === "ar" ? "ar-KW" : "mixed", dialectScore: 100, dialectWarnings: [], dialectPolicyVersion: "muted-template-v2", qualityPolicy: brief.qualityPolicy };
}
