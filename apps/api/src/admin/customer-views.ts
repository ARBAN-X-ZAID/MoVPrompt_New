import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import {
  AdminCustomerSummarySchema,
  AdminPaymentQuerySchema,
} from "@movprompt/contracts";
import type { Document } from "mongodb";
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
    const customerMatch: Document = {};
    if (input.userId) customerMatch.userId = adminObjectId(input.userId);
    const join = [
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];
    const search = input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchStages = search
      ? [
          {
            $match: {
              $or: [
                { "customer.name": { $regex: search, $options: "i" } },
                { "customer.email": { $regex: search, $options: "i" } },
              ],
            },
          },
        ]
      : [];
    const matched = [...join, ...searchStages];
    const [result, collected, refunds] = await Promise.all([
      db
        .collection(C.paymentOrders)
        .aggregate([
          {
            $match: {
              ...customerMatch,
              createdAt: { $gte: from, $lt: to },
              ...(input.status ? { status: input.status } : {}),
            },
          },
          ...matched,
          {
            $facet: {
              total: [{ $count: "count" }],
              items: [
                { $sort: { createdAt: -1, _id: -1 } },
                { $skip: (input.page - 1) * 25 },
                { $limit: 25 },
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
            },
          },
        ])
        .toArray(),
      db
        .collection(C.paymentOrders)
        .aggregate([
          {
            $match: {
              ...customerMatch,
              status: "credited",
              currency: "KWD",
              creditedAt: { $gte: from, $lt: to },
            },
          },
          ...matched,
          { $group: { _id: null, amount: { $sum: "$amountMinor" } } },
        ])
        .toArray(),
      db
        .collection(A.financial)
        .aggregate([
          {
            $match: {
              ...customerMatch,
              kind: "cash-refund",
              status: "confirmed",
              "execution.confirmedAt": { $gte: from, $lt: to },
            },
          },
          ...matched,
          { $group: { _id: null, amount: { $sum: "$amountMinor" } } },
        ])
        .toArray(),
    ]);
    const cashCollected = Number(collected[0]?.amount ?? 0),
      cashRefunded = Number(refunds[0]?.amount ?? 0);
    return adminJson({
      items: result[0]?.items ?? [],
      total: result[0]?.total[0]?.count ?? 0,
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
