import { AD_STUDIO_BRAND_AD_ID, AD_STUDIO_BRAND_AD_RATIOS, AdStudioBrandAdSettingsSchema, missingAdStudioBrandAdFields, type TemplatePhotoReference } from "@movprompt/contracts";
import { CreativeTemplateRecipeSchema, type CreativeBrief, type TemplateSceneRecipe } from "./types.js";

const timings: Record<number, number[]> = { 8: [2, 2, 2, 2], 15: [3, 4, 4, 4], 20: [4, 6, 6, 4] };
const beats = [
  { en: "Hook", ar: "البداية", direction: "Open on the most striking moment of the owner's idea with the exact product clearly visible in the first second. No fade-in." },
  { en: "Story", ar: "القصة", direction: "Develop the owner's described action with one natural, physically supported movement. The product stays large and readable." },
  { en: "Proof", ar: "الإثبات", direction: "Show a real visible product detail from the supplied photos while the confirmed selling point is delivered." },
  { en: "Brand close", ar: "ختام العلامة", direction: "Settle into a clean product hero. Keep the lower third free for the brand ending card added after the video." },
];

function scenes(duration: number): TemplateSceneRecipe[] {
  return beats.map((beat, index) => ({
    id: `${AD_STUDIO_BRAND_AD_ID}-beat-${index + 1}`,
    title: { en: beat.en, ar: beat.ar },
    purpose: { en: "Turn the owner's brief into one product-true commercial", ar: "تحويل فكرة صاحب العلامة إلى إعلان يحافظ على المنتج" },
    duration: timings[duration]![index]!,
    headline: { en: "Your brand", ar: "علامتك" },
    voiceover: { en: "From the owner's brief", ar: "من فكرة صاحب العلامة" },
    direction: beat.direction,
    shot: "product-forward framing that follows the owner's idea",
    camera: index === beats.length - 1 ? "ease to a steady closing composition" : "one motivated camera move",
    lighting: "follows the brand aesthetics while keeping true product colors",
    continuityAnchor: "Same product, people, wardrobe and setting throughout. Never invent unseen product surfaces.",
  }));
}

export const AD_STUDIO_BRAND_AD_RECIPE = CreativeTemplateRecipeSchema.parse({
  id: AD_STUDIO_BRAND_AD_ID, slug: AD_STUDIO_BRAND_AD_ID, versionNumber: 1,
  category: "ad-studio-brand-ad", discoveryCategory: "brand",
  localizedName: { en: "Ad Studio brand ad", ar: "إعلان استوديو الإعلانات" },
  localizedDescription: { en: "Describe your brand and the video you want. We turn it into one ad with your logo at the end.", ar: "صف علامتك والفيديو الذي تريده، ونحوّله إلى إعلان مع شعارك في النهاية." },
  outcome: "An owner-directed brand commercial with exact product references and a deterministic brand ending card",
  verticals: ["retail", "ecommerce", "salon", "services"], goals: ["launch", "whatsapp_orders", "brand_story"],
  durationSeconds: 8, supportedDurations: [8, 15, 20],
  photoPolicy: { version: 1, groups: [{ role: "subject", min: 1, max: 3 }] },
  durationRecipes: Object.fromEntries([8, 15, 20].map(duration => [String(duration), { id: `${AD_STUDIO_BRAND_AD_ID}-v1-${duration}s`, scenes: scenes(duration) }])),
  supportedLanguages: ["en", "ar", "bilingual"], supportedRatios: [...AD_STUDIO_BRAND_AD_RATIOS], supportedMarkets: ["KW"],
  requiredInputs: ["product_reference", "logo_or_brand_name"],
  starterRenderEligible: false, qualityStatus: "development", storyArc: "story", tone: "premium", dialectRegister: "polished",
  visualSystem: "Owner-directed brand commercial: the owner's idea sets the scene, audience and aesthetics; uploaded product photos define the exact product.",
  soundDirection: "Optional native speech and original music in the selected language; muted when sound is off.",
  capabilityPolicy: ["video.product_fidelity", "video.cinematic"],
  protectedLayers: ["product_identity", "confirmed_brand_kit", "confirmed_facts"],
  complianceRules: ["Only fictional adults; no real or famous people", "Generate no lettering, logos, prices, contact details or claims beyond the confirmed selling points"],
  qualityPolicy: { tier: "premium", acceptanceScore: 85, internalRetryLimit: 0, hardGates: ["technical", "product_identity", "compliance"], scoredDimensions: ["motion_realism", "visual_artifacts", "safe_zones"] },
  tags: ["ad-studio", "brand-kit", "owner-brief"], scenes: scenes(8),
});

