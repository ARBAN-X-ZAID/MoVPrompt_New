import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import type { z } from "zod";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import {
  LibraryEntrySchema,
  type AdminOwnedMediaImportSchema,
  type AdminOwnedMediaSourceSchema,
  type AdminOwnedMediaActionSchema,
} from "@movprompt/contracts";
import type { AssetStorageGateway } from "../asset-storage.js";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

export const OWNED_MEDIA = "admin_owned_media";
export const OWNED_MEDIA_REVISIONS = "admin_owned_media_revisions";
type Source = z.infer<typeof AdminOwnedMediaSourceSchema>;
type Import = z.infer<typeof AdminOwnedMediaImportSchema>;

async function resolveSource(
  database: MongoDatabase,
  storage: AssetStorageGateway,
  ownerId: ObjectId,
  source: Source,
  kind: string,
  session?: ClientSession,
) {
  const options = session ? { session } : {};
  if (source.type === "library") {
    const row = await database.db
      .collection("creator_reference_library")
      .findOne(
        {
          _id: adminObjectId(source.entryId),
          userId: ownerId,
          deleted: false,
          quarantinedAt: null,
          "value.revision": source.revision,
          "value.approved": true,
        },
        options,
      );
    if (!row)
      return adminError(
        "owned_media_source_changed",
        "Choose an approved photo from the owner's own library. Customer media cannot be imported automatically.",
      );
    if (session)
      await database.db.collection("creator_reference_library").updateOne(
        {
          _id: row._id,
          userId: ownerId,
          "value.revision": source.revision,
          "value.approved": true,
        },
        { $inc: { adminMediaFence: 1 } },
        { session },
      );
    const photos = row.value.photos as Document[];
    const publicEntry = LibraryEntrySchema.safeParse({
      ...row.value,
      photos: photos.map(({ objectKey: _key, ...photo }) => photo),
    });
    if (!publicEntry.success)
      return adminError(
        "owned_media_source_invalid",
        "This library revision needs renewed permission review.",
      );
    if ((kind === "presenter-sample") !== (row.kind === "presenter"))
      return adminError(
        "owned_media_role_mismatch",
        "Product and presenter references must stay separate.",
        400,
      );
    const photo = photos.find((item) => item.id === source.photoId);
    if (!photo)
      return adminError(
        "owned_media_photo_missing",
        "This photo is no longer available.",
        404,
      );
    return {
      bucket: storage.assetsBucket,
      key: String(photo.objectKey),
      mimeType: String(photo.mimeType),
      sizeBytes: Number(photo.sizeBytes),
      checksumSha256: String(photo.checksumSha256),
    };
  }
  const run = await database.db.collection(C.renderRuns).findOne(
    {
      _id: adminObjectId(source.runId),
      userId: ownerId,
      status: "completed",
    },
    options,
  );
  if (!run?.outputObjectKey || run.outputBucket !== storage.outputsBucket)
    return adminError(
      "owned_media_source_invalid",
      "Choose completed footage owned by this owner account.",
    );
  return {
    bucket: storage.outputsBucket,
    key: String(run.outputObjectKey),
    mimeType: "video/mp4",
    sizeBytes: null,
    checksumSha256: null,
  };
}

