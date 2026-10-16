import { describe, expect, it } from "vitest";
import { AD_STUDIO_BRAND_AD_ID, AD_STUDIO_BRAND_AD_LIMITS, AD_STUDIO_BRAND_AD_RATIOS, defaultAdStudioBrandAdSettings, type AdStudioBrandAdSettings, type TemplatePhotoReference } from "@movprompt/contracts";
import { getCreativeTemplate } from "./catalog.js";
import { ENGINE_VERSION, type CreativeBrief } from "./types.js";
import { resolveDurationRecipe } from "./duration-recipes.js";
import { compileCreativeDirection } from "./prompt-compiler.js";
import { compileTemplatePrompt, TEMPLATE_PROMPT_LIMIT, TEMPLATE_RETRY_LIMIT } from "./template-prompt.js";
import { CUSTOM_FORM_TEMPLATE_CATALOG } from "./product-model-ad.js";

const product: TemplatePhotoReference = { mimeType: "image/png", referenceRole: "subject" };
const settings = (overrides: Partial<AdStudioBrandAdSettings> = {}): AdStudioBrandAdSettings => ({
  ...defaultAdStudioBrandAdSettings(),
  brandName: "Oud Al Layl",
  sellingPoints: "Free delivery in Kuwait, lasts 12 hours",
  aesthetics: "Dark, luxury, warm gold light",
  audience: "Women 25 to 40 in Kuwait",
  description: "Handmade oud perfumes made in Kuwait",
  videoIdea: "A woman sprays the perfume on her wrist and smiles.",
  ...overrides,
});
function brief(duration: number, value = settings(), photos: TemplatePhotoReference[] = [product], language: "en" | "ar" | "bilingual" = "en"): CreativeBrief {
  const template = getCreativeTemplate(AD_STUDIO_BRAND_AD_ID);
  const recipe = resolveDurationRecipe({ id: template.id, duration, durationRecipes: template.durationRecipes!, photos });
  return { adStudioBrandAd: value, engineVersion: ENGINE_VERSION, templateId: template.id, templateRecipeVersion: 1, templatePromptVersion: `${template.id}-v1`, templateVisualSystem: template.visualSystem, durationVariant: recipe.id,
    market: "KW", language, arabicDialect: language === "en" ? null : "kuwaiti", dialectRegister: template.dialectRegister, tone: template.tone, vertical: "ecommerce", goal: "launch",
    product: { name: value.brandName, brand: value.brandName, description: value.description, callToAction: "Shop now", whatsapp: "", bookingUrl: "", price: "", offer: "", location: "" }, scenes: recipe.scenes, qualityPolicy: template.qualityPolicy };
}

describe("Ad Studio brand ad recipe", () => {
  it("is a registered custom-form template with every supported shape and length", () => {
    const template = CUSTOM_FORM_TEMPLATE_CATALOG.find(item => item.id === AD_STUDIO_BRAND_AD_ID)!;
    expect(template.supportedRatios).toEqual([...AD_STUDIO_BRAND_AD_RATIOS]);
    expect(template.supportedDurations).toEqual([8, 15, 20]);
  });

  it("puts the owner's idea, audience and aesthetics into the prompt with fixed rules after them", () => {
    const { prompt } = compileTemplatePrompt({ brief: brief(15), photos: [product], aspectRatio: "16:9", audio: true });
    const idea = prompt.indexOf("OWNER'S VIDEO IDEA");
    expect(idea).toBeGreaterThan(0);
    expect(prompt.indexOf("RULES:")).toBeGreaterThan(idea);
    expect(prompt).toContain("Women 25 to 40 in Kuwait");
    expect(prompt).toContain("Dark, luxury, warm gold light");
    expect(prompt).toContain("16:9 landscape");
    expect(prompt).toContain("11–15s");
    expect(prompt).not.toContain("MUTED OUTPUT");
  });

  it("follows the sound toggle and spoken language", () => {
    expect(compileTemplatePrompt({ brief: brief(8, settings(), [product], "ar"), photos: [product], aspectRatio: "9:16", audio: true }).prompt).toContain("Kuwaiti Arabic");
    const muted = compileCreativeDirection({ rawPrompt: "", creativeBrief: brief(8), audioEnabled: false, references: [product], aspectRatio: "1:1" });
    expect(muted.prompt).toContain("MUTED OUTPUT");
    expect(muted.negativePrompt).toContain("speech, music or sound effects");
  });

  it("keeps the longest allowed answers within the template prompt limit for every length and shape", () => {
    const longest = settings(Object.fromEntries(["brandName", "sellingPoints", "aesthetics", "audience", "description", "videoIdea"]
      .map(key => [key, "W".repeat(AD_STUDIO_BRAND_AD_LIMITS[key as keyof typeof AD_STUDIO_BRAND_AD_LIMITS])])) as Partial<AdStudioBrandAdSettings>);
    const photos = [product, product, product];
    for (const duration of [8, 15, 20]) {
      for (const ratio of AD_STUDIO_BRAND_AD_RATIOS) {
        const { prompt } = compileTemplatePrompt({ brief: brief(duration, longest, photos, "bilingual"), photos, aspectRatio: ratio, audio: true });
        expect(prompt.length).toBeLessThanOrEqual(TEMPLATE_PROMPT_LIMIT);
        expect(prompt.length + TEMPLATE_RETRY_LIMIT).toBeLessThanOrEqual(8_000);
      }
    }
  });

  it("refuses incomplete forms, mismatched brands and non-product photos", () => {
    expect(() => compileTemplatePrompt({ brief: brief(8, settings({ videoIdea: "" })), photos: [product], aspectRatio: "9:16", audio: true })).toThrow("ad_studio_brand_ad_incomplete");
    const mismatch = brief(8);
    mismatch.product.brand = "Other";
    expect(() => compileTemplatePrompt({ brief: mismatch, photos: [product], aspectRatio: "9:16", audio: true })).toThrow("brand_mismatch");
    const character: TemplatePhotoReference = { mimeType: "image/png", referenceRole: "character", personRightsConfirmed: true };
    expect(() => compileTemplatePrompt({ brief: brief(8), photos: [product, character], aspectRatio: "9:16", audio: true })).toThrow();
  });
});
