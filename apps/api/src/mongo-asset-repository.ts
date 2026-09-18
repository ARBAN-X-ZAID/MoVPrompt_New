import { CreatorAssetKindSchema } from "@movprompt/contracts";
import { COLLECTIONS, type MongoDatabase } from "@movprompt/db";
import type { AssetRepository, CreateAssetRecord, OwnedAssetRecord } from "./asset-repository.js";

function publicAsset(row: Record<string, unknown> | null): OwnedAssetRecord | null {
  if (!row || typeof row.checksumSha256 !== "string") return null;
  const kind = CreatorAssetKindSchema.safeParse(row.kind);
  if (!kind.success) return null;
  const metadata = row.sourceMetadata && typeof row.sourceMetadata === "object"
    ? row.sourceMetadata as Record<string, unknown>
    : {};
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    userId: String(row.userId), ...(typeof row.storageOwnerId === "string" ? { storageOwnerId: row.storageOwnerId } : {}),
    kind: kind.data,
    bucket: String(row.bucket),
    objectKey: String(row.objectKey),
    mimeType: String(row.mimeType),
    sizeBytes: Number(row.sizeBytes),
    checksumSha256: row.checksumSha256,
    ...(typeof row.durationMs === "number" ? { durationMs: row.durationMs } : {}),
    ...(typeof metadata.originalFilename === "string" ? { originalFilename: metadata.originalFilename } : {}),
    ...(typeof metadata.sourceUrlHash === "string" ? { sourceUrlHash: metadata.sourceUrlHash } : {}),
  };
}

export function createMongoAssetRepository(database: MongoDatabase): AssetRepository {
  const assets = database.collection(COLLECTIONS.creatorProjectAssets);
  const projects = database.collection(COLLECTIONS.creatorProjects);
  async function findOwned(userId: string, projectId: string, assetId: string) {
    const project = await projects.findOne({ id: projectId, userId, status: { $ne: "trashed" } });
    if (!project) return null;
    return publicAsset(await assets.findOne({ id: assetId, projectId, userId }) as Record<string, unknown> | null);
  }
  return {
    async isProjectOwned(userId, projectId) {
      return Boolean(await projects.findOne({ id: projectId, userId, status: { $ne: "trashed" } }, { projection: { id: 1 } }));
    },
    async createOrFind(record: CreateAssetRecord) {
      const now = new Date();
      await assets.updateOne(
        { id: record.id, projectId: record.projectId, userId: record.userId },
        { $setOnInsert: {
          ...record,
          sourceMetadata: {
            ...(record.originalFilename ? { originalFilename: record.originalFilename } : {}),
            ...(record.sourceUrlHash ? { sourceUrlHash: record.sourceUrlHash } : {}),
          },
          createdAt: now,
          updatedAt: now,
        } },
        { upsert: true },
      );
      const persisted = await findOwned(record.userId, record.projectId, record.id);
      if (!persisted) throw new Error("asset_record_not_persisted");
      return persisted;
    },
    findOwned,
    async updateVerifiedFootage({ userId, projectId, assetId, durationMs }) {
      const result = await assets.updateOne({ id: assetId, projectId, userId, kind: "footage" }, { $set: { durationMs, updatedAt: new Date() } });
      return result.matchedCount ? findOwned(userId, projectId, assetId) : null;
    },
    async updateVerifiedImage({ userId, projectId, assetId, width, height }) {
      const result = await assets.updateOne({ id: assetId, projectId, userId, kind: { $ne: "footage" } }, { $set: { width, height, updatedAt: new Date() } });
      return result.matchedCount ? findOwned(userId, projectId, assetId) : null;
    },
  };
}
