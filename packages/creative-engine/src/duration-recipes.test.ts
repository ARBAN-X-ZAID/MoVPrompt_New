import { describe, expect, it } from "vitest";
import { templatePhotoIssues, type TemplatePhotoReference } from "@movprompt/contracts";
import { CREATIVE_TEMPLATE_CATALOG, LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "./catalog.js";
import { resolveDurationRecipe, LAUNCH_PHOTO_POLICIES } from "./duration-recipes.js";
import { compileCreativeDirection } from "./prompt-compiler.js";
import { ENGINE_VERSION, type CreativeTemplateRecipe } from "./types.js";

function compile(template: CreativeTemplateRecipe, duration: number, photos: TemplatePhotoReference[], product = {}) {
  const variant = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration, photos });
  return compileCreativeDirection({ rawPrompt: "Test", audioEnabled: false, references: photos, aspectRatio: "9:16", creativeBrief: {
    engineVersion: ENGINE_VERSION, templateId: template.id, templateRecipeVersion: template.versionNumber, templatePromptVersion: `${template.id}-v${template.versionNumber}`, durationVariant: variant.id, templateVisualSystem: template.visualSystem,
    market: "KW", language: "en", arabicDialect: null, dialectRegister: template.dialectRegister, tone: template.tone, vertical: template.verticals[0], goal: template.goals[0],
    product: { name: "Confirmed subject", callToAction: "Discover", ...product }, scenes: variant.scenes, qualityPolicy: template.qualityPolicy,
  } });
}

describe("immutable duration-specific launch recipes", () => {
  it("adds jewelry to the launch templates without changing the 50 internal recipes", () => {
    expect(LAUNCH_CREATIVE_TEMPLATE_CATALOG).toHaveLength(14);
    expect(CREATIVE_TEMPLATE_CATALOG.filter(template => !template.durationRecipes)).toHaveLength(50);
  });
  it.each([8, 15, 20])("jewelry preserves the supplied set and uses the approved silent luxury direction at %is", duration => {
    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === "jewelry-product-showcase")!;
    const photos = [{ referenceRole: "subject" as const, mimeType: "image/png" }];
    const recipe = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration, photos });
    expect(recipe.scenes.map(scene => scene.duration)).toEqual(duration === 8 ? [2, 2, 2, 2] : duration === 15 ? [3, 4, 5, 3] : [4, 6, 6, 4]);
    const result = compile(template, duration, photos);
    expect(result.prompt).toContain("JEWELRY IDENTITY AND SET LOCK");
    expect(result.prompt).toContain("keep that exact piece count");
    expect(result.prompt).toContain("black lacquer");
    expect(result.prompt).toContain("No cloth, fabric");
    expect(result.prompt).toContain("MUTED OUTPUT");
    expect(recipe.scenes[0]!.direction).toMatch(/close|detail/i);
    expect(recipe.scenes.at(-1)!.direction).toMatch(/full|complete/);
    expect(template.capabilityPolicy.some(capability => capability.startsWith("speech."))).toBe(false);
  });
  it.each([8, 15, 20])("gift reveal opens the supplied package with one hand at %is", duration => {
    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === "luxury-gift-reveal")!;
    const photos = [{ referenceRole: "subject" as const, mimeType: "image/jpeg" }];
    const recipe = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration, photos });
    expect(recipe.scenes.map(scene => scene.duration)).toEqual(duration === 8 ? [1, 3, 2, 2] : duration === 15 ? [3, 4, 5, 3] : [4, 6, 6, 4]);
    const result = compile(template, duration, photos);
    expect(result.prompt).toContain("GIFT IDENTITY LOCK");
    expect(result.prompt).toContain("not the opening frame");
    expect(result.prompt).toContain("One consistent adult hand");
    expect(result.prompt).toContain("MUTED OUTPUT");
    expect(result.prompt).toContain("No detached hinge");
    expect(recipe.scenes[0]!.direction).toMatch(/closed/i);
    expect(recipe.scenes.at(-1)!.direction).toContain("no frozen hold");
    expect(recipe.scenes.at(-1)!.direction).not.toContain("Finish with a stable hold.");
  });
  it("keeps the revised eight-second jewelry close moving without a conflicting frozen-hold instruction", () => {
    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === "jewelry-product-showcase")!;
    const photos = [{ referenceRole: "subject" as const, mimeType: "image/png" }];
    const recipe = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration: 8, photos });
    expect(recipe.id).toBe("jewelry-product-showcase-v3-8s");
    expect(recipe.scenes[2]!.camera).toContain("continuous diagonal pullback");
    expect(recipe.scenes[3]!.direction).toContain("continue moving through the closing frame");
    expect(recipe.scenes[3]!.direction).not.toContain("Finish with a stable hold.");
    expect(compile(template, 8, photos).prompt).not.toContain("Stop the camera");
    for (const duration of [15, 20]) {
      const longer = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration, photos });
      expect(longer.scenes.at(-1)!.direction).toContain("Finish with a stable hold.");
    }
  });
  for (const template of LAUNCH_CREATIVE_TEMPLATE_CATALOG) {
    for (const duration of [8, 15, 20]) {
      it(`${template.id} ${duration}s: timing, references, mute and bounded prompt`, () => {
        const photos = template.photoPolicy!.groups.flatMap(group => Array.from({ length: group.max }, () => ({ referenceRole: group.role, mimeType: "image/png", ...(group.role === "character" ? { personRightsConfirmed: true as const } : {}) })));
        const recipe = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration, photos });
        expect(recipe.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(duration);
        expect(recipe.scenes.every(scene => Number.isInteger(scene.duration) && scene.duration > 0)).toBe(true);
        expect(recipe.scenes.length).toBeLessThanOrEqual(6);
        const prompt = compile(template, duration, photos).prompt;
        expect(prompt).toContain("MUTED OUTPUT");
        expect(prompt.length + 750 + 160).toBeLessThanOrEqual(8000);
        for (let index = 1; index <= photos.length; index++) expect(prompt).toContain(`[Image ${index}]`);
        expect([...prompt.matchAll(/\[Image (\d+)\]/g)].every(match => Number(match[1]) <= photos.length)).toBe(true);
        if (duration > 8) expect(recipe.scenes[0]?.direction).not.toBe(template.durationRecipes!["8"]!.scenes[0]?.direction);
      });
    }
  }
  it.each([1, 2, 3, 4, 5])("shows every property photo in order, including %i photos", count => {
    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === "real-estate-property")!;
    const photos = Array.from({ length: count }, () => ({ referenceRole: "property" as const, mimeType: "image/jpeg" }));
    for (const duration of [8, 15, 20]) {
      const recipe = resolveDurationRecipe({ id: template.id, durationRecipes: template.durationRecipes!, duration, photos });
      if (count > 1) expect(recipe.scenes.map(scene => scene.direction.match(/\[Image (\d+)\]/)?.[1])).toEqual([...photos.map((_, index) => String(index + 1)), "1"]);
      expect(recipe.scenes.reduce((sum, scene) => sum + scene.duration, 0)).toBe(duration);
    }
  });
  it("rejects oversized confirmed facts instead of clipping them", () => {
    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === "perfume-advertisement")!;
    expect(() => compile(template, 8, [{ mimeType: "image/png" }], { description: "A".repeat(2000), name: "N".repeat(240), brand: "B".repeat(240), offer: "O".repeat(500), location: "L".repeat(500) })).toThrow();
  });
  it.each([8, 15, 20])("UGC v3 preserves character rendering style independently of the product at %is", duration => {
    const template = LAUNCH_CREATIVE_TEMPLATE_CATALOG.find(item => item.id === "female-product-review")!;
    const result = compile(template, duration, [{ referenceRole: "subject", mimeType: "image/png" }, { referenceRole: "character", mimeType: "image/png", personRightsConfirmed: true }]);
    expect(result.prompt).toContain(`female-product-review-v3-${duration}s`);
    expect(result.prompt).toContain("CHARACTER STYLE LOCK");
    expect(result.prompt).toContain("never turn it into a photorealistic person");
    expect(result.prompt).toContain("Product references independently define the exact product");
    expect(result.prompt).toContain("MUTED OUTPUT");
    expect(result.prompt.length + 750 + 160).toBeLessThanOrEqual(8000);
    expect(compile(template, duration, [{ referenceRole: "subject", mimeType: "image/png" }]).prompt).not.toContain("CHARACTER STYLE LOCK");
  });
});

