import { createHash } from "node:crypto";
import { ObjectId, type Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import { retentionPolicy } from "./media-retention.js";
import { erasurePolicyHash } from "./account-erasure.js";
import { ADMIN_COLLECTIONS as A } from "./security.js";

export const SYSTEM = {
  alerts: "admin_system_alerts",
  checks: "admin_system_checks",
  backups: "admin_backup_evidence",
} as const;
const positive = (value: string | undefined) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};
export function backupPolicy(
  env: Readonly<Record<string, string | undefined>>,
) {
  const rpoMinutes = positive(env.ADMIN_BACKUP_RPO_MINUTES);
  const rtoMinutes = positive(env.ADMIN_BACKUP_RTO_MINUTES);
  const retentionDays = positive(env.ADMIN_BACKUP_RETENTION_DAYS);
  const approvalReference = env.ADMIN_BACKUP_APPROVAL_REFERENCE?.trim() || null;
  return {
    approved: Boolean(
      rpoMinutes && rtoMinutes && retentionDays && approvalReference,
    ),
    rpoMinutes,
    rtoMinutes,
    retentionDays,
    approvalReference,
  };
}
export const kuwaitBudgetDay = (now = new Date()) =>
  new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
type Check = {
  key: string;
  source: string;
  state: "healthy" | "attention" | "unavailable";
  observed: unknown;
  threshold?: unknown;
  from: Date | null;
  to: Date;
  evaluatedAt: Date;
};

