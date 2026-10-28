import { createHash } from "node:crypto";
import type { ClientSession, Document } from "mongodb";
import {
  COLLECTIONS as C,
  toMongoObjectId,
  type MongoDatabase,
} from "./mongo-client.js";

export type CreditLot = { orderId: string | null; remaining: number };
export type CreditAllocation = { orderId: string | null; credits: number };
export class CreditAllocationError extends Error {
  readonly code = "credit_allocation_reconciliation_required";
  constructor() {
    super("Credit provenance needs reconciliation before this operation.");
  }
}
function validSlices(
  value: unknown,
  total: number,
): value is CreditAllocation[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.orderId === null || typeof item.orderId === "string") &&
        Number.isSafeInteger(item.credits) &&
        item.credits > 0,
    ) &&
    value.reduce((sum, item) => sum + item.credits, 0) === total
  );
}
function consume(
  lots: CreditLot[],
  amount: number,
  orderId?: string | null,
): CreditLot[] | null {
  let remaining = amount;
  const used: CreditLot[] = [];
  for (const lot of lots) {
    if (orderId !== undefined && lot.orderId !== orderId) continue;
    const taken = Math.min(lot.remaining, remaining);
    lot.remaining -= taken;
    remaining -= taken;
    if (taken) used.push({ orderId: lot.orderId, remaining: taken });
    if (!remaining) break;
  }
  return remaining ? null : used;
}
/** Legacy events retain FIFO behavior. New debits pin their exact purchase lots,
 * so a refund hold on purchase A cannot be consumed by a later render using B. */
export function reconstructCreditLots(
  rows: Document[],
  balance: number,
): { lots: CreditLot[]; verified: boolean } {
  const delta = rows.reduce((sum, row) => sum + Number(row.delta), 0);
  const opening = balance - delta;
  const lots: CreditLot[] =
    opening > 0 ? [{ orderId: null, remaining: opening }] : [];
  const charges = new Map<string, CreditLot[]>();
  const restoredCharges = new Set<string>();
  const purchases = new Set<string>();
  let verified = Number.isSafeInteger(opening) && opening >= 0;
  for (const row of rows) {
    const amount = Number(row.delta);
    if (!Number.isSafeInteger(amount)) return { lots, verified: false };
    if (amount > 0) {
      if (row.kind === "purchase" && row.referenceType === "payment_order") {
        if (purchases.has(String(row.referenceId))) verified = false;
        purchases.add(String(row.referenceId));
      }
      if (row.kind === "refund") {
        if (restoredCharges.has(String(row.referenceId))) verified = false;
        restoredCharges.add(String(row.referenceId));
      }
      const previous =
        row.kind === "refund" ? charges.get(String(row.referenceId)) : null;
      if (
        previous &&
        previous.reduce((sum, lot) => sum + lot.remaining, 0) === amount
      )
        lots.push(...previous.map((lot) => ({ ...lot })));
      else
        lots.push({
          orderId:
            row.kind === "purchase" && row.referenceType === "payment_order"
              ? String(row.referenceId)
              : null,
          remaining: amount,
        });
    } else if (amount < 0) {
      const used: CreditLot[] = [];
      if (row.purchaseAllocations !== undefined) {
        if (!validSlices(row.purchaseAllocations, -amount))
          return { lots, verified: false };
        for (const slice of row.purchaseAllocations) {
          const taken = consume(lots, slice.credits, slice.orderId);
          if (!taken) verified = false;
          else used.push(...taken);
        }
      } else {
        const taken = consume(
          lots,
          -amount,
          row.kind === "cash_refund" ? String(row.referenceId) : undefined,
        );
        if (!taken) verified = false;
        else used.push(...taken);
      }
      if (row.kind === "charge") charges.set(String(row.referenceId), used);
    }
  }
  return {
    lots,
    verified:
      verified && lots.reduce((sum, lot) => sum + lot.remaining, 0) === balance,
  };
}
export function allocateCreditLots(
  lots: CreditLot[],
  credits: number,
): CreditAllocation[] {
  if (!Number.isSafeInteger(credits) || credits < 0)
    throw new CreditAllocationError();
  if (!credits) return [];
  const used = consume(lots, credits);
  if (!used) throw new CreditAllocationError();
  return used.map((lot) => ({ orderId: lot.orderId, credits: lot.remaining }));
}

/** Call with the wallet write fence held when assigning reservations or writing
 * materialized records. Balances still change only through ledger mutations. */
