import { PRODUCT_MODEL_AD_ID, PRODUCT_MODEL_AD_FORM, ProductModelAdSettingsSchema, type TemplatePhotoReference } from "@movprompt/contracts";
import { AD_STUDIO_BRAND_AD_ID } from "@movprompt/contracts";
import { CreativeTemplateRecipeSchema, type CreativeBrief, type TemplateSceneRecipe } from "./types.js";
import { AD_STUDIO_BRAND_AD_RECIPE } from "./ad-studio-brand-ad.js";

const beats: Record<number, number[]> = { 8: [1, 2, 3, 2], 15: [3, 4, 5, 3], 20: [4, 6, 6, 4] };
const actions: Record<number, string[]> = {
  8: [
    "Start immediately with the supplied product prominent beside one adult presenter. A brief lateral reveal catches their natural glance toward the product. No fade-in.",
    "The presenter makes one deliberate, physically supported presentation gesture. The product stays large, readable and in its supplied orientation. Match-cut on the gesture into the next view.",
    "Cut to a visible product detail, using the next supplied product view or a crop of the primary. Shift focus from the contact point to its real material detail, then cut back to the same presenter. Keep movement tactile and brief.",
    "The presenter settles the exact product into a clear hero composition beside their face in the upper half. Continue a subtle light change and leave the lower half unobstructed for the closing message. Hold readable identity through the final second.",
  ],
  15: [
    "A foreground edge reveals the supplied product and one adult presenter. Follow a short sideways move into a calm medium composition as the presenter looks toward the product. Establish the product before introducing a gesture.",
    "The presenter makes one supported presentation gesture, pauses to let the product read, then brings it slightly closer without turning into an unseen side. Keep believable fingers and contact shadows. Cut on the completion of the gesture.",
    "Show two supplied-view detail framings: first the actual material, then a visible construction or label detail. A gentle focus transfer connects each framing. Return to the same presenter with the product in the same grip; no opening or usage claim unless visibly supported.",
    "The presenter positions the product beside their face in the upper half, keeping it unobscured. A soft background light sweep settles into a clean hero close with the lower half free for the exact campaign message.",
  ],
  20: [
    "Begin with a supplied product detail, then cut to the same product beside one adult presenter. A short lateral move reveals their complete pose. Establish face, wardrobe, product scale and setting before the physical action.",
    "The presenter approaches the display surface or takes one small step while holding the exact product. Complete one supported presentation gesture, pause, then settle the grip. No wardrobe change, unreferenced product back, opening mechanism or invented feature.",
    "Use two clean detail cuts based on supplied views or visible crops. Trace one real material detail with a short lateral glide, then transfer focus to a second real feature. Return to the presenter at the same position and product orientation. Light and contact shadows remain continuous.",
    "The presenter places or holds the product beside their face in the upper half of a balanced final composition, keeping its complete identity clear. The motion slows naturally as the background light settles. Keep the final two seconds readable with the lower half unobstructed for exact branding.",
  ],
};

function scenes(duration: number): TemplateSceneRecipe[] {
  return beats[duration]!.map((seconds, index) => ({
    id: `${PRODUCT_MODEL_AD_ID}-beat-${index + 1}`,
    title: { en: ["First impression", "Product presentation", "Real details", "Brand close"][index]!, ar: ["الانطباع الأول", "عرض المنتج", "التفاصيل الحقيقية", "ختام العلامة"][index]! },
    purpose: { en: "Show the exact product with one consistent adult model", ar: "عرض المنتج نفسه مع شخصية بالغة ثابتة" },
    duration: seconds,
    headline: { en: "Your product", ar: "منتجك" }, voiceover: { en: "Silent", ar: "صامت" },
    direction: actions[duration]![index]!,
    shot: index === 2 ? "supplied visible-detail crop, then matching medium view" : "product-forward medium portrait with clear hands",
    camera: index === 2 ? "one short detail glide and a focus transfer" : "brief lateral reveal followed by a steady composition",
    lighting: "soft commercial key, consistent fill, accurate product colors and grounded contact shadows",
    continuityAnchor: "One adult, one wardrobe, same product and setting; clean cuts preserve grip and orientation. Never invent hidden surfaces.",
  }));
}

