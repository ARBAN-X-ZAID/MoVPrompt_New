import { createHash } from "node:crypto";

import {
  PROVIDER_BENCHMARK_CORPUS,
  type BenchmarkBrief,
  type QualityDimension,
} from "@movprompt/creative-engine";
import { assertStorageKey } from "@movprompt/storage";
import { z } from "zod";

const SHA256 = /^[a-f0-9]{64}$/u;
const CALIBRATION_DATASET_VERSION = "kw-video-48-v1" as const;
const CALIBRATION_EVALUATOR_VERSION = "fixture-quality-evaluator-v1" as const;
const CALIBRATION_RUBRIC_VERSION = "fixture-kuwait-quality-rubric-v1" as const;
const QUALITY_DIMENSIONS = [
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
] as const satisfies readonly QualityDimension[];

const QualityDimensionSchema = z.enum(QUALITY_DIMENSIONS);
const CalibrationReviewerRoleSchema = z.enum([
  "media_qa_reviewer",
  "kuwaiti_arabic_reviewer",
  "brand_truth_reviewer",
  "creative_direction_reviewer",
  "clinic_compliance_reviewer",
]);
const CalibrationAdjudicatorRoleSchema = z.enum([
  "quality_adjudicator",
  "clinic_compliance_adjudicator",
]);

export type CalibrationReviewerRole = z.infer<typeof CalibrationReviewerRoleSchema>;
export type CalibrationAdjudicatorRole = z.infer<typeof CalibrationAdjudicatorRoleSchema>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function checksum(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function assertCompleteDimensions(
  dimensions: Record<string, unknown>,
  context: string,
): asserts dimensions is Record<QualityDimension, number> {
  const unexpected = Object.keys(dimensions).filter((dimension) => !QUALITY_DIMENSIONS.includes(dimension as QualityDimension));
  const missing = QUALITY_DIMENSIONS.filter((dimension) => !(dimension in dimensions));
  if (unexpected.length || missing.length) {
    throw new Error(`${context}_dimensions_incomplete`);
  }
}

function assertSafeCalibrationPayload(input: unknown, path = "calibration"): void {
  if (typeof input === "string") {
    if (/https?:\/\/|s3:\/\/|data:|-----BEGIN|bearer\s+/iu.test(input)) {
      throw new Error(`calibration_forbidden_value:${path}`);
    }
    return;
  }
  if (Array.isArray(input)) {
    input.forEach((item, index) => assertSafeCalibrationPayload(item, `${path}[${index}]`));
    return;
  }
  if (!input || typeof input !== "object") return;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (/(?:url|provider|operation|secret|token|password|objectkey|media|raw|reviewer.?name|personal.?name|prose|comment|notes?)/iu.test(key)) {
      throw new Error(`calibration_forbidden_field:${path}.${key}`);
    }
    assertSafeCalibrationPayload(value, `${path}.${key}`);
  }
}

const BenchmarkReferenceSchema = z.object({
  objectKey: z.string().trim().min(1).max(1_024),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]),
  checksumSha256: z.string().regex(SHA256),
}).strict();

const BenchmarkManifestItemSchema = z.object({
  briefId: z.string().trim().min(1).max(160),
  factsChecksumSha256: z.string().regex(SHA256),
  rightsAttested: z.literal(true),
  references: z.array(BenchmarkReferenceSchema).min(1).max(9),
}).strict();

const BenchmarkManifestSchema = z.object({
  version: z.literal("kw-48-assets-v1"),
  items: z.array(BenchmarkManifestItemSchema).length(PROVIDER_BENCHMARK_CORPUS.length),
}).strict();

export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;
export type BenchmarkManifestItem = z.infer<typeof BenchmarkManifestItemSchema>;

function canonicalFacts(brief: BenchmarkBrief): string {
  return JSON.stringify({
    briefId: brief.id,
    templateId: brief.templateId,
    vertical: brief.vertical,
    language: brief.language,
    subjectName: brief.subjectName,
    confirmedFacts: brief.confirmedFacts,
    requiredRatio: brief.requiredRatio,
    challenge: brief.challenge,
  });
}

export function benchmarkFactsChecksum(brief: BenchmarkBrief): string {
  return createHash("sha256").update(canonicalFacts(brief)).digest("hex");
}

