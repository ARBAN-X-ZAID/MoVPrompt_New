import type { MongoDatabase } from "@movprompt/db";
import type { R2Storage } from "@movprompt/storage";
import { previewObjectKey } from "./preview-watermark.js";

/** Mark ownership before remote deletion; claims and new jobs touch the same session document. */
export async function cleanExpiredGuestMedia(database: MongoDatabase, storage: R2Storage): Promise<number> {
  const guests = database.db.collection("guest_sessions");
  const row = await database.transaction(async session => {
    const candidates = guests.find({ claimedBy: null, expiresAt: { $lte: new Date() }, cleanupState: { $ne: "deleted" } }, { session });
    for await (const candidate of candidates) {
      if (await database.db.collection("render_runs").findOne({ userId: candidate._id, status: { $in: ["submitting", "queued", "processing", "cancelling"] } }, { session })) continue;
      await guests.updateOne({ _id: candidate._id, claimedBy: null }, { $set: { cleanupState: "deleting" }, $inc: { revision: 1 } }, { session });
      return candidate;
    }
    return null;
  });
  if (!row) return 0;
  // Tombstone is permanent during retries; expired guest cookies never regain access.
  const projects = await database.db.collection("creator_projects").find({ userId: row._id }).toArray();
  for (const project of projects) await storage.deleteProjectMedia(row._id.toHexString(), project._id.toHexString());
  const assets = await database.db.collection("creator_project_assets").find({ userId: row._id }).toArray();
  const claimAssets = await database.db.collection("guest_claim_assets").find({ userId: row._id }).toArray();
  const runs = await database.db.collection("render_runs").find({ userId: row._id }).toArray();
  const objects = new Map<string, { bucket: string; key: string }>();
  for (const asset of [...assets, ...claimAssets]) {
    if (typeof asset.bucket === "string" && typeof asset.objectKey === "string") objects.set(`${asset.bucket}/${asset.objectKey}`, { bucket: asset.bucket, key: asset.objectKey });
  }
  for (const run of runs) {
    if (typeof run.outputBucket === "string" && typeof run.outputObjectKey === "string") {
      for (const key of [run.outputObjectKey, previewObjectKey(run.outputObjectKey)]) objects.set(`${run.outputBucket}/${key}`, { bucket: run.outputBucket, key });
    }
  }
  for (const object of objects.values()) await storage.delete(object.bucket, object.key);
  await database.transaction(async session => {
    for (const name of ["creator_projects", "creator_project_versions", "creator_project_assets", "guest_claim_operations", "guest_claim_assets", "generation_quotes", "render_runs", "render_attempts"]) {
      await database.db.collection(name).deleteMany({ userId: row._id }, { session });
    }
    await guests.updateOne({ _id: row._id, claimedBy: null }, { $set: { cleanupState: "deleted", cleanedAt: new Date() } }, { session });
  });
  return objects.size;
}

/** Trash remains recoverable for seven days; the deletion marker and restore predicate exclude each other. */
export async function cleanTrashedProjectMedia(database: MongoDatabase, storage: R2Storage): Promise<void> {
  const projects = database.db.collection("creator_projects");
  const project = await database.transaction(async session => {
    const row = await projects.findOne({ deletedAt: { $lte: new Date(Date.now() - 7 * 86400_000), $ne: null }, mediaCleanupState: { $ne: "deleted" } }, { session });
    if (!row) return null;
    if (await database.db.collection("render_runs").findOne({ projectId: row._id, status: { $in: ["submitting", "queued", "processing", "cancelling"] } }, { session })) return null;
    await projects.updateOne({ _id: row._id }, { $set: { mediaCleanupState: "deleting" } }, { session });
    return row;
  });
  if (!project) return;
  const owners = new Set([project.userId.toHexString(), project.storageOwnerId].filter((x): x is string => typeof x === "string"));
  for (const owner of owners) await storage.deleteProjectMedia(owner, project._id.toHexString());
  await projects.updateOne({ _id: project._id, mediaCleanupState: "deleting" }, { $set: { mediaCleanupState: "deleted", mediaDeletedAt: new Date() } });
}
