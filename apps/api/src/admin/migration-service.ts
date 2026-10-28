import { createHash } from "node:crypto";
import { ObjectId, type Document, type ClientSession } from "mongodb";
import {
  COLLECTIONS as C,
  loadCreditAllocationState,
  syncPurchaseAllocations,
  type MongoDatabase,
} from "@movprompt/db";
import {
  ADMIN_COLLECTIONS as A,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
} from "./security.js";

const fingerprint = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function inspect(
  database: MongoDatabase,
  userId: ObjectId,
  session: ClientSession,
) {
  const db = database.db;
  const account = await db
    .collection(C.creditAccounts)
    .findOne({ userId }, { session });
  if (!account)
    return {
      userId: String(userId),
      state: "review-required",
      reason: "wallet_missing",
      fingerprint: fingerprint(null),
    };
  const orders = await db
    .collection(C.paymentOrders)
    .find(
      { userId },
      {
        session,
        projection: {
          status: 1,
          currency: 1,
          amountMinor: 1,
          credits: 1,
          providerReference: 1,
        },
      },
    )
    .sort({ _id: 1 })
    .limit(10001)
    .toArray();
  if (orders.length > 10000)
    return {
      userId: String(userId),
      state: "review-required",
      reason: "requires_segmented_review",
      fingerprint: fingerprint({
        balance: account.balance,
        tooManyOrders: true,
      }),
    };
  try {
    const state = await loadCreditAllocationState(
      database,
      String(userId),
      Number(account.balance),
      session,
    );
    const validOrders = state.rows
      .filter(
        (row) =>
          row.kind === "purchase" && row.referenceType === "payment_order",
      )
      .every((row) => {
        const order = orders.find(
          (order) => String(order._id) === String(row.referenceId),
        );
        return (
          order?.status === "credited" &&
          order.currency === "KWD" &&
          order.providerReference &&
          Number.isSafeInteger(order.amountMinor) &&
          order.amountMinor > 0 &&
          order.credits === row.delta
        );
      });
    return {
      userId: String(userId),
      state: validOrders ? "ready" : "review-required",
      reason: validOrders ? null : "purchase_evidence_missing",
      balance: account.balance,
      purchasedCredits: state.rows
        .filter((row) => row.kind === "purchase")
        .reduce((sum, row) => sum + row.delta, 0),
      unprovenCredits: state.provenance.lots
        .filter((row) => !row.orderId)
        .reduce((sum, row) => sum + row.remaining, 0),
      fingerprint: fingerprint({
        balance: account.balance,
        refundReserved: account.refundReserved ?? 0,
        ledger: state.rows,
        reservations: state.reserved,
        holds: state.holds,
        orders,
      }),
    };
  } catch (error) {
    if (
      (error as { code?: string }).code !==
      "credit_allocation_reconciliation_required"
    )
      throw error;
    return {
      userId: String(userId),
      state: "review-required",
      reason: "credit_allocation_reconciliation_required",
      fingerprint: fingerprint({ balance: account.balance, orders }),
    };
  }
}

export async function executeMigrationOperation(
  database: MongoDatabase,
  row: Document,
) {
  if (row.kind === "migration.scan") {
    const accounts = await database.db
      .collection(C.creditAccounts)
      .find(row.afterId ? { _id: { $gt: adminObjectId(row.afterId) } } : {}, {
        projection: { userId: 1 },
      })
      .sort({ _id: 1 })
      .limit(51)
      .toArray();
    const items = [];
    for (const account of accounts.slice(0, 50))
      items.push(
        await database.transaction((session) =>
          inspect(database, account.userId, session),
        ),
      );
    return {
      items,
      fingerprint: fingerprint(items),
      nextCursor: accounts.length > 50 ? String(accounts[49]!._id) : null,
      reviewedAt: null,
      expiresAt: new Date(Date.now() + 15 * 60000),
      source:
        "canonical wallet, ledger, reservations, refund holds and verified payment orders",
      canonicalBalancesModified: false,
    };
  }
  const scan = await database.db.collection(A.operations).findOne({
    _id: row.scanId,
    kind: "migration.scan",
    status: "completed",
    fingerprint: row.fingerprint,
  });
  if (!scan || scan.expiresAt <= new Date())
    throw new Error("admin_migration_review_expired");
  const outcomes = [];
  const actor: AdminActor = {
    userId: String(row.actorId),
    sessionId: "durable-migration-job",
    requestId: `migration:${row._id}`,
  };
  for (const expected of scan.items as Document[]) {
    const receiptId = new ObjectId(
      createHash("sha256")
        .update(`${row._id}:${expected.userId}`)
        .digest()
        .subarray(0, 12),
    );
    const receipt = await database.transaction(async (session) => {
      const receipts = database.db.collection("admin_migration_receipts");
      const previous = await receipts.findOne({ _id: receiptId }, { session });
      if (previous) return previous.result;
      const userId = adminObjectId(expected.userId);
      await database.db
        .collection(C.creditAccounts)
        .updateOne(
          { userId },
          { $inc: { adminMigrationFence: 1 } },
          { session },
        );
      const current = await inspect(database, userId, session);
      let result: Document = {
        userId: expected.userId,
        status: "review-required",
        reason:
          current.fingerprint !== expected.fingerprint
            ? "source_changed"
            : current.reason,
      };
      if (
        expected.state === "ready" &&
        current.state === "ready" &&
        current.fingerprint === expected.fingerprint
      ) {
        const derived = await syncPurchaseAllocations(
          database,
          expected.userId,
          session,
        );
        result = {
          userId: expected.userId,
          status: derived?.reconciliationRequired
            ? "review-required"
            : "reconciled",
          purchases: derived?.purchases ?? 0,
          canonicalBalanceUnchanged: true,
        };
      }
      await receipts.insertOne(
        { _id: receiptId, operationId: row._id, result, createdAt: new Date() },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "migration.credit-provenance",
        expected.userId,
        result,
        session,
      );
      return result;
    });
    outcomes.push(receipt);
  }
  return {
    outcomes,
    canonicalBalancesModified: false,
    acceptedSnapshotsModified: false,
  };
}
