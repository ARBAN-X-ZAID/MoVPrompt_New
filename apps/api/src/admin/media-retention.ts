import { createHash } from "node:crypto";
import { ObjectId, type Document } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import type { AssetStorageGateway } from "../asset-storage.js";
import { ADMIN_COLLECTIONS as A, writeAdminAudit } from "./security.js";

export const RETENTION_CANDIDATES = "admin_retention_candidates";
const TRASH_MS = 30 * 86400000;
type Candidate = Document & {
  _id: string;
  kind: "library" | "owned" | "account" | "transient";
  sourceCollection?: "support_attachments" | "admin_operations";
  sourceId: string;
  objectKey: string;
  bucket: string;
  notBefore: Date;
  checksumSha256: string;
  sizeBytes: number;
  photoId?: string;
};
export function retentionPolicy(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const financialDays = Number(environment.ADMIN_FINANCIAL_RETENTION_DAYS);
  const accountGraceDays = Number(environment.ADMIN_ACCOUNT_ERASURE_GRACE_DAYS);
  const ready = Boolean(
    environment.ADMIN_RETENTION_POLICY_VERSION?.trim() &&
    environment.ADMIN_RETENTION_APPROVAL_REFERENCE?.trim() &&
    Number.isSafeInteger(financialDays) &&
    financialDays > 0 &&
    Number.isSafeInteger(accountGraceDays) &&
    accountGraceDays >= 30,
  );
  return {
    ready,
    enabled: ready && environment.ADMIN_RETENTION_EXECUTION_ENABLED === "true",
    version: environment.ADMIN_RETENTION_POLICY_VERSION ?? null,
    approvalReference: environment.ADMIN_RETENTION_APPROVAL_REFERENCE ?? null,
    mediaTrashDays: 30,
    financialRetentionDays:
      Number.isSafeInteger(financialDays) && financialDays > 0
        ? financialDays
        : null,
    accountErasureGraceDays:
      Number.isSafeInteger(accountGraceDays) && accountGraceDays >= 30
        ? accountGraceDays
        : null,
  };
}
const keyId = (bucket: string, key: string) =>
  createHash("sha256").update(`${bucket}\0${key}`).digest("hex");
const keysIn = (value: unknown, matches: Set<string>) => {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      if (matches.has(node)) found.add(node);
    } else if (Array.isArray(node)) {
      for (const item of node) visit(item);
    } else if (node && typeof node === "object") {
      for (const [field, item] of Object.entries(node))
        if (!/token|secret|password|backupCodes/i.test(field)) visit(item);
    }
  };
  visit(value);
  return found;
};

/** Derive retirement from the last revision containing the bytes. A replacement
 * never shortens the thirty-day recovery period, and current photos are excluded. */
