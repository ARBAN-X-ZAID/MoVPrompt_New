import { addAdminRecordLabels } from "./record-labels.js";
import { libraryAssetUsage } from "./asset-usage.js";
import { ObjectId, type Document } from "mongodb";
import { resolveStoredTemplateDefinition, COLLECTIONS, type MongoDatabase } from "@movprompt/db";
import { supportsNativeUgc, type AdminListQuery, type AdminResource } from "@movprompt/contracts";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

type Resource = {
  collection: string;
  fields: string[];
  search: string[];
  date?: string;
  status?: string;
};
export const ADMIN_RESOURCES: Record<AdminResource, Resource> = {
  customers: {
    collection: "users",
    fields: [
      "name",
      "email",
      "emailVerified",
      "locale",
      "createdAt",
      "updatedAt",
      "suspendedAt",
      "deletionRequestedAt",
    ],
    search: ["name", "email"],
  },
  campaigns: {
    collection: COLLECTIONS.creatorProjects,
    fields: [
      "userId",
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
    search: ["title"],
  },
  generations: {
    collection: COLLECTIONS.renderRuns,
    fields: [
      "userId",
      "projectId",
      "projectVersionId",
      "status",
      "stage",
      "progressPercent",
      "capabilityAlias",
      "quotedCredits",
      "chargedCredits",
      "refundStatus",
      "qualityAttempt",
      "failureCode",
      "failureMessage",
      "errorCode",
      "errorMessage",
      "providerSubmittedAt",
      "providerAcceptedAt",
      "completedAt",
      "createdAt",
      "updatedAt",
    ],
    search: ["failureCode", "errorCode"],
  },
  templates: {
    collection: COLLECTIONS.videoTemplates,
    fields: [
      "displayName",
      "slug",
      "category",
      "discoveryCategory",
      "publishingState",
      "enabledDurations",
      "currentPublishedVersionId",
      "adminManaged",
      "revision",
      "createdAt",
      "updatedAt",
    ],
    search: ["slug", "category", "displayName.en", "displayName.ar"],
    status: "publishingState",
  },
  assets: {
    collection: "creator_reference_library",
    fields: [
      "userId",
      "kind",
      "deleted",
      "quarantinedAt",
      "trashUntil",
      "updatedAt",
      "value.name",
      "value.revision",
      "value.approved",
      "value.approval",
      "value.deleted",
      "value.photos.id",
      "value.photos.name",
      "value.photos.mimeType",
      "value.photos.sizeBytes",
      "value.photos.checksumSha256",
    ],
    search: ["value.name"],
    date: "updatedAt",
  },
  "owned-media": {
    collection: "admin_owned_media",
    fields: [
      "name",
      "kind",
      "revision",
      "stateRevision",
      "status",
      "approvedRevision",
      "mimeType",
      "sizeBytes",
      "checksumSha256",
      "verifiedAt",
      "operationId",
      "deletedAt",
      "trashUntil",
      "createdAt",
      "updatedAt",
    ],
    search: ["name", "kind"],
    date: "updatedAt",
  },
  payments: {
    collection: COLLECTIONS.paymentOrders,
    fields: [
      "userId",
      "provider",
      "providerReference",
      "packageId",
      "credits",
      "amountMinor",
      "currency",
      "status",
      "failureReason",
      "creditedAt",
      "createdAt",
      "updatedAt",
    ],
    search: ["providerReference", "packageId"],
  },
  credits: {
    collection: COLLECTIONS.creditLedger,
    fields: [
      "userId",
      "kind",
      "delta",
      "balanceAfter",
      "purchaseAllocations",
      "reason",
      "referenceType",
      "referenceId",
      "createdAt",
    ],
    search: ["reason", "referenceId"],
    status: "kind",
  },
  "business-renders": {
    collection: "admin_business_renders",
    fields: [
      "purpose",
      "userId",
      "projectId",
      "sourceVersionId",
      "projectVersionId",
      "originalRunId",
      "templateId",
      "draftRevision",
      "status",
      "revision",
      "worstCaseMicrousd",
      "perAttemptMicrousd",
      "currency",
      "costBasis",
      "reason",
      "quoteId",
      "runId",
      "previewMediaId",
      "qualityDecision",
      "failureCode",
      "requestedBy",
      "approvedBy",
      "approvalReason",
      "budgetDay",
      "createdAt",
      "updatedAt",
    ],
    search: ["reason", "purpose"],
  },
  "financial-requests": {
    collection: A.financial,
    fields: [
      "kind",
      "userId",
      "orderId",
      "runId",
      "amountMinor",
      "delta",
      "exception",
      "reason",
      "caseId",
      "status",
      "revision",
      "impact",
      "review",
      "execution",
      "operationId",
      "createdAt",
      "updatedAt",
    ],
    search: ["reason", "kind"],
  },
  support: {
    collection: A.cases,
    fields: [
      "userId",
      "subject",
      "category",
      "status",
      "priority",
      "projectId",
      "runId",
      "paymentId",
      "revision",
      "createdAt",
      "updatedAt",
    ],
    search: ["subject", "category"],
  },
  moderation: {
    collection: A.moderation,
    fields: [
      "userId",
      "projectId",
      "assetId",
      "category",
      "reason",
      "status",
      "revision",
      "decision",
      "createdAt",
      "updatedAt",
    ],
    search: ["category", "reason"],
  },
  content: {
    collection: A.content,
    fields: [
      "kind",
      "title",
      "body",
      "audience",
      "status",
      "revision",
      "scheduledAt",
      "publishedAt",
      "delivery",
      "createdAt",
      "updatedAt",
    ],
    search: ["title.en", "title.ar"],
  },
  reports: {
    collection: A.operations,
    fields: [
      "kind",
      "status",
      "progress",
      "rowCount",
      "truncated",
      "failureCode",
      "userId",
      "privacyRevision",
      "eligibleAt",
      "erasedAt",
      "approvedPolicyVersion",
      "mediaCleanupResult",
      "nextStep",
      "manifest",
      "review",
      "mediaCount",
      "createdAt",
      "completedAt",
      "expiresAt",
      "updatedAt",
    ],
    search: ["kind"],
  },
  operations: {
    collection: COLLECTIONS.workerJobs,
    fields: [
      "name",
      "status",
      "retryCount",
      "retryLimit",
      "startAfter",
      "leaseOwner",
      "leaseExpiresAt",
      "createdAt",
      "completedAt",
      "failedAt",
      "updatedAt",
    ],
    search: ["name"],
  },
  audit: {
    collection: "audit_logs",
    fields: [
      "actorId",
      "action",
      "target",
      "requestId",
      "outcome",
      "changes",
      "createdAt",
    ],
    search: ["action", "target", "requestId"],
  },
};
const projection = (fields: string[]) =>
  Object.fromEntries(fields.map((field) => [field, 1]));
const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function adminFilter(
  resource: AdminResource,
  query: AdminListQuery,
): Document {
  const config = ADMIN_RESOURCES[resource];
  const filter: Document = {};
  if (resource === "templates") filter.slug = { $ne: "ad-studio-brand-ad" };
  if (query.search) {
    filter.$or = config.search.map((field) => ({
      [field]: { $regex: literal(query.search), $options: "i" },
    }));
    if (/^[a-f\d]{24}$/i.test(query.search))
      filter.$or.push({ _id: adminObjectId(query.search) });
  }
  if (query.userId)
    filter[resource === "customers" ? "_id" : "userId"] = adminObjectId(
      query.userId,
    );
  if (query.projectId && resource !== "customers")
    filter[resource === "campaigns" ? "_id" : "projectId"] = adminObjectId(
      query.projectId,
    );
  if (query.status) {
    if (resource === "assets") {
      if (query.status === "trashed") filter.deleted = true;
      else if (query.status === "quarantined")
        filter.quarantinedAt = { $ne: null };
      else if (query.status === "active") filter.deleted = false;
    } else if (resource === "customers") {
      filter.suspendedAt = ["suspended", "inactive"].includes(query.status) ? { $ne: null } : null;
    } else filter[config.status ?? "status"] = query.status;
  }
  return filter;
}
export function createAdminDataService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  const db = database.db;
  async function list(resource: AdminResource, query: AdminListQuery, refundsOnly = false) {
    const config = ADMIN_RESOURCES[resource];
    const filter = adminFilter(resource, query);
    if (refundsOnly && resource === "financial-requests") filter.kind = { $in: ["cash-refund", "generation-restoration"] };
    const collection = db.collection(config.collection);
    const [items, total] = await Promise.all([
      collection
        .find(filter, {
          projection: projection(config.fields),
          maxTimeMS: 10000,
        })
        .sort({
          [config.date ?? "createdAt"]: query.direction === "asc" ? 1 : -1,
          _id: query.direction === "asc" ? 1 : -1,
        })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .toArray(),
      collection.countDocuments(filter, { maxTimeMS: 10000 }),
    ]);
    await addAdminRecordLabels(db, items);
    if (resource === "customers") items.forEach(row => { row.status = row.suspendedAt ? "inactive" : "active"; });
    if (resource === "campaigns") await Promise.all(items.map(async row => {
      if (!row.currentAcceptedVersionId) return;
      const accepted = await db.collection(COLLECTIONS.renderRuns).findOne({ projectId: row._id, projectVersionId: row.currentAcceptedVersionId, status: "completed" }, { projection: { _id: 1 }, sort: { completedAt: -1 } });
      if (accepted) row.acceptedRunId = accepted._id;
    }));
    if (resource === "templates") {
      await Promise.all(items.map(async row => {
        if (!row.currentPublishedVersionId) return;
        const version = await db.collection(COLLECTIONS.videoTemplateVersions).findOne({ _id: adminObjectId(String(row.currentPublishedVersionId)), templateId: row._id });
        if (!version) return;
        const stored = resolveStoredTemplateDefinition(version, String(version.recipe?.familyId ?? row.slug));
        const definition = row.displayName ? { ...stored, localizedName: row.displayName } : stored;
        Object.assign(row, { name: definition.localizedName, description: definition.localizedDescription, familyId: definition.id, supportedDurations: definition.supportedDurations ?? [definition.durationSeconds], supportedRatios: definition.supportedRatios, supportedLanguages: definition.supportedLanguages, photoPolicy: definition.photoPolicy ?? null, presenterModes: version.recipe?.presenterModes ?? [], speechSupported: supportsNativeUgc(definition.id), templateMedia: version.templateMedia ?? null });
      }));
    }
    return {
      items: adminJson(items),
      total,
      page: query.page,
      limit: query.limit,
      source: config.collection,
      evaluatedAt: new Date().toISOString(),
    };
  }
  async function detail(
    resource: AdminResource,
    id: string,
    actor: AdminActor,
  ) {
    const config = ADMIN_RESOURCES[resource];
    const oid = adminObjectId(id);
    const record = await db
      .collection(config.collection)
      .findOne({ _id: oid }, { projection: projection(config.fields) });
    if (!record)
      return adminError(
        "admin_record_not_found",
        "This record was not found.",
        404,
      );
    const related: Document = {};
    if (resource === "customers") {
      related.purchaseAllocations = await db
        .collection(A.allocations)
        .find(
          { userId: oid },
          {
            projection: {
              orderId: 1,
              allocationVersion: 1,
              purchasedCredits: 1,
              unusedCredits: 1,
              availableCredits: 1,
              generationReservedCredits: 1,
              refundReservedCredits: 1,
              verified: 1,
              evaluatedAt: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      related.wallet = await db
        .collection(COLLECTIONS.creditAccounts)
        .findOne(
          { userId: oid },
          { projection: { balance: 1, lifetimeSpent: 1, updatedAt: 1 } },
        );
      related.reservations = await db
        .collection(COLLECTIONS.creditReservations)
        .find(
          { userId: oid, status: "reserved" },
          { projection: { amount: 1, renderRunId: 1, createdAt: 1 } },
        )
        .limit(100)
        .toArray();
      related.sessions = await db
        .collection("sessions")
        .find(
          { userId: oid, expiresAt: { $gt: new Date() } },
          {
            projection: {
              createdAt: 1,
              expiresAt: 1,
              updatedAt: 1,
              userAgent: 1,
            },
          },
        )
        .limit(100)
        .toArray();
    }
    if (resource === "content") {
      related.history = await db
        .collection(A.contentVersions)
        .find(
          { contentId: oid },
          { projection: { revision: 1, definition: 1, createdAt: 1 } },
        )
        .sort({ revision: -1 })
        .limit(50)
        .toArray();
      related.publicationOperations = await db
        .collection(A.operations)
        .find(
          { contentId: oid, kind: "content.publish" },
          {
            projection: {
              status: 1,
              contentRevision: 1,
              availableAt: 1,
              publication: 1,
              failureCode: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();
    }
    if (resource === "owned-media") {
      related.revisions = await db
        .collection("admin_owned_media_revisions")
        .find(
          { mediaId: oid },
          {
            projection: {
              revision: 1,
              name: 1,
              kind: 1,
              status: 1,
              source: 1,
              sizeBytes: 1,
              mimeType: 1,
              checksumSha256: 1,
              verifiedAt: 1,
              approvedAt: 1,
              approvedBy: 1,
              approvalReason: 1,
              createdAt: 1,
            },
          },
        )
        .sort({ revision: -1 })
        .limit(50)
        .toArray();
      related.operation = await db.collection(A.operations).findOne(
        { _id: record.operationId },
        {
          projection: {
            kind: 1,
            status: 1,
            attempts: 1,
            failureCode: 1,
            updatedAt: 1,
          },
        },
      );
    }
    if (resource === "customers") {
      related.authenticationEvents = await db
        .collection("authentication_events")
        .find(
          { userId: oid },
          {
            projection: {
              kind: 1,
              outcome: 1,
              httpStatus: 1,
              createdAt: 1,
              requestId: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
      related.privacyRequests = await db
        .collection(A.operations)
        .find(
          { userId: oid, kind: "customer.delete-request" },
          {
            projection: {
              kind: 1,
              status: 1,
              privacyRevision: 1,
              manifest: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
    }
    if (resource === "campaigns") {
      const ids = [
        record.currentWorkingVersionId,
        record.currentAcceptedVersionId,
      ].filter((value) => value instanceof ObjectId);
      related.versions = await db
        .collection(COLLECTIONS.creatorProjectVersions)
        .find(
          { _id: { $in: ids }, projectId: oid, userId: record.userId },
          {
            projection: {
              versionNumber: 1,
              templateVersionId: 1,
              configuration: 1,
              createdAt: 1,
              status: 1,
            },
          },
        )
        .toArray();
      related.media = await db
        .collection(COLLECTIONS.creatorProjectAssets)
        .find(
          { projectId: oid, userId: record.userId },
          {
            projection: {
              kind: 1,
              mimeType: 1,
              originalFilename: 1,
              sizeBytes: 1,
              role: 1,
              deletedAt: 1,
            },
          },
        )
        .limit(100)
        .toArray();
      await writeAdminAudit(database, actor, "campaign.inspect", id, {});
    }
    if (resource === "generations") {
      related.adminOperations = await db
        .collection(A.operations)
        .find(
          { runId: oid },
          {
            projection: {
              kind: 1,
              status: 1,
              attempts: 1,
              failureCode: 1,
              availableAt: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(30)
        .toArray();
      related.attempts = await db
        .collection(COLLECTIONS.renderAttempts)
        .find(
          { renderRunId: oid },
          {
            projection: {
              attemptNumber: 1,
              status: 1,
              qualityResult: 1,
              qualityReview: 1,
              failureCode: 1,
              createdAt: 1,
              updatedAt: 1,
            },
          },
        )
        .limit(100)
        .toArray();
      related.jobs = await db
        .collection(COLLECTIONS.workerJobs)
        .find(
          { "data.renderRunId": id },
          { projection: projection(ADMIN_RESOURCES.operations.fields) },
        )
        .limit(30)
        .toArray();
    }
    if (resource === "payments")
      related.events = await db
        .collection(COLLECTIONS.paymentEvents)
        .find(
          { orderId: id },
          { projection: { eventId: 1, type: 1, provider: 1, createdAt: 1 } },
        )
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();
    if (resource === "financial-requests" && record.operationId)
      related.operation = await db.collection(A.operations).findOne(
        { _id: record.operationId },
        {
          projection: {
            kind: 1,
            status: 1,
            attempts: 1,
            failureCode: 1,
            availableAt: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      );
    if (resource === "moderation" && record.decision?.operationId)
      related.operation = await db.collection(A.operations).findOne(
        { _id: record.decision.operationId },
        {
          projection: {
            kind: 1,
            status: 1,
            failureCode: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        },
      );
    if (resource === "business-renders") {
      related.operations = await db
        .collection(A.operations)
        .find(
          { businessRequestId: oid },
          {
            projection: {
              kind: 1,
              status: 1,
              failureCode: 1,
              availableAt: 1,
              updatedAt: 1,
              runId: 1,
            },
          },
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .toArray();
      related.source = await db
        .collection(COLLECTIONS.creatorProjectVersions)
        .findOne(
          { _id: record.sourceVersionId, userId: record.userId },
          {
            projection: {
              configuration: 1,
              productRecipe: 1,
              campaignRecipe: 1,
            },
          },
        );
      await writeAdminAudit(
        database,
        actor,
        "business.source-review",
        id,
        { sourceVersionId: record.sourceVersionId },
        undefined,
        "authorized",
      );
    }
    if (resource === "support")
      related.messages = await db
        .collection(A.messages)
        .find({ caseId: oid })
        .sort({ createdAt: 1 })
        .limit(200)
        .toArray();
    if (resource === "assets") {
      related.references = await libraryAssetUsage(database, id, record.userId);
      related.revisions = await db
        .collection("creator_reference_library_revisions")
        .find(
          { entryId: id, userId: record.userId },
          {
            projection: {
              revision: 1,
              createdAt: 1,
              "value.approved": 1,
              "value.approval": 1,
              "value.photos.id": 1,
              "value.photos.name": 1,
              "value.photos.mimeType": 1,
            },
          },
        )
        .sort({ revision: -1 })
        .limit(100)
        .toArray();
    }
    // Configuration is customer-supplied data, not a source of signed media URLs
    // or credentials. Raw auth/provider documents never reach this boundary.
    await addAdminRecordLabels(db, [record]);
    return adminJson({ record, related });
  }
  async function overview(days: number) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);
    const metric = async (
      source: string,
      query: Document,
      pipeline?: Document[],
    ) => {
      try {
        const value = pipeline
          ? ((
              await db
                .collection(source)
                .aggregate([{ $match: query }, ...pipeline], {
                  maxTimeMS: 10000,
                })
                .toArray()
            )[0]?.value ?? 0)
          : await db
              .collection(source)
              .countDocuments(query, { maxTimeMS: 10000 });
        return {
          value,
          status: "available",
          source,
          from: since.toISOString(),
          to: now.toISOString(),
          evaluatedAt: now.toISOString(),
        };
      } catch {
        return {
          value: null,
          status: "unavailable",
          source,
          from: since.toISOString(),
          to: now.toISOString(),
          evaluatedAt: now.toISOString(),
        };
      }
    };
    const metrics = Object.fromEntries(
      await Promise.all(
        [
          ["newCustomers", "users", { createdAt: { $gte: since } }],
          [
            "activeCustomers",
            "sessions",
            { updatedAt: { $gte: since }, expiresAt: { $gt: now } },
            [{ $group: { _id: "$userId" } }, { $count: "value" }],
          ],
          [
            "cashCollectedMinor",
            COLLECTIONS.paymentOrders,
            {
              status: "credited",
              creditedAt: { $gte: since },
              currency: "KWD",
            },
            [{ $group: { _id: null, value: { $sum: "$amountMinor" } } }],
          ],
          [
            "cashRefundedMinor",
            A.financial,
            {
              kind: "cash-refund",
              status: "confirmed",
              updatedAt: { $gte: since },
            },
            [{ $group: { _id: null, value: { $sum: "$amountMinor" } } }],
          ],
          [
            "outstandingCredits",
            COLLECTIONS.creditAccounts,
            {},
            [{ $group: { _id: null, value: { $sum: "$balance" } } }],
          ],
          ["openCases", A.cases, { status: { $nin: ["closed", "resolved"] } }],
          ["pendingPayments", COLLECTIONS.paymentOrders, { status: "pending" }],
          [
            "failedPayments",
            COLLECTIONS.paymentOrders,
            { status: "failed", createdAt: { $gte: since } },
          ],
          ...["queued", "processing", "completed", "failed", "cancelled"].map(
            (status) => [
              `runs.${status}`,
              COLLECTIONS.renderRuns,
              { status, createdAt: { $gte: since } },
            ],
          ),
        ].map(async ([name, source, query, pipeline]) => [
          String(name),
          await metric(
            String(source),
            query as Document,
            pipeline as Document[] | undefined,
          ),
        ]),
      ),
    );
    const runs = db.collection(COLLECTIONS.renderRuns);
    const durations = await runs
      .aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: since },
            completedAt: { $type: "date" },
          },
        },
        {
          $group: {
            _id: null,
            meanMs: { $avg: { $subtract: ["$completedAt", "$createdAt"] } },
            sample: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const failures = await runs
      .aggregate([
        { $match: { status: "failed", createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $ifNull: ["$failureCode", "$errorCode"] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ])
      .toArray();
    const heartbeats = await db
      .collection(COLLECTIONS.serviceHeartbeats)
      .find(
        {},
        {
          projection: {
            serviceName: 1,
            instanceId: 1,
            lastSeenAt: 1,
            updatedAt: 1,
            status: 1,
          },
        },
      )
      .limit(50)
      .toArray();
    return adminJson({
      metrics,
      duration: durations[0] ?? { status: "unavailable" },
      failures,
      heartbeats: heartbeats.map((row) => ({
        ...row,
        readiness:
          row.status !== "ready"
            ? row.status
            : row.status === "ready" &&
                row.lastSeenAt instanceof Date &&
                now.getTime() - row.lastSeenAt.getTime() <=
                  Math.max(
                    1,
                    Number(environment.WORKER_HEARTBEAT_MAX_AGE_SECONDS ?? 45),
                  ) *
                    1000
              ? "ready"
              : "stale",
        evaluatedAt: now,
      })),
      providerCosts: {
        status: "unavailable",
        reason: "No verified provider cost settlement feed is configured.",
      },
      recentActions: await db
        .collection("audit_logs")
        .find({}, { projection: projection(ADMIN_RESOURCES.audit.fields) })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
      evaluatedAt: now,
      from: since,
      to: now,
    });
  }
  async function customerAction(
    actor: AdminActor,
    id: string,
    key: string,
    input: Document,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const userId = adminObjectId(id);
      const now = new Date();
      const user = await db.collection("users").findOneAndUpdate(
        { _id: userId },
        { $inc: { adminMutationFence: 1 } },
        {
          session,
          returnDocument: "after",
          projection: { name: 1, locale: 1, suspendedAt: 1, erasedAt: 1 },
        },
      );
      if (!user)
        return adminError(
          "admin_customer_not_found",
          "Customer not found.",
          404,
        );
      if (
        user.erasedAt &&
        !["export", "reconcile-credits"].includes(input.action)
      )
        return adminError(
          "customer_already_erased",
          "This account has been permanently erased.",
        );
      if (
        ["suspend", "revoke-sessions", "delete-request"].includes(
          input.action,
        ) &&
        (await db.collection(A.owners).findOne({ userId }, { session }))
      )
        return adminError(
          "owner_access_protected",
          "Owner access cannot be removed through customer controls.",
          403,
        );
      if (
        input.action === "delete-request" &&
        (await db
          .collection("users")
          .findOne(
            { _id: userId, deletionRequestedAt: { $ne: null } },
            { session },
          ))
      )
        return adminError(
          "privacy_request_exists",
          "Review or cancel the existing deletion request first.",
        );
      if (input.action === "profile")
        await db.collection("users").updateOne(
          { _id: userId },
          {
            $set: { name: input.name, locale: input.locale, updatedAt: now },
          },
          { session },
        );
      if (["suspend", "restore"].includes(input.action))
        await db.collection("users").updateOne(
          { _id: userId },
          {
            $set: {
              suspendedAt: input.action === "suspend" ? now : null,
              suspensionReason: input.reason,
              updatedAt: now,
            },
          },
          { session },
        );
      if (
        ["suspend", "revoke-sessions", "delete-request"].includes(input.action)
      )
        await db.collection("sessions").deleteMany({ userId }, { session });
      let operationId: string | null = null;
      if (
        [
          "export",
          "delete-request",
          "password-reset",
          "verify-email",
          "reconcile-credits",
        ].includes(input.action)
      ) {
        const operation = new ObjectId();
        operationId = operation.toHexString();
        await db.collection(A.operations).insertOne(
          {
            _id: operation,
            kind: `customer.${input.action}`,
            ...(input.action === "delete-request"
              ? { privacyRevision: 0 }
              : {}),
            userId,
            actorId: adminObjectId(actor.userId),
            status: "queued",
            availableAt: now,
            attempts: 0,
            requestId: actor.requestId,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        if (input.action === "delete-request")
          await db.collection("users").updateOne(
            { _id: userId },
            {
              $set: {
                deletionRequestedAt: now,
                deletionOperationId: operation,
                updatedAt: now,
              },
            },
            { session },
          );
      }
      await writeAdminAudit(
        database,
        actor,
        `customer.${input.action}`,
        id,
        {
          reason: input.reason,
          before: {
            name: user.name,
            locale: user.locale,
            suspendedAt: user.suspendedAt,
          },
          ...(input.action === "profile"
            ? { after: { name: input.name, locale: input.locale } }
            : {}),
          operationId,
        },
        session,
      );
      return { status: operationId ? "queued" : "completed", operationId };
    });
  }
  return { list, detail, overview, customerAction };
}