function referenceSignature(item: BenchmarkManifestItem): string {
  return item.references
    .map((reference) => `${reference.mimeType}:${reference.checksumSha256}`)
    .sort()
    .join("|");
}

/**
 * A complete benchmark uses the same subject pack across the three language
 * variants, but a distinct primary asset for all sixteen vertical/challenge
 * combinations. This isolates language quality without letting one attractive
 * product image stand in for the whole launch corpus.
 */
export function parseBenchmarkManifest(input: unknown): BenchmarkManifest {
  const manifest = BenchmarkManifestSchema.parse(input);
  const expected = new Map(PROVIDER_BENCHMARK_CORPUS.map((brief) => [brief.id, brief]));
  const seen = new Set<string>();
  const signatureBySubject = new Map<string, string>();
  const primaryChecksums = new Set<string>();
  for (const item of manifest.items) {
    if (seen.has(item.briefId)) throw new Error(`benchmark_manifest_duplicate_brief:${item.briefId}`);
    seen.add(item.briefId);
    const brief = expected.get(item.briefId);
    if (!brief) throw new Error(`benchmark_manifest_unknown_brief:${item.briefId}`);
    if (item.factsChecksumSha256 !== benchmarkFactsChecksum(brief)) {
      throw new Error(`benchmark_manifest_facts_mismatch:${item.briefId}`);
    }
    for (const reference of item.references) assertStorageKey(reference.objectKey);
    if (!item.references[0]!.mimeType.startsWith("image/")) {
      throw new Error(`benchmark_manifest_primary_image_required:${item.briefId}`);
    }
    if (item.references.filter((reference) => reference.mimeType === "video/mp4").length > 3) {
      throw new Error(`benchmark_manifest_video_reference_limit:${item.briefId}`);
    }
    const subjectKey = `${brief.vertical}:${brief.challenge}`;
    const signature = referenceSignature(item);
    const existing = signatureBySubject.get(subjectKey);
    if (existing && existing !== signature) {
      throw new Error(`benchmark_manifest_language_asset_drift:${subjectKey}`);
    }
    signatureBySubject.set(subjectKey, signature);
    primaryChecksums.add(item.references[0]!.checksumSha256);
  }
  const missing = [...expected.keys()].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`benchmark_manifest_missing_briefs:${missing.join(",")}`);
  if (signatureBySubject.size !== 16 || primaryChecksums.size < 16) {
    throw new Error("benchmark_manifest_requires_sixteen_distinct_subject_packs");
  }
  return manifest;
}

export interface BenchmarkAssetStorage {
  readonly assetsBucket: string;
  head(bucket: string, key: string): Promise<{
    ContentLength?: number | undefined;
    ContentType?: string | undefined;
    Metadata?: Record<string, string> | undefined;
  }>;
}

/** Verifies every private source object before the first paid provider call. */
export async function verifyBenchmarkManifestAssets(
  manifest: BenchmarkManifest,
  storage: BenchmarkAssetStorage,
  maxReferenceBytes = 50 * 1024 * 1024,
): Promise<void> {
  const checked = new Set<string>();
  for (const item of manifest.items) {
    for (const reference of item.references) {
      const identity = `${reference.objectKey}:${reference.checksumSha256}`;
      if (checked.has(identity)) continue;
      checked.add(identity);
      const head = await storage.head(storage.assetsBucket, reference.objectKey);
      const size = head.ContentLength ?? 0;
      const type = head.ContentType?.toLowerCase() ?? "";
      const checksum = head.Metadata?.["sha256-hex"]?.toLowerCase() ?? "";
      if (!Number.isSafeInteger(size) || size < 1 || size > maxReferenceBytes) {
        throw new Error(`benchmark_asset_size_invalid:${reference.objectKey}`);
      }
      if (type !== reference.mimeType) throw new Error(`benchmark_asset_mime_mismatch:${reference.objectKey}`);
      if (checksum !== reference.checksumSha256) {
        throw new Error(`benchmark_asset_checksum_mismatch:${reference.objectKey}`);
      }
    }
  }
}

