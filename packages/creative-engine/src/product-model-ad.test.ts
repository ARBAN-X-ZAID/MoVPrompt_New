import { LEGACY_UGC_RECIPE_V3 } from "./catalog.js";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { defaultProductModelAdSettings, type TemplatePhotoReference } from "@movprompt/contracts";
import { CREATIVE_TEMPLATE_CATALOG, getCreativeTemplate } from "./catalog.js";
import { ENGINE_VERSION, type CreativeBrief } from "./types.js";
import { resolveDurationRecipe } from "./duration-recipes.js";
import { assertDurationVariant, compileTemplatePrompt, TEMPLATE_PROMPT_LIMIT, TEMPLATE_RETRY_LIMIT } from "./template-prompt.js";

const product: TemplatePhotoReference = { mimeType: "image/png", referenceRole: "subject" };
const model: TemplatePhotoReference = { mimeType: "image/png", referenceRole: "character", personRightsConfirmed: true };
function brief(duration: number, photos: TemplatePhotoReference[] = [product], language: "en" | "ar" | "bilingual" = "en"): CreativeBrief {
  const template = getCreativeTemplate("product-with-model-ad");
  const recipe = resolveDurationRecipe({ id: template.id, duration, durationRecipes: template.durationRecipes!, photos });
  const settings = defaultProductModelAdSettings();
  if (photos.includes(model)) settings.modelChoice = "reference_adult";
  return { productModelAd: settings, engineVersion: ENGINE_VERSION, templateId: template.id, templateRecipeVersion: 2, templatePromptVersion: `${template.id}-v2`, templateVisualSystem: template.visualSystem, durationVariant: recipe.id,
    market: "KW", language, arabicDialect: language === "en" ? null : "kuwaiti", dialectRegister: template.dialectRegister, tone: template.tone, vertical: "ecommerce", goal: "launch",
    product: { name: "Uploaded bag", brand: "", description: "Brown leather bag", callToAction: "Discover", whatsapp: "", bookingUrl: "", price: "", offer: "", location: "" }, scenes: recipe.scenes, qualityPolicy: template.qualityPolicy };
}

