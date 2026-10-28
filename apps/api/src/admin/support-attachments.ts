import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import type { Hono } from "hono";
import { z } from "zod";
import { bodyLimit } from "hono/body-limit";
import type { MongoDatabase } from "@movprompt/db";
import type { AuthGateway } from "../auth-gateway.js";
import type { AssetStorageGateway } from "../asset-storage.js";
import {
  createAssetContentVerifier,
  AssetContentVerificationError,
} from "../asset-content-verifier.js";
import type { ApiEnvironment } from "../request-context.js";
import {
  ADMIN_COLLECTIONS as A,
  adminObjectId,
  adminError,
  adminJson,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

export const SUPPORT_ATTACHMENTS = "support_attachments";
const InitSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(12 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const publicAttachment = (row: Document) => ({
  id: String(row._id),
  name: row.name,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
});

/** A verified attachment is bound once, atomically with its message. Private
 * owner notes cannot be fetched by the customer through attachment IDs. */
export async function bindSupportAttachments(
  database: MongoDatabase,
  actor: AdminActor,
  caseId: ObjectId,
  userId: ObjectId,
  messageId: ObjectId,
  visibility: string,
  ids: string[],
  session: ClientSession,
) {
  const photos = [];
  for (const id of ids) {
    const row = await database.db.collection(SUPPORT_ATTACHMENTS).findOne(
      {
        _id: adminObjectId(id),
        caseId,
        userId,
        uploaderId: adminObjectId(actor.userId),
        status: "verified",
        messageId: null,
        expiresAt: { $gt: new Date() },
      },
      { session },
    );
    if (!row)
      return adminError(
        "support_attachment_unavailable",
        "Upload and verify this photo in the current case before sending.",
      );
    await database.db.collection(SUPPORT_ATTACHMENTS).updateOne(
      { _id: row._id, messageId: null },
      {
        $set: {
          messageId,
          visibility,
          linkedAt: new Date(),
          expiresAt: null,
        },
      },
      { session },
    );
    photos.push(publicAttachment(row));
  }
  return photos;
}

export function registerSupportAttachmentRoutes(
  app: Hono<ApiEnvironment>,
  input: {
    database: MongoDatabase;
    security: AdminSecurity;
    auth: AuthGateway;
    storage?: AssetStorageGateway;
    assertMutation: (request: Request, binary?: boolean) => void;
  },
) {
  const { database, security, auth, storage } = input;
  const collection = database.db.collection(SUPPORT_ATTACHMENTS);
  const verifier = createAssetContentVerifier();
  for (const admin of [false, true]) {
    const base = admin
      ? "/api/v1/admin/support/:caseId/attachments"
      : "/api/v1/support/:caseId/attachments";
    async function access(headers: Headers, caseId: string, requestId: string) {
      const current = await auth.getSession(headers);
      if (!current || current.session.guest)
        return adminError(
          "authentication_required",
          "Sign in to use support attachments.",
          401,
        );
      const actor = admin
        ? await security.requireOwner(headers, requestId)
        : { userId: current.user.id, sessionId: current.session.id, requestId };
      const record = await database.db.collection(A.cases).findOne({
        _id: adminObjectId(caseId),
        ...(admin ? {} : { userId: adminObjectId(current.user.id) }),
      });
      if (!record)
        return adminError("support_not_found", "Case not found.", 404);
      return { actor, record };
    }
    app.post(base, async (context) => {
      input.assertMutation(context.req.raw);
      if (!storage)
        return adminError(
          "admin_storage_unavailable",
          "Private storage is unavailable.",
          503,
        );
      const { actor, record } = await access(
        context.req.raw.headers,
        context.req.param("caseId"),
        context.get("requestId"),
      );
      const value = InitSchema.parse(await context.req.json());
      const result = (await security.command(
        actor,
        z.string().min(8).max(200).parse(context.req.header("idempotency-key")),
        { caseId: String(record._id), ...value },
        async (session) => {
          if (
            (await collection.countDocuments(
              {
                uploaderId: adminObjectId(actor.userId),
                createdAt: { $gte: new Date(Date.now() - 3600000) },
              },
              { session },
            )) >= 30
          )
            return adminError(
              "support_attachment_rate_limit",
              "Please wait before uploading more photos.",
              429,
            );
          const _id = new ObjectId();
          const now = new Date();
          await collection.insertOne(
            {
              _id,
              ...value,
              userId: record.userId,
              caseId: record._id,
              uploaderId: adminObjectId(actor.userId),
              status: "pending",
              messageId: null,
              uploadKey: `support-uploads/${_id}`,
              expiresAt: new Date(now.getTime() + 3600000),
              createdAt: now,
            },
            { session },
          );
          return { id: String(_id) };
        },
      )) as { id: string };
      const row = await collection.findOne({
        _id: adminObjectId(result.id),
        uploaderId: adminObjectId(actor.userId),
        caseId: record._id,
      });
      if (!row || row.status !== "pending" || row.expiresAt <= new Date())
        return adminError(
          "support_upload_expired",
          "Choose the photo again to restart its upload.",
        );
      const upload = await storage.signUpload({
        bucket: storage.assetsBucket,
        key: row.uploadKey,
        metadata: {
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          checksumSha256: row.checksumSha256,
        },
        validation: {
          allowedMimeTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
          maxBytes: 12 * 1024 * 1024,
        },
      });
      return context.json({ ...result, upload });
    });
    // The authenticated bounded proxy avoids requiring public browser CORS on
    // private R2. Bytes still use the same verification and independent-copy flow.
    app.put(
      `${base}/:attachmentId/upload`,
      bodyLimit({
        maxSize: 12 * 1024 * 1024,
        onError: () =>
          adminError(
            "support_upload_too_large",
            "Choose a photo up to 12 MB.",
            400,
          ),
      }),
      async (context) => {
        input.assertMutation(context.req.raw, true);
        if (!storage)
          return adminError(
            "admin_storage_unavailable",
            "Private storage is unavailable.",
            503,
          );
        z.string().min(8).max(200).parse(context.req.header("idempotency-key"));
        const { actor, record } = await access(
          context.req.raw.headers,
          context.req.param("caseId"),
          context.get("requestId"),
        );
        const row = await collection.findOne({
          _id: adminObjectId(context.req.param("attachmentId")),
          caseId: record._id,
          uploaderId: adminObjectId(actor.userId),
          status: { $in: ["pending", "verified"] },
          messageId: null,
          expiresAt: { $gt: new Date() },
        });
        if (!row)
          return adminError(
            "support_upload_expired",
            "Restart this photo upload.",
            404,
          );
        const body = new Uint8Array(await context.req.arrayBuffer());
        if (
          body.length !== row.sizeBytes ||
          createHash("sha256").update(body).digest("hex") !==
            row.checksumSha256 ||
          context.req.header("content-type") !== row.mimeType
        )
          return adminError(
            "support_upload_mismatch",
            "The uploaded photo does not match its verified metadata.",
            400,
          );
        if (row.status === "pending") {
          await storage.put({
            bucket: storage.assetsBucket,
            key: row.uploadKey,
            body,
            contentType: row.mimeType,
            metadata: { "sha256-hex": row.checksumSha256 },
          });
          const head = await storage.head(storage.assetsBucket, row.uploadKey);
          if (
            head.contentLength !== row.sizeBytes ||
            head.checksumSha256 !== row.checksumSha256
          )
            return adminError(
              "support_upload_mismatch",
              "Private upload verification failed.",
              503,
            );
        }
        return context.json({ uploaded: true });
      },
    );
    app.post(`${base}/:attachmentId/verify`, async (context) => {
      input.assertMutation(context.req.raw);
      if (!storage)
        return adminError(
          "admin_storage_unavailable",
          "Private storage is unavailable.",
          503,
        );
      const { actor, record } = await access(
        context.req.raw.headers,
        context.req.param("caseId"),
        context.get("requestId"),
      );
      const id = adminObjectId(context.req.param("attachmentId"));
      const row = await collection.findOne({
        _id: id,
        caseId: record._id,
        uploaderId: adminObjectId(actor.userId),
      });
      if (!row || (row.expiresAt && row.expiresAt <= new Date()))
        return adminError(
          "support_upload_expired",
          "Choose the photo again to restart its upload.",
        );
      const operationKey = z
        .string()
        .min(8)
        .max(200)
        .parse(context.req.header("idempotency-key"));
      const operationInput = {
        caseId: String(record._id),
        attachmentId: String(id),
      };
      if (row.status === "verified")
        return context.json(
          await security.command(
            actor,
            operationKey,
            operationInput,
            async () => publicAttachment(row),
          ),
        );
      const bytes = await storage.get({
        bucket: storage.assetsBucket,
        key: row.uploadKey,
        maxBytes: 12 * 1024 * 1024,
      });
      if (
        bytes.body.length !== row.sizeBytes ||
        createHash("sha256").update(bytes.body).digest("hex") !==
          row.checksumSha256
      )
        return adminError(
          "support_attachment_checksum_mismatch",
          "The uploaded file did not match. Choose it again.",
          400,
        );
      try {
        await verifier.verify({
          kind: "reference",
          bytes: bytes.body,
          mimeType: row.mimeType,
          checksumSha256: row.checksumSha256,
        });
      } catch (error) {
        if (error instanceof AssetContentVerificationError)
          return adminError(
            "support_attachment_invalid",
            error.message,
            error.code === "unavailable" ? 503 : 400,
          );
        throw error;
      }
      const objectKey = `support/${record._id}/${id}/${row.checksumSha256}`;
      await storage.put({
        bucket: storage.assetsBucket,
        key: objectKey,
        body: bytes.body,
        contentType: row.mimeType,
        metadata: { "sha256-hex": row.checksumSha256 },
      });
      const head = await storage.head(storage.assetsBucket, objectKey);
      if (
        head.contentLength !== row.sizeBytes ||
        head.checksumSha256 !== row.checksumSha256
      )
        return adminError(
          "support_attachment_copy_failed",
          "Private storage verification failed. Retry this upload.",
          503,
        );
      const result = await security.command(
        actor,
        operationKey,
        operationInput,
        async (session) => {
          const current = await collection.findOne(
            {
              _id: id,
              caseId: record._id,
              uploaderId: adminObjectId(actor.userId),
              messageId: null,
              expiresAt: { $gt: new Date() },
            },
            { session },
          );
          if (!current)
            return adminError(
              "support_upload_expired",
              "This upload is no longer available.",
            );
          await collection.updateOne(
            { _id: id },
            {
              $set: {
                status: "verified",
                objectKey,
                bucket: storage.assetsBucket,
                verifiedAt: new Date(),
              },
            },
            { session },
          );
          return publicAttachment(current);
        },
      );
      return context.json(result);
    });
    app.get(`${base}/:attachmentId`, async (context) => {
      if (!storage)
        return adminError(
          "admin_storage_unavailable",
          "Private storage is unavailable.",
          503,
        );
      const { actor, record } = await access(
        context.req.raw.headers,
        context.req.param("caseId"),
        context.get("requestId"),
      );
      const row = await collection.findOne({
        _id: adminObjectId(context.req.param("attachmentId")),
        caseId: record._id,
        userId: record.userId,
        status: "verified",
        messageId: { $ne: null },
        ...(admin ? {} : { visibility: "customer" }),
      });
      if (!row || row.bucket !== storage.assetsBucket)
        return context.notFound();
      const message = await database.db.collection(A.messages).findOne({
        _id: row.messageId,
        caseId: record._id,
        userId: record.userId,
        ...(admin ? {} : { visibility: "customer" }),
      });
      if (!message) return context.notFound();
      if (admin)
        await writeAdminAudit(
          database,
          actor,
          "support.attachment-view",
          String(row._id),
          { caseId: String(record._id), messageId: String(message._id) },
          undefined,
          "authorized",
        );
      const result = await storage.get({
        bucket: row.bucket,
        key: row.objectKey,
        maxBytes: 12 * 1024 * 1024,
      });
      if (
        result.body.length !== row.sizeBytes ||
        createHash("sha256").update(result.body).digest("hex") !==
          row.checksumSha256
      )
        return context.notFound();
      context.header("Cache-Control", "private, no-store");
      context.header("X-Content-Type-Options", "nosniff");
      context.header("Content-Type", row.mimeType);
      context.header(
        "Content-Disposition",
        `attachment; filename="movprompt-support-${row._id}.${row.mimeType === "image/png" ? "png" : row.mimeType === "image/webp" ? "webp" : "jpg"}"`,
      );
      return context.body(new Uint8Array(result.body).buffer);
    });
  }
}