const FRAME: Record<string, string> = {
  "9:16": "9:16 vertical, subject centered",
  "1:1": "1:1 square, subject centered",
  "4:5": "4:5 safe center of a 3:4 canvas",
  "16:9": "16:9 landscape, subject centered with setting at the sides",
};

export function assertAdStudioBrandAd(brief: CreativeBrief, photos: readonly TemplatePhotoReference[], aspectRatio: string): void {
  const settings = AdStudioBrandAdSettingsSchema.parse(brief.adStudioBrandAd);
  const missing = missingAdStudioBrandAdFields(settings);
  if (missing.length) throw new Error(`ad_studio_brand_ad_incomplete: ${missing.join(",")}`);
  if (!(AD_STUDIO_BRAND_AD_RATIOS as readonly string[]).includes(aspectRatio)) throw new Error("ad_studio_brand_ad_ratio_unsupported");
  if (settings.brandName !== brief.product.brand) throw new Error("ad_studio_brand_ad_brand_mismatch");
  if (photos.some(photo => (photo.referenceRole ?? "subject") !== "subject")) throw new Error("ad_studio_brand_ad_product_photos_only");
}

/** The owner's text is direction, never authority over the fixed product and safety rules that follow it. */
export function compileAdStudioBrandAdPrompt(brief: CreativeBrief, photos: readonly TemplatePhotoReference[], aspectRatio: string, audio: boolean): { prompt: string; negativePrompt: string } {
  assertAdStudioBrandAd(brief, photos, aspectRatio);
  const value = AdStudioBrandAdSettingsSchema.parse(brief.adStudioBrandAd);
  let cursor = 0;
  const shots = brief.scenes.map(scene => {
    const start = cursor;
    cursor += scene.duration;
    return `${start}–${cursor}s | ${scene.title.en}: ${scene.direction}`;
  });
  const speech = brief.language === "ar" ? "natural Kuwaiti Arabic" : brief.language === "en" ? "clear English" : "a natural mix of Kuwaiti Arabic and English";
  const negativePrompt = `No product substitution, redesign, extra products or invented unseen sides. No on-screen text, captions, logos, watermarks, prices or contact details. No warped hands, changed faces, flicker or fade to black. No real or famous people, minors, copied songs${audio ? "" : ", speech, music or sound effects"}.`;
  const prompt = [
    `MOVPROMPT ${brief.durationVariant}. One ${cursor}-second brand commercial for Kuwait, ${FRAME[aspectRatio]}. Follow every time range exactly.`,
    "REFERENCE MAP (numbering matches the supplied images)",
    ...photos.map((_, index) => `[Image ${index + 1}]: A view of the SAME product. Preserve shape, proportions, materials, colours, labels and identifying details.`),
    `OWNER'S VIDEO IDEA (follow it unless it conflicts with the rules below): ${value.videoIdea}`,
    `BRAND: ${value.brandName}. WHAT THE BRAND SELLS: ${value.description}`,
    `AUDIENCE: ${value.audience}. Choose presenter casting, tone, setting and pacing for these viewers.`,
    `AESTHETICS: ${value.aesthetics}. Apply to lighting, colour, background and mood; never recolor the product.`,
    `CONFIRMED SELLING POINTS (the only claims allowed): ${value.sellingPoints}`,
    "TIMED SHOT PLAN",
    ...shots,
    audio
      ? `SOUND: Any speech or voiceover is in ${speech}, mentions only the brand name and confirmed selling points, and matches visible lip movement. Original background music; no copied songs.`
      : "MUTED OUTPUT: no speech, dialogue, music or sound effects. Mouths remain still.",
    "RULES: The supplied photos define the exact product; keep it identical in every shot. Any person is ONE fictional adult unless the idea asks for more; no real or famous people and no minors. Do not generate text, logos, prices or contact details; the exact logo and brand details are added after the video. Do not invent claims, discounts or facts beyond the confirmed selling points.",
    negativePrompt,
  ].join("\n\n");
  return { prompt, negativePrompt };
}
