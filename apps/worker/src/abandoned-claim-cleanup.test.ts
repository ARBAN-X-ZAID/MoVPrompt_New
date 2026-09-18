import { describe, expect, it, vi } from "vitest";

import {
  AbandonedClaimCleanupService,
  type AbandonedClaimCleanupRepository,
  type AbandonedClaimCleanupStorage,
} from "./abandoned-claim-cleanup.js";

const NOW = new Date("2026-08-19T12:00:00.000Z");
const CLAIM_ID = "claim-1";
const ASSET_ID = "asset-1";
const OBJECT_KEY = "users/u-1/projects/p-1/assets/product/asset-1/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function candidate(overrides: Partial<Parameters<AbandonedClaimCleanupRepository["leaseCandidate"]>[0]> = {}) {
  return {
    claimId: CLAIM_ID,
    assetId: ASSET_ID,
    userId: "u-1",
    projectId: "p-1",
    bucket: "assets",
    objectKey: OBJECT_KEY,
    kind: "product" as const,
    checksumSha256: "a".repeat(64),
    updatedAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1_000),
    ...overrides,
  };
}

function setup(options: { candidate?: ReturnType<typeof candidate> | null; recheck?: ReturnType<typeof candidate> | null; remove?: () => Promise<void> } = {}) {
  const leased = options.candidate === undefined ? candidate() : options.candidate;
  const rechecked = options.recheck === undefined ? leased : options.recheck;
  const repository: AbandonedClaimCleanupRepository = {
    leaseCandidate: vi.fn(async () => leased),
    recheckLeasedCandidate: vi.fn(async () => rechecked),
    complete: vi.fn(async () => undefined),
    retry: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  };
  const storage: AbandonedClaimCleanupStorage = { remove: vi.fn(options.remove ?? (async () => undefined)) };
  const service = new AbandonedClaimCleanupService({ repository, storage, now: () => NOW });
  return { repository, storage, service };
}

describe("AbandonedClaimCleanupService", () => {
  it("retains an incomplete private object at 23:59:59", async () => {
    const { repository, storage, service } = setup({
      candidate: candidate({ updatedAt: new Date(NOW.getTime() - 24 * 60 * 60 * 1_000 + 1) }),
    });

    await expect(service.cleanOne({ jobId: "job-1", workerId: "worker-1", requestId: "request-1" }))
      .resolves.toEqual({ outcome: "released", claimId: CLAIM_ID, assetId: ASSET_ID });

    expect(storage.remove).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
    expect(repository.release).toHaveBeenCalledWith(expect.objectContaining({ reason: "retention_window" }));
  });

  it("deletes one canonical private object at the 24-hour boundary and audits completion", async () => {
    const { repository, storage, service } = setup();

    await expect(service.cleanOne({ jobId: "job-1", workerId: "worker-1", requestId: "request-1" }))
      .resolves.toEqual({ outcome: "completed", claimId: CLAIM_ID, assetId: ASSET_ID });

    expect(storage.remove).toHaveBeenCalledWith("assets", OBJECT_KEY);
    expect(repository.complete).toHaveBeenCalledWith(expect.objectContaining({
      claimId: CLAIM_ID,
      assetId: ASSET_ID,
      status: "completed",
      jobId: "job-1",
      requestId: "request-1",
    }));
  });

  it("treats a missing private object as an idempotent completed deletion", async () => {
    const { repository, storage, service } = setup({
      remove: async () => { throw new Error("NoSuchKey"); },
    });

    await expect(service.cleanOne({ jobId: "job-1", workerId: "worker-1", requestId: "request-1" }))
      .resolves.toMatchObject({ outcome: "completed" });

    expect(storage.remove).toHaveBeenCalledOnce();
    expect(repository.complete).toHaveBeenCalledWith(expect.objectContaining({ status: "completed", storageResult: "not_found" }));
  });

  it("records sanitized retryable state and rethrows transient storage failures", async () => {
    const { repository, service } = setup({
      remove: async () => { throw new Error("socket timeout while deleting secret-object-key"); },
    });

    await expect(service.cleanOne({ jobId: "job-1", workerId: "worker-1", requestId: "request-1" }))
      .rejects.toThrow("abandoned_claim_cleanup_retryable");

    expect(repository.retry).toHaveBeenCalledWith(expect.objectContaining({
      claimId: CLAIM_ID,
      assetId: ASSET_ID,
      code: "storage_delete_failed",
      message: "storage_delete_failed",
    }));
  });

  it("never deletes a finalized asset when a delayed job rechecks its lease", async () => {
    const { repository, storage, service } = setup({ recheck: null });

    await expect(service.cleanOne({ jobId: "job-1", workerId: "worker-1", requestId: "request-1" }))
      .resolves.toEqual({ outcome: "released", claimId: CLAIM_ID, assetId: ASSET_ID });

    expect(storage.remove).not.toHaveBeenCalled();
    expect(repository.release).toHaveBeenCalledWith(expect.objectContaining({ claimId: CLAIM_ID, assetId: ASSET_ID }));
  });

  it("rejects non-canonical candidate keys before deletion", async () => {
    const { repository, storage, service } = setup({
      candidate: candidate({ objectKey: "users/u-2/projects/p-1/assets/product/asset-1/unsafe" }),
    });

    await expect(service.cleanOne({ jobId: "job-1", workerId: "worker-1", requestId: "request-1" }))
      .resolves.toMatchObject({ outcome: "released" });

    expect(storage.remove).not.toHaveBeenCalled();
    expect(repository.release).toHaveBeenCalledWith(expect.objectContaining({ reason: "canonical_key_mismatch" }));
  });
});
