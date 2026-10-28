import { syncPurchaseAllocations } from "./credit-provenance.js";
import { COLLECTIONS, newMongoObjectId, type MongoDatabase } from "./mongo-client.js";

export type TopUpOrderStatus = "pending" | "credited" | "failed" | "cancelled" | "expired";

export type TopUpOrderRecord = {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: TopUpOrderStatus;
  credits: number;
  amountMinor: number;
  currency: string;
  provider: string;
  packageId: string | null;
  pricingVersion?: string;
  pricingSnapshot?: { credits: number; amountMinor: number; packageId: string | null };
  providerReference: string | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  creditedAt: Date | null;
};

export class PaymentDomainError extends Error {
  constructor(
    readonly code:
      | "order_not_found"
      | "idempotency_conflict"
      | "order_not_creditable"
      | "payment_amount_mismatch"
      | "top_up_limit_reached",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PaymentDomainError";
  }
}

export interface PaymentService {
  createOrder(input: {
    userId: string;
    idempotencyKey: string;
    credits: number;
    amountMinor: number;
    currency: string;
    provider: string;
    packageId: string | null;
    pricingVersion?: string;
    maxOrdersPerHour?: number;
    now?: Date;
  }): Promise<TopUpOrderRecord>;
  attachProviderReference(input: { orderId: string; providerReference: string; now?: Date }): Promise<void>;
  /** The only path that adds purchased credits. Safe to call repeatedly for the same order. */
  creditOrder(input: { orderId: string; provider: string; providerReference: string; amountMinor: number; currency: string; refundSourceOrderId?: string; paymentTrackId?: string; now?: Date }): Promise<TopUpOrderRecord>;
  closeOrder(input: { orderId: string; status: Exclude<TopUpOrderStatus, "pending" | "credited">; reason: string; now?: Date }): Promise<TopUpOrderRecord>;
  findOrderByIdempotency?(userId: string, key: string): Promise<TopUpOrderRecord | null>;
  findOwnedOrder(userId: string, orderId: string): Promise<TopUpOrderRecord | null>;
  findByProviderReference(provider: string, providerReference: string): Promise<TopUpOrderRecord | null>;
  /** Returns false when this provider event was already processed. */
  recordProviderEvent(input: { provider: string; eventId: string; orderId: string | null; type: string; now?: Date }): Promise<boolean>;
}

const DUPLICATE_KEY = 11000;

