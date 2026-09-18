import { objectKeys } from "@movprompt/storage";

const RETENTION_MS = 24 * 60 * 60 * 1_000;

export type AbandonedClaimCleanupCandidate = {
  claimId: string;
  assetId: string;
  userId: string;
  projectId: string;
  bucket: string;
  objectKey: string;
  kind: "product" | "logo" | "audio" | "reference" | "footage";
  checksumSha256: string;
  updatedAt: Date;
};

export type CleanupAuditInput = {
  claimId: string;
  assetId: string;
  jobId: string;
  workerId: string;
  requestId: string;
  status?: "completed" | "retryable" | "released";
  storageResult?: "deleted" | "not_found";
  code?: string;
  message?: string;
  reason?: "retention_window" | "canonical_key_mismatch" | "finalized_or_released";
};

export interface AbandonedClaimCleanupRepository {
  leaseCandidate(input: { now: Date; minimumAgeMs: number; workerId: string; jobId: string; requestId: string }): Promise<AbandonedClaimCleanupCandidate | null>;
  recheckLeasedCandidate(input: { claimId: string; assetId: string; now: Date }): Promise<AbandonedClaimCleanupCandidate | null>;
  complete(input: CleanupAuditInput & { status: "completed"; storageResult: "deleted" | "not_found" }): Promise<void>;
  retry(input: CleanupAuditInput & { status?: "retryable"; code: string; message: string }): Promise<void>;
  release(input: CleanupAuditInput & { reason: "retention_window" | "canonical_key_mismatch" | "finalized_or_released" }): Promise<void>;
}

export interface AbandonedClaimCleanupStorage {
  remove(bucket: string, objectKey: string): Promise<void>;
}

export type AbandonedClaimCleanupResult =
  | { outcome: "none" }
  | { outcome: "completed"; claimId: string; assetId: string }
  | { outcome: "released"; claimId: string; assetId: string };

export class AbandonedClaimCleanupService {
  readonly #repository: AbandonedClaimCleanupRepository;
  readonly #storage: AbandonedClaimCleanupStorage;
  readonly #now: () => Date;

  constructor(dependencies: {
    repository: AbandonedClaimCleanupRepository;
    storage: AbandonedClaimCleanupStorage;
    now?: () => Date;
  }) {
    this.#repository = dependencies.repository;
    this.#storage = dependencies.storage;
    this.#now = dependencies.now ?? (() => new Date());
  }

  async cleanOne(input: { jobId: string; workerId: string; requestId: string }): Promise<AbandonedClaimCleanupResult> {
    const now = this.#now();
    const candidate = await this.#repository.leaseCandidate({
      now,
      minimumAgeMs: RETENTION_MS,
      workerId: input.workerId,
      jobId: input.jobId,
      requestId: input.requestId,
    });
    if (!candidate) return { outcome: "none" };

    const audit = { claimId: candidate.claimId, assetId: candidate.assetId, ...input };
    if (candidate.updatedAt.getTime() > now.getTime() - RETENTION_MS) {
      await this.#repository.release({ ...audit, reason: "retention_window" });
      return { outcome: "released", claimId: candidate.claimId, assetId: candidate.assetId };
    }

    const locked = await this.#repository.recheckLeasedCandidate({
      claimId: candidate.claimId,
      assetId: candidate.assetId,
      now,
    });
    if (!locked) {
      await this.#repository.release({ ...audit, reason: "finalized_or_released" });
      return { outcome: "released", claimId: candidate.claimId, assetId: candidate.assetId };
    }

    if (!this.#isCanonical(locked)) {
      await this.#repository.release({ ...audit, reason: "canonical_key_mismatch" });
      return { outcome: "released", claimId: candidate.claimId, assetId: candidate.assetId };
    }

    try {
      await this.#storage.remove(locked.bucket, locked.objectKey);
      await this.#repository.complete({ ...audit, status: "completed", storageResult: "deleted" });
    } catch (error) {
      if (isNotFound(error)) {
        await this.#repository.complete({ ...audit, status: "completed", storageResult: "not_found" });
      } else {
        await this.#repository.retry({
          ...audit,
          status: "retryable",
          code: "storage_delete_failed",
          message: "storage_delete_failed",
        });
        throw new Error("abandoned_claim_cleanup_retryable");
      }
    }
    return { outcome: "completed", claimId: candidate.claimId, assetId: candidate.assetId };
  }

  #isCanonical(candidate: AbandonedClaimCleanupCandidate): boolean {
    try {
      return candidate.objectKey === objectKeys.creatorAsset({
        userId: candidate.userId,
        projectId: candidate.projectId,
        assetId: candidate.assetId,
        kind: candidate.kind,
        checksumSha256: candidate.checksumSha256,
      });
    } catch {
      return false;
    }
  }
}

function isNotFound(error: unknown): boolean {
  const code = typeof error === "object" && error !== null && "name" in error
    ? String((error as { name: unknown }).name)
    : "";
  const message = error instanceof Error ? error.message : String(error);
  return /NoSuchKey|NotFound|not[ _-]?found/i.test(`${code} ${message}`);
}
