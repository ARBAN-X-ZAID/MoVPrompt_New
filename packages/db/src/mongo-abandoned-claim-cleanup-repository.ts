import { COLLECTIONS, type MongoDatabase } from "./mongo-client.js";
import type { AbandonedClaimCleanupCandidateRecord } from "./abandoned-claim-cleanup-repository.js";

export function createMongoAbandonedClaimCleanupRepository(database: MongoDatabase) {
  const assets = database.collection(COLLECTIONS.guestClaimAssets); const operations = database.collection(COLLECTIONS.guestClaimOperations); const projectAssets = database.collection(COLLECTIONS.creatorProjectAssets);
  async function candidate(asset: Record<string, unknown>): Promise<AbandonedClaimCleanupCandidateRecord | null> {
    const operation = await operations.findOne({ id: asset.claimOperationId, userId: asset.userId, status: { $in: ["pending", "securing", "failed"] }, finalizedAt: null });
    if (!operation || await projectAssets.findOne({ id: asset.localAssetId, userId: asset.userId })) return null;
    if (typeof operation.projectId !== "string" || typeof asset.bucket !== "string" || typeof asset.objectKey !== "string") return null;
    return { claimId: String(operation.id), assetId: String(asset.id), userId: String(asset.userId), projectId: operation.projectId, bucket: asset.bucket, objectKey: asset.objectKey, kind: asset.kind as AbandonedClaimCleanupCandidateRecord["kind"], checksumSha256: String(asset.checksumSha256), updatedAt: operation.updatedAt as Date };
  }
  return {
    async leaseCandidate(input: { now: Date; minimumAgeMs: number; workerId: string; jobId: string; requestId: string }) {
      const cutoff = new Date(input.now.getTime() - input.minimumAgeMs); const eligibleOperations = await operations.find({ status: { $in: ["pending", "securing", "failed"] }, finalizedAt: null, updatedAt: { $lte: cutoff } }).toArray();
      for (const operation of eligibleOperations) {
        const asset = await assets.findOneAndUpdate({ claimOperationId: operation.id, status: "verified", "errorMetadata.cleanup.state": { $ne: "leased" } }, { $set: { status: "securing", errorMetadata: { cleanup: { state: "leased", jobId: input.jobId, workerId: input.workerId, requestId: input.requestId, at: input.now.toISOString() } }, updatedAt: input.now } }, { returnDocument: "after" });
        if (asset) { const result = await candidate(asset); if (result) return result; await assets.updateOne({ id: asset.id }, { $set: { status: "verified" } }); }
      }
      return null;
    },
    async recheckLeasedCandidate(input: { claimId: string; assetId: string; now: Date }) { const asset = await assets.findOne({ id: input.assetId, claimOperationId: input.claimId, status: "securing", "errorMetadata.cleanup.state": "leased" }); return asset ? candidate(asset) : null; },
    async complete(input: { assetId: string; jobId: string; workerId: string; requestId: string; storageResult: string }) { const now = new Date(); await assets.updateOne({ id: input.assetId, status: "securing" }, { $set: { status: "failed", errorCode: "abandoned_claim_cleanup_completed", errorMetadata: { cleanup: { state: "completed", jobId: input.jobId, workerId: input.workerId, requestId: input.requestId, storageResult: input.storageResult, at: now.toISOString() } }, updatedAt: now } }); },
    async retry(input: { assetId: string; jobId: string; workerId: string; requestId: string; code: string; message: string }) { const now = new Date(); await assets.updateOne({ id: input.assetId, status: "securing" }, { $set: { status: "verified", errorCode: input.code.slice(0, 120), errorMetadata: { cleanup: { state: "retryable", jobId: input.jobId, workerId: input.workerId, requestId: input.requestId, code: input.code.slice(0, 120), at: now.toISOString() } }, updatedAt: now } }); },
    async release(input: { assetId: string; jobId: string; workerId: string; requestId: string; reason: string }) { const now = new Date(); await assets.updateOne({ id: input.assetId, status: "securing" }, { $set: { status: "verified", errorMetadata: { cleanup: { state: "released", jobId: input.jobId, workerId: input.workerId, requestId: input.requestId, reason: input.reason, at: now.toISOString() } }, updatedAt: now } }); },
  };
}
