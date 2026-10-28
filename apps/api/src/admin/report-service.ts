import type { Document } from "mongodb";
import type { MongoDatabase } from "@movprompt/db";
import { COLLECTIONS as C } from "@movprompt/db";
import { ADMIN_COLLECTIONS as A, adminJson } from "./security.js";

/** Bounded aggregates report money once from orders and refunds. Credit usage is
 * a separate unit and is never added to cash revenue. Costs stay in USD unless
 * a verified conversion policy is introduced. */
export function createAdminReportService(database: MongoDatabase) {
  const db = database.db;
  async function summary(days: number) {
    const now = new Date();
    const from = new Date(now.getTime() - days * 86400000);
    const range = { $gte: from, $lte: now };
    async function aggregate(
      source: string,
      pipeline: Document[],
      scope = "selected-period",
    ) {
      try {
        return {
          status: "available",
          source,
          scope,
          from: scope === "current-all-time" ? null : from,
          to: now,
          updatedAt: now,
          rows: await db
            .collection(source)
            .aggregate(pipeline, { maxTimeMS: 10_000 })
            .toArray(),
        };
      } catch {
        return {
          status: "unavailable",
          source,
          scope,
          from: scope === "current-all-time" ? null : from,
          to: now,
          updatedAt: now,
          rows: null,
        };
      }
    }
    const day = (field: string) => ({
      $dateToString: {
        date: field,
        format: "%Y-%m-%d",
        timezone: "Asia/Kuwait",
      },
    });
    const entries: Array<[string, string, Document[], string?]> = [
      [
        "acquisition",
        "users",
        [
          { $match: { createdAt: range } },
          { $group: { _id: day("$createdAt"), customers: { $sum: 1 } } },
          { $sort: { _id: 1 } },
          { $limit: 366 },
        ],
      ],
      [
        "activation",
        C.renderRuns,
        [
          {
            $group: {
              _id: "$userId",
              firstGenerationAt: { $min: "$createdAt" },
            },
          },
          { $match: { firstGenerationAt: range } },
          {
            $group: {
              _id: day("$firstGenerationAt"),
              firstGenerationCustomers: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 366 },
        ],
      ],
      [
        "generationStatus",
        C.renderRuns,
        [
          { $match: { createdAt: range } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ],
      ],
      [
        "templatePerformance",
        C.renderRuns,
        [
          { $match: { createdAt: range } },
          {
            $lookup: {
              from: C.creatorProjectVersions,
              localField: "projectVersionId",
              foreignField: "_id",
              as: "version",
            },
          },
          { $unwind: { path: "$version", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { $ifNull: ["$version.templateVersionId", "advanced"] },
              runs: { $sum: 1 },
              completed: {
                $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
              },
              failed: {
                $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
              },
              meanCompletedMs: {
                $avg: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$status", "completed"] },
                        { $eq: [{ $type: "$completedAt" }, "date"] },
                      ],
                    },
                    { $subtract: ["$completedAt", "$createdAt"] },
                    null,
                  ],
                },
              },
            },
          },
          { $sort: { runs: -1 } },
          { $limit: 100 },
        ],
      ],
      [
        "failureReasons",
        C.renderRuns,
        [
          { $match: { createdAt: range, status: "failed" } },
          {
            $group: {
              _id: {
                $ifNull: [
                  "$errorCode",
                  { $ifNull: ["$failureCode", "unclassified"] },
                ],
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 30 },
        ],
      ],
      [
        "cashCollections",
        C.paymentOrders,
        [
          {
            $match: { status: "credited", currency: "KWD", creditedAt: range },
          },
          {
            $group: {
              _id: day("$creditedAt"),
              amountMinor: { $sum: "$amountMinor" },
              purchases: { $sum: 1 },
              purchasedCredits: { $sum: "$credits" },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 366 },
        ],
      ],
      [
        "cashRefunds",
        A.financial,
        [
          {
            $match: {
              kind: "cash-refund",
              status: "confirmed",
              updatedAt: range,
            },
          },
          {
            $group: {
              _id: day("$updatedAt"),
              amountMinor: { $sum: "$amountMinor" },
              refunds: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $limit: 366 },
        ],
      ],
      [
        "creditLedger",
        C.creditLedger,
        [
          { $match: { createdAt: range } },
          {
            $group: {
              _id: "$kind",
              credits: { $sum: "$delta" },
              entries: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
      ],
      [
        "wallets",
        C.creditAccounts,
        [
          {
            $group: {
              _id: null,
              accounts: { $sum: 1 },
              balance: { $sum: "$balance" },
              refundReserved: { $sum: { $ifNull: ["$refundReserved", 0] } },
            },
          },
        ],
        "current-all-time",
      ],
      [
        "generationReservations",
        C.creditReservations,
        [
          { $match: { status: "reserved" } },
          {
            $group: {
              _id: null,
              reservedCredits: { $sum: "$amount" },
              reservations: { $sum: 1 },
            },
          },
        ],
        "current-all-time",
      ],
      [
        "providerCosts",
        C.renderAttempts,
        [
          { $match: { createdAt: range } },
          {
            $group: {
              _id: { $ifNull: ["$provider", "unknown"] },
              attempts: { $sum: 1 },
              reportedCostSamples: {
                $sum: { $cond: [{ $isNumber: "$providerCostMicrousd" }, 1, 0] },
              },
              reportedCostMicrousd: {
                $sum: {
                  $cond: [
                    { $isNumber: "$providerCostMicrousd" },
                    "$providerCostMicrousd",
                    0,
                  ],
                },
              },
            },
          },
          { $sort: { attempts: -1 } },
          { $limit: 30 },
        ],
      ],
      [
        "uploadStorage",
        C.creatorProjectAssets,
        [
          { $match: { objectKey: { $type: "string" }, sizeBytes: { $gt: 0 } } },
          {
            $group: {
              _id: { bucket: "$bucket", objectKey: "$objectKey" },
              bytes: { $max: "$sizeBytes" },
            },
          },
          {
            $group: {
              _id: null,
              objects: { $sum: 1 },
              bytes: { $sum: "$bytes" },
            },
          },
        ],
        "current-all-time",
      ],
      [
        "libraryStorage",
        "creator_reference_library_revisions",
        [
          { $unwind: "$value.photos" },
          {
            $match: {
              "value.photos.objectKey": { $type: "string" },
              "value.photos.sizeBytes": { $gt: 0 },
            },
          },
          {
            $group: {
              _id: "$value.photos.objectKey",
              bytes: { $max: "$value.photos.sizeBytes" },
            },
          },
          {
            $group: {
              _id: null,
              objects: { $sum: 1 },
              bytes: { $sum: "$bytes" },
            },
          },
        ],
        "current-all-time",
      ],
      [
        "supportWorkload",
        A.cases,
        [
          { $match: { createdAt: range } },
          {
            $group: {
              _id: { category: "$category", status: "$status" },
              cases: { $sum: 1 },
            },
          },
          { $sort: { cases: -1 } },
          { $limit: 100 },
        ],
      ],
      [
        "openSupport",
        A.cases,
        [
          { $match: { status: { $nin: ["closed", "resolved"] } } },
          {
            $group: {
              _id: "$priority",
              cases: { $sum: 1 },
              oldestCreatedAt: { $min: "$createdAt" },
            },
          },
        ],
        "current-all-time",
      ],
      [
        "internalRecovery",
        "admin_business_renders",
        [
          { $match: { purpose: "recovery", createdAt: range } },
          {
            $group: {
              _id: "$status",
              requests: { $sum: 1 },
              reviewedCeilingMicrousd: {
                $sum: { $ifNull: ["$worstCaseMicrousd", 0] },
              },
            },
          },
        ],
      ],
    ];
    const reports = Object.fromEntries(
      await Promise.all(
        entries.map(async ([name, source, pipeline, scope]) => [
          name,
          await aggregate(source, pipeline, scope),
        ]),
      ),
    );
    const costs = reports.providerCosts!;
    if (costs.rows)
      for (const row of costs.rows)
        if (row.reportedCostSamples === 0) {
          row.reportedCostMicrousd = null;
          row.coverage = "unavailable";
        } else
          row.coverage =
            row.reportedCostSamples === row.attempts ? "complete" : "partial";
    return adminJson({
      days,
      timezone: "Asia/Kuwait",
      from,
      to: now,
      updatedAt: now,
      reports,
      notes: {
        cash: "Integer KWD fils from confirmed orders and confirmed refunds. Credit consumption is not additional revenue.",
        activation:
          "First recorded generation, grouped by Kuwait calendar day; not a signup-cohort conversion rate.",
        providerCosts:
          "Provider-reported USD microunits with sample coverage. Missing samples are unavailable, not free. No KWD conversion or profit claim.",
        storage:
          "Recorded verified uploads and independent library revision objects. Does not include untracked bucket objects, output sizes without stored metadata, or provider storage.",
      },
    });
  }
  return { summary };
}