export function createMongoPaymentService(database: MongoDatabase,environment:Readonly<Record<string,string|undefined>>=process.env): PaymentService {
  const orders = database.collection(COLLECTIONS.paymentOrders);
  const events = database.collection(COLLECTIONS.paymentEvents);
  const accounts = database.collection(COLLECTIONS.creditAccounts);
  const ledger = database.collection(COLLECTIONS.creditLedger);

  const load = async (orderId: string) => (await orders.findOne({ id: orderId })) as TopUpOrderRecord | null;

  return {
    async createOrder(input) {
      const now = input.now ?? new Date();
      const existing = (await orders.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey })) as TopUpOrderRecord | null;
      if (existing) {
        if (existing.credits !== input.credits || existing.amountMinor !== input.amountMinor || existing.provider !== input.provider || existing.packageId !== input.packageId) {
          throw new PaymentDomainError("idempotency_conflict");
        }
        return existing;
      }
      const recent = await orders.countDocuments({ userId: input.userId, createdAt: { $gt: new Date(now.getTime() - 3_600_000) } });
      if (recent >= (input.maxOrdersPerHour ?? 10)) throw new PaymentDomainError("top_up_limit_reached");
      const order: TopUpOrderRecord = {
        id: newMongoObjectId(),
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        status: "pending",
        credits: input.credits,
        amountMinor: input.amountMinor,
        currency: input.currency,
        provider: input.provider,
        packageId: input.packageId,
        ...(input.pricingVersion ? { pricingVersion: input.pricingVersion, pricingSnapshot: { credits: input.credits, amountMinor: input.amountMinor, packageId: input.packageId } } : {}),
        providerReference: null,
        failureReason: null,
        createdAt: now,
        updatedAt: now,
        creditedAt: null,
      };
      try {
        await orders.insertOne(order);
      } catch (error) {
        // A concurrent request with the same key won the insert; return its order.
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
        const winner = (await orders.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey })) as TopUpOrderRecord | null;
        if (!winner) throw error;
        return winner;
      }
      return order;
    },

    async attachProviderReference(input) {
      await orders.updateOne(
        { id: input.orderId, providerReference: null },
        { $set: { providerReference: input.providerReference, updatedAt: input.now ?? new Date() } },
      );
    },

    async creditOrder(input) {
      const now = input.now ?? new Date();
      return database.transaction(async (session) => {
        const order = (await orders.findOne({ id: input.orderId }, { session })) as TopUpOrderRecord | null;
        if (!order) throw new PaymentDomainError("order_not_found");
        if (order.status === "credited") return order;
        if (order.status !== "pending" || order.provider !== input.provider) throw new PaymentDomainError("order_not_creditable");
        if (order.providerReference && order.providerReference !== input.providerReference) throw new PaymentDomainError("order_not_creditable");
        if (order.amountMinor !== input.amountMinor || order.currency !== input.currency) throw new PaymentDomainError("payment_amount_mismatch");

        const claimed = await orders.updateOne(
          { id: order.id, status: "pending" },
          { $set: { status: "credited", providerReference: input.providerReference, ...(input.refundSourceOrderId ? { refundSourceOrderId: input.refundSourceOrderId } : {}), ...(input.paymentTrackId ? { paymentTrackId: input.paymentTrackId } : {}), creditedAt: now, updatedAt: now } },
          { session },
        );
        if (!claimed.matchedCount) throw new PaymentDomainError("order_not_creditable");
        const account = await accounts.findOneAndUpdate(
          { userId: order.userId },
          { $inc: { balance: order.credits }, $set: { updatedAt: now }, $setOnInsert: { userId: order.userId, createdAt: now } },
          { upsert: true, returnDocument: "after", session },
        );
        await ledger.insertOne({
          id: newMongoObjectId(),
          userId: order.userId,
          kind: "purchase",
          delta: order.credits,
          balanceAfter: Number(account?.balance),
          reason: "credit_top_up",
          referenceType: "payment_order",
          referenceId: order.id,
          idempotencyKey: `topup.credit:${order.id}`,
          metadata: { provider: order.provider, amountMinor: order.amountMinor, currency: order.currency },
          createdAt: now,
        }, { session });
        if(environment.FEATURE_PURCHASE_ALLOCATIONS==="true")await syncPurchaseAllocations(database,order.userId,session);
        return (await orders.findOne({ id: order.id }, { session })) as unknown as TopUpOrderRecord;
      });
    },

    async closeOrder(input) {
      const now = input.now ?? new Date();
      await orders.updateOne(
        { id: input.orderId, status: "pending" },
        { $set: { status: input.status, failureReason: input.reason, updatedAt: now } },
      );
      const order = await load(input.orderId);
      if (!order) throw new PaymentDomainError("order_not_found");
      return order;
    },

    async findOrderByIdempotency(userId, key) { return await orders.findOne({ userId, idempotencyKey: key }) as TopUpOrderRecord | null; },
    async findOwnedOrder(userId, orderId) {
      return (await orders.findOne({ id: orderId, userId })) as TopUpOrderRecord | null;
    },

    async findByProviderReference(provider, providerReference) {
      return (await orders.findOne({ provider, providerReference })) as TopUpOrderRecord | null;
    },

    async recordProviderEvent(input) {
      try {
        await events.insertOne({ id: newMongoObjectId(), provider: input.provider, eventId: input.eventId, orderId: input.orderId, type: input.type, createdAt: input.now ?? new Date() });
        return true;
      } catch (error) {
        if ((error as { code?: number }).code === DUPLICATE_KEY) return false;
        throw error;
      }
    },
  };
}
