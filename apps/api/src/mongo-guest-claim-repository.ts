import { CreatorProjectSchema, GuestClaimAssetManifestSchema, GuestClaimSnapshotSchema, ProjectVersionSchema, type GuestClaimSnapshot } from "@movprompt/contracts";
import { COLLECTIONS, newMongoObjectId, type JsonObject, type MongoDatabase } from "@movprompt/db";
import { objectKeys } from "@movprompt/storage";
import type { ClientSession, Document } from "mongodb";
import { GuestClaimRepositoryError, type GuestClaimOperation, type GuestClaimRepository } from "./guest-claim-repository.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function publicOperation(row: Document, assets: Document[]): GuestClaimOperation {
  const next = assets.find((asset) => asset.status === "failed") ?? assets.find((asset) => asset.status === "pending" || asset.status === "securing");
  return { id: String(row.id), projectId: String(row.projectId), draftId: String(row.draftId), pendingGenerationId: String(row.pendingGenerationId), snapshotDigest: String(row.snapshotDigest), status: row.status, nextAsset: next ? { id: String(next.id), localAssetId: String(next.localAssetId), ordinal: Number(next.ordinal), status: next.status } : null };
}

function publicVersion(row: Document) {
  return ProjectVersionSchema.parse({
    id: String(row.id),
    projectId: String(row.projectId),
    parentVersionId: typeof row.parentVersionId === "string" ? row.parentVersionId : null,
    templateVersionId: typeof row.templateVersionId === "string" ? row.templateVersionId : null,
    mode: row.mode,
    versionNumber: Number(row.versionNumber),
    configuration: row.configuration,
    productRecipe: row.productRecipe,
    campaignRecipe: row.campaignRecipe,
    changeReason: typeof row.changeReason === "string" ? row.changeReason : null,
    createdAt: (row.createdAt as Date).toISOString(),
  });
}