/** Monitoring never mutates balances, retries providers or turns absence into zero. */
export async function evaluateAdminSystem(
  database: MongoDatabase,
  env: Readonly<Record<string, string | undefined>>,
  now = new Date(),
) {
  const db = database.db;
  const checks: Check[] = [];
  async function collect(
    key: string,
    source: string,
    evaluate: () => Promise<
      Omit<Check, "key" | "source" | "evaluatedAt" | "to">
    >,
  ) {
    try {
      checks.push({
        key,
        source,
        evaluatedAt: now,
        to: now,
        ...(await evaluate()),
      });
    } catch {
      checks.push({
        key,
        source,
        evaluatedAt: now,
        to: now,
        from: null,
        state: "unavailable",
        observed: null,
      });
    }
  }
  await collect("admin-worker", C.serviceHeartbeats, async () => {
    const latest = await db
      .collection(C.serviceHeartbeats)
      .findOne(
        { serviceName: "movprompt-admin-worker" },
        { sort: { lastSeenAt: -1 } },
      );
    return {
      from: null,
      state: !latest
        ? "unavailable"
        : latest.status === "ready" &&
            latest.lastSeenAt instanceof Date &&
            now.getTime() - latest.lastSeenAt.getTime() <= 60000
          ? "healthy"
          : "attention",
      observed: latest
        ? { lastSeenAt: latest.lastSeenAt, status: latest.status }
        : null,
      threshold: { maxAgeSeconds: 60 },
    };
  });
  await collect("failed-background-jobs", A.operations, async () => {
    const from = new Date(now.getTime() - 86400000);
    const count = await db
      .collection(A.operations)
      .countDocuments({ status: "failed", updatedAt: { $gte: from } });
    return {
      from,
      state: count ? "attention" : "healthy",
      observed: { count },
      threshold: { count: 0 },
    };
  });
  await collect("payment-reconciliation", C.paymentOrders, async () => {
    const count = await db.collection(C.paymentOrders).countDocuments({
      status: "pending",
      createdAt: { $lt: new Date(now.getTime() - 15 * 60000) },
    });
    const refunds = await db.collection(A.financial).countDocuments({
      status: { $in: ["submitted", "uncertain"] },
      updatedAt: { $lt: new Date(now.getTime() - 15 * 60000) },
    });
    return {
      from: null,
      state: count || refunds ? "attention" : "healthy",
      observed: {
        pendingCheckouts: count,
        unconfirmedRefunds: refunds,
        pendingDoesNotProvePayment: true,
      },
      threshold: { ageMinutes: 15 },
    };
  });
  await collect(
    "credit-provenance",
    "credit_allocation_reconciliation",
    async () => {
      const count = await db
        .collection("credit_allocation_reconciliation")
        .countDocuments({ verified: false });
      return {
        from: null,
        state: count ? "attention" : "healthy",
        observed: { count },
      };
    },
  );
  await collect("provider-reported-spending", C.renderAttempts, async () => {
    const from = new Date(`${kuwaitBudgetDay(now)}T00:00:00+03:00`);
    const rows = await db
      .collection(C.renderAttempts)
      .aggregate(
        [
          { $match: { createdAt: { $gte: from, $lte: now } } },
          {
            $group: {
              _id: null,
              attempts: { $sum: 1 },
              samples: {
                $sum: { $cond: [{ $isNumber: "$providerCostMicrousd" }, 1, 0] },
              },
              reportedMicrousd: {
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
        ],
        { maxTimeMS: 10000 },
      )
      .toArray();
    const row = rows[0];
    const threshold = Number(env.ADMIN_PROVIDER_DAILY_ALERT_USD);
    const limit =
      Number.isFinite(threshold) && threshold > 0
        ? Math.floor(threshold * 1e6)
        : null;
    return {
      from,
      state:
        !row || !row.samples || !limit
          ? "unavailable"
          : row.reportedMicrousd >= limit || row.samples < row.attempts
            ? "attention"
            : "healthy",
      observed: row
        ? {
            attempts: row.attempts,
            reportedCostSamples: row.samples,
            reportedMicrousd: row.samples ? row.reportedMicrousd : null,
            currency: "USD",
            settlementConfirmed: false,
          }
        : null,
      threshold: { microusd: limit, currency: "USD" },
    };
  });
  await collect("backup-recovery", SYSTEM.backups, async () => {
    const policy = backupPolicy(env);
    // Local drills demonstrate tooling, never production recoverability.
    const last = await db
      .collection(SYSTEM.backups)
      .findOne(
        { scope: "production", verifiedByProtectedDrill: true },
        { sort: { completedAt: -1 } },
      );
    return {
      from: null,
      state:
        !policy.approved || !last
          ? "unavailable"
          : now.getTime() - new Date(last.snapshotAt).getTime() >
                policy.rpoMinutes! * 60000 ||
              last.restoreDurationMs > policy.rtoMinutes! * 60000
            ? "attention"
            : "healthy",
      observed: {
        policy,
        evidence: last
          ? {
              id: String(last._id),
              snapshotAt: last.snapshotAt,
              completedAt: last.completedAt,
              restoreDurationMs: last.restoreDurationMs,
            }
          : null,
      },
    };
  });
  for (const check of checks) {
    await db
      .collection(SYSTEM.checks)
      .updateOne({ key: check.key }, { $set: check }, { upsert: true });
    const alert = db.collection(SYSTEM.alerts);
    if (check.state === "healthy") {
      await alert.updateOne(
        {
          _id: new ObjectId(
            createHash("sha256").update(check.key).digest().subarray(0, 12),
          ),
          active: true,
        },
        {
          $set: { active: false, resolvedAt: now, updatedAt: now },
          $inc: { revision: 1 },
        },
      );
    } else {
      const _id = new ObjectId(
        createHash("sha256").update(check.key).digest().subarray(0, 12),
      );
      const previous = await alert.findOne({ _id });
      const fingerprint = createHash("sha256")
        .update(
          JSON.stringify({
            state: check.state,
            observed: check.observed,
            threshold: check.threshold,
          }),
        )
        .digest("hex");
      // Acknowledgement is a review receipt; recurrence is shown as unreviewed.
      await alert.updateOne(
        { _id },
        {
          $set: {
            key: check.key,
            state: check.state,
            source: check.source,
            observed: check.observed,
            threshold: check.threshold ?? null,
            active: true,
            evaluatedAt: now,
            updatedAt: now,
            fingerprint,
            ...(previous?.fingerprint !== fingerprint || !previous?.active
              ? { reviewedAt: null, reviewedBy: null }
              : {}),
          },
          $setOnInsert: { createdAt: now },
          $inc: { revision: 1 },
        },
        { upsert: true },
      );
    }
  }
  return { checks, evaluatedAt: now };
}

export async function scheduleAdminMaintenance(
  database: MongoDatabase,
  env: Readonly<Record<string, string | undefined>>,
  storageAvailable: boolean,
  now = new Date(),
) {
  const minute = Math.floor(now.getTime() / 60000);
  const schedule = async (key: string, value: Document) =>
    database.db.collection(A.operations).updateOne(
      {
        _id: new ObjectId(
          createHash("sha256").update(key).digest().subarray(0, 12),
        ),
      },
      {
        $setOnInsert: {
          ...value,
          status: "queued",
          attempts: 0,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
          scheduledBy: "protected-deployment-policy",
        },
      },
      { upsert: true },
    );
  await schedule(`system.monitor:${minute}`, { kind: "system.monitor" });
  if (storageAvailable && retentionPolicy(env).enabled) {
    const owner = await database.db
      .collection(A.owners)
      .findOne({ active: true, role: "owner" });
    if (owner)
      await schedule(`media.inventory:${Math.floor(minute / 60)}`, {
        kind: "media.inventory",
        actorId: owner.userId,
        policyHash: erasurePolicyHash(env),
      });
  }
}