export function createAdminOwnedMediaService(
  database: MongoDatabase,
  security: AdminSecurity,
  storage?: AssetStorageGateway,
) {
  const db = database.db;
  async function importRevision(
    actor: AdminActor,
    id: string | null,
    key: string,
    input: Import,
  ) {
    if (!storage)
      return adminError(
        "admin_storage_unavailable",
        "Private storage is unavailable.",
        503,
      );
    return security.command(actor, key, { id, ...input }, async (session) => {
      const ownerId = adminObjectId(actor.userId);
      const head = id
        ? await db
            .collection(OWNED_MEDIA)
            .findOne({ _id: adminObjectId(id) }, { session })
        : null;
      if (
        (head?.revision ?? 0) !== input.expectedRevision ||
        (head?.stateRevision ?? 0) !== input.expectedStateRevision ||
        (id && !head)
      )
        return adminError(
          "owned_media_changed",
          "Reload the media before replacing it.",
        );
      if (head?.deletedAt)
        return adminError(
          "owned_media_trashed",
          "Restore this item before changing it.",
        );
      const source = await resolveSource(
        database,
        storage,
        ownerId,
        input.source,
        input.kind,
        session,
      );
      const now = new Date();
      const mediaId = head ? head._id : new ObjectId();
      const revision = input.expectedRevision + 1;
      const operationId = new ObjectId();
      const record = {
        mediaId,
        revision,
        name: input.name,
        kind: input.kind,
        source: input.source,
        ownerId,
        status: "copying",
        rightsConfirmed: input.rightsConfirmed,
        adultLikenessConfirmed: input.adultLikenessConfirmed,
        operationId,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection(OWNED_MEDIA_REVISIONS).insertOne(record, { session });
      await db.collection(OWNED_MEDIA).updateOne(
        { _id: mediaId },
        {
          $set: {
            name: input.name,
            kind: input.kind,
            revision,
            stateRevision: Number(head?.stateRevision ?? 0) + 1,
            status: "copying",
            approvedRevision: null,
            operationId,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now, ownerId, deletedAt: null },
        },
        { session, upsert: !head },
      );
      await db.collection(A.operations).insertOne(
        {
          _id: operationId,
          kind: "media.import",
          mediaId,
          mediaRevision: revision,
          userId: ownerId,
          actorId: ownerId,
          source: input.source,
          inputKind: input.kind,
          sourceSnapshot: source,
          status: "queued",
          attempts: 0,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "owned-media.import",
        String(mediaId),
        { reason: input.reason, revision, source: input.source },
        session,
      );
      return {
        id: String(mediaId),
        revision,
        stateRevision: Number(head?.stateRevision ?? 0) + 1,
        status: "copying",
        operationId: String(operationId),
      };
    });
  }
  async function action(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof AdminOwnedMediaActionSchema>,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const _id = adminObjectId(id);
      const head = await db
        .collection(OWNED_MEDIA)
        .findOne({ _id, revision: input.expectedRevision }, { session });
      if (
        !head ||
        Number(head.stateRevision ?? 0) !== input.expectedStateRevision
      )
        return adminError(
          "owned_media_changed",
          "Reload this media before changing it.",
        );
      const revision = await db
        .collection(OWNED_MEDIA_REVISIONS)
        .findOne({ mediaId: _id, revision: head.revision }, { session });
      if (!revision)
        return adminError(
          "owned_media_revision_missing",
          "The media revision is unavailable.",
        );
      const now = new Date();
      const fields: Document = { updatedAt: now };
      if (input.action === "approve") {
        if (
          head.deletedAt ||
          !["needs-review", "approved"].includes(head.status) ||
          !revision.objectKey ||
          !revision.verifiedAt
        )
          return adminError(
            "owned_media_not_ready",
            "Only a verified, active copy can be approved.",
          );
        fields.status = "approved";
        fields.approvedRevision = head.revision;
        await db.collection(OWNED_MEDIA_REVISIONS).updateOne(
          { _id: revision._id },
          {
            $set: {
              approvedAt: now,
              approvedBy: adminObjectId(actor.userId),
              approvalReason: input.reason,
            },
          },
          { session },
        );
      } else if (input.action === "withdraw-approval") {
        fields.status = "needs-review";
        fields.approvedRevision = null;
      } else if (input.action === "trash") {
        fields.status = "trashed";
        fields.deletedAt = now;
        fields.trashUntil = new Date(now.getTime() + 30 * 86400000);
        fields.approvedRevision = null;
      } else if (input.action === "restore") {
        if (!head.deletedAt || !head.trashUntil || head.trashUntil <= now)
          return adminError(
            "owned_media_restore_expired",
            "This item is outside its recoverable trash period.",
          );
        fields.status = revision.verifiedAt ? "needs-review" : "copying";
        fields.deletedAt = null;
        fields.trashUntil = null;
        fields.approvedRevision = null;
      } else {
        if (head.deletedAt || revision.verifiedAt)
          return adminError(
            "owned_media_retry_invalid",
            "This copy does not need retrying.",
          );
        const operation = await db
          .collection(A.operations)
          .findOne(
            { _id: head.operationId, status: "failed", kind: "media.import" },
            { session },
          );
        if (!operation)
          return adminError(
            "owned_media_retry_invalid",
            "Wait for the current copy to finish.",
          );
        await db.collection(A.operations).updateOne(
          { _id: operation._id },
          {
            $set: {
              status: "queued",
              attempts: 0,
              availableAt: now,
              failureCode: null,
              updatedAt: now,
            },
          },
          { session },
        );
        fields.status = "copying";
      }
      // State changes increment the revision fence without altering the immutable
      // media revision number. Concurrent approval/trash must never overwrite.
      const stateRevision = Number(head.stateRevision ?? 0) + 1;
      await db
        .collection(OWNED_MEDIA)
        .updateOne(
          { _id, revision: head.revision },
          { $set: { ...fields, stateRevision } },
          { session },
        );
      await writeAdminAudit(
        database,
        actor,
        `owned-media.${input.action}`,
        id,
        { reason: input.reason, revision: head.revision, stateRevision },
        session,
      );
      return adminJson({
        id,
        revision: head.revision,
        ...fields,
        stateRevision,
      });
    });
  }
  async function sources(actor: AdminActor) {
    const ownerId = adminObjectId(actor.userId);
    const photos = await db
      .collection("creator_reference_library")
      .find(
        {
          userId: ownerId,
          deleted: false,
          quarantinedAt: null,
          "value.approved": true,
        },
        { projection: { kind: 1, value: 1 } },
      )
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    const videos = await db
      .collection(C.renderRuns)
      .find(
        {
          userId: ownerId,
          status: "completed",
          outputObjectKey: { $type: "string" },
        },
        { projection: { projectId: 1, completedAt: 1 } },
      )
      .sort({ completedAt: -1 })
      .limit(30)
      .toArray();
    const items = photos.flatMap((row) =>
      (row.value.photos as Document[]).map((photo) => ({
        key: `photo:${String(row._id)}:${photo.id}`,
        name: `${row.value.name} · ${photo.name}`,
        kind: row.kind,
        type: "library",
        source: {
          type: "library",
          entryId: String(row._id),
          photoId: photo.id,
          revision: row.value.revision,
        },
      })),
    );
    return {
      items: [
        ...items,
        ...videos.map((row) => ({
          key: `video:${String(row._id)}`,
          name: `${String(row.projectId)} · ${row.completedAt instanceof Date ? row.completedAt.toISOString() : ""}`,
          kind: "video",
          type: "generation",
          source: { type: "generation", runId: String(row._id) },
        })),
      ],
    };
  }
  return { importRevision, action, sources };
}