export function createMongoGuestClaimRepository(database: MongoDatabase): GuestClaimRepository {
  const operations = database.collection(COLLECTIONS.guestClaimOperations); const claimAssets = database.collection(COLLECTIONS.guestClaimAssets);
  const projects = database.collection(COLLECTIONS.creatorProjects); const versions = database.collection(COLLECTIONS.creatorProjectVersions);
  async function assetsFor(id: string, session?: ClientSession) { return claimAssets.find({ claimOperationId: id }, session ? { session } : {}).sort({ ordinal: 1 }).toArray(); }
  async function byIntent(userId: string, pendingGenerationId: string, session?: ClientSession) { const row = await operations.findOne({ userId, pendingGenerationId, supersededAt: { $exists: false } }, session ? { session } : {}); if (!row) throw new GuestClaimRepositoryError("not_found"); return row; }
  async function ensureTemplate(id: string | undefined, session: ClientSession) {
    if (!id) return; const version = await database.collection(COLLECTIONS.videoTemplateVersions).findOne({ id, publishedAt: { $ne: null } }, { session });
    if (!version || !(await database.collection(COLLECTIONS.videoTemplates).findOne({ id: version.templateId, publishingState: "published" }, { session }))) throw new GuestClaimRepositoryError("conflict");
  }
  return {
    async start({ userId, snapshot }) {
      const parsed = GuestClaimSnapshotSchema.safeParse(snapshot); if (!parsed.success) throw new GuestClaimRepositoryError("invalid_campaign_configuration");
      return database.transaction(async (session) => {
        const byDraft = await operations.findOne({ draftId: parsed.data.draftId }, { session });
        if (byDraft) {
          if (byDraft.userId !== userId) throw new GuestClaimRepositoryError("conflict");
          if (byDraft.pendingGenerationId === parsed.data.pendingGenerationId) {
            if (canonical(byDraft.snapshot) !== canonical(parsed.data)) throw new GuestClaimRepositoryError("conflict");
            return publicOperation(byDraft, await assetsFor(String(byDraft.id), session));
          }
          // A changed draft is a new intent. Preserve the unfinished operation and its
          // media history while releasing the unique draft slot for the same project.
          // The operation write also serializes replacement against finalization.
          if (byDraft.status === "ready" || byDraft.projectVersionId) throw new GuestClaimRepositoryError("conflict");
          if ((await assetsFor(String(byDraft.id), session)).some((asset) =>
            (asset.errorMetadata as JsonObject | undefined)?.cleanup &&
            ((asset.errorMetadata as JsonObject).cleanup as JsonObject).state === "leased")) throw new GuestClaimRepositoryError("cleanup_leased");
          await operations.updateOne({ id: byDraft.id, userId }, { $set: {
            originalDraftId: byDraft.draftId, draftId: String(byDraft.id),
            supersededAt: new Date(), updatedAt: new Date(), status: "failed", errorCode: "claim_superseded",
          } }, { session });
        }
        const existing = await operations.findOne({ userId, pendingGenerationId: parsed.data.pendingGenerationId }, { session });
        if (existing) { if (existing.supersededAt || canonical(existing.snapshot) !== canonical(parsed.data)) throw new GuestClaimRepositoryError("conflict"); return publicOperation(existing, await assetsFor(String(existing.id), session)); }
        await ensureTemplate(parsed.data.templateVersionId, session); const now = new Date(); const existingProject = await projects.findOne({ clientDraftId: parsed.data.draftId }, { session });
        if (existingProject && existingProject.userId !== userId) throw new GuestClaimRepositoryError("conflict");
        const projectId = existingProject ? String(existingProject.id) : newMongoObjectId(); const operationId = newMongoObjectId();
        if (!existingProject) await projects.insertOne({ id: projectId, userId, title: parsed.data.title, mode: parsed.data.mode, status: "draft", clientDraftId: parsed.data.draftId, currentWorkingVersionId: null, currentAcceptedVersionId: null, deletedAt: null, createdAt: now, updatedAt: now }, { session });
        const operation = { id: operationId, userId, draftId: parsed.data.draftId, pendingGenerationId: parsed.data.pendingGenerationId, snapshotDigest: parsed.data.snapshotDigest, snapshot: parsed.data, assetManifest: parsed.data.assetManifest, projectId, projectVersionId: null, status: parsed.data.assetManifest.length ? "securing" : "pending", errorCode: null, errorMetadata: {}, finalizedAt: null, createdAt: now, updatedAt: now };
        await operations.insertOne(operation, { session });
        const assets = parsed.data.assetManifest.map((asset) => ({ id: newMongoObjectId(), claimOperationId: operationId, userId, localAssetId: asset.localAssetId, ordinal: asset.ordinal, kind: asset.kind, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksumSha256: asset.checksumSha256, durationMs: asset.durationMs ?? null, status: "pending", bucket: null, objectKey: null, errorCode: null, errorMetadata: {}, createdAt: now, updatedAt: now }));
        if (assets.length) await claimAssets.insertMany(assets, { session }); return publicOperation(operation, assets);
      });
    },
    async resume({ userId, pendingGenerationId }) { const row = await byIntent(userId, pendingGenerationId); return publicOperation(row, await assetsFor(String(row.id))); },
    async markAssetVerified({ userId, pendingGenerationId, localAssetId, bucket, objectKey, durationMs }) {
      return database.transaction(async (session) => {
        const operation = await byIntent(userId, pendingGenerationId, session); if (!operation.projectId || operation.status === "ready") throw new GuestClaimRepositoryError("asset_invalid");
        const asset = await claimAssets.findOne({ claimOperationId: operation.id, localAssetId, userId }, { session }); if (!asset) throw new GuestClaimRepositoryError("not_found");
        if ((asset.errorMetadata as JsonObject | undefined)?.cleanup && ((asset.errorMetadata as JsonObject).cleanup as JsonObject).state === "leased") throw new GuestClaimRepositoryError("cleanup_leased");
        if (!["product", "logo", "audio", "reference", "footage"].includes(String(asset.kind)) || (asset.kind === "footage" && (!durationMs || durationMs > 600_000))) throw new GuestClaimRepositoryError("asset_invalid");
        const expected = objectKeys.creatorAsset({ userId, projectId: String(operation.projectId), assetId: String(asset.localAssetId), kind: asset.kind, checksumSha256: String(asset.checksumSha256) }); if (expected !== objectKey || !bucket.trim()) throw new GuestClaimRepositoryError("asset_invalid");
        const now = new Date(); await claimAssets.updateOne({ id: asset.id, userId }, { $set: { status: "verified", bucket, objectKey, ...(asset.kind === "footage" ? { durationMs } : {}), verifiedAt: now, errorCode: null, errorMetadata: {}, updatedAt: now } }, { session });
        await operations.updateOne({ id: operation.id, userId }, { $set: { status: "securing", errorCode: null, errorMetadata: {}, updatedAt: now } }, { session }); const updated = await byIntent(userId, pendingGenerationId, session); return publicOperation(updated, await assetsFor(String(updated.id), session));
      });
    },
    async markAssetFailed({ userId, pendingGenerationId, localAssetId, code }) {
      return database.transaction(async (session) => {
        const operation = await byIntent(userId, pendingGenerationId, session); const asset = await claimAssets.findOne({ claimOperationId: operation.id, localAssetId, userId }, { session }); if (!asset) throw new GuestClaimRepositoryError("not_found");
        if (operation.status === "ready") throw new GuestClaimRepositoryError("asset_invalid");
        const now = new Date();
        await claimAssets.updateOne({ id: asset.id, userId }, { $set: { status: "failed", errorCode: code, errorMetadata: {}, updatedAt: now } }, { session }); await operations.updateOne({ id: operation.id, userId }, { $set: { status: "failed", errorCode: code, errorMetadata: {}, updatedAt: now } }, { session }); const updated = await byIntent(userId, pendingGenerationId, session); return publicOperation(updated, await assetsFor(String(updated.id), session));
      });
    },
    async finalize({ userId, pendingGenerationId }) {
      return database.transaction(async (session) => {
        const operation = await byIntent(userId, pendingGenerationId, session); const assets = await assetsFor(String(operation.id), session);
        if (assets.some((asset) => asset.status !== "verified")) throw new GuestClaimRepositoryError("assets_pending");
        if (operation.status !== "ready") {
          const snapshot = GuestClaimSnapshotSchema.parse(operation.snapshot) as GuestClaimSnapshot; await ensureTemplate(snapshot.templateVersionId, session); const now = new Date(); const versionId = newMongoObjectId();
          const previousVersion = await versions.findOne({ projectId: operation.projectId, userId }, { session, sort: { versionNumber: -1 } });
          await versions.insertOne({ id: versionId, projectId: operation.projectId, userId, mode: snapshot.mode, versionNumber: Number(previousVersion?.versionNumber ?? 0) + 1, parentVersionId: previousVersion ? String(previousVersion.id) : null, templateVersionId: snapshot.templateVersionId ?? null, configuration: structuredClone(snapshot.configuration), productRecipe: snapshot.productRecipe, campaignRecipe: snapshot.campaignRecipe, changeReason: "Guest draft claimed after authentication", operationKey: snapshot.pendingGenerationId, createdAt: now }, { session });
          if (assets.length) for (const asset of assets) await database.collection(COLLECTIONS.creatorProjectAssets).updateOne({ id: asset.localAssetId, projectId: operation.projectId, userId }, { $setOnInsert: { id: asset.localAssetId, projectId: operation.projectId, userId, kind: asset.kind, bucket: asset.bucket, objectKey: asset.objectKey, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksumSha256: asset.checksumSha256, durationMs: asset.durationMs ?? null, createdAt: now, updatedAt: now } }, { upsert: true, session });
          await projects.updateOne({ id: operation.projectId, userId }, { $set: { title: snapshot.title, mode: snapshot.mode, status: "ready", currentWorkingVersionId: versionId, updatedAt: now } }, { session }); await operations.updateOne({ id: operation.id, userId }, { $set: { status: "ready", projectVersionId: versionId, errorCode: null, errorMetadata: {}, finalizedAt: now, updatedAt: now } }, { session }); operation.status = "ready"; operation.projectVersionId = versionId;
        }
        const project = await projects.findOne({ id: operation.projectId, userId }, { session }); const version = await versions.findOne({ id: operation.projectVersionId, userId }, { session }); if (!project || !version) throw new Error("guest_claim_receipt_missing");
        const versionCount = await versions.countDocuments({ projectId: operation.projectId, userId }, { session });
        return { operation: publicOperation(operation, assets), project: CreatorProjectSchema.parse({ id: project.id, title: project.title, mode: project.mode, status: project.status, currentWorkingVersionId: project.currentWorkingVersionId, currentAcceptedVersionId: project.currentAcceptedVersionId ?? null, latestRenderRunId: null, latestRenderProjectVersionId: null, latestRenderRunStatus: null, deletedAt: null, createdAt: (project.createdAt as Date).toISOString(), updatedAt: (project.updatedAt as Date).toISOString(), currentVersion: publicVersion(version), versionCount, outputCount: 0 }), assetManifest: GuestClaimAssetManifestSchema.parse(assets.map((asset) => ({ localAssetId: asset.localAssetId, ordinal: asset.ordinal, kind: asset.kind, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksumSha256: asset.checksumSha256, ...(typeof asset.durationMs === "number" ? { durationMs: asset.durationMs } : {}) }))) };
      });
    },
  };
}