export const PRODUCT_MODEL_AD_RECIPE_V1 = CreativeTemplateRecipeSchema.parse({
  id: PRODUCT_MODEL_AD_ID, slug: PRODUCT_MODEL_AD_ID, versionNumber: 1,
  category: "model-product-ad", discoveryCategory: "advertising",
  localizedName: { en: "Product With Model Ad", ar: "إعلان منتج مع عارض" },
  localizedDescription: { en: "Create a silent product commercial with a consistent adult model and your brand kit.", ar: "إعلان منتج صامت بشخصية بالغة ثابتة وهوية علامتك." },
  outcome: "A reference-led product and model commercial with exact brand finishing",
  verticals: ["retail", "ecommerce"], goals: ["launch", "whatsapp_orders", "brand_story"],
  durationSeconds: 8, supportedDurations: [8, 15, 20],
  photoPolicy: { version: 1, groups: [{ role: "subject", min: 1, max: 3 }, { role: "character", min: 0, max: 3 }] },
  durationRecipes: Object.fromEntries([8, 15, 20].map(duration => [String(duration), { id: `${PRODUCT_MODEL_AD_ID}-v1-${duration}s`, scenes: scenes(duration) }])),
  supportedLanguages: ["en", "ar", "bilingual"], supportedRatios: ["9:16"], supportedMarkets: ["KW"],
  requiredInputs: ["product_reference", "call_to_action"],
  starterRenderEligible: false, qualityStatus: "development", storyArc: "demo", tone: "premium", dialectRegister: "polished",
  visualSystem: "Product-forward editorial commercial, one consistent adult presenter, tactile supported movement, motivated detail cuts and clear lower-half finishing space in the closing composition",
  soundDirection: "Completely silent: no speech, music or effects",
  capabilityPolicy: ["video.product_fidelity", "video.cinematic"],
  protectedLayers: ["product_identity", "model_identity", "confirmed_brand_kit", "confirmed_facts"],
  complianceRules: ["Uploaded models must show one consenting adult; preserve the rendering style and likeness", "Generate no lettering, claims, extra products or unreferenced product surfaces"],
  qualityPolicy: { tier: "premium", acceptanceScore: 85, internalRetryLimit: 0, hardGates: ["technical", "product_identity", "compliance"], scoredDimensions: ["motion_realism", "visual_artifacts", "safe_zones"] },
  tags: ["product", "model", "brand-kit", "silent"], scenes: scenes(8),
});
const carActions = [
  "Begin on the exact uploaded product supported by the selected adult at the open passenger doorway of a parked car. Reveal to a medium view with one short sideways move; keep face unobscured. Wearable products are already worn correctly; never change their construction to make them handheld.",
  "Cut on the supported grip or pose. With both feet already on the pavement, the same adult stands naturally, clears the open doorway and steps outside. Follow sideways. Keep the product supported or worn throughout; no moving car, detached hands or walking through panels.",
  "Match-cut to the actual visible product detail during two measured steps. Track its gentle natural movement; transfer focus once from contact point to a supplied material or construction detail. Use only supplied angles or crops. Never invent a handle, clasp, logo, opening or reverse side.",
  "Track beside the same adult walking away from the parked car. Keep face and complete product readable together and above the closing-message area. Continue a natural stride through the final frame, with a restrained glance to camera. No face-covering product, frozen finish or fade to black.",
];
function carScenes(duration: number): TemplateSceneRecipe[] {
  const timings = duration === 15 ? [3, 4, 4, 4] : duration === 20 ? [4, 6, 6, 4] : [1, 2, 3, 2];
  return scenes(duration).map((scene, index) => ({
    ...scene, duration: timings[index]!,
    title: { en: ["Product introduction", "Confident arrival", "Detail in motion", "Walking hero"][index]!, ar: ["تقديم المنتج", "وصول واثق", "تفاصيل متحركة", "ختام أثناء المشي"][index]! },
    direction: carActions[index]! + (duration === 8 ? " Use one concise action and a clean cut." : duration === 20 ? " Let the action develop with a brief readable detail hold while physical movement continues." : " Keep the transition deliberate and product-led."),
    camera: index === 2 ? "short lateral detail tracking and one focus transfer" : "steady lateral tracking at the model's pace",
    lighting: "consistent soft late-afternoon light, true product colors and grounded contact shadows",
    continuityAnchor: "Same uploaded product and adult identity, wardrobe, grip and parked car; passenger door stays open. No new product details.",
  }));
}
/** New immutable direction; the original silent recipe remains available for historical records. */
export const PRODUCT_MODEL_AD_RECIPE = CreativeTemplateRecipeSchema.parse({
  ...PRODUCT_MODEL_AD_RECIPE_V1, versionNumber: 2,
  localizedDescription: { en: "Turn product images into a presenter-led ad with music, an optional logo and a closing action.", ar: "حوّل صور المنتج إلى إعلان بشخصية وموسيقى وشعار اختياري ودعوة ختامية." },
  outcome: "A product and presenter commercial with optional logo finishing and an exact closing action",
  visualSystem: "Reference-led luxury car-arrival commercial: product introduction, natural exit, moving detail and walking hero. Product and presenter uploads determine identity, never the example video.",
  soundDirection: "Original instrumental fashion-ad music around 120 BPM, warm bass, soft keys and restrained percussion. No vocals, dialogue or narration.",
  tags: ["product", "model", "brand-kit", "music", "arrival"],
  durationRecipes: Object.fromEntries([8, 15, 20].map(duration => [String(duration), { id: `${PRODUCT_MODEL_AD_ID}-v2-${duration}s`, scenes: carScenes(duration) }])),
  scenes: carScenes(8),
});
export const CUSTOM_FORM_TEMPLATE_CATALOG = Object.freeze([PRODUCT_MODEL_AD_RECIPE, AD_STUDIO_BRAND_AD_RECIPE]);
export const CUSTOM_TEMPLATE_FORM_DEFINITIONS = { [PRODUCT_MODEL_AD_ID]: PRODUCT_MODEL_AD_FORM };
/** Custom forms that publish without a sample video because the owner writes the direction. */
export const PREVIEWLESS_CUSTOM_TEMPLATE_IDS: readonly string[] = [AD_STUDIO_BRAND_AD_ID];