export async function inventoryRetiredMedia(
  database: MongoDatabase,
  storage: AssetStorageGateway,
  now = new Date(),
) {
  const db = database.db;
  const candidates = db.collection<Candidate>(RETENTION_CANDIDATES);
  let discovered = 0;
  for (const kind of ["library", "owned"] as const) {
    const collection =
      kind === "library" ? "creator_reference_library" : "admin_owned_media";
    const rows = await db
      .collection(collection)
      .find({ retentionCompleteAt: null })
      .sort({ lastRetentionScanAt: 1, updatedAt: 1 })
      .limit(100)
      .toArray();
    for (const row of rows) {
      const sourceId = String(row._id);
      const revisions: Document[] = await db
        .collection(
          kind === "library"
            ? "creator_reference_library_revisions"
            : "admin_owned_media_revisions",
        )
        .find(
          kind === "library"
            ? { entryId: sourceId, userId: row.userId }
            : { mediaId: row._id },
        )
        .sort({ revision: 1 })
        .limit(1001)
        .toArray();
      if (revisions.length > 1000) continue;
      if (
        kind === "library" &&
        !revisions.some((revision) => revision.revision === row.value?.revision)
      )
        revisions.push({
          revision: row.value?.revision,
          value: row.value,
          createdAt: row.updatedAt ?? row.createdAt,
        });
      const photos = (revision: Document): Document[] =>
        kind === "library"
          ? (revision.value?.photos ?? [])
          : revision.verifiedAt
            ? [revision]
            : [];
      const current =
        kind === "library"
          ? row.deleted
            ? []
            : (row.value?.photos ?? [])
          : row.deletedAt
            ? []
            : photos(
                revisions.find(
                  (revision) => revision.revision === row.revision,
                ) ?? {},
              );
      const currentKeys = new Set(
        current.map((photo: Document) => String(photo.objectKey)),
      );
      const last = new Map<string, { photo: Document; index: number }>();
      revisions.forEach((revision, index) =>
        photos(revision).forEach((photo) => {
          if (photo.objectKey)
            last.set(String(photo.objectKey), { photo, index });
        }),
      );
      for (const [key, { photo, index }] of last) {
        if (currentKeys.has(key)) continue;
        const following = revisions[index + 1];
        const retiredAt =
          following?.createdAt ??
          (row.deleted || row.deletedAt
            ? (row.trashedAt ?? row.deletedAt)
            : null);
        if (!retiredAt || !Number.isFinite(new Date(retiredAt).getTime()))
          continue;
        const notBefore = new Date(new Date(retiredAt).getTime() + TRASH_MS);
        const bucket =
          kind === "library" ? storage.assetsBucket : String(photo.bucket);
        if (
          ![storage.assetsBucket, storage.outputsBucket].includes(bucket) ||
          !photo.checksumSha256 ||
          !photo.sizeBytes
        )
          continue;
        await candidates.updateOne(
          { _id: keyId(bucket, key) },
          {
            $setOnInsert: {
              kind,
              sourceId,
              ...(kind === "library" ? { photoId: String(photo.id) } : {}),
              objectKey: key,
              bucket,
              checksumSha256: String(photo.checksumSha256),
              sizeBytes: Number(photo.sizeBytes),
              notBefore,
              status: "planned",
              createdAt: now,
              updatedAt: now,
            },
          },
          { upsert: true },
        );
        discovered++;
      }
      await db
        .collection(collection)
        .updateOne({ _id: row._id }, { $set: { lastRetentionScanAt: now } });
    }
  }
  // Abandoned support uploads and expired private report archives have no
  // selection path. Keep the same conservative thirty-day recovery window.
  for (const sourceCollection of [
    "support_attachments",
    "admin_operations",
  ] as const) {
    const filter =
      sourceCollection === "support_attachments"
        ? { createdAt: { $lte: new Date(now.getTime() - TRASH_MS) } }
        : {
            kind: { $in: ["customer.export", "report.export"] },
            status: { $in: ["completed", "expired"] },
            expiresAt: { $lte: new Date(now.getTime() - TRASH_MS) },
          };
    const rows = await db
      .collection(sourceCollection)
      .find(filter)
      .sort({ lastRetentionScanAt: 1 })
      .limit(100)
      .toArray();
    for (const row of rows) {
      const keys =
        sourceCollection === "support_attachments"
          ? [
              row.uploadKey,
              ...(!row.messageId &&
              row.expiresAt &&
              new Date(row.expiresAt) <= now
                ? [row.objectKey]
                : []),
            ]
          : [row.objectKey];
      for (const objectKey of keys.filter(
        (key): key is string => typeof key === "string" && Boolean(key),
      )) {
        const bucket =
          row.bucket ??
          (sourceCollection === "support_attachments"
            ? storage.assetsBucket
            : storage.outputsBucket);
        let head;
        try {
          head = await storage.head(bucket, objectKey);
        } catch (error) {
          if (missing(error)) continue;
          throw error;
        }
        if (
          !head.contentLength ||
          !head.checksumSha256 ||
          !/^[a-f\d]{64}$/i.test(head.checksumSha256)
        )
          continue;
        await candidates.updateOne(
          { _id: keyId(bucket, objectKey) },
          {
            $setOnInsert: {
              kind: "transient",
              sourceCollection,
              sourceId: String(row._id),
              bucket,
              objectKey,
              checksumSha256: head.checksumSha256,
              sizeBytes: head.contentLength,
              notBefore: new Date(
                new Date(row.expiresAt ?? row.createdAt).getTime() + TRASH_MS,
              ),
              status: "planned",
              createdAt: now,
            },
          },
          { upsert: true },
        );
        discovered++;
      }
      await db
        .collection(sourceCollection)
        .updateOne({ _id: row._id }, { $set: { lastRetentionScanAt: now } });
    }
  }
  return {
    discovered,
    source:
      "immutable library/company-media revisions and expired private staging/export objects",
    evaluatedAt: now,
  };
}