/** Copies are independent and unavailable until both source and destination
 * checksums have been verified. A lease retry writes the same content key. */
export async function executeOwnedMediaImport(
  database: MongoDatabase,
  storage: AssetStorageGateway,
  row: Document,
) {
  const db = database.db;
  const revision = await db
    .collection(OWNED_MEDIA_REVISIONS)
    .findOne({ mediaId: row.mediaId, revision: row.mediaRevision });
  if (!revision) throw new Error("owned_media_revision_missing");
  if (revision.verifiedAt)
    return {
      mediaId: String(row.mediaId),
      mediaRevision: row.mediaRevision,
      verified: true,
    };
  const source = await resolveSource(
    database,
    storage,
    row.userId,
    row.source,
    row.inputKind,
  );
  if (source.key !== row.sourceSnapshot.key)
    throw new Error("owned_media_source_changed");
  const maxBytes =
    row.inputKind === "video-preview" ? 64 * 1024 * 1024 : 12 * 1024 * 1024;
  const sourceHead = await storage.head(source.bucket, source.key);
  if (sourceHead.contentLength && sourceHead.contentLength > maxBytes)
    throw new Error("owned_media_source_too_large");
  const result = await storage.get({
    bucket: source.bucket,
    key: source.key,
    maxBytes,
  });
  const checksum = createHash("sha256").update(result.body).digest("hex");
  if (
    !result.body.length ||
    (source.sizeBytes !== null && source.sizeBytes !== result.body.length) ||
    (source.checksumSha256 !== null && source.checksumSha256 !== checksum)
  )
    throw new Error("owned_media_checksum_mismatch");
  const bucket =
    row.inputKind === "video-preview"
      ? storage.outputsBucket
      : storage.assetsBucket;
  const key = `admin-owned/${String(row.mediaId)}/revisions/${row.mediaRevision}/${checksum}`;
  await storage.put({
    bucket,
    key,
    body: result.body,
    contentType: source.mimeType,
    metadata: { "sha256-hex": checksum },
  });
  const head = await storage.head(bucket, key);
  if (
    head.contentLength !== result.body.length ||
    head.checksumSha256 !== checksum
  )
    throw new Error("owned_media_copy_verification_failed");
  await database.transaction(async (session) => {
    await resolveSource(
      database,
      storage,
      row.userId,
      row.source,
      row.inputKind,
      session,
    );
    const now = new Date();
    await db.collection(OWNED_MEDIA_REVISIONS).updateOne(
      { _id: revision._id, verifiedAt: null },
      {
        $set: {
          bucket,
          objectKey: key,
          sizeBytes: result.body.length,
          checksumSha256: checksum,
          mimeType: source.mimeType,
          status: "needs-review",
          verifiedAt: now,
          updatedAt: now,
        },
      },
      { session },
    );
    await db.collection(OWNED_MEDIA).updateOne(
      {
        _id: row.mediaId,
        revision: row.mediaRevision,
        status: "copying",
        deletedAt: null,
      },
      {
        $inc: { stateRevision: 1 },
        $set: {
          status: "needs-review",
          mimeType: source.mimeType,
          sizeBytes: result.body.length,
          checksumSha256: checksum,
          verifiedAt: now,
          updatedAt: now,
        },
      },
      { session },
    );
    await writeAdminAudit(
      database,
      {
        userId: String(row.actorId),
        sessionId: "worker",
        requestId: `media-import:${String(row._id)}`,
      },
      "owned-media.copy-verified",
      String(row.mediaId),
      { revision: row.mediaRevision, checksumSha256: checksum },
      session,
    );
  });
  return {
    mediaId: String(row.mediaId),
    mediaRevision: row.mediaRevision,
    verified: true,
  };
}
