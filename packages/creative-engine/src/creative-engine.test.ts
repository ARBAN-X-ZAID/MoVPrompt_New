import { describe, expect, it } from "vitest";

import {
  CREATIVE_TEMPLATE_CATALOG,
  CREATIVE_TEMPLATE_CATEGORIES,
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
  LAUNCH_TEMPLATE_IDS,
} from "./catalog.js";
import {
  PROVIDER_BENCHMARK_CORPUS,
  buildBenchmarkCreativeBrief,
  compileBenchmarkDirection,
  runProviderBenchmark,
  scoreProviderBenchmark,
} from "./benchmark.js";
import { compileKuwaitiCampaignCopy, normalizeKuwaitiArabic } from "./kuwaiti-arabic.js";
import { compileCreativeDirection } from "./prompt-compiler.js";
import { evaluateAcceptedOutput, preflightCreativeBrief, type QualityObservation } from "./quality-engine.js";
import { ENGINE_VERSION, type CreativeBrief } from "./types.js";

function brief(): CreativeBrief {
  const template = CREATIVE_TEMPLATE_CATALOG[0]!;
  return {
    engineVersion: ENGINE_VERSION,
    templateId: template.id,
    market: "KW",
    language: "ar",
    arabicDialect: "kuwaiti",
    dialectRegister: template.dialectRegister,
    tone: template.tone,
    vertical: template.verticals[0]!,
    goal: template.goals[0]!,
    product: {
      name: "عطر نور",
      brand: "نور",
      description: "عطر شرقي بعبوة سوداء",
      price: "24.500",
      offer: "",
      callToAction: "Order on WhatsApp",
      whatsapp: "+96550000000",
      location: "Kuwait City",
    },
    scenes: template.scenes,
    qualityPolicy: template.qualityPolicy,
  };
}