export function benchmarkManifestByBrief(manifest: BenchmarkManifest): ReadonlyMap<string, BenchmarkManifestItem> {
  return new Map(manifest.items.map((item) => [item.briefId, item]));
}

const CandidateEvaluatorOutputSchema = z.object({
  evaluatorVersion: z.string().trim().min(1).max(160),
  rubricVersion: z.string().trim().min(1).max(160),
  decision: z.enum(["accepted", "rejected"]),
  criticalDefect: z.boolean(),
  dimensions: z.record(QualityDimensionSchema, z.number().int().min(0).max(100)),
}).strict();

const CalibrationCandidateSchema = z.object({
  id: z.string().trim().min(1).max(160),
  vertical: z.enum(["salon", "clinic", "retail", "ecommerce"]),
  language: z.enum(["en", "ar", "bilingual"]),
  challenge: z.enum(["identity", "motion", "arabic", "conversion"]),
  requiredRatio: z.enum(["9:16", "1:1", "4:5", "16:9"]),
  factsChecksumSha256: z.string().regex(SHA256),
  configurationChecksumSha256: z.string().regex(SHA256),
  rightsAttested: z.literal(true),
  privateReferenceIdentityDigest: z.string().regex(SHA256),
  evaluator: CandidateEvaluatorOutputSchema,
  candidateChecksumSha256: z.string().regex(SHA256),
}).strict();

const CalibrationCandidateManifestSchema = z.object({
  version: z.literal(CALIBRATION_DATASET_VERSION),
  candidates: z.array(CalibrationCandidateSchema).length(PROVIDER_BENCHMARK_CORPUS.length),
}).strict();

export type CalibrationCandidate = z.infer<typeof CalibrationCandidateSchema>;
export type CalibrationCandidateManifest = z.infer<typeof CalibrationCandidateManifestSchema>;

type DimensionScores = Record<QualityDimension, number>;

function dimensionScores(seed: number, rejected: boolean): DimensionScores {
  return Object.fromEntries(QUALITY_DIMENSIONS.map((dimension, index) => {
    const score = rejected
      ? 42 + ((seed * 13 + index * 7) % 20)
      : 90 + ((seed * 11 + index * 3) % 10);
    return [dimension, score];
  })) as DimensionScores;
}

function candidateConfigurationChecksum(brief: BenchmarkBrief): string {
  return checksum({
    templateId: brief.templateId,
    language: brief.language,
    requiredRatio: brief.requiredRatio,
    challenge: brief.challenge,
    confirmedFacts: brief.confirmedFacts,
  });
}

function candidateChecksum(candidate: Omit<CalibrationCandidate, "candidateChecksumSha256">): string {
  return checksum(candidate);
}

function referenceIdentityDigest(item: BenchmarkManifestItem): string {
  return checksum(item.references.map((reference) => ({
    mimeType: reference.mimeType,
    checksumSha256: reference.checksumSha256,
  })).sort((left, right) => stableJson(left).localeCompare(stableJson(right))));
}

/**
 * Produces a redacted candidate ledger from the private asset manifest. It
 * deliberately retains hashes only: object keys and any temporary URLs remain
 * inside storage operations and never enter the review artifact.
 */
export function createCalibrationCandidateManifest(assetManifest: BenchmarkManifest): CalibrationCandidateManifest {
  const manifest = parseBenchmarkManifest(assetManifest);
  const assetsByBrief = benchmarkManifestByBrief(manifest);
  const candidates = PROVIDER_BENCHMARK_CORPUS.map((brief, index) => {
    const rejected = index % 2 === 1;
    const candidate: Omit<CalibrationCandidate, "candidateChecksumSha256"> = {
      id: brief.id,
      vertical: brief.vertical,
      language: brief.language,
      challenge: brief.challenge,
      requiredRatio: brief.requiredRatio,
      factsChecksumSha256: benchmarkFactsChecksum(brief),
      configurationChecksumSha256: candidateConfigurationChecksum(brief),
      rightsAttested: true,
      privateReferenceIdentityDigest: referenceIdentityDigest(assetsByBrief.get(brief.id)!),
      evaluator: {
        evaluatorVersion: CALIBRATION_EVALUATOR_VERSION,
        rubricVersion: CALIBRATION_RUBRIC_VERSION,
        decision: rejected ? "rejected" : "accepted",
        criticalDefect: rejected && (brief.challenge === "identity" || brief.vertical === "clinic"),
        dimensions: dimensionScores(index, rejected),
      },
    };
    return { ...candidate, candidateChecksumSha256: candidateChecksum(candidate) };
  });
  return parseCalibrationCandidateManifest({ version: CALIBRATION_DATASET_VERSION, candidates });
}