// Durable storage consumers are scanned. Oversized scans fail
// closed. Logical library references matter while a copy/job is still active;
// immutable campaigns protect the actual independently copied object keys.
const consumers = [
  ["creator_project_assets", {}],
  ["creator_project_versions", {}],
  ["render_runs", {}],
  ["render_attempts", {}],
  ["exports", {}],
  ["creator_reference_library", {}],
  ["creator_reference_library_revisions", {}],
  ["admin_owned_media", {}],
  ["admin_owned_media_revisions", {}],
  ["worker_jobs", { status: { $in: ["queued", "active"] } }],
  ["outbox_jobs", { status: { $in: ["pending", "processing"] } }],
  ["guest_claim_assets", { status: "pending" }],
  [
    "guest_claim_operations",
    { status: { $nin: ["ready", "completed", "failed", "cancelled"] } },
  ],
  ["creator_reference_library_uploads", { status: "pending" }],
  ["admin_operations", { status: { $in: ["queued", "running"] } }],
  ["support_attachments", { status: "verified", messageId: { $ne: null } }],
] as const;
async function protectedKeys(database: MongoDatabase, candidates: Candidate[]) {
  const keys = new Set(candidates.map((item) => item.objectKey));
  const protectedSet = new Set<string>();
  let scanned = 0;
  for (const [collection, filter] of consumers) {
    const cursor = database.db
      .collection(collection)
      .find(filter, { maxTimeMS: 30000 })
      .batchSize(100);
    for await (const row of cursor) {
      if (++scanned > 50000)
        throw new Error("admin_retention_reference_scan_incomplete");
      const matches = keysIn(row, keys);
      for (const key of matches) {
        const refs = candidates.filter((item) => item.objectKey === key);
        const own = refs.every(
          (item) =>
            (item.kind === "transient" &&
              collection === item.sourceCollection &&
              String(row._id) === item.sourceId &&
              row.uploadKey === key) ||
            (item.kind === "account" &&
              String(row.userId) === item.sourceId &&
              row.privacyErasedAt &&
              ![
                "worker_jobs",
                "outbox_jobs",
                "guest_claim_assets",
                "guest_claim_operations",
                "admin_operations",
              ].includes(collection)) ||
            (item.kind === "library" &&
              ((collection === "creator_reference_library" &&
                String(row._id) === item.sourceId) ||
                (collection === "creator_reference_library_revisions" &&
                  String(row.entryId) === item.sourceId))) ||
            (item.kind === "owned" &&
              ((collection === "admin_owned_media" &&
                String(row._id) === item.sourceId) ||
                (collection === "admin_owned_media_revisions" &&
                  String(row.mediaId) === item.sourceId))),
        );
        if (!own) protectedSet.add(key);
      }
      if (
        [
          "worker_jobs",
          "outbox_jobs",
          "guest_claim_assets",
          "guest_claim_operations",
          "creator_reference_library_uploads",
        ].includes(collection)
      ) {
        const json = JSON.stringify(row);
        for (const candidate of candidates)
          if (
            candidate.kind === "library" &&
            json.includes(candidate.sourceId) &&
            (!candidate.photoId || json.includes(candidate.photoId))
          )
            protectedSet.add(candidate.objectKey);
      }
    }
  }
  return { protectedSet, scanned };
}
function missing(error: unknown) {
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    value.name === "NotFound" ||
    value.name === "NoSuchKey" ||
    value.$metadata?.httpStatusCode === 404
  );
}