describe("creative template catalog", () => {
  it("publishes the ten supplied Seedance recipes plus the advertising takeover", () => {
    expect(LAUNCH_TEMPLATE_IDS).toEqual([
      "premium-phone-reveal",
      "phone-floating-ad",
      "restaurant-food-hero",
      "food-delivery-ad",
      "fashion-product-showcase",
      "luxury-fashion-reveal",
      "cosmetic-product-commercial",
      "perfume-advertisement",
      "female-product-review",
      "real-estate-property",
      "business-service-promotion",
      "new-york-billboard-takeover",
    ]);
    expect(LAUNCH_CREATIVE_TEMPLATE_CATALOG.map((template) => template.id)).toEqual(LAUNCH_TEMPLATE_IDS);
    expect(new Set(LAUNCH_CREATIVE_TEMPLATE_CATALOG.map((template) => template.category))).toHaveLength(8);
    expect([...LAUNCH_CREATIVE_TEMPLATE_CATALOG.reduce((counts, template) => counts.set(template.category, (counts.get(template.category) ?? 0) + 1), new Map<string, number>()).values()]).toEqual([2, 2, 2, 1, 1, 1, 1, 2]);
    for (const template of LAUNCH_CREATIVE_TEMPLATE_CATALOG) {
      expect(template.versionNumber).toBe(1);
      expect(template.durationSeconds).toBe(8);
      // new-york-billboard-takeover is the only launch recipe with a 3-scene
      // arc (3+3+2) to keep camera moves under two per film.
      expect(template.scenes).toHaveLength(template.id === "new-york-billboard-takeover" ? 3 : 4);
      expect(template.requiredInputs).toContain("primary_reference");
      expect(template.complianceRules).toEqual(expect.arrayContaining([
        expect.stringContaining("client-uploaded primary reference"),
        expect.stringContaining("Preserve the reference subject's shape"),
      ]));
    }
  });

  it("contains sixty-two distinct, fully structured Kuwait recipes", () => {
    expect(CREATIVE_TEMPLATE_CATALOG).toHaveLength(62);
    expect(new Set(CREATIVE_TEMPLATE_CATALOG.map((template) => template.id))).toHaveLength(62);
    expect(CREATIVE_TEMPLATE_CATEGORIES).toHaveLength(57);
    for (const template of CREATIVE_TEMPLATE_CATALOG) {
      expect(template.supportedMarkets).toEqual(["KW"]);
      expect(template.supportedLanguages).toEqual(expect.arrayContaining(["ar", "en", "bilingual"]));
      expect(template.supportedRatios).toHaveLength(4);
      expect(template.scenes.reduce((total, scene) => total + scene.duration, 0)).toBe(template.durationSeconds);
      expect(template.qualityPolicy.internalRetryLimit).toBe(2);
      expect(template.protectedLayers).toEqual(expect.arrayContaining(["price", "arabic_copy", "subtitles"]));
    }
  });

  it("includes the two new public business verticals without changing the established verticals", () => {
    const verticals = new Set(CREATIVE_TEMPLATE_CATALOG.flatMap((template) => template.verticals));
    expect(verticals).toEqual(new Set(["retail", "ecommerce", "salon", "clinic", "real_estate", "services"]));
    expect(CREATIVE_TEMPLATE_CATALOG.filter((template) => template.verticals.includes("clinic")).length).toBeGreaterThanOrEqual(7);
    expect(CREATIVE_TEMPLATE_CATALOG.filter((template) => template.verticals.includes("salon")).length).toBeGreaterThanOrEqual(8);
  });

  it("keeps a fixed 48-brief benchmark across every launch vertical and language", () => {
    expect(PROVIDER_BENCHMARK_CORPUS).toHaveLength(48);
    expect(new Set(PROVIDER_BENCHMARK_CORPUS.map((item) => item.id))).toHaveLength(48);
    expect(new Set(PROVIDER_BENCHMARK_CORPUS.map((item) => item.vertical))).toEqual(
      new Set(["salon", "clinic", "retail", "ecommerce"]),
    );
    expect(new Set(PROVIDER_BENCHMARK_CORPUS.map((item) => item.language))).toEqual(
      new Set(["en", "ar", "bilingual"]),
    );
  });

  it("approves a provider only after the complete benchmark clears all launch gates", () => {
    const observations = PROVIDER_BENCHMARK_CORPUS.map((item) => ({
      providerKey: "candidate-a",
      briefId: item.id,
      technicalSuccess: true,
      usable: true,
      productIdentity: 94,
      promptAdherence: 91,
      motionRealism: 89,
      arabicDialect: 92,
      latencyMs: 42_000,
      costUsd: 0.75,
    }));
    expect(scoreProviderBenchmark(observations)[0]).toMatchObject({
      sampleSize: 48,
      technicalSuccessRate: 1,
      usableOutputRate: 1,
      approved: true,
    });
    expect(scoreProviderBenchmark(observations.slice(0, 47))[0]?.approved).toBe(false);
  });

  it("cannot approve duplicated samples masquerading as complete corpus coverage", () => {
    const observation = {
      providerKey: "candidate-a",
      briefId: PROVIDER_BENCHMARK_CORPUS[0]!.id,
      technicalSuccess: true,
      usable: true,
      productIdentity: 99,
      promptAdherence: 99,
      motionRealism: 99,
      arabicDialect: 99,
      latencyMs: 1_000,
      costUsd: 0.5,
    };
    const score = scoreProviderBenchmark(Array.from({ length: 48 }, () => ({ ...observation })))[0]!;
    expect(score.corpusComplete).toBe(false);
    expect(score.duplicateBriefIds).toEqual([observation.briefId]);
    expect(score.missingBriefIds).toHaveLength(47);
    expect(score.approved).toBe(false);
  });

  it("builds deterministic Kuwait briefs and checkpoints every paid benchmark attempt", async () => {
    const briefs = [
      PROVIDER_BENCHMARK_CORPUS.find((item) => item.language === "ar")!,
      PROVIDER_BENCHMARK_CORPUS.find((item) => item.language === "en")!,
    ];
    const arabic = buildBenchmarkCreativeBrief(briefs[0]!);
    expect(arabic.arabicDialect).toBe("kuwaiti");
    expect(compileBenchmarkDirection(briefs[0]!).direction.spokenLocale).toBe("ar-KW");

    let clock = Date.parse("2026-08-13T00:00:00.000Z");
    const checkpoints: string[] = [];
    const run = await runProviderBenchmark({
      providerKey: "candidate-a",
      briefs,
      concurrency: 1,
      now: () => {
        clock += 1_000;
        return clock;
      },
      async execute({ brief: sample }) {
        if (sample.language === "en") throw new Error("simulated_provider_failure");
        return {
          technicalSuccess: true,
          usable: true,
          productIdentity: 94,
          promptAdherence: 91,
          motionRealism: 90,
          arabicDialect: 96,
          costUsd: 0.7,
        };
      },
      onObservation(observation) {
        checkpoints.push(observation.briefId);
      },
    });
    expect(checkpoints).toEqual(briefs.map((item) => item.id));
    expect(run.observations).toHaveLength(2);
    expect(run.observations[1]).toMatchObject({
      technicalSuccess: false,
      errorCode: "simulated_provider_failure",
    });
    expect(run.score.corpusComplete).toBe(false);
    expect(run.score.approved).toBe(false);

    let resumedExecutions = 0;
    const resumed = await runProviderBenchmark({
      providerKey: "candidate-a",
      briefs,
      existingObservations: [run.observations[0]!],
      async execute() {
        resumedExecutions += 1;
        return {
          technicalSuccess: true,
          usable: true,
          productIdentity: 95,
          promptAdherence: 95,
          motionRealism: 95,
          arabicDialect: 100,
          costUsd: 0.7,
        };
      },
    });
    expect(resumedExecutions).toBe(1);
    expect(resumed.observations[0]).toEqual(run.observations[0]);
  });
});

