import { describe, expect, it } from "vitest";

import { buildTemplatePreflightManifest } from "./template-generation-preflight.js";

const reference = {
  path: "apps/web/public/create/sample-kinza.jpg",
  mimeType: "image/jpeg" as const,
  bytes: 120_000,
  width: 1200,
  height: 2134,
  checksumSha256: "a".repeat(64),
};

describe("zero-cost twelve-template Seedance preflight", () => {
  it("compiles every template across all languages and output ratios without provider calls", () => {
    const manifest = buildTemplatePreflightManifest(reference);
    expect(manifest).toMatchObject({
      status: "passed",
      paidProviderCalls: 0,
      model: "bytedance/seedance-2.5",
      templateCount: 12,
      languageCount: 3,
      outputRatioCount: 4,
      caseCount: 144,
    });
    expect(new Set(manifest.templates.map((template) => template.templateId))).toHaveLength(12);
    expect(new Set(manifest.templates.flatMap((template) => template.cases.map((item) => item.language)))).toEqual(
      new Set(["ar", "en", "bilingual"]),
    );
    expect(manifest.templates.flatMap((template) => template.cases).filter((item) => item.outputRatio === "4:5"))
      .toHaveLength(36);
    expect(manifest.templates.flatMap((template) => template.cases).find((item) => item.outputRatio === "4:5"))
      .toMatchObject({ providerRatio: "3:4", exportStrategy: "deterministic_crop_4:5" });
  });

  it("retains CTA, market, reference and recipe evidence for every matrix case", () => {
    const manifest = buildTemplatePreflightManifest(reference);
    for (const template of manifest.templates) {
      expect(template.requiredInputs.length, template.templateId).toBeGreaterThan(0);
      expect(template.capabilityPolicy.length, template.templateId).toBeGreaterThan(0);
      expect(template.caseCount, template.templateId).toBe(12);
      for (const item of template.cases) {
        expect(item.market, item.caseId).toBe("KW");
        expect(item.callToAction.trim().length, item.caseId).toBeGreaterThan(0);
        expect(item.referenceChecksumSha256, item.caseId).toBe(reference.checksumSha256);
        expect(item.promptLength, item.caseId).toBeGreaterThan(500);
        expect(item.promptLength, item.caseId).toBeLessThanOrEqual(8_000);
        expect(item.dialectScore, item.caseId).toBeGreaterThanOrEqual(90);
      }
    }
  });
});
