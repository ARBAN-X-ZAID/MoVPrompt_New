import type { TemplatePhotoReference } from "@movprompt/contracts";
import { assertTemplatePhotos, LAUNCH_PHOTO_POLICIES, resolveDurationRecipe, type DurationRecipes } from "./duration-recipes.js";
import { getCreativeTemplate } from "./catalog.js";
import type { CompiledCreativeDirection, CreativeBrief } from "./types.js";

export const TEMPLATE_PROMPT_LIMIT = 7_000;
export const TEMPLATE_RETRY_LIMIT = 750;

/** Shared by quote preflight and the worker; never trust client-authored visual instructions. */
export function assertDurationVariant(brief: CreativeBrief, duration: number, photos: readonly TemplatePhotoReference[], publishedRecipes?: DurationRecipes): void {
  const template = getCreativeTemplate(brief.templateId);
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
}): CompiledCreativeDirection {
  const { brief, photos } = input;
  assertDurationVariant(brief, brief.scenes.reduce((sum, scene) => sum + scene.duration, 0), photos);
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
    return `${start}–${cursor}s | ${scene.title.en}\nAction: ${scene.direction}\nFrame: ${scene.shot}\nCamera: ${scene.camera}\nLight: ${scene.lighting}\nContinuity: ${scene.continuityAnchor}`;
  });
  const facts = Object.entries(brief.product)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${value}`);
  const negativePrompt = "No subject substitution, redesigned packaging, invented unseen sides, extra products, changed faces, warped hands, flicker, fabricated rooms or claims. No new lettering, watermarks, speech, music or sound effects.";
  const prompt = [
    `MOVPROMPT ${brief.durationVariant}. One ${cursor}-second muted commercial, ${input.aspectRatio}, Kuwait. Follow every time range exactly; do not compress into the eight-second example.`,
    "REFERENCE MAP (numbering exactly matches the supplied images)",
    ...referenceMap,
    ...(brief.templateId === "female-product-review" && (brief.templateRecipeVersion ?? 0) >= 3 && hasCharacter ? [
      "CHARACTER STYLE LOCK: The character reference defines the presenter's rendering style as well as identity. If it is an illustration or cartoon, keep that same illustrated adult character, linework, shading and proportions throughout; never turn it into a photorealistic person. Do not copy the character's illustrated texture onto the product. Product references independently define the exact product shape, material, colour and label. Integrate the two with coherent contact, shadows and restrained motion. A reference photo does not authorize identity replacement.",
    ] : []),
    brief.templateId === "female-product-review"
      ? hasCharacter
        ? "Use only the adult identity in the character references for ONE presenter throughout. Product references never define the person's identity. Keep the same face, hair, wardrobe, proportions and lighting between shots."
        : "Use ONE generic adult woman throughout, with dark shoulder-length hair, a plain cream long-sleeve top, natural makeup and a neutral warm expression. Keep face, wardrobe and room unchanged between shots. No celebrity likeness."
      : brief.templateId === "new-york-billboard-takeover" ? "Only anonymous soft-focus background pedestrians; never introduce a featured person or celebrity."
        : "No additional featured people or replacement products. Only decorative elements explicitly specified in the shot plan are allowed. The uploaded subject determines identity; the template determines presentation.",
    "FACTS FOR DETERMINISTIC FINISHING (do not invent any absent value)",
    ...facts,
    "Preserve existing labels, logos and artwork in the references. Do not generate new text, offers, claims, captions, interfaces or contact details. Leave clean lower-third space for the finishing service. A blank fact stays absent.",
    brief.templateId === "new-york-billboard-takeover"
      ? "The supplied artwork belongs on ONE billboard exactly as provided. Other signs stay neutral and unreadable. Never replace the artwork with invented advertising."
      : "Use the reference subject directly; never insert it into a fictional phone, screen or billboard. Crops may show visible detail; unsupplied sides must never be invented.",
    "TIMED SHOT PLAN",
    ...shots,
    "Keep one motivated camera move at a time, stable exposure and grade, physical motion and clean transitions. Effects stay secondary and never obscure identifying features.",
    "MUTED OUTPUT: no speech, dialogue, music or sound effects. Presenter mouths remain still; no pantomimed speaking or testimonials.",
    negativePrompt,
  ].join("\n\n");
  // Reserve room for a bounded quality retry instead of silently clipping facts.
  if (prompt.length > TEMPLATE_PROMPT_LIMIT) throw new Error("compiled_prompt_exceeds_provider_contract");
  return { prompt, negativePrompt, spokenLocale: brief.language === "en" ? "en-US" : brief.language === "ar" ? "ar-KW" : "mixed", dialectScore: 100, dialectWarnings: [], dialectPolicyVersion: "muted-template-v2", qualityPolicy: brief.qualityPolicy };
}
