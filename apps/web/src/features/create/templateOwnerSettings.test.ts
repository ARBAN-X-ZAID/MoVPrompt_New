import { describe, expect, it, vi } from "vitest";
import type { PublicTemplate } from "@movprompt/contracts";

const flags = vi.hoisted(() => ({ managed: false }));
vi.mock("@/config/features", () => ({ isFeatureEnabled: (name: string) => name === "managedTemplates" && flags.managed }));

import { getCreativeTemplate } from "@movprompt/creative-engine";
import { creatorTemplateFromCatalog } from "./templateCatalogMapper";
import { offeredCampaignLanguages, supportedCampaignLanguage } from "./templateCampaignOptions";
import { createDraftProject, getCreatorTemplate, getProjectTemplate, templateLengths } from "./templates";

function published(slug: string, changes: Partial<PublicTemplate> = {}) {
  const recipe = getCreativeTemplate(slug);
  return {
    slug, familyId: recipe.id, versionId: "66e6d8e7c51fa82b8e426931", versionNumber: recipe.versionNumber,
    name: { en: "Owner name", ar: "اسم المالك" }, description: { en: "Owner copy", ar: "وصف المالك" },
    outcome: "Owner outcome", category: recipe.category, discoveryCategory: recipe.discoveryCategory,
    durationSeconds: recipe.durationSeconds, supportedLanguages: ["en", "ar"], supportedRatios: recipe.supportedRatios,
    tags: ["owner"], verticals: recipe.verticals, goals: recipe.goals, requiredInputs: recipe.requiredInputs,
    dialectPolicy: { register: recipe.dialectRegister }, qualityStatus: recipe.qualityStatus, scenes: [],
    executableDefinition: recipe, ...changes,
  } as unknown as PublicTemplate;
}

describe("owner template settings in the browser", () => {
  it("reaches the bundled Create template with managed templates off", () => {
    expect(getCreatorTemplate("restaurant-food-hero").name).not.toBe("Owner name");
    creatorTemplateFromCatalog(published("restaurant-food-hero", { localizedOutcome: { en: "Owner outcome", ar: "نتيجة المالك" } }));
    const template = getCreatorTemplate("restaurant-food-hero");
    expect(template).toMatchObject({ name: "Owner name", nameAr: "اسم المالك", description: "Owner copy", bestFor: "Owner outcome", bestForAr: "نتيجة المالك", tags: ["owner"] });
    expect(template.versionId).toBeUndefined();
    expect(template.scenes.length).toBeGreaterThan(0);
    expect(getProjectTemplate({ templateId: "restaurant-food-hero" }).name).toBe("Owner name");
  });

  it("uses server settings over the recipe with managed templates on", () => {
    flags.managed = true;
    try {
      const mapped = creatorTemplateFromCatalog(published("fashion-product-showcase", { supportedLanguages: ["ar"] }));
      expect(mapped).toMatchObject({ name: "Owner name", descriptionAr: "وصف المالك", languages: ["ar"], serverPublished: true });
      expect(mapped.definition?.localizedName.en).not.toBe("Owner name");
    } finally { flags.managed = false; }
  });

  it("keeps bundled values when the catalog never answered", () => {
    expect(getCreatorTemplate("premium-phone-reveal").name).toBe(getCreativeTemplate("premium-phone-reveal").localizedName.en);
  });

  it("starts a draft on an enabled language and an enabled length", () => {
    const recipe = getCreativeTemplate("jewelry-product-showcase");
    creatorTemplateFromCatalog(published("jewelry-product-showcase", { supportedLanguages: ["ar"], supportedDurations: [15, 20] }));
    const draft = createDraftProject("jewelry-product-showcase");
    expect(recipe.durationSeconds).toBe(8);
    expect(draft.language).toBe("ar");
    expect(draft.durationSeconds).toBe(15);
    expect(draft.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(15);
  });

  it("keeps the default language and length while they stay enabled", () => {
    creatorTemplateFromCatalog(published("perfume-launch", { supportedLanguages: ["en", "ar"], supportedDurations: [8, 15] }));
    const draft = createDraftProject("perfume-launch");
    expect(draft.language).toBe("en");
    expect(draft.durationSeconds).toBe(getCreatorTemplate("perfume-launch").duration);
  });

  it("repairs languages toward what is offered and never offers bilingual", () => {
    expect(offeredCampaignLanguages(["ar", "en", "bilingual"])).toEqual(["en", "ar"]);
    expect(supportedCampaignLanguage("en", { languages: ["ar"] })).toBe("ar");
    expect(supportedCampaignLanguage("bilingual", { languages: ["en", "ar"] })).toBe("en");
    expect(supportedCampaignLanguage("ar", { languages: ["en", "ar"] })).toBe("ar");
  });

  it("reports every selectable length instead of the preview length", () => {
    expect(templateLengths({ duration: 8, supportedDurations: [8, 15, 20] })).toEqual([8, 15, 20]);
    expect(templateLengths({ duration: 12 })).toEqual([12]);
  });
});