export async function loadCreditAllocationState(
  database: MongoDatabase,
  userId: string,
  balance: number,
  session?: ClientSession,
  assignLegacy = false,
) {
  const owner = toMongoObjectId(userId);
  const options = session ? { session } : {};
  const rows = await database.db
    .collection(C.creditLedger)
    .find(
      { userId: owner },
      {
        ...options,
        projection: {
          kind: 1,
          delta: 1,
          referenceType: 1,
          referenceId: 1,
          purchaseAllocations: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: 1, _id: 1 })
    .limit(100001)
    .toArray();
  if (rows.length > 100000) throw new CreditAllocationError();
  const provenance = reconstructCreditLots(rows, balance);
  if (!provenance.verified) throw new CreditAllocationError();
  const available = provenance.lots.map((lot) => ({ ...lot }));
  const holds = await database.db
    .collection("admin_financial_requests")
    .find(
      {
        userId: owner,
        kind: "cash-refund",
        status: { $in: ["approved", "submitted", "uncertain"] },
      },
      options,
    )
    .toArray();
  const account = await database.db
    .collection(C.creditAccounts)
    .findOne(
      { userId: owner },
      { ...options, projection: { refundReserved: 1 } },
    );
  const recordedHold = Number(account?.refundReserved ?? 0);
  if (
    !Number.isSafeInteger(recordedHold) ||
    recordedHold !==
      holds.reduce(
        (sum, row) => sum + Number(row.impact?.creditsToRetire ?? 0),
        0,
      )
  )
    throw new CreditAllocationError();
  for (const hold of holds) {
    const credits = Number(hold.impact?.creditsToRetire ?? 0);
    if (
      !Number.isSafeInteger(credits) ||
      credits < 0 ||
      (credits && !consume(available, credits, String(hold.orderId)))
    )
      throw new CreditAllocationError();
  }
  const reserved = await database.db
    .collection(C.creditReservations)
    .find({ userId: owner, status: "reserved" }, options)
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  const allocations = new Map<string, CreditAllocation[]>();
  // Exact reservations must be removed before assigning any pre-migration rows.
  for (const row of reserved)
    if (row.purchaseAllocations !== undefined) {
      if (!validSlices(row.purchaseAllocations, Number(row.amount)))
        throw new CreditAllocationError();
      for (const slice of row.purchaseAllocations)
        if (!consume(available, slice.credits, slice.orderId))
          throw new CreditAllocationError();
      allocations.set(String(row._id), row.purchaseAllocations);
    }
  for (const row of reserved)
    if (row.purchaseAllocations === undefined) {
      const slices = allocateCreditLots(available, Number(row.amount));
      allocations.set(String(row._id), slices);
      if (assignLegacy && session)
        await database.db
          .collection(C.creditReservations)
          .updateOne(
            { _id: row._id, purchaseAllocations: { $exists: false } },
            { $set: { purchaseAllocations: slices, allocationVersion: 1 } },
            { session },
          );
    }
  return { rows, provenance, available, reserved, allocations, holds };
}

/** Derived purchase records are reviewable migration evidence; canonical orders,
 * ledger and reservation snapshots remain the authority. Unproven opening or
 * goodwill credits never become cash-purchase allocations. */
export async function syncPurchaseAllocations(
  database: MongoDatabase,
  userId: string,
  session: ClientSession,
) {
  const owner = toMongoObjectId(userId);
  const account = await database.db
    .collection(C.creditAccounts)
    .findOne({ userId: owner }, { session });
  if (!account) return;
  let state: Awaited<ReturnType<typeof loadCreditAllocationState>>;
  try {
    state = await loadCreditAllocationState(
      database,
      userId,
      Number(account.balance),
      session,
      true,
    );
  } catch (error) {
    if (!(error instanceof CreditAllocationError)) throw error;
    await database.db.collection("credit_allocation_reconciliation").updateOne(
      { userId: owner },
      {
        $set: {
          verified: false,
          reason: error.code,
          evaluatedAt: new Date(),
        },
      },
      { session, upsert: true },
    );
    await database.db.collection("credit_purchase_allocations").updateMany(
      { userId: owner },
      {
        $set: {
          verified: false,
          reconciliationRequired: true,
          evaluatedAt: new Date(),
        },
      },
      { session },
    );
    return { purchases: 0, reconciliationRequired: true };
  }
  await database.db
    .collection("credit_allocation_reconciliation")
    .updateOne(
      { userId: owner },
      { $set: { verified: true, reason: null, evaluatedAt: new Date() } },
      { session, upsert: true },
    );
  const orderIds = [
    ...new Set(
      state.rows
        .filter(
          (row) =>
            row.kind === "purchase" && row.referenceType === "payment_order",
        )
        .map((row) => String(row.referenceId)),
    ),
  ];
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        balance: account.balance,
        ledger: state.rows.map((row) => [
          String(row._id),
          row.delta,
          row.purchaseAllocations,
        ]),
        reservations: state.reserved.map((row) => [
          String(row._id),
          row.amount,
          state.allocations.get(String(row._id)),
        ]),
        holds: state.holds.map((row) => [
          String(row._id),
          row.impact?.creditsToRetire,
        ]),
      }),
    )
    .digest("hex");
  for (const orderId of orderIds) {
    if (!/^[a-f\d]{24}$/i.test(orderId)) continue;
    const purchase = await database.db.collection(C.paymentOrders).findOne(
      {
        _id: toMongoObjectId(orderId),
        userId: owner,
        status: "credited",
        currency: "KWD",
      },
      { session },
    );
    const credited = state.rows
      .filter(
        (row) => row.kind === "purchase" && String(row.referenceId) === orderId,
      )
      .reduce((sum, row) => sum + Number(row.delta), 0);
    const unused = state.provenance.lots
      .filter((lot) => lot.orderId === orderId)
      .reduce((sum, lot) => sum + lot.remaining, 0);
    const available = state.available
      .filter((lot) => lot.orderId === orderId)
      .reduce((sum, lot) => sum + lot.remaining, 0);
    const generationReserved = [...state.allocations.values()]
      .flat()
      .filter((slice) => slice.orderId === orderId)
      .reduce((sum, slice) => sum + slice.credits, 0);
    const refundReserved = state.holds
      .filter((row) => String(row.orderId) === orderId)
      .reduce((sum, row) => sum + Number(row.impact?.creditsToRetire ?? 0), 0);
    await database.db.collection("credit_purchase_allocations").updateOne(
      { orderId, userId: owner },
      {
        $set: {
          userId: owner,
          allocationVersion: 1,
          purchasedCredits: credited,
          unusedCredits: unused,
          availableCredits: available,
          generationReservedCredits: generationReserved,
          refundReservedCredits: refundReserved,
          verified: Boolean(purchase) && credited === Number(purchase?.credits),
          source: "canonical-order-ledger-reservations",
          reconciliationRequired: false,
          sourceFingerprint: fingerprint,
          evaluatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, session },
    );
  }
  return { purchases: orderIds.length, sourceFingerprint: fingerprint };
}