export function parseCalibrationCandidateManifest(input: unknown): CalibrationCandidateManifest {
  assertSafeCalibrationPayload(input, "candidate_manifest");
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray((input as { candidates?: unknown }).candidates) ||
    (input as { candidates: unknown[] }).candidates.length !== PROVIDER_BENCHMARK_CORPUS.length
  ) {
    throw new Error("calibration_candidate_manifest_missing_candidates");
  }
  const manifest = CalibrationCandidateManifestSchema.parse(input);
  const expected = new Map(PROVIDER_BENCHMARK_CORPUS.map((brief) => [brief.id, brief]));
  const seen = new Set<string>();
  const referencesBySubject = new Map<string, string>();
  const evaluatorVersions = new Set<string>();
  const rubricVersions = new Set<string>();

  for (const candidate of manifest.candidates) {
    if (seen.has(candidate.id)) throw new Error(`calibration_candidate_manifest_duplicate_candidate:${candidate.id}`);
    seen.add(candidate.id);
    const brief = expected.get(candidate.id);
    if (!brief) throw new Error(`calibration_candidate_manifest_unknown_candidate:${candidate.id}`);
    if (
      candidate.vertical !== brief.vertical ||
      candidate.language !== brief.language ||
      candidate.challenge !== brief.challenge ||
      candidate.requiredRatio !== brief.requiredRatio ||
      candidate.factsChecksumSha256 !== benchmarkFactsChecksum(brief) ||
      candidate.configurationChecksumSha256 !== candidateConfigurationChecksum(brief)
    ) {
      throw new Error(`calibration_candidate_manifest_contract_mismatch:${candidate.id}`);
    }
    assertCompleteDimensions(candidate.evaluator.dimensions, `calibration_candidate:${candidate.id}`);
    const { candidateChecksumSha256, ...candidateWithoutChecksum } = candidate;
    if (candidateChecksumSha256 !== candidateChecksum(candidateWithoutChecksum)) {
      throw new Error(`calibration_candidate_manifest_checksum_mismatch:${candidate.id}`);
    }
    evaluatorVersions.add(candidate.evaluator.evaluatorVersion);
    rubricVersions.add(candidate.evaluator.rubricVersion);
    const subjectKey = `${candidate.vertical}:${candidate.challenge}`;
    const existingReference = referencesBySubject.get(subjectKey);
    if (existingReference && existingReference !== candidate.privateReferenceIdentityDigest) {
      throw new Error(`calibration_candidate_manifest_reference_drift:${subjectKey}`);
    }
    referencesBySubject.set(subjectKey, candidate.privateReferenceIdentityDigest);
  }
  const missing = [...expected.keys()].filter((id) => !seen.has(id));
  if (missing.length) throw new Error(`calibration_candidate_manifest_missing_candidates:${missing.join(",")}`);
  if (referencesBySubject.size !== 16 || evaluatorVersions.size !== 1 || rubricVersions.size !== 1) {
    throw new Error("calibration_candidate_manifest_versions_or_subject_packs_invalid");
  }
  return manifest;
}

const ReviewerRoleAttestationSchema = z.object({
  reviewerRole: CalibrationReviewerRoleSchema,
  attestationDigest: z.string().regex(SHA256),
  qualified: z.literal(true),
  independentlyCompleted: z.literal(true),
  completedAt: z.string().datetime({ offset: true }),
}).strict();

const HumanReviewLabelSchema = z.object({
  candidateId: z.string().trim().min(1).max(160),
  candidateChecksumSha256: z.string().regex(SHA256),
  reviewerRole: CalibrationReviewerRoleSchema,
  roleAttestationDigest: z.string().regex(SHA256),
  accepted: z.boolean(),
  criticalDefect: z.boolean(),
  dimensions: z.record(QualityDimensionSchema, z.number().int().min(0).max(100)),
  completedAt: z.string().datetime({ offset: true }),
  defectCategory: z.enum([
    "none",
    "technical",
    "product_or_fact",
    "motion_or_artifact",
    "arabic_or_bidi",
    "safe_zone",
    "compliance_or_consent",
  ]),
}).strict();