export function assertProductModelAd(brief: CreativeBrief, photos: readonly TemplatePhotoReference[], aspectRatio: string): void {
  const settings = ProductModelAdSettingsSchema.parse(brief.productModelAd);
  if (aspectRatio !== "9:16") throw new Error("product_model_ad_portrait_required");
  const characters = photos.filter(photo => photo.referenceRole === "character");
  if (settings.modelChoice === "reference_adult" && !characters.length) throw new Error("product_model_ad_model_photos_required");
  if (settings.modelChoice !== "reference_adult" && characters.length) throw new Error("product_model_ad_unselect_model_photos");
  if (settings.brandKit.name !== brief.product.brand) throw new Error("product_model_ad_brand_mismatch");
  if (settings.brandKit.website !== (brief.product.bookingUrl ?? "") || settings.brandKit.whatsapp !== brief.product.whatsapp) throw new Error("product_model_ad_contact_mismatch");
  const closingCopy = [settings.brandKit.name, settings.brandKit.tagline, ...settings.brandKit.sellingPoints, settings.sellingPoint, brief.product.offer, brief.product.callToAction, settings.brandKit.website, settings.brandKit.whatsapp].filter(Boolean).join(" ");
  if (closingCopy.length > 300) throw new Error("product_model_ad_closing_copy_too_long: Keep the combined closing message, brand and contacts within 300 characters.");
  const lines = [settings.brandKit.name, settings.brandKit.tagline, ...settings.brandKit.sellingPoints, settings.sellingPoint, brief.product.offer, brief.product.callToAction, settings.brandKit.website, settings.brandKit.whatsapp].filter(Boolean).reduce((sum, text) => sum + Math.ceil(Array.from(text).length / 24), 0);
  if (lines > 8) throw new Error("product_model_ad_closing_copy_too_long: Shorten the closing details so they fit clearly beside your logo.");
}

