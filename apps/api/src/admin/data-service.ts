import { addAdminRecordLabels } from "./record-labels.js";
import { libraryAssetUsage } from "./asset-usage.js";
import { ObjectId, type Document } from "mongodb";
import { COLLECTIONS, type MongoDatabase } from "@movprompt/db";
import type { AdminListQuery, AdminResource } from "@movprompt/contracts";
import { addAdminTemplateView, addAdminTemplateViews } from "./template-view.js";
import { addCampaignListFields, campaignDetail } from "./campaign-views.js";
import { createTtlCache } from "./ttl-cache.js";
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
  /** Kept on detail, too heavy for a page of rows. */
  detailOnly?: string[];
};
/** Beyond this a filtered count stops scanning and the total is reported as capped. */
export const ADMIN_LIST_COUNT_CAP = 10000;
const OVERVIEW_METRICS_TTL_MS = 45000;
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
      "enabledLanguages",
      "displayDescription",
      "displayOutcome",
      "displayCategory",
      "displayDiscoveryCategory",
      "displayTags",
      "displaySortOrder",
      "currentPublishedVersionId",
      "adminManaged",
      "publicationPinned",
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
    detailOnly: ["purchaseAllocations"],
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
  /** customerTab narrows finance to refunds and links accepted renders on campaigns. */
  async function list(resource: AdminResource, query: AdminListQuery, customerTab = false) {
    const config = ADMIN_RESOURCES[resource];
    const filter = adminFilter(resource, query);
    if (customerTab && resource === "financial-requests") filter.kind = { $in: ["cash-refund", "generation-restoration"] };
    const collection = db.collection(config.collection);
    const unfiltered = Object.keys(filter).length === 0;
    const skip = (query.page - 1) * query.limit;
    const [items, count] = await Promise.all([
      collection
        .find(filter, {
          projection: projection(config.fields.filter(field => !config.detailOnly?.includes(field))),
          maxTimeMS: 10000,
        })
        .sort({
          [config.date ?? "createdAt"]: query.direction === "asc" ? 1 : -1,
          _id: query.direction === "asc" ? 1 : -1,
        })
        .skip(skip)
        .limit(query.limit)
        .toArray(),
      unfiltered
        ? collection.estimatedDocumentCount({ maxTimeMS: 10000 })
        : collection.countDocuments(filter, { limit: ADMIN_LIST_COUNT_CAP, maxTimeMS: 10000 }),
    ]);
    const totalCapped = !unfiltered && count >= ADMIN_LIST_COUNT_CAP;
    await addAdminRecordLabels(db, items);
    if (resource === "customers") items.forEach(row => { row.status = row.suspendedAt ? "inactive" : "active"; });
    if (resource === "campaigns") await addCampaignListFields(db, items, customerTab);
    if (resource === "templates") await addAdminTemplateViews(db, items);
    return {
      items: adminJson(items),
      // Neither count may contradict the rows just returned on this page.
      total: Math.max(count, items.length ? skip + items.length : 0),
      ...(totalCapped ? { totalCapped: true } : {}),
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
    if (resource === "campaigns") return campaignDetail(database, id, actor);
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
    if (resource === "templates") await addAdminTemplateView(db, record);
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
  type OverviewMetrics = {
    metrics: Record<string, Document>;
    daily: Document[];
    failures: Document[];
    from: Date;
    evaluatedAt: Date;
  };
  async function loadOverviewMetrics(days: number): Promise<OverviewMetrics> {
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);
    const window = {
      from: since.toISOString(),
      to: now.toISOString(),
      evaluatedAt: now.toISOString(),
    };
    const metric = async (
      source: string,
      query: Document,
      pipeline?: Document[],
    ) => {
      try {
        if (!pipeline)
          return {
            value: await db
              .collection(source)
              .countDocuments(query, { maxTimeMS: 10000 }),
            status: "available",
            source,
            ...window,
          };
        const [row] = await db
          .collection(source)
          .aggregate([{ $match: query }, ...pipeline], { maxTimeMS: 10000 })
          .toArray();
        return { value: row?.value ?? 0, ...(row?.days ? { days: row.days } : {}), status: "available", source, ...window };
      } catch {
        return { value: null, status: "unavailable", source, ...window };
      }
    };
    const kuwaitDay = (field: string) => ({
      $dateToString: { date: field, format: "%Y-%m-%d", timezone: "Asia/Kuwait" },
    });
    const [metricEntries, runGroups] = await Promise.all([
      Promise.all(
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
            [
              { $group: { _id: kuwaitDay("$creditedAt"), value: { $sum: "$amountMinor" } } },
              {
                $group: {
                  _id: null,
                  value: { $sum: "$value" },
                  days: { $push: { day: "$_id", value: "$value" } },
                },
              },
            ],
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
        ].map(async ([name, source, query, pipeline]) => [
          String(name),
          await metric(
            String(source),
            query as Document,
            pipeline as Document[] | undefined,
          ),
        ]),
      ),
      // One pass answers run counts, daily outcomes and failure reasons together.
      db
        .collection(COLLECTIONS.renderRuns)
        .aggregate(
          [
            { $match: { createdAt: { $gte: since } } },
            {
              $group: {
                _id: {
                  status: "$status",
                  day: kuwaitDay("$createdAt"),
                  failure: {
                    $cond: [
                      { $eq: ["$status", "failed"] },
                      { $ifNull: ["$failureCode", "$errorCode"] },
                      null,
                    ],
                  },
                },
                count: { $sum: 1 },
              },
            },
          ],
          { maxTimeMS: 10000 },
        )
        .toArray(),
    ]);
    const runCounts = new Map<string, number>();
    const failureCounts = new Map<string | null, number>();
    const runDays = new Map<string, Record<string, number>>();
    for (const row of runGroups) {
      const status = String(row._id.status);
      runCounts.set(status, (runCounts.get(status) ?? 0) + row.count);
      const outcome = ["completed", "failed", "cancelled"].includes(status) ? status : "active";
      const day = runDays.get(row._id.day) ?? {};
      day[outcome] = (day[outcome] ?? 0) + row.count;
      runDays.set(row._id.day, day);
      if (status === "failed") {
        const code = row._id.failure ?? null;
        failureCounts.set(code, (failureCounts.get(code) ?? 0) + row.count);
      }
    }
    const runMetrics = ["queued", "processing", "completed", "failed", "cancelled"].map(
      (status) => [
        `runs.${status}`,
        {
          value: runCounts.get(status) ?? 0,
          status: "available",
          source: COLLECTIONS.renderRuns,
          ...window,
        },
      ],
    );
    const metrics: Record<string, Document> = Object.fromEntries([...metricEntries, ...runMetrics]);
    const { days: cashDays, ...cash } = metrics.cashCollectedMinor!;
    metrics.cashCollectedMinor = cash;
    const cashByDay = new Map<string, number>(
      (cashDays ?? []).map((row: Document) => [row.day, row.value]),
    );
    const calendar = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuwait" });
    return {
      metrics,
      // Every day in the window is present, so a quiet day shows as a gap and not a missing date.
      daily: Array.from({ length: days + 1 }, (_, index) => {
        const day = calendar.format(new Date(since.getTime() + index * 86400000));
        return {
          day,
          completed: 0,
          failed: 0,
          cancelled: 0,
          active: 0,
          ...runDays.get(day),
          cashMinor: cash.status === "available" ? (cashByDay.get(day) ?? 0) : null,
        };
      }),
      failures: [...failureCounts]
        .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
        .slice(0, 10)
        .map(([code, count]) => ({ _id: code, count })),
      from: since,
      evaluatedAt: now,
    };
  }
  // Aggregate totals only. Heartbeats and recent actions stay live below, and an
  // incomplete result is never kept.
  const overviewMetrics = createTtlCache<number, OverviewMetrics>(OVERVIEW_METRICS_TTL_MS, {
    keep: (value) =>
      Object.values(value.metrics).every((row) => row.status === "available"),
  });
  async function overview(days: number) {
    const now = new Date();
    const [aggregates, heartbeats, recentActions] = await Promise.all([
      overviewMetrics(days, () => loadOverviewMetrics(days)),
      db
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
            maxTimeMS: 10000,
          },
        )
        .limit(50)
        .toArray(),
      db
        .collection("audit_logs")
        .find(
          {},
          {
            projection: projection(ADMIN_RESOURCES.audit.fields),
            maxTimeMS: 10000,
          },
        )
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);
    return adminJson({
      metrics: aggregates.metrics,
      daily: aggregates.daily,
      failures: aggregates.failures,
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
      recentActions,
      evaluatedAt: aggregates.evaluatedAt,
      from: aggregates.from,
      to: aggregates.evaluatedAt,
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