const AdjudicationSchema = z.object({
  candidateId: z.string().trim().min(1).max(160),
  candidateChecksumSha256: z.string().regex(SHA256),
  adjudicatorRole: CalibrationAdjudicatorRoleSchema,
  adjudicatorAttestationDigest: z.string().regex(SHA256),
  accepted: z.boolean(),
  criticalDefect: z.boolean(),
  dimensions: z.record(QualityDimensionSchema, z.number().int().min(0).max(100)),
  completedAt: z.string().datetime({ offset: true }),
  defectCategory: z.enum([
    "none",
    "technical",
    "product_or_fact",
    "motion_or_artifact",
    "arabic_or_bidi",
    "safe_zone",
    "compliance_or_consent",
  ]),
}).strict();

const AdjudicatorRoleAttestationSchema = z.object({
  adjudicatorRole: CalibrationAdjudicatorRoleSchema,
  attestationDigest: z.string().regex(SHA256),
  qualified: z.literal(true),
  completedAt: z.string().datetime({ offset: true }),
}).strict();

const CalibrationDimensionMetricSchema = z.object({
  sampleCount: z.number().int().nonnegative(),
  applicable: z.boolean(),
  spearman: z.number().min(-1).max(1).nullable(),
}).strict();

const CalibrationMetricsSchema = z.object({
  binary: z.object({
    truePositive: z.number().int().nonnegative(),
    trueNegative: z.number().int().nonnegative(),
    falsePositive: z.number().int().nonnegative(),
    falseNegative: z.number().int().nonnegative(),
  }).strict(),
  weightedCohenKappa: z.number().min(-1).max(1),
  dimensions: z.record(QualityDimensionSchema, CalibrationDimensionMetricSchema),
  criticalFalseAccepts: z.number().int().nonnegative(),
}).strict();

const CalibrationApprovalRecordSchema = z.object({
  approverRole: z.literal("quality_calibration_approver"),
  evidenceDigest: z.string().regex(SHA256),
  approvalRecordDigest: z.string().regex(SHA256),
  approvedAt: z.string().datetime({ offset: true }).optional(),
}).strict();

const QualifiedHumanCalibrationEvidenceSchema = z.object({
  datasetVersion: z.literal(CALIBRATION_DATASET_VERSION),
  evaluatorVersion: z.string().trim().min(1).max(160),
  rubricVersion: z.string().trim().min(1).max(160),
  labels: z.array(HumanReviewLabelSchema).length(PROVIDER_BENCHMARK_CORPUS.length * 2),
  reviewerRoleAttestations: z.array(ReviewerRoleAttestationSchema).min(2).max(7),
  adjudicatorRoleAttestations: z.array(AdjudicatorRoleAttestationSchema).min(1).max(2),
  adjudications: z.array(AdjudicationSchema).length(PROVIDER_BENCHMARK_CORPUS.length),
  metrics: CalibrationMetricsSchema,
  approvalRecord: CalibrationApprovalRecordSchema,
}).strict();

export type QualifiedHumanCalibrationEvidence = z.infer<typeof QualifiedHumanCalibrationEvidenceSchema>;
export type CalibrationMetrics = z.infer<typeof CalibrationMetricsSchema>;
export type CalibrationEligibility = {
  datasetVersion: typeof CALIBRATION_DATASET_VERSION;
  evaluatorVersion: string;
  rubricVersion: string;
  candidateManifestDigest: string;
  evidenceDigest: string;
  approvalRecordDigest: string;
  passed: true;
};

