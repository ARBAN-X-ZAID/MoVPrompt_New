import {
  CreativeBriefSchema,
  evaluateAcceptedOutput,
  type QualityDimension,
  type QualityObservation,
  type TemplateQualityPolicy,
} from "@movprompt/creative-engine";
import type { JsonObject } from "@movprompt/db";

import type { CalibrationEligibility } from "./benchmark-manifest.js";
import type { RenderOutputQualityReviewer } from "./render-lifecycle.js";

export type StoredCandidate = {
  bucket: string;
  objectKey: string;
  runId: string;
  projectId: string;
  projectVersionId: string;
};

export interface OutputQualityAnalyzer {
  readonly id: string;
  readonly dimensions: readonly QualityDimension[];
  analyze(input: {
    candidate: StoredCandidate;
    configuration: JsonObject;
    attemptNumber: number;
  }): Promise<QualityObservation[]>;
}

const DEFAULT_PREMIUM_POLICY: TemplateQualityPolicy = {
  tier: "premium",
  acceptanceScore: 85,
  internalRetryLimit: 2,
  hardGates: ["valid_media", "confirmed_facts_only", "safe_content"],
  scoredDimensions: [
    "technical",
    "product_identity",
    "prompt_adherence",
    "motion_realism",
    "visual_artifacts",
    "brand_safety",
    "dialect_fidelity",
    "speech_sync",
    "safe_zones",
    "compliance",
  ],
};

const REQUIRED_DIMENSIONS: readonly QualityDimension[] = [
  "technical",
  "product_identity",
  "prompt_adherence",
  "motion_realism",
  "visual_artifacts",
  "brand_safety",
  "dialect_fidelity",
  "speech_sync",
  "safe_zones",
  "compliance",
];

const CRITICAL_DIMENSIONS = new Set<QualityDimension>([
  "product_identity",
  "prompt_adherence",
  "dialect_fidelity",
  "compliance",
]);

function generationConfiguration(configuration: JsonObject): JsonObject {
  const nested = configuration.generation;
  return nested && typeof nested === "object" && !Array.isArray(nested)
    ? nested as JsonObject
    : configuration;
}

function qualityPolicy(configuration: JsonObject): TemplateQualityPolicy {
  const creativeBrief = generationConfiguration(configuration).creativeBrief;
  const parsed = CreativeBriefSchema.safeParse(creativeBrief);
  return parsed.success ? parsed.data.qualityPolicy : DEFAULT_PREMIUM_POLICY;
}

/**
 * Combines independent technical, visual/identity and speech/dialect analyzers.
 * Missing dimensions score zero, so an incomplete analyzer setup can never
 * silently approve a production candidate.
 */
export function createComposedOutputQualityReviewer(
  analyzers: readonly OutputQualityAnalyzer[],
  calibration?: CalibrationEligibility,
): RenderOutputQualityReviewer {
  if (!analyzers.length) throw new Error("quality_analyzers_required");
  const ids = analyzers.map((analyzer) => analyzer.id.trim());
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error("quality_analyzer_ids_must_be_unique");
  }

  return {
    async review(input) {
      // The calibration artifact is verified at worker composition time. An
      // absent artifact is not a low score: it is an unavailable acceptance
      // authority, so no candidate can silently pass while an in-flight run is
      // still safely reconciled by the lifecycle.
      if (!calibration?.passed) {
        return {
          status: "needs_review",
          score: 0,
          failedDimensions: [...REQUIRED_DIMENSIONS] as QualityDimension[],
        };
      }
      const candidate: StoredCandidate = {
        bucket: input.bucket,
        objectKey: input.objectKey,
        runId: input.runId,
        projectId: input.projectId,
        projectVersionId: input.projectVersionId,
      };
      const observations = (
        await Promise.all(
          analyzers.map((analyzer) => analyzer.analyze({
            candidate,
            configuration: input.configuration,
            attemptNumber: input.attemptNumber,
          })),
        )
      ).flat();
      const dimensions = new Set<QualityDimension>();
      for (const observation of observations) {
        if (dimensions.has(observation.dimension)) {
          throw new Error(`duplicate_quality_dimension:${observation.dimension}`);
        }
        dimensions.add(observation.dimension);
      }
      const policy = qualityPolicy(input.configuration);
      const policyDimensions = policy.scoredDimensions.filter((dimension): dimension is QualityDimension =>
        REQUIRED_DIMENSIONS.includes(dimension as QualityDimension),
      );
      const requiredDimensions: readonly QualityDimension[] = policyDimensions.length
        ? policyDimensions
        : REQUIRED_DIMENSIONS;
      const missingDimensions = requiredDimensions.filter((dimension): dimension is QualityDimension =>
        !dimensions.has(dimension),
      );
      if (missingDimensions.length) {
        return {
          status: "needs_review",
          score: 0,
          failedDimensions: missingDimensions,
        };
      }
      const decision = evaluateAcceptedOutput({
        observations,
        policy,
        attempt: input.attemptNumber,
      });
      const criticalFailures = observations
        .filter((observation) => observation.hardFailure && CRITICAL_DIMENSIONS.has(observation.dimension))
        .map((observation) => observation.dimension);
      if (criticalFailures.length) {
        return {
          status: "failed",
          score: decision.score,
          failedDimensions: [...new Set(criticalFailures)],
        };
      }
      return decision;
    },
  };
}
