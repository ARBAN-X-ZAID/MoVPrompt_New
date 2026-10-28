import { queueEmail, assertEmailEnabled } from "./email-delivery.js";
import {
  validateTransactionalEmail,
  retirePriorTransactionalEmails,
} from "./transactional-email.js";
import { bindSupportAttachments } from "./support-attachments.js";
import { parseAdminMediaRange } from "./media-range.js";
import { applyAdminAssetAction } from "./asset-moderation.js";
import { ObjectId, type Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import type { AssetStorageGateway } from "../asset-storage.js";
import type { AdminActor, AdminSecurity } from "./security.js";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
} from "./security.js";

export function createAdminWorkspaceService(
  database: MongoDatabase,
  security: AdminSecurity,
  storage?: AssetStorageGateway,
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  const db = database.db;
  async function createCase(
    actor: AdminActor,
    key: string,
    input: Document,
    customerInitiated = false,
  ) {
    return security.command(actor, key, input, async (session) => {
      const id = new ObjectId();
      const now = new Date();
      if (!input.userId)
        return adminError(
          "support_customer_required",
          "Choose a customer.",
          400,
        );
      const userId = adminObjectId(input.userId);
      if (
        !(await db
          .collection("users")
          .findOneAndUpdate(
            { _id: userId, erasedAt: null },
            { $inc: { adminMutationFence: 1 } },
            { session, returnDocument: "after" },
          ))
      )
        return adminError(
          "admin_customer_not_found",
          "Customer not found.",
          404,
        );
      for (const [field, collection] of [
        ["projectId", C.creatorProjects],
        ["runId", C.renderRuns],
        ["paymentId", C.paymentOrders],
      ]) {
        if (
          input[field!] &&
          !(await db
            .collection(collection!)
            .findOne(
              { _id: adminObjectId(input[field!]), userId },
              { session },
            ))
        )
          return adminError(
            "support_link_invalid",
            "A linked record belongs to another customer.",
            400,
          );
      }
      const { message, ...rest } = input;
      const record = {
        _id: id,
        ...rest,
        ...Object.fromEntries(
          ["projectId", "runId", "paymentId"]
            .filter((field) => input[field])
            .map((field) => [field, adminObjectId(input[field])]),
        ),
        userId,
        status: "open",
        priority: "normal",
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection(A.cases).insertOne(record, { session });
      await db.collection(A.messages).insertOne(
        {
          caseId: id,
          userId,
          actorId: adminObjectId(actor.userId),
          visibility: customerInitiated ? "customer" : "private",
          message,
          delivery: customerInitiated ? "available-in-app" : "not-requested",
          createdAt: now,
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "support.create",
        id.toHexString(),
        { category: input.category },
        session,
      );
      return adminJson(record);
    });
  }
  async function updateCase(
    actor: AdminActor,
    id: string,
    key: string,
    input: Document,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const caseId = adminObjectId(id);
      const now = new Date();
      const row = await db
        .collection(A.cases)
        .findOne(
          { _id: caseId, revision: input.expectedRevision },
          { session },
        );
      if (
        row &&
        !(await db
          .collection("users")
          .findOneAndUpdate(
            { _id: row.userId, erasedAt: null },
            { $inc: { adminMutationFence: 1 } },
            { session, returnDocument: "after" },
          ))
      )
        return adminError(
          "support_account_erased",
          "This account has been erased.",
        );
      if (!row)
        return adminError(
          "support_case_changed",
          "Reload the case before updating it.",
        );
      const fields = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        updatedAt: now,
      };
      await db
        .collection(A.cases)
        .updateOne(
          { _id: caseId, revision: input.expectedRevision },
          { $set: fields, $inc: { revision: 1 } },
          { session },
        );
      if (input.attachmentIds?.length && !input.message)
        return adminError(
          "support_message_required",
          "Add a message with the attachments.",
          400,
        );
      if (input.message) {
        const messageId = new ObjectId();
        const attachments = await bindSupportAttachments(
          database,
          actor,
          caseId,
          row.userId,
          messageId,
          input.visibility,
          input.attachmentIds ?? [],
          session,
        );
        const result = await db.collection(A.messages).insertOne(
          {
            _id: messageId,
            attachments,
            caseId,
            userId: row.userId,
            actorId: adminObjectId(actor.userId),
            visibility: input.visibility,
            message: input.message,
            delivery:
              input.visibility === "customer"
                ? "available-in-app"
                : "not-requested",
            createdAt: now,
          },
          { session },
        );
        if (input.visibility === "customer")
          await db.collection(C.notifications).insertOne(
            {
              userId: row.userId,
              type: "support-reply",
              title: row.subject,
              body: input.message,
              caseId,
              messageId: result.insertedId,
              readAt: null,
              createdAt: now,
            },
            { session },
          );
        if (input.notifyEmail) {
          if (input.visibility !== "customer")
            return adminError(
              "support_email_private",
              "Private notes cannot be emailed to the customer.",
              400,
            );
          assertEmailEnabled(environment);
          const recipient = await db.collection("users").findOne(
            {
              _id: row.userId,
              emailVerified: true,
              suspendedAt: null,
              deletionRequestedAt: null,
            },
            { session },
          );
          if (!recipient)
            return adminError(
              "support_email_unverified",
              "The customer needs a verified, active email account.",
            );
          const text = `${input.message}\n\n${new URL(environment.WEB_ORIGIN ?? environment.BETTER_AUTH_URL!).origin}/notifications`;
          await queueEmail(
            database,
            {
              kind: "support",
              userId: row.userId,
              email: recipient.email,
              locale: recipient.locale === "ar" ? "ar" : "en",
              title: { en: row.subject, ar: row.subject },
              body: { en: text, ar: text },
              caseId,
              messageId,
              actorId: adminObjectId(actor.userId),
            },
            session,
          );
          await db
            .collection(A.messages)
            .updateOne(
              { _id: messageId },
              { $set: { emailStatus: "queued" } },
              { session },
            );
        }
      }
      await writeAdminAudit(
        database,
        actor,
        "support.update",
        id,
        {
          reason: input.reason,
          status: fields,
          messageVisibility: input.message ? input.visibility : null,
        },
        session,
      );
      return { id, revision: input.expectedRevision + 1, ...fields };
    });
  }
  async function customerReply(
    actor: AdminActor,
    id: string,
    key: string,
    input: {
      expectedRevision: number;
      message: string;
      attachmentIds?: string[];
    },
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const userId = adminObjectId(actor.userId);
      const caseId = adminObjectId(id);
      const now = new Date();
      const row = await db
        .collection(A.cases)
        .findOne(
          { _id: caseId, userId, revision: input.expectedRevision },
          { session },
        );
      if (!row)
        return adminError(
          "support_case_changed",
          "Reload your case before replying.",
        );
      const recent = await db.collection(A.messages).countDocuments(
        {
          userId,
          actorId: userId,
          createdAt: { $gte: new Date(now.getTime() - 3600000) },
        },
        { session },
      );
      if (recent >= 30)
        return adminError(
          "support_rate_limit",
          "Please wait before sending another reply.",
          429,
        );
      const messageId = new ObjectId();
      const attachments = await bindSupportAttachments(
        database,
        actor,
        caseId,
        userId,
        messageId,
        "customer",
        input.attachmentIds ?? [],
        session,
      );
      await db.collection(A.messages).insertOne(
        {
          _id: messageId,
          attachments,
          caseId,
          userId,
          actorId: userId,
          authorRole: "customer",
          visibility: "customer",
          message: input.message,
          delivery: "available-in-app",
          createdAt: now,
        },
        { session },
      );
      await db.collection(A.cases).updateOne(
        { _id: caseId, userId, revision: input.expectedRevision },
        {
          $set: {
            status:
              row.status === "closed" ||
              row.status === "resolved" ||
              row.status === "waiting-customer"
                ? "open"
                : row.status,
            lastCustomerReplyAt: now,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "support.customer-reply",
        id,
        { messageId },
        session,
      );
      return {
        id,
        messageId: String(messageId),
        revision: input.expectedRevision + 1,
        delivery: "available-in-app",
      };
    });
  }
  async function assetAction(
    actor: AdminActor,
    id: string,
    key: string,
    input: Document,
  ) {
    return security.command(actor, key, { id, ...input }, (session) =>
      applyAdminAssetAction(database, actor, id, input, session),
    );
  }
  async function content(
    actor: AdminActor,
    id: string | null,
    key: string,
    input: Document,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const _id = id ? adminObjectId(id) : new ObjectId();
      const now = new Date();
      const previous = await db
        .collection(A.content)
        .findOne({ _id }, { session });
      if (
        (id && !previous) ||
        (previous?.revision ?? 0) !== input.expectedRevision
      )
        return adminError(
          "content_revision_changed",
          "Reload this content before saving.",
        );
      if (
        (input.kind === "promotional-email" ||
          (input.kind === "transactional-email" &&
            (environment.ADMIN_EMAIL_ENABLED !== "true" ||
              !environment.SMTP_HOST ||
              !environment.EMAIL_FROM))) &&
        input.status !== "draft" &&
        input.status !== "archived"
      )
        return adminError(
          "email_release_gate_closed",
          "Email campaigns require verified audience suppression, preview and delivery acceptance before publishing.",
          503,
        );
      if (
        input.status === "scheduled" &&
        (!input.scheduledAt || new Date(input.scheduledAt) <= now)
      )
        return adminError(
          "schedule_invalid",
          "Choose a future publication time.",
          400,
        );
      if (input.kind === "transactional-email")
        validateTransactionalEmail(input);
      if (input.kind === "transactional-email" && input.status === "published")
        await retirePriorTransactionalEmails(
          database,
          _id,
          input.emailPurpose,
          session,
          now,
        );
      const { expectedRevision, reason, ...definition } = input;
      const record = {
        _id,
        ...definition,
        revision: expectedRevision + 1,
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
        ...(input.status === "published" ? { publishedAt: now } : {}),
        delivery: input.kind.endsWith("email")
          ? "not-requested"
          : "available-in-app",
        approvedBy: adminObjectId(actor.userId),
      };
      await db
        .collection(A.content)
        .replaceOne({ _id }, record, { session, upsert: true });
      await db.collection(A.contentVersions).insertOne(
        {
          contentId: _id,
          definition: record,
          revision: record.revision,
          createdAt: now,
        },
        { session },
      );
      await db
        .collection(A.operations)
        .updateMany(
          { kind: "content.publish", contentId: _id, status: "queued" },
          { $set: { status: "cancelled", updatedAt: now } },
          { session },
        );
      if (input.status === "scheduled")
        await db.collection(A.operations).insertOne(
          {
            kind: "content.publish",
            contentId: _id,
            contentRevision: record.revision,
            actorId: adminObjectId(actor.userId),
            requestId: actor.requestId,
            status: "queued",
            attempts: 0,
            availableAt: new Date(input.scheduledAt),
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      await writeAdminAudit(
        database,
        actor,
        "content.save",
        _id.toHexString(),
        {
          reason,
          revision: record.revision,
          status: input.status,
          audience: input.audience,
        },
        session,
      );
      return adminJson(record);
    });
  }
  async function settings(actor: AdminActor, key: string, input: Document) {
    return security.command(actor, key, input, async (session) => {
      const collection = db.collection(A.settings);
      const previous = await collection.findOne(
        { key: "operations" },
        { session },
      );
      if ((previous?.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "settings_revision_changed",
          "Reload operational settings first.",
        );
      const { expectedRevision, reason, ...settings } = input;
      await collection.updateOne(
        { key: "operations" },
        {
          $set: {
            ...settings,
            revision: expectedRevision + 1,
            updatedAt: new Date(),
          },
        },
        { session, upsert: true },
      );
      await writeAdminAudit(
        database,
        actor,
        "settings.operations",
        "operations",
        {
          reason,
          before: previous
            ? {
                pauseGeneration: previous.pauseGeneration,
                pausedCapabilities: previous.pausedCapabilities,
              }
            : null,
          after: settings,
        },
        session,
      );
      return { ...settings, revision: expectedRevision + 1 };
    });
  }
  async function getSettings() {
    return adminJson(
      (await db.collection(A.settings).findOne({ key: "operations" })) ?? {
        revision: 0,
        pauseGeneration: false,
        pausedCapabilities: [],
        maintenanceMessage: { en: "", ar: "" },
        dailyRecoveryBudgetMinor: 0,
      },
    );
  }
  async function moderation(actor: AdminActor, key: string, input: Document) {
    return security.command(actor, key, input, async (session) => {
      const now = new Date();
      const _id = new ObjectId();
      const userId = adminObjectId(input.userId);
      if (
        !(await db
          .collection("users")
          .findOneAndUpdate(
            { _id: userId, erasedAt: null },
            { $inc: { adminMutationFence: 1 } },
            { session, returnDocument: "after" },
          ))
      )
        return adminError(
          "admin_customer_not_found",
          "Customer not found.",
          404,
        );
      for (const [field, collection] of [
        ["projectId", C.creatorProjects],
        ["assetId", "creator_reference_library"],
      ]) {
        if (
          input[field!] &&
          !(await db
            .collection(collection!)
            .findOne(
              { _id: adminObjectId(input[field!]), userId },
              { session },
            ))
        )
          return adminError(
            "moderation_link_invalid",
            "The linked record belongs to another customer.",
            400,
          );
      }
      const record = {
        _id,
        ...input,
        userId,
        ...Object.fromEntries(
          ["projectId", "assetId"]
            .filter((field) => input[field])
            .map((field) => [field, adminObjectId(input[field])]),
        ),
        status: "open",
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection(A.moderation).insertOne(record, { session });
      await writeAdminAudit(
        database,
        actor,
        "moderation.open",
        _id.toHexString(),
        { category: input.category, reason: input.reason },
        session,
      );
      return adminJson(record);
    });
  }
  async function media(
    actor: AdminActor,
    input: {
      kind: "asset" | "owned" | "campaign" | "generation";
      id: string;
      photoId?: string;
      revision?: number;
      download: boolean;
      range?: string;
      restricted?: boolean;
    },
  ) {
    if (!storage)
      return adminError(
        "admin_storage_unavailable",
        "Private storage is unavailable.",
        503,
      );
    if (
      input.revision !== undefined &&
      !["owned", "asset"].includes(input.kind)
    )
      return adminError(
        "admin_media_revision_unsupported",
        "This media type does not support photo revisions.",
        400,
      );
    let bucket: string | undefined;
    let key: string | undefined;
    let mimeType: string | undefined;
    if (input.kind === "owned") {
      const row = await db
        .collection("admin_owned_media")
        .findOne({ _id: adminObjectId(input.id) });
      if (
        row?.deletedAt &&
        (!input.restricted || !row.trashUntil || row.trashUntil <= new Date())
      )
        return adminError(
          "admin_media_unavailable",
          "This item is in trash or outside its recovery period.",
          404,
        );
      const revision = row
        ? await db.collection("admin_owned_media_revisions").findOne({
            mediaId: row._id,
            revision: input.revision ?? row.revision,
            verifiedAt: { $ne: null },
          })
        : null;
      if (revision) {
        bucket = revision.bucket;
        key = revision.objectKey;
        mimeType = revision.mimeType;
      }
    } else if (input.kind === "asset") {
      const row = await db.collection("creator_reference_library").findOne({
        _id: adminObjectId(input.id),
        ...(input.restricted ? {} : { deleted: false, quarantinedAt: null }),
      });
      if (
        row?.deleted &&
        (!row.trashUntil || new Date(row.trashUntil) <= new Date())
      )
        return adminError(
          "admin_media_unavailable",
          "This item is outside its recoverable trash period.",
          404,
        );
      const revision =
        row && input.revision !== undefined
          ? await db.collection("creator_reference_library_revisions").findOne({
              entryId: input.id,
              userId: row.userId,
              revision: input.revision,
            })
          : null;
      const value = input.revision !== undefined ? revision?.value : row?.value;
      const photo = value?.photos?.find(
        (item: Document) => item.id === input.photoId,
      );
      if (photo) {
        bucket = storage.assetsBucket;
        key = photo.objectKey;
        mimeType = photo.mimeType;
      }
    } else if (input.kind === "campaign") {
      const row = await db
        .collection(C.creatorProjectAssets)
        .findOne({ _id: adminObjectId(input.id), deletedAt: null });
      if (row) {
        bucket = row.bucket;
        key = row.objectKey;
        mimeType = row.mimeType;
      }
    } else {
      const row = await db
        .collection(C.renderRuns)
        .findOne({ _id: adminObjectId(input.id), status: "completed" });
      if (row?.privacyErasedAt)
        return adminError(
          "admin_media_unavailable",
          "This customer's media is no longer available.",
          404,
        );
      if (row) {
        bucket = row.outputBucket;
        key = row.outputObjectKey;
        mimeType = "video/mp4";
      }
    }
    if (
      !bucket ||
      !key ||
      ![storage.assetsBucket, storage.outputsBucket].includes(bucket)
    )
      return adminError(
        "admin_media_unavailable",
        "This media is missing, quarantined or in trash.",
        404,
      );
    // Audit is durable before any private bytes leave the server.
    await writeAdminAudit(
      database,
      actor,
      input.download ? "media.download" : "media.preview",
      input.id,
      {
        kind: input.kind,
        photoId: input.photoId ?? null,
        revision: input.revision ?? null,
        restricted: input.restricted === true,
      },
      undefined,
      "authorized",
    );
    const head = await storage.head(bucket, key);
    const size = head.contentLength;
    if (!Number.isSafeInteger(size) || !size || size < 1)
      return adminError(
        "admin_media_unavailable",
        "This media is unavailable.",
        404,
      );
    const range = parseAdminMediaRange(input.range, size);
    const safeMime = mimeType ?? head.contentType ?? "application/octet-stream";
    const normalizedMime = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/quicktime",
    ].includes(safeMime)
      ? safeMime
      : "application/octet-stream";
    if (range === false)
      return {
        body: null,
        stream: null,
        status: 416 as const,
        mimeType: normalizedMime,
        contentRange: `bytes */${size}`,
        contentLength: 0,
      };
    if (storage.stream) {
      const result = await storage.stream({
        bucket,
        key,
        ...(range ? { range } : {}),
      });
      const expectedLength = range ? range.end - range.start + 1 : size;
      if (result.contentLength !== expectedLength) {
        await result.body.cancel();
        return adminError(
          "admin_media_changed",
          "This media changed during loading. Retry the preview.",
        );
      }
      return {
        body: null,
        stream: result.body,
        status: range ? (206 as const) : (200 as const),
        mimeType: normalizedMime,
        ...(range
          ? { contentRange: `bytes ${range.start}-${range.end}/${size}` }
          : { contentRange: null }),
        contentLength: range ? range.end - range.start + 1 : size,
      };
    }
    const result = await storage.get({
      bucket,
      key,
      maxBytes: 64 * 1024 * 1024,
    });
    return {
      body: range ? result.body.slice(range.start, range.end + 1) : result.body,
      stream: null,
      status: range ? (206 as const) : (200 as const),
      mimeType: normalizedMime,
      contentRange: range ? `bytes ${range.start}-${range.end}/${size}` : null,
      contentLength: range ? range.end - range.start + 1 : size,
    };
  }
  return {
    createCase,
    updateCase,
    customerReply,
    assetAction,
    content,
    settings,
    getSettings,
    moderation,
    media,
  };
}