describe("Kuwaiti Arabic engine", () => {
  it("replaces obvious cross-dialect phrases and reports their source", () => {
    const result = normalizeKuwaitiArabic("دلوقتي بدك المنتج كتير", { register: "conversational" });
    expect(result.normalized).toBe("الحين تبي المنتج وايد");
    expect(result.score).toBeLessThan(100);
    expect(result.warnings).toEqual(expect.arrayContaining(["Egyptian: دلوقتي", "Levantine: بدك"]));
  });

  it("rejects common Saudi and Iraqi campaign phrasing instead of calling it Kuwaiti", () => {
    const result = normalizeKuwaitiArabic("تبغى المنتج هسه؟ كلش سهل", { register: "conversational" });
    expect(result.normalized).toBe("تبي المنتج الحين؟ وايد سهل");
    expect(result.warnings).toEqual(expect.arrayContaining(["Saudi: تبغى", "Iraqi: هسه", "Iraqi: كلش"]));
    expect(result.score).toBeLessThan(90);
  });

  it("produces an ar-KW campaign script with Kuwait-native conversion copy", () => {
    const result = compileKuwaitiCampaignCopy(brief());
    expect(result.locale).toBe("ar-KW");
    expect(result.scenes).toHaveLength(4);
    expect(result.fullVoiceover).toContain("عطر نور");
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.policyVersion).toBe("ar-KW-campaign-2026.08");
  });

  it("keeps every template script above the ar-KW submission threshold", () => {
    for (const template of CREATIVE_TEMPLATE_CATALOG) {
      const sample = brief();
      sample.templateId = template.id;
      sample.vertical = template.verticals[0]!;
      sample.goal = template.goals[0]!;
      sample.tone = template.tone;
      sample.dialectRegister = template.dialectRegister;
      sample.scenes = template.scenes;
      sample.qualityPolicy = template.qualityPolicy;
      const result = compileKuwaitiCampaignCopy(sample);
      expect(result.score, template.id).toBeGreaterThanOrEqual(90);
    }
  });

  it("fails a script containing cross-dialect overlay copy even when its voice lines are safe", () => {
    const sample = brief();
    sample.scenes[0] = {
      ...sample.scenes[0]!,
      headline: { en: "Want it?", ar: "تبغى المنتج؟" },
    };
    const result = compileKuwaitiCampaignCopy(sample);
    expect(result.warnings).toContain("Saudi: تبغى");
    expect(result.score).toBeLessThan(90);
  });
});

