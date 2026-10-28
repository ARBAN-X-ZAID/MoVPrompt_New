import { retentionPolicy } from "./media-retention.js";
import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import { ADMIN_COLLECTIONS as A, adminJson } from "./security.js";

const LIMIT = 10000;
const MAX_EXPORT_BYTES = 30 * 1024 * 1024;
// Explicit projections keep authentication material, gateway payloads and owner
// notes out of customer exports as those collections gain new internal fields.
const sections: Record<string, [string, string[]]> = {
  profile: [
    "users",
    [
      "name",
      "email",
      "emailVerified",
      "locale",
      "image",
      "createdAt",
      "updatedAt",
      "suspendedAt",
      "deletionRequestedAt",
    ],
  ],
  authenticationAccounts: [
    C.accounts,
    ["providerId", "accountId", "createdAt", "updatedAt"],
  ],
  authenticationHistory: [
    "authentication_events",
    ["kind", "outcome", "httpStatus", "createdAt"],
  ],
  sessions: [
    C.sessions,
    ["createdAt", "expiresAt", "updatedAt", "userAgent", "ipAddress"],
  ],
  campaigns: [
    C.creatorProjects,
    [
      "title",
      "mode",
      "status",
      "templateId",
      "currentWorkingVersionId",
      "currentAcceptedVersionId",
      "latestRenderRunId",
      "deletedAt",
      "createdAt",
      "updatedAt",
    ],
  ],
  versions: [
    C.creatorProjectVersions,
    [
      "projectId",
      "mode",
      "versionNumber",
      "parentVersionId",
      "templateVersionId",
      "configuration",
      "productRecipe",
      "campaignRecipe",
      "changeReason",
      "createdAt",
    ],
  ],
  media: [
    C.creatorProjectAssets,
    [
      "projectId",
      "kind",
      "role",
      "bucket",
      "objectKey",
      "originalFilename",
      "mimeType",
      "sizeBytes",
      "checksumSha256",
      "width",
      "height",
      "librarySource",
      "deletedAt",
      "createdAt",
    ],
  ],
  generations: [
    C.renderRuns,
    [
      "projectId",
      "projectVersionId",
      "status",
      "processingStage",
      "capabilityAlias",
      "quotedCredits",
      "chargedCredits",
      "chargedAt",
      "refundStatus",
      "outputBucket",
      "outputObjectKey",
      "outputSizeBytes",
      "posterObjectKey",
      "createdAt",
      "completedAt",
      "updatedAt",
    ],
  ],
  downloads: [
    C.exports,
    [
      "projectId",
      "projectVersionId",
      "renderRunId",
      "format",
      "status",
      "bucket",
      "objectKey",
      "createdAt",
      "completedAt",
    ],
  ],
  library: [
    "creator_reference_library",
    [
      "kind",
      "value",
      "deleted",
      "quarantinedAt",
      "trashUntil",
      "createdAt",
      "updatedAt",
    ],
  ],
  libraryRevisions: [
    "creator_reference_library_revisions",
    ["entryId", "revision", "value", "createdAt"],
  ],
  payments: [
    C.paymentOrders,
    [
      "packageId",
      "credits",
      "amountMinor",
      "currency",
      "status",
      "failureReason",
      "createdAt",
      "creditedAt",
      "updatedAt",
    ],
  ],
  wallet: [
    C.creditAccounts,
    ["balance", "refundReserved", "lifetimeSpent", "createdAt", "updatedAt"],
  ],
  credits: [
    C.creditLedger,
    [
      "kind",
      "delta",
      "balanceAfter",
      "reason",
      "referenceType",
      "referenceId",
      "createdAt",
    ],
  ],
  reservations: [
    C.creditReservations,
    ["renderRunId", "amount", "status", "createdAt", "updatedAt"],
  ],
  entitlements: [
    C.entitlements,
    ["type", "status", "consumedAt", "renderRunId", "createdAt", "updatedAt"],
  ],
  support: [
    A.cases,
    [
      "subject",
      "category",
      "status",
      "priority",
      "projectId",
      "runId",
      "paymentId",
      "createdAt",
      "updatedAt",
    ],
  ],
  supportMessages: [
    A.messages,
    ["caseId", "authorRole", "message", "attachments", "delivery", "createdAt"],
  ],
  supportAttachments: [
    "support_attachments",
    [
      "caseId",
      "messageId",
      "name",
      "mimeType",
      "sizeBytes",
      "checksumSha256",
      "objectKey",
      "bucket",
      "verifiedAt",
      "createdAt",
    ],
  ],
  emailPreferences: [
    "email_preferences",
    ["marketingOptIn", "revision", "suppressedAt", "consentAt", "updatedAt"],
  ],
  notifications: [
    C.notifications,
    ["type", "title", "body", "caseId", "readAt", "createdAt"],
  ],
};