describe("Product With Model Ad isolated recipes", () => {
  it("uses uploaded product and adult identity instead of the preview identities", () => {
    const value = brief(15, [product, model]);
    value.product.name = "Blue watch";
    value.product.description = "Blue watch with a steel strap";
    const { prompt, negativePrompt } = compileTemplatePrompt({ brief: value, photos: [product, model], aspectRatio: "9:16" });
    expect(prompt).toContain("[Image 2] are angles of ONE consenting adult");
    expect(prompt).toContain("Blue watch with a steel strap");
    expect(prompt).toContain("Never reuse the preview product, presenter");
    expect(prompt).not.toContain("burgundy");
    expect(prompt).not.toContain("gold clasp");
    expect(prompt).not.toContain("dark shoulder-length hair");
    expect(prompt).not.toContain("MUTED OUTPUT");
    expect(negativePrompt).not.toContain("music");
    expect(prompt).toContain("11–15s");
  });
  it("casts a realistic adult only when no presenter references are selected", () => {
    const value = brief(15);
    expect(compileTemplatePrompt({ brief: value, photos: [product], aspectRatio: "9:16" }).prompt).toContain("fictional photorealistic adult");
    expect(() => compileTemplatePrompt({ brief: value, photos: [product, model], aspectRatio: "9:16" })).toThrow("unselect_model_photos");
  });
  it("keeps a filled 20-second ad brief within the provider prompt limit", () => {
    const value = brief(20);
    value.product.description = "D".repeat(500);
    value.productModelAd!.aesthetics = "A".repeat(240);
    value.productModelAd!.sellingPoint = "S".repeat(160);
    const result = compileTemplatePrompt({ brief: value, photos: [product], aspectRatio: "9:16" });
    expect(result.prompt.length).toBeLessThanOrEqual(TEMPLATE_PROMPT_LIMIT);
  });
  it("preserves the 63 other recipes and the historical UGC recipe byte for byte", () => {
    expect(CREATIVE_TEMPLATE_CATALOG).toHaveLength(64);
    expect(createHash("sha256").update(JSON.stringify(CREATIVE_TEMPLATE_CATALOG.map(template => template.id === "female-product-review" ? LEGACY_UGC_RECIPE_V3 : template))).digest("hex")).toBe("5b89b79ba366eb81b31061d7a9e9454e72ed1b4cf39353ce2f1c667a4405e5b5");
  });
  it.each([8, 15, 20])("authors a complete distinct %is sequence", duration => {
    const value = brief(duration);
    expect(value.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(duration);
    expect(value.scenes.every(scene => scene.duration > 0)).toBe(true);
    expect(value.scenes.map(scene => scene.direction)).not.toEqual(brief(duration === 8 ? 15 : 8).scenes.map(scene => scene.direction));
  });
  it.each([8, 15, 20].flatMap(duration => ["en", "ar", "bilingual"].map(language => [duration, language] as const)))("compiles %is / %s with ordered references, mute and retry room", (duration, language) => {
    const photos = [product, product, model];
    const value = brief(duration, photos, language as "en" | "ar" | "bilingual");
    const result = compileTemplatePrompt({ brief: value, photos, aspectRatio: "9:16" });
    expect(result.prompt.length).toBeLessThanOrEqual(TEMPLATE_PROMPT_LIMIT);
    expect(result.prompt.length + TEMPLATE_RETRY_LIMIT).toBeLessThan(8000);
    expect(result.prompt).toContain("[Image 3]");
    expect(result.prompt).toContain("MUSIC:");
    expect(result.prompt).not.toContain("No additional featured people");
  });
  it("rejects missing product, fourth photos, video and absent rights", () => {
    for (const photos of [[], [model], [product, product, product, product], [{ mimeType: "video/mp4", referenceRole: "subject" }], [product, { ...model, personRightsConfirmed: undefined }]]) {
      expect(() => compileTemplatePrompt({ brief: brief(8), photos: photos as TemplatePhotoReference[], aspectRatio: "9:16" })).toThrow();
    }
  });
  it("requires uploaded model photos only when that choice is selected", () => {
    const value = brief(8); value.productModelAd!.modelChoice = "reference_adult";
    expect(() => compileTemplatePrompt({ brief: value, photos: [product], aspectRatio: "9:16" })).toThrow("model_photos_required");
    value.productModelAd!.modelChoice = "illustrated_adult";
    expect(() => compileTemplatePrompt({ brief: value, photos: [product, model], aspectRatio: "9:16" })).toThrow("unselect_model_photos");
  });
  it("rejects forged beats, form version, incompatible action and ratio", () => {
    const value = brief(15); value.scenes[0]!.direction = "Invent a second product";
    expect(() => assertDurationVariant(value, 15, [product])).toThrow("mismatch");
    const invalid = brief(8); invalid.productModelAd!.action = "wear";
    expect(() => compileTemplatePrompt({ brief: invalid, photos: [product], aspectRatio: "9:16" })).toThrow();
    expect(() => compileTemplatePrompt({ brief: brief(8), photos: [product], aspectRatio: "1:1" })).toThrow("portrait_required");
  });
  it("rejects oversized copy and inconsistent brand facts before charging", () => {
    const value = brief(8); value.productModelAd!.sellingPoint = "a".repeat(240); value.product.offer = "b".repeat(100);
    expect(() => compileTemplatePrompt({ brief: value, photos: [product], aspectRatio: "9:16" })).toThrow("closing_copy_too_long");
    value.product.offer = ""; value.product.brand = "Other brand";
    expect(() => compileTemplatePrompt({ brief: value, photos: [product], aspectRatio: "9:16" })).toThrow("brand_mismatch");
  });
});
