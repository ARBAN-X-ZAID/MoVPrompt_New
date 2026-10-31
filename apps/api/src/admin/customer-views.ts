import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import {
  AdminCustomerSummarySchema,
  AdminPaymentQuerySchema,
} from "@movprompt/contracts";
import type { Db, Document, ObjectId } from "mongodb";
import type { z } from "zod";
import {
  adminError,
  adminJson,
  adminObjectId,
  ADMIN_COLLECTIONS as A,
} from "./security.js";

export function paymentDateRange(
  input: z.infer<typeof AdminPaymentQuerySchema>,
  now = new Date(),
) {
  const day = new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const midnight = new Date(`${day}T00:00:00+03:00`);
  let from = new Date(midnight);
  let to = new Date(midnight.getTime() + 86400000);
  if (input.period === "week")
    from = new Date(midnight.getTime() - 6 * 86400000);
  if (input.period === "month")
    from = new Date(`${day.slice(0, 8)}01T00:00:00+03:00`);
  if (input.period === "custom") {
    if (!input.start || !input.end)
      return adminError(
        "payment_dates_required",
        "Choose a start and end date.",
        400,
      );
    from = new Date(`${input.start}T00:00:00+03:00`);
    to = new Date(new Date(`${input.end}T00:00:00+03:00`).getTime() + 86400000);
    const validDate = (date: Date, expected: string) =>
      Number.isFinite(date.getTime()) &&
      new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10) ===
        expected;
    if (
      !validDate(from, input.start) ||
      !validDate(new Date(to.getTime() - 86400000), input.end) ||
      from >= to
    )
      return adminError(
        "invalid_payment_dates",
        "Choose valid dates in chronological order.",
        400,
      );
  }
  return { from, to };
}

/** Above this many matching customers or projects a search result is partial. */
export const ADMIN_SEARCH_ID_LIMIT = 5000;
export const escapeSearchPattern = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Resolves a name or email search to ids, newest customers first. */
export async function findCustomersBySearch(
  db: Db,
  search: string,
  userId?: ObjectId,
) {
  const pattern = { $regex: escapeSearchPattern(search), $options: "i" };
  const rows = await db
    .collection("users")
    .find(
      {
        ...(userId ? { _id: userId } : {}),
        $or: [{ name: pattern }, { email: pattern }],
      },
      { projection: { _id: 1 }, maxTimeMS: 10000 },
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(ADMIN_SEARCH_ID_LIMIT)
    .toArray();
  return {
    ids: rows.map((row) => row._id),
    partial: rows.length === ADMIN_SEARCH_ID_LIMIT,
  };
}

export function createCustomerViews(
  database: MongoDatabase,
  environment: Record<string, string | undefined>,
) {
  const db = database.db;
  async function summary(id: string) {
    const userId = adminObjectId(id);
    const [
      user,
      account,
      reservations,
      projects,
      generations,
      assets,
      support,
    ] = await Promise.all([
      db
        .collection("users")
        .findOne(
          { _id: userId },
          {
            projection: {
              name: 1,
              email: 1,
              locale: 1,
              createdAt: 1,
              suspendedAt: 1,
            },
          },
        ),
      db.collection(C.creditAccounts).findOne({ userId }),
      db
        .collection(C.creditReservations)
        .aggregate([
          { $match: { userId, status: "reserved" } },
          { $group: { _id: null, amount: { $sum: "$amount" } } },
        ])
        .toArray(),
      db.collection(C.creatorProjects).countDocuments({ userId }),
      db.collection(C.renderRuns).countDocuments({ userId }),
      db
        .collection("creator_reference_library")
        .countDocuments({ userId, deleted: { $ne: true } }),
      db.collection(A.cases).countDocuments({ userId }),
    ]);
    if (!user)
      return adminError("customer_not_found", "Customer not found.", 404);
    const balance = Number(account?.balance ?? 0);
    const reserved =
      Number(reservations[0]?.amount ?? 0) +
      Number(account?.refundReserved ?? 0);
    return AdminCustomerSummarySchema.parse({
      id,
      name: user.name ?? "",
      email: user.email ?? "",
      locale: user.locale ?? "en",
      createdAt: user.createdAt.toISOString(),
      inactive: Boolean(user.suspendedAt),
      emailDeliveryAvailable: Boolean(
        environment.SMTP_HOST && environment.EMAIL_FROM,
      ),
      wallet: { balance, reserved, available: balance - reserved },
      counts: { projects, generations, assets, support },
    });
  }
  async function payments(input: z.infer<typeof AdminPaymentQuerySchema>) {
    const { from, to } = paymentDateRange(input);
    const userId = input.userId ? adminObjectId(input.userId) : undefined;
    const matches = input.search
      ? await findCustomersBySearch(db, input.search, userId)
      : null;
    // Filtering by matched ids keeps every query on indexed fields; only the page
    // of rows on screen joins customer names.
    const customerMatch: Document = matches
      ? { userId: { $in: matches.ids } }
      : userId
        ? { userId }
        : {};
    const orderMatch: Document = {
      ...customerMatch,
      createdAt: { $gte: from, $lt: to },
      ...(input.status ? { status: input.status } : {}),
    };
    const orders = db.collection(C.paymentOrders);
    const [items, total, collected, refunds] = await Promise.all([
      orders
        .aggregate(
          [
            { $match: orderMatch },
            { $sort: { createdAt: -1, _id: -1 } },
            { $skip: (input.page - 1) * 25 },
            { $limit: 25 },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                pipeline: [{ $project: { name: 1, email: 1 } }],
                as: "customer",
              },
            },
            { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                userId: 1,
                amountMinor: 1,
                currency: 1,
                credits: 1,
                status: 1,
                providerReference: 1,
                createdAt: 1,
                customerName: "$customer.name",
                customerEmail: "$customer.email",
              },
            },
          ],
          { maxTimeMS: 10000 },
        )
        .toArray(),
      orders.countDocuments(orderMatch, { maxTimeMS: 10000 }),
      orders
        .aggregate(
          [
            {
              $match: {
                ...customerMatch,
                status: "credited",
                currency: "KWD",
                creditedAt: { $gte: from, $lt: to },
              },
            },
            { $group: { _id: null, amount: { $sum: "$amountMinor" } } },
          ],
          { maxTimeMS: 10000 },
        )
        .toArray(),
      db
        .collection(A.financial)
        .aggregate(
          [
            {
              $match: {
                ...customerMatch,
                kind: "cash-refund",
                status: "confirmed",
                "execution.confirmedAt": { $gte: from, $lt: to },
              },
            },
            { $group: { _id: null, amount: { $sum: "$amountMinor" } } },
          ],
          { maxTimeMS: 10000 },
        )
        .toArray(),
    ]);
    const cashCollected = Number(collected[0]?.amount ?? 0),
      cashRefunded = Number(refunds[0]?.amount ?? 0);
    return adminJson({
      items,
      total,
      ...(matches?.partial ? { totalCapped: true } : {}),
      page: input.page,
      limit: 25,
      from,
      to,
      totals: {
        collected: cashCollected,
        refunded: cashRefunded,
        net: cashCollected - cashRefunded,
      },
      evaluatedAt: new Date(),
    });
  }
  return { summary, payments };
}