/** Remove only infrastructure credentials and expiring storage links. Ordinary
 * customer wording, punctuation, numbers and approved dialogue are untouched. */
export function exportCustomerValue(value: unknown): unknown {
  if (value instanceof ObjectId || value instanceof Date)
    return adminJson(value);
  if (Array.isArray(value)) return value.map(exportCustomerValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) => {
      if (
        /^(password|passwordHash|accessToken|refreshToken|idToken|secret|backupCodes|sessionToken|providerRequestId|providerPayload|rawResponse|signedUrl|signedUploadUrl|signedDownloadUrl|providerModelId|modelId)$/i.test(
          key,
        )
      )
        return [];
      if (
        typeof item === "string" &&
        /^https?:/i.test(item) &&
        /[?&](X-Amz-|Signature=|token=|sig=)/i.test(item)
      )
        return [];
      return [[key === "_id" ? "id" : key, exportCustomerValue(item)]];
    }),
  );
}

export function createCustomerDataService(
  database: MongoDatabase,
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  const db = database.db;
  async function collect(userId: ObjectId, session: ClientSession) {
    const records: Record<string, Document[]> = {};
    let totalBytes = 0;
    for (const [section, [collection, fields]] of Object.entries(sections)) {
      const filter: Document =
        section === "profile" ? { _id: userId } : { userId };
      if (section === "supportMessages" || section === "supportAttachments")
        filter.visibility = "customer";
      const cursor = db
        .collection(collection)
        .find(filter, {
          session,
          projection: Object.fromEntries(fields.map((field) => [field, 1])),
          maxTimeMS: 30000,
        })
        .sort({ _id: 1 })
        .limit(LIMIT + 1)
        .batchSize(100);
      const items: Document[] = [];
      for await (const row of cursor) {
        totalBytes += new TextEncoder().encode(
          JSON.stringify(adminJson(row)),
        ).length;
        if (items.length === LIMIT || totalBytes > MAX_EXPORT_BYTES)
          throw new Error("customer_export_requires_larger_reviewed_manifest");
        items.push(row);
      }
      records[section] = items;
    }
    if (!records.profile?.length)
      throw new Error("customer_export_account_missing");
    return records;
  }
  async function exportData(userId: ObjectId) {
    const records = await database.transaction((session) =>
      collect(userId, session),
    );
    const media: Document[] = [];
    for (const row of records.supportAttachments ?? [])
      if (row.objectKey)
        media.push({
          source: "support",
          recordId: row._id,
          bucket: row.bucket,
          objectKey: row.objectKey,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          checksumSha256: row.checksumSha256,
        });
    for (const row of records.media ?? [])
      if (row.objectKey)
        media.push({
          source: "campaign",
          recordId: row._id,
          bucket: row.bucket,
          objectKey: row.objectKey,
          mimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          checksumSha256: row.checksumSha256,
        });
    for (const row of records.generations ?? [])
      if (row.outputObjectKey)
        media.push({
          source: "generation",
          recordId: row._id,
          bucket: row.outputBucket,
          objectKey: row.outputObjectKey,
          mimeType: "video/mp4",
          sizeBytes: row.outputSizeBytes,
        });
    for (const row of records.libraryRevisions ?? [])
      for (const photo of row.value?.photos ?? [])
        media.push({
          source: "library-revision",
          entryId: row.entryId,
          revision: row.revision,
          photoId: photo.id,
          objectKey: photo.objectKey,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          checksumSha256: photo.checksumSha256,
        });
    for (const row of records.library ?? [])
      for (const photo of row.value?.photos ?? [])
        media.push({
          source: "library",
          entryId: row._id,
          revision: row.value.revision,
          photoId: photo.id,
          objectKey: photo.objectKey,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          checksumSha256: photo.checksumSha256,
        });
    const document = exportCustomerValue({
      schemaVersion: 1,
      customerId: userId,
      generatedAt: new Date(),
      scope:
        "Account records and private media inventory. Media bytes are not embedded. Device-only guest files are unavailable to the server.",
      counts: Object.fromEntries(
        Object.entries(records).map(([section, rows]) => [
          section,
          rows.length,
        ]),
      ),
      records,
      mediaInventory: media,
      excluded: [
        "Credentials and session tokens",
        "Private owner notes",
        "Provider payloads",
        "Other customers",
        "Device-only files",
      ],
    });
    const body = new TextEncoder().encode(JSON.stringify(document, null, 2));
    if (body.length > MAX_EXPORT_BYTES)
      throw new Error("customer_export_requires_larger_reviewed_manifest");
    return {
      body,
      checksumSha256: createHash("sha256").update(body).digest("hex"),
      recordCount: Object.values(records).reduce(
        (sum, rows) => sum + rows.length,
        0,
      ),
      mediaCount: media.length,
    };
  }
  async function deletionManifest(
    userId: ObjectId,
    existingSession?: ClientSession,
  ) {
    const build = async (session: ClientSession) => {
      const records = await collect(userId, session);
      const active = await db
        .collection(C.renderRuns)
        .countDocuments(
          { userId, status: { $nin: ["completed", "failed", "cancelled"] } },
          { session },
        );
      const reservations = await db
        .collection(C.creditReservations)
        .countDocuments({ userId, status: "reserved" }, { session });
      const refunds = await db.collection(A.financial).countDocuments(
        {
          userId,
          status: {
            $in: ["requested", "approved", "submitted", "uncertain"],
          },
        },
        { session },
      );
      const holds = await db.collection(A.moderation).countDocuments(
        {
          userId,
          category: {
            $in: ["clinic-review", "permission-dispute", "suspicious-payment"],
          },
          status: { $ne: "closed" },
        },
        { session },
      );
      const counts = Object.fromEntries(
        Object.entries(records).map(([name, rows]) => [name, rows.length]),
      );
      const policy = retentionPolicy(environment);
      const wallet = records.wallet?.[0];
      const unsettledOrders = await db
        .collection(C.paymentOrders)
        .countDocuments(
          {
            userId,
            status: { $nin: ["credited", "failed", "expired", "cancelled"] },
          },
          { session },
        );
      const business = await db
        .collection("admin_business_renders")
        .countDocuments(
          {
            userId,
            status: { $in: ["preparing", "ready", "approved", "running"] },
          },
          { session },
        );
      const pendingClaims = await db
        .collection(C.guestClaimOperations)
        .countDocuments(
          { userId, status: { $in: ["pending", "securing"] } },
          { session },
        );
      const pendingAdmin = await db.collection(A.operations).countDocuments(
        {
          userId,
          kind: { $ne: "customer.delete-request" },
          status: { $in: ["queued", "running"] },
        },
        { session },
      );
      const pendingWorker = await db.collection(C.workerJobs).countDocuments(
        {
          status: { $in: ["queued", "active"] },
          $or: [
            { "data.userId": { $in: [userId, String(userId)] } },
            { "data.ownerId": { $in: [userId, String(userId)] } },
          ],
        },
        { session },
      );
      const manifest = {
        dataDigest: createHash("sha256")
          .update(JSON.stringify(adminJson(records)))
          .digest("hex"),
        policyVersion: policy.version,
        schemaVersion: 1,
        customerId: userId.toHexString(),
        counts,
        blockers: [
          ...(!policy.ready
            ? [{ code: "retention-policy-review", count: 1 }]
            : []),
          ...(!wallet
            ? [{ code: "wallet-account-missing", count: 1 }]
            : Number(wallet.balance) !== 0
              ? [
                  {
                    code: "unsettled-wallet-balance",
                    count: 1,
                    balanceCredits: Number(wallet.balance),
                  },
                ]
              : []),
          ...(unsettledOrders
            ? [{ code: "unsettled-payment-orders", count: unsettledOrders }]
            : []),
          ...(business
            ? [{ code: "active-business-renders", count: business }]
            : []),
          ...(pendingClaims + pendingAdmin + pendingWorker
            ? [
                {
                  code: "active-account-operations",
                  count: pendingClaims + pendingAdmin + pendingWorker,
                },
              ]
            : []),
          ...(active ? [{ code: "active-generations", count: active }] : []),
          ...(reservations
            ? [{ code: "reserved-credits", count: reservations }]
            : []),
          ...(refunds
            ? [{ code: "unsettled-financial-requests", count: refunds }]
            : []),
          ...(holds
            ? [{ code: "legal-or-permission-review", count: holds }]
            : []),
        ],
        retainedCategories: [
          "Financial records",
          "Audit history",
          "Accepted and active generation snapshots until reviewed retention expires",
          "Objects referenced by independent records",
        ],
        recordIds: Object.fromEntries(
          Object.entries(records).map(([name, rows]) => [
            name,
            rows.map((row) => String(row._id)),
          ]),
        ),
      };
      return {
        ...manifest,
        evaluatedAt: new Date(),
        manifestHash: createHash("sha256")
          .update(JSON.stringify(manifest))
          .digest("hex"),
        permanentDeletionEnabled: policy.enabled,
      };
    };
    return existingSession
      ? build(existingSession)
      : database.transaction(build);
  }
  return { exportData, deletionManifest };
}
