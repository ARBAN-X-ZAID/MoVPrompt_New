import { createHash } from "node:crypto";
import { ObjectId, type Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import type { AssetStorageGateway } from "../asset-storage.js";
import { createCustomerDataService } from "./customer-data.js";
import { RETENTION_CANDIDATES, retentionPolicy } from "./media-retention.js";
import { EMAIL } from "./email-delivery.js";
import { ADMIN_COLLECTIONS as A, writeAdminAudit } from "./security.js";

export const erasurePolicyHash = (
  environment: Readonly<Record<string, string | undefined>>,
) =>
  createHash("sha256")
    .update(JSON.stringify(retentionPolicy(environment)))
    .digest("hex");

/** Account erasure is separate from routine media controls. Financial, dispute
 * and audit records retain opaque ownership. No wallet balance is edited. */
export async function executeAccountErasure(
  database: MongoDatabase,
  operation: Document,
  environment: Readonly<Record<string, string | undefined>>,
  storage?: AssetStorageGateway,
  now = new Date(),
) {
  const db = database.db;
  const requests = db.collection(A.operations);
  const policy = retentionPolicy(environment);
  if (!policy.enabled) throw new Error("admin_privacy_gate_closed");
  const request = await requests.findOne({
    _id: operation.privacyRequestId,
    kind: "customer.delete-request",
  });
  if (!request) throw new Error("admin_privacy_request_missing");
  if (
    request.status === "cancelled" ||
    !["erasure-scheduled", "erased"].includes(request.status)
  )
    return { status: "superseded" };
  if (
    operation.approvedManifestHash &&
    operation.approvedManifestHash !== request.approvedManifestHash
  )
    return { status: "superseded" };
  if (request.approvedPolicyHash !== erasurePolicyHash(environment))
    throw new Error("admin_privacy_policy_changed");
  const userId = request.userId as ObjectId;
  if (await db.collection(A.owners).findOne({ userId, role: "owner" }))
    throw new Error("admin_privacy_owner_protected");
  if (request.status !== "erased") {
    const user = await db
      .collection("users")
      .findOne({ _id: userId, deletionOperationId: request._id });
    if (!user?.deletionRequestedAt)
      throw new Error("admin_privacy_request_changed");
    const eligibleAt = new Date(
      new Date(user.deletionRequestedAt).getTime() +
        policy.accountErasureGraceDays! * 86400000,
    );
    if (now < eligibleAt) throw new Error("admin_privacy_grace_not_elapsed");
    const data = createCustomerDataService(database, environment);
    const fresh = await data.deletionManifest(userId);
    if (
      fresh.manifestHash !== request.approvedManifestHash ||
      fresh.blockers.length
    ) {
      await requests.updateOne(
        { _id: request._id, status: "erasure-scheduled" },
        {
          $set: {
            status: "review-required",
            nextStep: "fresh-privacy-review",
            manifest: fresh,
            updatedAt: now,
          },
          $inc: { privacyRevision: 1 },
        },
      );
      return {
        status: "review-required",
        reason: "manifest-or-blockers-changed",
      };
    }
    await database.transaction(async (session) => {
      const locked = await requests.findOneAndUpdate(
        {
          _id: request._id,
          status: "erasure-scheduled",
          approvedManifestHash: fresh.manifestHash,
        },
        { $inc: { privacyExecutionFence: 1 } },
        { session, returnDocument: "after" },
      );
      if (!locked) throw new Error("admin_privacy_request_changed");
      const current = await db
        .collection("users")
        .findOneAndUpdate(
          { _id: userId, deletionOperationId: request._id },
          { $inc: { adminMutationFence: 1 } },
          { session, returnDocument: "after" },
        );
      if (!current || current.erasedAt)
        throw new Error("admin_privacy_request_changed");
      const lockedManifest = await data.deletionManifest(userId, session);
      if (
        lockedManifest.manifestHash !== request.approvedManifestHash ||
        lockedManifest.blockers.length
      )
        throw new Error("admin_privacy_manifest_changed");
      // Serialize against finance and generation accounting without modifying money.
      await db
        .collection(C.creditAccounts)
        .updateOne({ userId }, { $inc: { revision: 1 } }, { session });
      const wallet = await db
        .collection(C.creditAccounts)
        .findOne({ userId }, { session });
      if (
        Number(wallet?.balance ?? 0) !== 0 ||
        Number(wallet?.refundReserved ?? 0) !== 0 ||
        (await db
          .collection(C.creditReservations)
          .findOne({ userId, status: "reserved" }, { session })) ||
        (await db
          .collection(C.renderRuns)
          .findOne(
            { userId, status: { $nin: ["completed", "failed", "cancelled"] } },
            { session },
          )) ||
        (await db.collection(A.financial).findOne(
          {
            userId,
            status: {
              $in: ["requested", "approved", "submitted", "uncertain"],
            },
          },
          { session },
        ))
      )
        throw new Error("admin_privacy_financial_state_changed");
      const retired: Document[] = [];
      const add = (row: Document, bucket: unknown, key: unknown) => {
        if (typeof key === "string" && key)
          retired.push({
            bucket,
            objectKey: key,
            checksumSha256: row.checksumSha256 ?? null,
            sizeBytes: row.sizeBytes ?? null,
          });
      };
      const assets = await db
        .collection(C.creatorProjectAssets)
        .find({ userId }, { session })
        .toArray();
      for (const row of assets) add(row, row.bucket, row.objectKey);
      for (const row of await db
        .collection(C.exports)
        .find({ userId }, { session })
        .toArray())
        add(row, row.bucket, row.objectKey);
      const runs = await db
        .collection(C.renderRuns)
        .find({ userId }, { session })
        .toArray();
      for (const row of runs) add(row, row.outputBucket, row.outputObjectKey);
      const revisions = await db
        .collection("creator_reference_library_revisions")
        .find({ userId }, { session })
        .toArray();
      for (const row of revisions)
        for (const photo of row.value?.photos ?? [])
          add(photo, storage?.assetsBucket, photo.objectKey);
      const entries = await db
        .collection("creator_reference_library")
        .find({ userId }, { session })
        .toArray();
      for (const row of entries)
        for (const photo of row.value?.photos ?? [])
          add(photo, storage?.assetsBucket, photo.objectKey);
      const cases = await db
        .collection(A.cases)
        .find(
          { userId, category: { $nin: ["payment", "credits"] } },
          { session },
        )
        .toArray();
      const caseIds = cases.map((row) => row._id);
      for (const row of await db
        .collection("support_attachments")
        .find({ userId, caseId: { $in: caseIds } }, { session })
        .toArray()) {
        add(row, row.bucket, row.objectKey);
        if (row.uploadKey) add(row, storage?.assetsBucket, row.uploadKey);
      }
      for (const row of await requests
        .find(
          { userId, kind: "customer.export", status: "completed" },
          { session },
        )
        .toArray())
        add(row, row.bucket, row.objectKey);
      const unique = [
        ...new Map(
          retired
            .filter((row) => row.bucket)
            .map((row) => [`${row.bucket}:${row.objectKey}`, row]),
        ).values(),
      ];
      if (unique.length > 20000)
        throw new Error("admin_privacy_manifest_requires_segmented_review");
      await db.collection(C.sessions).deleteMany({ userId }, { session });
      await db.collection(C.accounts).deleteMany({ userId }, { session });
      await db.collection("twoFactor").deleteMany({ userId }, { session });
      await db.collection(C.verifications).deleteMany(
        {
          $or: [
            { userId },
            { identifier: current.email },
            { value: String(userId) },
          ],
        },
        { session },
      );
      await db.collection("users").replaceOne(
        { _id: userId },
        {
          _id: userId,
          name: "Deleted customer",
          email: `deleted-${userId}@account.invalid`,
          emailVerified: false,
          twoFactorEnabled: false,
          createdAt: current.createdAt,
          updatedAt: now,
          deletionRequestedAt: current.deletionRequestedAt,
          deletionOperationId: request._id,
          erasedAt: now,
          erasurePolicyVersion: policy.version,
        },
        { session },
      );
      await db.collection(C.creatorProjects).updateMany(
        { userId },
        {
          $set: {
            title: "Erased campaign",
            deletedAt: now,
            privacyErasedAt: now,
            updatedAt: now,
          },
        },
        { session },
      );
      await db.collection(C.creatorProjectVersions).updateMany(
        { userId },
        {
          $set: {
            configuration: {},
            productRecipe: {},
            campaignRecipe: {},
            changeReason: "Account erasure under reviewed retention policy",
            privacyErasedAt: now,
          },
        },
        { session },
      );
      await db.collection(C.creatorProjectAssets).updateMany(
        { userId },
        {
          $set: { deletedAt: now, privacyErasedAt: now },
          $unset: { originalFilename: "", name: "", librarySource: "" },
        },
        { session },
      );
      await db
        .collection(C.exports)
        .updateMany(
          { userId },
          { $set: { privacyErasedAt: now } },
          { session },
        );
      await db.collection(C.renderAttempts).updateMany(
        { userId },
        {
          $set: { privacyErasedAt: now },
          $unset: {
            errorMessage: "",
            prompt: "",
            configuration: "",
            providerPayload: "",
          },
        },
        { session },
      );
      await db
        .collection(C.renderRuns)
        .updateMany(
          { userId },
          { $set: { privacyErasedAt: now }, $unset: { errorMessage: "" } },
          { session },
        );
      const sanitize = (value: Document) => ({
        id: value.id,
        kind: value.kind,
        name: "Erased asset",
        revision: value.revision,
        photos: (value.photos ?? []).map((photo: Document) => ({
          id: photo.id,
          name: "Erased photo",
          objectKey: photo.objectKey,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          checksumSha256: photo.checksumSha256,
        })),
        deleted: true,
        approved: false,
        privacyErasedAt: now,
      });
      for (const entry of entries)
        await db.collection("creator_reference_library").updateOne(
          { _id: entry._id, userId },
          {
            $set: {
              value: sanitize(entry.value),
              deleted: true,
              trashedAt: current.deletionRequestedAt,
              trashUntil: eligibleAt,
              privacyErasedAt: now,
            },
          },
          { session },
        );
      for (const revision of revisions)
        await db
          .collection("creator_reference_library_revisions")
          .updateOne(
            { _id: revision._id, userId },
            { $set: { value: sanitize(revision.value), privacyErasedAt: now } },
            { session },
          );
      await db.collection(A.messages).updateMany(
        { userId, caseId: { $in: caseIds } },
        {
          $set: {
            message: "Removed following reviewed account erasure",
            privacyErasedAt: now,
          },
          $unset: { attachments: "" },
        },
        { session },
      );
      await db
        .collection(A.cases)
        .updateMany(
          { _id: { $in: caseIds }, userId },
          { $set: { subject: "Erased customer case", privacyErasedAt: now } },
          { session },
        );
      await db.collection("support_attachments").updateMany(
        { userId, caseId: { $in: caseIds } },
        {
          $set: {
            status: "retired",
            name: "Erased attachment",
            privacyErasedAt: now,
          },
        },
        { session },
      );
      await db.collection(C.notifications).deleteMany({ userId }, { session });
      await requests.updateMany(
        { userId, kind: "customer.export", status: "completed" },
        { $set: { status: "expired", expiresAt: now, privacyErasedAt: now } },
        { session },
      );
      await db.collection(EMAIL.preferences).updateOne(
        { userId },
        {
          $set: {
            marketingOptIn: false,
            suppressedAt: now,
            consentAt: null,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
        { upsert: true, session },
      );
      await db.collection(EMAIL.deliveries).updateMany(
        { userId, status: "queued" },
        {
          $set: {
            status: "suppressed",
            suppressionReason: "account-erasure",
            updatedAt: now,
          },
        },
        { session },
      );
      await db.collection(EMAIL.deliveries).updateMany(
        { userId, kind: { $ne: "support" } },
        {
          $set: {
            email: `deleted-${userId}@account.invalid`,
            body: {},
            title: {},
            privacyErasedAt: now,
          },
        },
        { session },
      );
      await db.collection(EMAIL.deliveries).updateMany(
        { userId, kind: "support", caseId: { $in: caseIds } },
        {
          $set: {
            email: `deleted-${userId}@account.invalid`,
            body: {},
            title: {},
            privacyErasedAt: now,
          },
        },
        { session },
      );
      await db.collection(EMAIL.audiences).updateMany(
        { "recipients.userId": userId },
        {
          $set: {
            "recipients.$[recipient].email": `deleted-${userId}@account.invalid`,
            privacyRedactedAt: now,
          },
        },
        { session, arrayFilters: [{ "recipient.userId": userId }] },
      );
      await requests.updateOne(
        { _id: request._id },
        {
          $set: {
            status: "erased",
            erasedAt: now,
            nextStep: "private-media-cleanup",
            retiredMedia: unique,
            mediaEligibleAt: eligibleAt,
            updatedAt: now,
          },
          $inc: { privacyRevision: 1 },
        },
        { session },
      );
      await writeAdminAudit(
        database,
        {
          userId: String(request.review.actorId),
          sessionId: "worker",
          requestId: `privacy-erasure:${request._id}`,
        },
        "privacy.account-erased",
        String(userId),
        {
          policyVersion: policy.version,
          manifestHash: fresh.manifestHash,
          financialRecordsRetained: true,
          mediaCount: unique.length,
        },
        session,
      );
    });
  }
  const erased = await requests.findOne({ _id: request._id, status: "erased" });
  if (!storage || !erased)
    return {
      status: "review-required",
      reason: "private-storage-cleanup-unavailable",
    };
  for (const object of erased.retiredMedia ?? []) {
    if (![storage.assetsBucket, storage.outputsBucket].includes(object.bucket))
      continue;
    const id = createHash("sha256")
      .update(`${object.bucket}\0${object.objectKey}`)
      .digest("hex");
    // The source account is already irreversibly erased. Media remains private
    // until a checksum-verified, cross-owner reference scan permits cleanup.
    let head;
    try {
      head = await storage.head(object.bucket, object.objectKey);
    } catch (error) {
      const value = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        value.name === "NotFound" ||
        value.name === "NoSuchKey" ||
        value.$metadata?.httpStatusCode === 404
      )
        continue;
      throw new Error("admin_privacy_media_inventory_unavailable");
    }
    if (!head.contentLength || !head.checksumSha256)
      throw new Error("admin_privacy_media_checksum_review_required");
    await db.collection(RETENTION_CANDIDATES).updateOne(
      { _id: id as never },
      {
        $set: {
          kind: "account",
          sourceId: String(userId),
          notBefore: erased.mediaEligibleAt,
          updatedAt: now,
        },
        $setOnInsert: {
          bucket: object.bucket,
          objectKey: object.objectKey,
          checksumSha256: head.checksumSha256,
          sizeBytes: head.contentLength,
          status: "planned",
          createdAt: now,
        },
      },
      { upsert: true },
    );
  }
  const cleanupId = new ObjectId(
    createHash("sha256")
      .update(`privacy-cleanup:${request._id}`)
      .digest("hex")
      .slice(0, 24),
  );
  await requests.updateOne(
    { _id: cleanupId },
    {
      $setOnInsert: {
        kind: "media.cleanup",
        policyHash: request.approvedPolicyHash,
        privacyRequestId: request._id,
        actorId: request.review.actorId,
        status: "queued",
        attempts: 0,
        availableAt: now,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );
  await requests.updateOne(
    { _id: request._id, status: "erased" },
    {
      $set: {
        mediaInventoryPreparedAt: now,
        mediaCleanupOperationId: cleanupId,
      },
    },
  );
  return {
    status: "erased",
    financialRecordsRetained: true,
    mediaCleanupPending: true,
  };
}