describe("premium prompt compiler and quality gate", () => {
  it("keeps the supplied image as the subject and changes framing with the selected ratio", () => {
    const portrait = compileCreativeDirection({ rawPrompt: "Premium fragrance launch.", creativeBrief: brief(), aspectRatio: "9:16" });
    const wide = compileCreativeDirection({ rawPrompt: "Premium fragrance launch.", creativeBrief: brief(), aspectRatio: "16:9" });
    expect(portrait.prompt).toContain("SUPPLIED IMAGE: first image only");
    expect(portrait.prompt).toContain("FRAME: 9:16 portrait, subject centered.");
    expect(wide.prompt).toContain("FRAME: 16:9 landscape, subject centered, setting only at the sides.");
    expect(wide.prompt).not.toContain("FRAME: 9:16 portrait");
  });

  it("compiles timecoded direction, product lock and ar-KW speech without baked text", () => {
    const result = compileCreativeDirection({ rawPrompt: "Premium fragrance launch.", creativeBrief: brief() });
    expect(result.prompt).toContain("NON-NEGOTIABLE PRODUCT AND BUSINESS TRUTH");
    expect(result.prompt).toContain("Native Kuwait Arabic (ar-KW)");
    expect(result.prompt).toContain("SHOT 1");
    expect(result.prompt).toContain("render no text inside the generated footage");
    expect(result.spokenLocale).toBe("ar-KW");
  });

  it.each([
    ["premium-phone-reveal", "camera module, screen layout, logo placement"],
    ["phone-floating-ad", "camera module, screen layout, logo placement"],
    ["restaurant-food-hero", "plating, ingredients, portion and texture"],
    ["fashion-product-showcase", "fabric, cut, stitching, pattern and logo"],
    ["perfume-advertisement", "bottle silhouette, cap, glass, liquid colour and label"],
    ["female-product-review", "uploaded product is the only product"],
    ["real-estate-property", "architecture, room geometry, fixtures and view"],
    ["business-service-promotion", "uploaded service artwork, brand marks and interface"],
    ["app-service", "Preserve the supplied subject exactly across every shot"],
    ["new-york-billboard-takeover", "clean neutral glowing panel"],
  ])("adds the subject-specific identity lock for %s", (templateId, expectedLock) => {
    const template = CREATIVE_TEMPLATE_CATALOG.find((item) => item.id === templateId)!;
    const input = brief();
    Object.assign(input, {
      templateId,
      templateRecipeVersion: template.versionNumber,
      templatePromptVersion: `${template.id}-v${template.versionNumber}`,
      templateVisualSystem: template.visualSystem,
      vertical: template.verticals[0]!,
      goal: template.goals[0]!,
      tone: template.tone,
      dialectRegister: template.dialectRegister,
      scenes: template.scenes,
      qualityPolicy: template.qualityPolicy,
    });
    const result = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: input });
    expect(result.prompt).toContain(expectedLock);
    expect(result.prompt).toContain("render no text inside the generated footage");
    expect(result.prompt).toContain("NO-BAKED-TEXT RULE (HIGHEST PRIORITY)");
    expect(result.prompt).toContain("The finishing service adds every readable element afterwards");
  });

  it("removes the old readable-text permission from the new-york-billboard-takeover identity lock", () => {
    const template = CREATIVE_TEMPLATE_CATALOG.find((item) => item.id === "new-york-billboard-takeover")!;
    const input = brief();
    Object.assign(input, {
      templateId: template.id,
      templateRecipeVersion: template.versionNumber,
      templatePromptVersion: `${template.id}-v${template.versionNumber}`,
      templateVisualSystem: template.visualSystem,
      vertical: template.verticals[0]!,
      goal: template.goals[0]!,
      tone: template.tone,
      dialectRegister: template.dialectRegister,
      scenes: template.scenes,
      qualityPolicy: template.qualityPolicy,
    });
    const result = compileCreativeDirection({ rawPrompt: template.visualSystem, creativeBrief: input });
    expect(result.prompt).not.toContain("preserve the exact uploaded artwork, logo, proportions, colours, layout and readable text");
  });

  it("requires native synchronized speech for a presenter template", () => {
    const template = CREATIVE_TEMPLATE_CATALOG.find((item) => item.capabilityPolicy.includes("speech.lip_sync"))!;
    const input = brief();
    input.templateId = template.id;
    input.vertical = template.verticals[0]!;
    input.goal = template.goals[0]!;
    input.tone = template.tone;
    input.dialectRegister = template.dialectRegister;
    input.scenes = template.scenes;
    input.qualityPolicy = template.qualityPolicy;
    const result = compileCreativeDirection({ rawPrompt: "A real Kuwait presenter demonstrates the product.", creativeBrief: input });
    expect(result.prompt).toContain("SYNCHRONIZED PRESENTER SPEECH");
    expect(result.prompt).toContain("Never create silent talking, detached dubbing");
  });

  it("turns a presenter template into an honestly muted visual when campaign audio is disabled", () => {
    const template = CREATIVE_TEMPLATE_CATALOG.find((item) => item.capabilityPolicy.includes("speech.lip_sync"))!;
    const input = brief();
    input.templateId = template.id;
    input.vertical = template.verticals[0]!;
    input.goal = template.goals[0]!;
    input.tone = template.tone;
    input.dialectRegister = template.dialectRegister;
    input.scenes = template.scenes;
    input.qualityPolicy = template.qualityPolicy;
    const result = compileCreativeDirection({
      rawPrompt: "A muted product campaign.",
      creativeBrief: input,
      audioEnabled: false,
    });
    expect(result.prompt).toContain("MUTED OUTPUT");
    expect(result.prompt).toContain("Do not show a person visibly speaking");
    expect(result.prompt).not.toContain("SYNCHRONIZED PRESENTER SPEECH");
  });

  it("fails unsafe clinic briefs before provider submission", () => {
    const input = brief();
    input.vertical = "clinic";
    input.scenes[0] = {
      ...input.scenes[0]!,
      headline: { en: "Guaranteed cure", ar: "علاج نهائي" },
    };
    expect(preflightCreativeBrief(input)).toEqual({ passed: false, failures: ["clinic_claim_not_allowed"] });
  });

  it("accepts a premium output and creates a targeted retry for weak identity", () => {
    const dimensions: QualityObservation["dimension"][] = [
      "technical", "product_identity", "prompt_adherence", "motion_realism", "visual_artifacts",
      "brand_safety", "dialect_fidelity", "speech_sync", "safe_zones", "compliance",
    ];
    const good = dimensions.map((dimension) => ({ dimension, score: 96 }));
    expect(evaluateAcceptedOutput({ observations: good, policy: brief().qualityPolicy, attempt: 0 }).status).toBe("accepted");
    const weak = good.map((item) => item.dimension === "product_identity" ? { ...item, score: 62 } : item);
    const decision = evaluateAcceptedOutput({ observations: weak, policy: brief().qualityPolicy, attempt: 0 });
    expect(decision.status).toBe("retry");
    expect(decision.retryDirective).toContain("product silhouette");
  });
});