function mean(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averageRanks(values: readonly number[]): number[] {
  const ordered = values.map((value, index) => ({ value, index })).sort((left, right) => left.value - right.value);
  const ranks = new Array<number>(values.length);
  let start = 0;
  while (start < ordered.length) {
    let end = start + 1;
    while (end < ordered.length && ordered[end]!.value === ordered[start]!.value) end += 1;
    const rank = (start + 1 + end) / 2;
    for (let index = start; index < end; index += 1) ranks[ordered[index]!.index] = rank;
    start = end;
  }
  return ranks;
}

function tieAwareSpearman(left: readonly number[], right: readonly number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftRanks = averageRanks(left);
  const rightRanks = averageRanks(right);
  const leftMean = mean(leftRanks);
  const rightMean = mean(rightRanks);
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < leftRanks.length; index += 1) {
    const leftOffset = leftRanks[index]! - leftMean;
    const rightOffset = rightRanks[index]! - rightMean;
    covariance += leftOffset * rightOffset;
    leftVariance += leftOffset * leftOffset;
    rightVariance += rightOffset * rightOffset;
  }
  if (leftVariance === 0 || rightVariance === 0) return null;
  return Number((covariance / Math.sqrt(leftVariance * rightVariance)).toFixed(12));
}

function weightedCohenKappa(left: readonly boolean[], right: readonly boolean[]): number {
  if (left.length !== right.length || !left.length) throw new Error("calibration_kappa_samples_invalid");
  const observed = left.filter((value, index) => value === right[index]).length / left.length;
  const leftYes = left.filter(Boolean).length / left.length;
  const rightYes = right.filter(Boolean).length / right.length;
  const expected = leftYes * rightYes + (1 - leftYes) * (1 - rightYes);
  if (expected === 1) return observed === 1 ? 1 : 0;
  return Number(((observed - expected) / (1 - expected)).toFixed(12));
}

export function calibrationCandidateManifestDigest(candidateManifest: CalibrationCandidateManifest): string {
  return checksum(parseCalibrationCandidateManifest(candidateManifest));
}

export function calibrationEvidenceDigest(
  candidateManifestDigest: string,
  evidence: Omit<QualifiedHumanCalibrationEvidence, "approvalRecord">,
): string {
  return checksum({ candidateManifestDigest, ...evidence });
}

export function calibrationApprovalRecordDigest(record: z.infer<typeof CalibrationApprovalRecordSchema>): string {
  return checksum({
    approverRole: record.approverRole,
    evidenceDigest: record.evidenceDigest,
    ...(record.approvedAt ? { approvedAt: record.approvedAt } : {}),
  });
}

function assertEvidenceCoverage(
  candidateManifest: CalibrationCandidateManifest,
  evidence: QualifiedHumanCalibrationEvidence,
): void {
  const candidates = new Map(candidateManifest.candidates.map((candidate) => [candidate.id, candidate]));
  const roleAttestations = new Map(evidence.reviewerRoleAttestations.map((attestation) => [attestation.reviewerRole, attestation]));
  if (roleAttestations.size !== evidence.reviewerRoleAttestations.length) {
    throw new Error("calibration_reviewer_role_attestations_duplicate");
  }
  const labelsByCandidate = new Map<string, z.infer<typeof HumanReviewLabelSchema>[]>();
  for (const label of evidence.labels) {
    const candidate = candidates.get(label.candidateId);
    if (!candidate || candidate.candidateChecksumSha256 !== label.candidateChecksumSha256) {
      throw new Error(`calibration_label_candidate_mismatch:${label.candidateId}`);
    }
    const attestation = roleAttestations.get(label.reviewerRole);
    if (!attestation || attestation.attestationDigest !== label.roleAttestationDigest || !attestation.qualified || !attestation.independentlyCompleted) {
      throw new Error(`calibration_reviewer_role_attestation_invalid:${label.candidateId}:${label.reviewerRole}`);
    }
    assertCompleteDimensions(label.dimensions, `calibration_label:${label.candidateId}`);
    const labels = labelsByCandidate.get(label.candidateId) ?? [];
    labels.push(label);
    labelsByCandidate.set(label.candidateId, labels);
  }
  for (const candidate of candidates.values()) {
    const labels = labelsByCandidate.get(candidate.id) ?? [];
    if (labels.length !== 2) throw new Error(`calibration_labels_incomplete:${candidate.id}`);
    if (new Set(labels.map((label) => label.reviewerRole)).size !== 2) {
      throw new Error(`calibration_reviewer_roles_not_independent:${candidate.id}`);
    }
    if (candidate.vertical === "clinic" && !labels.some((label) => label.reviewerRole === "clinic_compliance_reviewer")) {
      throw new Error(`calibration_clinic_attestation_required:${candidate.id}`);
    }
  }

  const adjudications = new Map<string, z.infer<typeof AdjudicationSchema>>();
  const adjudicatorAttestations = new Map(
    evidence.adjudicatorRoleAttestations.map((attestation) => [attestation.adjudicatorRole, attestation]),
  );
  if (adjudicatorAttestations.size !== evidence.adjudicatorRoleAttestations.length) {
    throw new Error("calibration_adjudicator_role_attestations_duplicate");
  }
  for (const adjudication of evidence.adjudications) {
    const candidate = candidates.get(adjudication.candidateId);
    if (!candidate || candidate.candidateChecksumSha256 !== adjudication.candidateChecksumSha256) {
      throw new Error(`calibration_adjudication_candidate_mismatch:${adjudication.candidateId}`);
    }
    if (adjudications.has(adjudication.candidateId)) {
      throw new Error(`calibration_adjudication_duplicate:${adjudication.candidateId}`);
    }
    const adjudicatorAttestation = adjudicatorAttestations.get(adjudication.adjudicatorRole);
    if (
      !adjudicatorAttestation ||
      !adjudicatorAttestation.qualified ||
      adjudicatorAttestation.attestationDigest !== adjudication.adjudicatorAttestationDigest
    ) {
      throw new Error(`calibration_adjudicator_role_attestation_invalid:${adjudication.candidateId}`);
    }
    assertCompleteDimensions(adjudication.dimensions, `calibration_adjudication:${adjudication.candidateId}`);
    adjudications.set(adjudication.candidateId, adjudication);
  }
  if (adjudications.size !== candidates.size) throw new Error("calibration_adjudications_incomplete");
}