export function productModelAdDirection(brief: CreativeBrief, photos: readonly TemplatePhotoReference[]): string[] {
  const value = ProductModelAdSettingsSchema.parse(brief.productModelAd);
  const characters = photos.flatMap((photo, index) => photo.referenceRole === "character" ? [`[Image ${index + 1}]`] : []);
  const wearingClothing = value.action === "wear" && value.category === "clothing";
  const aesthetics = value.aesthetics?.trim() ?? "";
  const casting = value.modelChoice === "realistic_adult" ? "ONE fictional photorealistic adult, age 25 or older; no fixed ethnicity, hairstyle or gender from the example" : "ONE clearly illustrated adult, age 25 or older";
  return [
    "UPLOAD IDENTITY PRIORITY: Selected product images define the exact item, not the demonstration purse. Selected character images alone define the presenter when supplied. Never reuse the preview product, presenter, clothing or colors. Do not force a purse, handle or gold hardware onto another item. Preserve supplied identity and original photographic or illustrated style.",
    characters.length ? `MODEL: ${characters.join(", ")} are angles of ONE consenting adult. Preserve face, hair, proportions and original photo or illustration style. ${wearingClothing ? "The uploaded product garment replaces the reference outfit from the first shot; keep that outfit consistent throughout." : "Keep the reference wardrobe consistent throughout."} These images never define the product.` : `MODEL: ${casting}. ${wearingClothing ? "Wear the exact uploaded garment from the first shot with neutral supporting clothes." : "Wear neutral tailored clothing."} Keep the same face, proportions, wardrobe and chosen rendering style throughout. No celebrity resemblance.`,
    `PRODUCT CATEGORY: ${value.category}. ACTION: ${value.action === "wear" ? "Wear only if the supplied category and construction support it; show the supplied face and preserve fit and scale" : value.action === "hold" ? "Hold the exact product with one natural supported grip; no usage demonstration" : "Present beside the product with one open-hand gesture; do not open or transform it"}.`,
    `SETTING: ${value.setting === "car_arrival" ? "one stationary unbranded sedan at a refined generic entrance; passenger door remains open, soft afternoon daylight" : value.setting === "studio" ? "a commercial studio with a stationary unbranded car set and clear walking space" : "a generic entrance with a stationary unbranded car and clear walking space"}. The car is fictional scenery, not the advertised product. BRAND STYLE: ${value.brandKit.style}. Accents may use ${value.brandKit.primaryColor} and ${value.brandKit.secondaryColor}; never recolor the uploads.`,
    ...(aesthetics ? [`USER VISUAL AESTHETICS: ${aesthetics}. Apply this to lighting, background, pacing and graphic finishing only. Preserve the uploaded product and presenter identities.`] : []),
    ...(value.sellingPoint.trim() ? [`USER-CONFIRMED SELLING POINTS: ${value.sellingPoint.trim()}. Use this text only in deterministic ad copy. Show only product details supported by the uploaded images.`] : []),
    "ACTION ADAPTATION: Hold only portable products with their real support points. Wear clothing/accessories only when selected and physically supported. For present mode or large products, keep the product safely stationary beside the car and let the adult walk alongside it; do not shrink, lift or deform it. Maintain product prominence during the exit and final tracking shot.",
  ];
}