export async function executeMediaCleanup(
  database: MongoDatabase,
  storage: AssetStorageGateway,
  environment: Readonly<Record<string, string | undefined>>,
  actorId: string,
  now = new Date(),
) {
  const policy = retentionPolicy(environment);
  if (!policy.enabled || !storage.delete)
    throw new Error("admin_retention_gate_closed");
  const collection = database.db.collection<Candidate>(RETENTION_CANDIDATES);
  const rows = await collection
    .find({
      notBefore: { $lte: now },
      status: { $in: ["planned", "retained-reference", "purging"] },
    })
    .sort({ notBefore: 1 })
    .limit(100)
    .toArray();
  const references = await protectedKeys(database, rows);
  let purged = 0,
    retained = 0;
  for (const row of rows) {
    if (references.protectedSet.has(row.objectKey)) {
      retained++;
      await collection.updateOne(
        { _id: row._id },
        {
          $set: {
            status: "retained-reference",
            evaluatedAt: now,
            updatedAt: now,
          },
        },
      );
      continue;
    }
    const sourceCollection =
      row.kind === "library"
        ? "creator_reference_library"
        : row.kind === "owned"
          ? "admin_owned_media"
          : row.kind === "transient"
            ? row.sourceCollection!
            : "users";
    const source = await database.db
      .collection(sourceCollection)
      .findOne({ _id: new ObjectId(row.sourceId) });
    if (!source) continue;
    if (row.kind === "account" && !source.erasedAt) continue;
    const activeKeys =
      row.kind === "transient"
        ? sourceCollection === "support_attachments"
          ? source.messageId && row.objectKey !== source.uploadKey
            ? [row.objectKey]
            : source.expiresAt && new Date(source.expiresAt) > now
              ? [row.objectKey]
              : []
          : source.expiresAt && new Date(source.expiresAt) <= now
            ? []
            : [row.objectKey]
        : row.kind === "account"
          ? []
          : row.kind === "library"
            ? (source.deleted ? [] : (source.value?.photos ?? [])).map(
                (photo: Document) => photo.objectKey,
              )
            : source.deletedAt
              ? []
              : [
                  (
                    await database.db
                      .collection("admin_owned_media_revisions")
                      .findOne({
                        mediaId: source._id,
                        revision: source.revision,
                      })
                  )?.objectKey,
                ];
    if (activeKeys.includes(row.objectKey)) continue;
    await database.transaction(async (session) => {
      await database.db
        .collection(sourceCollection)
        .updateOne(
          { _id: source._id },
          { $inc: { retentionFence: 1 } },
          { session },
        );
      await collection.updateOne(
        { _id: row._id },
        {
          $set: {
            status: "purging",
            policyVersion: policy.version,
            deletionIntentAt: now,
            updatedAt: now,
          },
        },
        { session },
      );
    });
    let alreadyMissing = false;
    try {
      const head = await storage.head(row.bucket, row.objectKey);
      if (
        head.contentLength !== row.sizeBytes ||
        head.checksumSha256 !== row.checksumSha256
      ) {
        await collection.updateOne(
          { _id: row._id },
          {
            $set: {
              status: "review-required",
              failureCode: "storage-metadata-changed",
              updatedAt: now,
            },
          },
        );
        continue;
      }
    } catch (error) {
      if (!missing(error)) throw error;
      alreadyMissing = true;
    }
    if (!alreadyMissing) await storage.delete(row.bucket, row.objectKey);
    await collection.updateOne(
      { _id: row._id, status: "purging" },
      {
        $set: {
          status: "purged",
          purgedAt: now,
          alreadyMissing,
          updatedAt: now,
        },
      },
    );
    purged++;
    await writeAdminAudit(
      database,
      {
        userId: actorId,
        sessionId: "worker",
        requestId: `retention:${row._id}`,
      },
      "media.retention-purge",
      row.sourceId,
      {
        candidateId: row._id,
        kind: row.kind,
        policyVersion: policy.version,
        alreadyMissing,
      },
    );
  }
  return {
    purged,
    retained,
    scanned: references.scanned,
    policyVersion: policy.version,
    evaluatedAt: now,
  };
}
