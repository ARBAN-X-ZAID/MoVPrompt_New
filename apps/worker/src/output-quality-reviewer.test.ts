import type { QualityDimension } from "@movprompt/creative-engine";
import { describe, expect, it, vi } from "vitest";

import type { CalibrationEligibility } from "./benchmark-manifest.js";
import { createComposedOutputQualityReviewer, type OutputQualityAnalyzer } from "./output-quality-reviewer.js";

const dimensions: QualityDimension[] = [
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

function analyzer(id: string, selected: QualityDimension[], score = 96): OutputQualityAnalyzer {
  return {
    id,
    dimensions: selected,
    analyze: vi.fn(async () => selected.map((dimension) => ({ dimension, score }))),
  };
}

const input = {
  runId: "run",
  userId: "user",
  projectId: "project",
  projectVersionId: "version",
  bucket: "creator-outputs",
  objectKey: "user/project/version/candidate.mp4",
  attemptNumber: 0,
  configuration: { prompt: "Premium product campaign" },
};

const calibration: CalibrationEligibility = {
  datasetVersion: "kw-video-48-v1",
  evaluatorVersion: "quality-evaluator-v1",
  rubricVersion: "kuwait-quality-rubric-v1",
  candidateManifestDigest: "a".repeat(64),
  evidenceDigest: "b".repeat(64),
  approvalRecordDigest: "c".repeat(64),
  passed: true,
};

describe("composed output quality reviewer", () => {
  it("accepts only when every premium quality dimension is supplied and passes", async () => {
    const reviewer = createComposedOutputQualityReviewer([
      analyzer("technical", ["technical"]),
      analyzer("visual", dimensions.slice(1, 9)),
      analyzer("compliance", ["compliance"]),
    ], calibration);
    await expect(reviewer.review(input)).resolves.toMatchObject({ status: "accepted", score: 96 });
  });

  it("fails closed to review when dialect evidence is missing", async () => {
    const reviewer = createComposedOutputQualityReviewer([
      analyzer("technical", ["technical"]),
      analyzer("visual", dimensions.filter((dimension) => dimension !== "technical" && dimension !== "dialect_fidelity")),
    ]);
    await expect(reviewer.review(input)).resolves.toMatchObject({
      status: "needs_review",
      failedDimensions: expect.arrayContaining(["dialect_fidelity"]),
    });
  });

  it("scores a complete candidate when the qualified-human calibration file is unavailable", async () => {
    const reviewer = createComposedOutputQualityReviewer([
      analyzer("technical", ["technical"]),
      analyzer("visual", dimensions.slice(1, 9)),
      analyzer("compliance", ["compliance"]),
    ]);

    await expect(reviewer.review(input)).resolves.toMatchObject({ status: "accepted", score: 96 });
  });

  it("rejects a critical product, Arabic, or compliance defect regardless of the aggregate score", async () => {
    const reviewer = createComposedOutputQualityReviewer([
      analyzer("technical", ["technical"]),
      {
        id: "visual",
        dimensions: dimensions.slice(1, 9),
        analyze: vi.fn(async () => dimensions.slice(1, 9).map((dimension) => ({
          dimension,
          score: 96,
          ...(dimension === "dialect_fidelity" ? { hardFailure: true } : {}),
        }))),
      },
      analyzer("compliance", ["compliance"]),
    ], calibration);

    await expect(reviewer.review(input)).resolves.toMatchObject({
      status: "failed",
      failedDimensions: expect.arrayContaining(["dialect_fidelity"]),
    });
  });
});
