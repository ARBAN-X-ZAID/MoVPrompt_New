import { createHash } from "node:crypto";

import {
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
  CreativeBriefSchema,
  CreativeTemplateRecipeSchema,
  ENGINE_VERSION,
  compileCreativeDirection,
  preflightCreativeBrief,
  type CreativeBrief,
} from "@movprompt/creative-engine";

import { SEEDANCE_25_MODEL_ID } from "./gateway-video-smoke.js";

const LANGUAGES = ["ar", "en", "bilingual"] as const;
const OUTPUT_RATIOS = ["9:16", "1:1", "4:5", "16:9"] as const;

const SEEDANCE_RATIO_PLAN = {
  "9:16": { providerRatio: "9:16", resolution: "720x1280", exportStrategy: "native" },
  "1:1": { providerRatio: "1:1", resolution: "720x720", exportStrategy: "native" },
  "4:5": { providerRatio: "3:4", resolution: "720x960", exportStrategy: "deterministic_crop_4:5" },
  "16:9": { providerRatio: "16:9", resolution: "1280x720", exportStrategy: "native" },
} as const;

const CTA = {
  ar: "اطلب كينزا على واتساب",
  en: "Order Kinza on WhatsApp",
  bilingual: "Order Kinza on WhatsApp · اطلب كينزا على واتساب",
} as const;

function demoBrief(template: (typeof LAUNCH_CREATIVE_TEMPLATE_CATALOG)[number], language: typeof LANGUAGES[number]): CreativeBrief {
  return CreativeBriefSchema.parse({
    engineVersion: ENGINE_VERSION,
    templateId: template.id,
    market: "KW",
    language,
    arabicDialect: language === "en" ? null : "kuwaiti",
    dialectRegister: template.dialectRegister,
    tone: template.tone,
    vertical: template.verticals[0],
    goal: template.goals[0],
    product: {
      name: "Kinza Beauty Product",
      brand: "Kinza",
      description: "Confirmed packaged beauty product shown in the supplied reference photograph.",
      price: "12.500",
      offer: "Development demo only",
      callToAction: CTA[language],
      whatsapp: "+96550000000",
      location: "Kuwait",
    },
    scenes: template.scenes,
    qualityPolicy: template.qualityPolicy,
  });
}

export type TemplatePreflightManifest = ReturnType<typeof buildTemplatePreflightManifest>;

/**
 * Compiles every template/language/output-ratio combination without contacting
 * an AI provider. The 4:5 delivery preset is deliberately generated at the
 * closest supported Seedance ratio (3:4) and deterministically cropped later.
 */
export function buildTemplatePreflightManifest(reference: {
  path: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  bytes: number;
  width: number;
  height: number;
  checksumSha256: string;
}) {
  const templates = LAUNCH_CREATIVE_TEMPLATE_CATALOG.map((templateInput) => {
    const template = CreativeTemplateRecipeSchema.parse(templateInput);
    if (template.supportedMarkets.join(",") !== "KW") throw new Error(`template_market_invalid:${template.id}`);
    if (template.durationSeconds < 4 || template.durationSeconds > 30) {
      throw new Error(`template_duration_outside_seedance_25:${template.id}:${template.durationSeconds}`);
    }
    if (template.scenes.reduce((sum, scene) => sum + scene.duration, 0) !== template.durationSeconds) {
      throw new Error(`template_scene_duration_mismatch:${template.id}`);
    }
    for (const language of LANGUAGES) {
      if (!template.supportedLanguages.includes(language)) {
        throw new Error(`template_language_missing:${template.id}:${language}`);
      }
    }
    for (const ratio of OUTPUT_RATIOS) {
      if (!template.supportedRatios.includes(ratio)) {
        throw new Error(`template_ratio_missing:${template.id}:${ratio}`);
      }
    }

    const cases = LANGUAGES.flatMap((language) => {
      const brief = demoBrief(template, language);
      const preflight = preflightCreativeBrief(brief);
      if (!preflight.passed) {
        throw new Error(`template_creative_preflight_failed:${template.id}:${language}:${preflight.failures.join(",")}`);
      }
      if (!brief.product.callToAction.trim()) throw new Error(`template_cta_missing:${template.id}:${language}`);

      return OUTPUT_RATIOS.map((outputRatio) => {
        const compiled = compileCreativeDirection({
          rawPrompt: `${template.localizedName.en}. ${template.localizedDescription.en}`,
          creativeBrief: brief,
          aspectRatio: outputRatio,
        });
        if (compiled.dialectScore < 90) {
          throw new Error(`template_dialect_preflight_failed:${template.id}:${language}:${compiled.dialectScore}`);
        }
        const ratioPlan = SEEDANCE_RATIO_PLAN[outputRatio];
        return {
          caseId: `${template.id}:${language}:${outputRatio}`,
          language,
          market: brief.market,
          callToAction: brief.product.callToAction,
          outputRatio,
          providerRatio: ratioPlan.providerRatio,
          resolution: ratioPlan.resolution,
          exportStrategy: ratioPlan.exportStrategy,
          durationSeconds: template.durationSeconds,
          referenceChecksumSha256: reference.checksumSha256,
          promptLength: compiled.prompt.length,
          promptChecksumSha256: createHash("sha256").update(compiled.prompt).digest("hex"),
          dialectScore: compiled.dialectScore,
          spokenLocale: compiled.spokenLocale,
        };
      });
    });

    return {
      templateId: template.id,
      slug: template.slug,
      recipeVersion: template.versionNumber,
      requiredInputs: template.requiredInputs,
      capabilityPolicy: template.capabilityPolicy,
      durationSeconds: template.durationSeconds,
      caseCount: cases.length,
      cases,
    };
  });

  const cases = templates.flatMap((template) => template.cases);
  return {
    version: "seedance-25-kinza-preflight-v1",
    status: "passed" as const,
    paidProviderCalls: 0,
    model: SEEDANCE_25_MODEL_ID,
    contract: {
      operation: "image-to-video",
      supportedDurationSeconds: { min: 4, max: 30 },
      fps: 24,
      directRatios: ["9:16", "1:1", "16:9"],
      derivedRatios: { "4:5": "generate 3:4, then deterministic crop" },
      market: "KW",
      languages: LANGUAGES,
    },
    demoFacts: {
      subject: "Kinza Beauty Product",
      brand: "Kinza",
      priceKwd: "12.500",
      offer: "Development demo only",
      whatsapp: "+96550000000",
      warning: "These are development-only demo facts and must not be published as real product claims.",
    },
    reference,
    templateCount: templates.length,
    languageCount: LANGUAGES.length,
    outputRatioCount: OUTPUT_RATIOS.length,
    caseCount: cases.length,
    templates,
  };
}
