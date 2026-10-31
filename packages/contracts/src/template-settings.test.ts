import { describe, expect, it } from "vitest";
import { AdminTemplateDetailsSchema, effectiveTemplateDurations, effectiveTemplateLanguages } from "./template-settings.js";

describe("template settings", () => {
  it("accepts a partial change and null as a reset", () => {
    const parsed = AdminTemplateDetailsSchema.parse({ expectedRevision: 0, displayName: { en: " Name ", ar: "اسم" }, tags: null });
    expect(parsed.displayName?.en).toBe("Name");
    expect(parsed.tags).toBeNull();
  });

  it("requires a real change and both languages of any copy", () => {
    expect(AdminTemplateDetailsSchema.safeParse({ expectedRevision: 0 }).success).toBe(false);
    expect(AdminTemplateDetailsSchema.safeParse({ expectedRevision: 0, displayOutcome: { en: "Only English", ar: " " } }).success).toBe(false);
  });

  it("offers English and Arabic only, and always at least one", () => {
    for (const enabledLanguages of [[], ["bilingual"], ["en", "en"], ["en", "ar", "en"]])
      expect(AdminTemplateDetailsSchema.safeParse({ expectedRevision: 0, enabledLanguages }).success).toBe(false);
    expect(AdminTemplateDetailsSchema.safeParse({ expectedRevision: 0, enabledLanguages: ["ar"] }).success).toBe(true);
  });

  it("narrows to what the version supports and ignores a choice that no longer overlaps", () => {
    expect(effectiveTemplateLanguages(["ar", "en", "bilingual"], ["en"])).toEqual(["en"]);
    expect(effectiveTemplateLanguages(["en"], ["ar"])).toEqual(["en"]);
    expect(effectiveTemplateLanguages(["en", "ar"], undefined)).toEqual(["en", "ar"]);
    expect(effectiveTemplateDurations([8, 15, 20], [20, 15])).toEqual([15, 20]);
    expect(effectiveTemplateDurations([8], [20])).toEqual([8]);
  });
});
