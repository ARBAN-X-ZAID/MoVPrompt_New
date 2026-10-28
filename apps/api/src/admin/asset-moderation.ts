import { type Document, type ClientSession } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import {
  adminError,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
} from "./security.js";

export async function applyAdminAssetAction(
  database: MongoDatabase,
  actor: AdminActor,
  id: string,
  input: Document,
  session: ClientSession,
) {
  const db = database.db;
  const entry = await db
    .collection("creator_reference_library")
    .findOne(
      { _id: adminObjectId(id), "value.revision": input.expectedRevision },
      { session },
    );
  if (!entry)
    return adminError(
      "asset_revision_changed",
      "Reload this asset before changing it.",
    );
  const now = new Date();
  const value = structuredClone(entry.value);
  const revision = Number(value.revision) + 1;
  if (
    input.action === "restore" &&
    (!entry.deleted || !entry.trashUntil || new Date(entry.trashUntil) <= now)
  )
    return adminError(
      "asset_restore_expired",
      "This item is outside its recoverable trash period.",
    );
  value.revision = revision;
  value.updatedAt = now.toISOString();
  value.approved = false;
  value.reviewedAt = null;
  value.approval = {
    ...value.approval,
    revision,
    approved: false,
    reviewedAt: null,
    rightsConfirmed: false,
    sameSubjectConfirmed: false,
    adultConfirmed: false,
  };
  if (input.action === "trash") value.deleted = true;
  if (input.action === "restore") value.deleted = false;
  const fields = {
    value,
    deleted: value.deleted,
    updatedAt: now,
    ...(input.action === "trash"
      ? {
          trashUntil: new Date(now.getTime() + 30 * 86400000),
          trashedAt: now,
        }
      : {}),
    ...(input.action === "restore"
      ? { trashUntil: null, trashedAt: null }
      : {}),
    ...(input.action === "quarantine"
      ? { quarantinedAt: now, quarantineReason: input.reason }
      : {}),
    ...(input.action === "release-quarantine"
      ? { quarantinedAt: null, quarantineReason: null }
      : {}),
  };
  await db
    .collection("creator_reference_library")
    .updateOne(
      { _id: entry._id, "value.revision": input.expectedRevision },
      { $set: fields },
      { session },
    );
  await db.collection("creator_reference_library_revisions").insertOne(
    {
      entryId: id,
      userId: entry.userId,
      revision,
      value,
      createdAt: now,
    },
    { session },
  );
  await db.collection(C.workerJobs).insertOne(
    {
      name: "reference-library.reconcile.v1",
      data: { userId: String(entry.userId) },
      status: "queued",
      retryCount: 0,
      retryLimit: 5,
      startAfter: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
    { session },
  );
  await writeAdminAudit(
    database,
    actor,
    `asset.${input.action}`,
    id,
    {
      reason: input.reason,
      userId: entry.userId,
      previousRevision: input.expectedRevision,
      revision,
    },
    session,
  );
  return { id, revision, approved: false, deleted: value.deleted };
}