/** Recomputes all imported metrics; callers must never trust hand-entered values. */
export function calculateCalibrationMetrics(
  candidateManifest: CalibrationCandidateManifest,
  evidence: Pick<QualifiedHumanCalibrationEvidence, "labels" | "adjudications">,
): CalibrationMetrics {
  const candidates = parseCalibrationCandidateManifest(candidateManifest).candidates;
  const labelsByCandidate = new Map<string, z.infer<typeof HumanReviewLabelSchema>[]>();
  for (const label of evidence.labels) {
    const labels = labelsByCandidate.get(label.candidateId) ?? [];
    labels.push(label);
    labelsByCandidate.set(label.candidateId, labels);
  }
  const adjudications = new Map(evidence.adjudications.map((adjudication) => [adjudication.candidateId, adjudication]));
  const reviewerLeft: boolean[] = [];
  const reviewerRight: boolean[] = [];
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;
  let criticalFalseAccepts = 0;
  const evaluatorScores = new Map<QualityDimension, number[]>();
  const adjudicatedScores = new Map<QualityDimension, number[]>();
  for (const dimension of QUALITY_DIMENSIONS) {
    evaluatorScores.set(dimension, []);
    adjudicatedScores.set(dimension, []);
  }
  for (const candidate of candidates) {
    const labels = (labelsByCandidate.get(candidate.id) ?? []).slice().sort((left, right) => left.reviewerRole.localeCompare(right.reviewerRole));
    const adjudication = adjudications.get(candidate.id);
    if (labels.length !== 2 || !adjudication) throw new Error(`calibration_metrics_evidence_incomplete:${candidate.id}`);
    reviewerLeft.push(labels[0]!.accepted);
    reviewerRight.push(labels[1]!.accepted);
    if (candidate.evaluator.decision === "accepted" && adjudication.accepted) truePositive += 1;
    if (candidate.evaluator.decision === "rejected" && !adjudication.accepted) trueNegative += 1;
    if (candidate.evaluator.decision === "accepted" && !adjudication.accepted) falsePositive += 1;
    if (candidate.evaluator.decision === "rejected" && adjudication.accepted) falseNegative += 1;
    if (candidate.evaluator.decision === "accepted" && adjudication.criticalDefect) criticalFalseAccepts += 1;
    for (const dimension of QUALITY_DIMENSIONS) {
      evaluatorScores.get(dimension)!.push(candidate.evaluator.dimensions[dimension]);
      adjudicatedScores.get(dimension)!.push(adjudication.dimensions[dimension]);
    }
  }
  const dimensions = Object.fromEntries(QUALITY_DIMENSIONS.map((dimension) => {
    const left = evaluatorScores.get(dimension)!;
    const right = adjudicatedScores.get(dimension)!;
    const spearman = tieAwareSpearman(left, right);
    return [dimension, {
      sampleCount: left.length,
      applicable: spearman !== null,
      spearman,
    }];
  })) as CalibrationMetrics["dimensions"];
  return {
    binary: { truePositive, trueNegative, falsePositive, falseNegative },
    weightedCohenKappa: weightedCohenKappa(reviewerLeft, reviewerRight),
    dimensions,
    criticalFalseAccepts,
  };
}