describe("photo policy boundaries", () => {
  for (const [id, policy] of Object.entries(LAUNCH_PHOTO_POLICIES)) {
    it(`${id} enforces each group's minimum, maximum, roles and files`, () => {
      const minimum = policy.groups.flatMap(group => Array.from({ length: group.min }, () => ({ referenceRole: group.role, mimeType: "image/png" })));
      expect(templatePhotoIssues(policy, minimum)).toEqual([]);
      expect(templatePhotoIssues(policy, [])).not.toEqual([]);
      for (const group of policy.groups) {
        const photos = [...minimum.filter(photo => photo.referenceRole !== group.role), ...Array.from({ length: group.max + 1 }, () => ({ referenceRole: group.role, mimeType: "image/png", personRightsConfirmed: true as const }))];
        expect(templatePhotoIssues(policy, photos)).toContain(`${group.role}_photo_limit_${group.max}`);
      }
      expect(templatePhotoIssues(policy, [{ ...minimum[0], mimeType: "video/mp4" }])).toContain("photo_type_unsupported");
      if (id !== "female-product-review") expect(templatePhotoIssues(policy, [{ referenceRole: "character", personRightsConfirmed: true }])).toContain("photo_role_unsupported");
    });
  }
  it("separates character identity from product identity and requires rights", () => {
    const policy = LAUNCH_PHOTO_POLICIES["female-product-review"]!;
    expect(templatePhotoIssues(policy, [{ referenceRole: "subject" }, { referenceRole: "character" }])).toContain("character_rights_required");
    expect(templatePhotoIssues(policy, [{ referenceRole: "character", personRightsConfirmed: true }])).toContain("subject_photos_required");
  });
});