export function validateCalibrationArtifact(input: {
  candidateManifest: unknown;
  evidence: unknown;
  activeEvaluatorVersion?: string;
  activeRubricVersion?: string;
}): CalibrationEligibility {
  assertSafeCalibrationPayload(input.candidateManifest, "candidate_manifest");
  assertSafeCalibrationPayload(input.evidence, "calibration_evidence");
  const candidateManifest = parseCalibrationCandidateManifest(input.candidateManifest);
  if (
    !input.evidence ||
    typeof input.evidence !== "object" ||
    !Array.isArray((input.evidence as { labels?: unknown }).labels) ||
    (input.evidence as { labels: unknown[] }).labels.length !== PROVIDER_BENCHMARK_CORPUS.length * 2
  ) {
    throw new Error("calibration_labels_incomplete");
  }
  const evidence = QualifiedHumanCalibrationEvidenceSchema.parse(input.evidence);
  assertEvidenceCoverage(candidateManifest, evidence);
  const candidateManifestDigest = calibrationCandidateManifestDigest(candidateManifest);
  const { approvalRecord, ...unsignedEvidence } = evidence;
  const evidenceDigest = calibrationEvidenceDigest(candidateManifestDigest, unsignedEvidence);
  if (approvalRecord.evidenceDigest !== evidenceDigest || approvalRecord.approvalRecordDigest !== calibrationApprovalRecordDigest(approvalRecord)) {
    throw new Error("calibration_approval_record_invalid");
  }
  if (input.activeEvaluatorVersion && evidence.evaluatorVersion !== input.activeEvaluatorVersion) {
    throw new Error("calibration_evaluator_version_mismatch");
  }
  if (input.activeRubricVersion && evidence.rubricVersion !== input.activeRubricVersion) {
    throw new Error("calibration_rubric_version_mismatch");
  }
  if (!candidateManifest.candidates.every((candidate) =>
    candidate.evaluator.evaluatorVersion === evidence.evaluatorVersion &&
    candidate.evaluator.rubricVersion === evidence.rubricVersion,
  )) {
    throw new Error("calibration_candidate_evaluator_or_rubric_mismatch");
  }
  const computedMetrics = calculateCalibrationMetrics(candidateManifest, evidence);
  if (stableJson(computedMetrics) !== stableJson(evidence.metrics)) {
    throw new Error("calibration_metrics_mismatch");
  }
  if (computedMetrics.weightedCohenKappa < 0.7) throw new Error("calibration_weighted_kappa_below_threshold");
  if (computedMetrics.criticalFalseAccepts !== 0) throw new Error("calibration_critical_false_accepts_present");
  for (const dimension of QUALITY_DIMENSIONS) {
    const metric = computedMetrics.dimensions[dimension];
    if (!metric || metric.sampleCount < 2) throw new Error(`calibration_dimension_sample_count_low:${dimension}`);
    if (metric.applicable && (metric.spearman === null || metric.spearman < 0.7)) {
      throw new Error(`calibration_dimension_spearman_below_threshold:${dimension}`);
    }
  }
  return {
    datasetVersion: evidence.datasetVersion,
    evaluatorVersion: evidence.evaluatorVersion,
    rubricVersion: evidence.rubricVersion,
    candidateManifestDigest,
    evidenceDigest,
    approvalRecordDigest: approvalRecord.approvalRecordDigest,
    passed: true,
  };
}
