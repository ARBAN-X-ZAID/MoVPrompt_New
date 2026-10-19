import { describe, expect, it, vi } from "vitest";
import { PaymentDomainError, type PaymentService, type TopUpOrderRecord } from "@movprompt/db";

import type { AuthenticatedSession } from "../auth-gateway.js";
import { createManualPaymentProvider } from "./manual-provider.js";
import type { PaymentProvider } from "./provider.js";
import { createPaymentsConfigFromEnvironment } from "./providers.js";
import { createTopUpService } from "./top-up-service.js";

/** Mirrors the Mongo service's exactly-once rules without a database. */
function memoryPayments() {
  const orders = new Map<string, TopUpOrderRecord>();
  const balances = new Map<string, number>();
  const ledger: Array<{ userId: string; delta: number; orderId: string }> = [];
  let next = 0;
  const service: PaymentService = {
    async createOrder(input) {
      const existing = [...orders.values()].find((order) => order.userId === input.userId && order.idempotencyKey === input.idempotencyKey);
      if (existing) {
        if (existing.credits !== input.credits || existing.amountMinor !== input.amountMinor) throw new PaymentDomainError("idempotency_conflict");
        return existing;
      }
      const now = new Date();
      const order: TopUpOrderRecord = { id: (next++).toString(16).padStart(24, "0"), userId: input.userId, idempotencyKey: input.idempotencyKey, status: "pending", credits: input.credits, amountMinor: input.amountMinor, currency: input.currency, provider: input.provider, packageId: input.packageId, providerReference: null, failureReason: null, createdAt: now, updatedAt: now, creditedAt: null };
      orders.set(order.id, order);
      return order;
    },
    async attachProviderReference({ orderId, providerReference }) { orders.get(orderId)!.providerReference = providerReference; },
    async creditOrder({ orderId, provider, providerReference, amountMinor, currency }) {
      const order = orders.get(orderId);
      if (!order) throw new PaymentDomainError("order_not_found");
      if (order.status === "credited") return order;
      if (order.status !== "pending" || order.provider !== provider) throw new PaymentDomainError("order_not_creditable");
      if (order.amountMinor !== amountMinor || order.currency !== currency) throw new PaymentDomainError("payment_amount_mismatch");
      Object.assign(order, { status: "credited", providerReference, creditedAt: new Date() });
      balances.set(order.userId, (balances.get(order.userId) ?? 0) + order.credits);
      ledger.push({ userId: order.userId, delta: order.credits, orderId });
      return order;
    },
    async closeOrder({ orderId, status, reason }) {
      const order = orders.get(orderId)!;
      if (order.status === "pending") Object.assign(order, { status, failureReason: reason });
      return order;
    },
    async findOwnedOrder(userId, orderId) { const order = orders.get(orderId); return order?.userId === userId ? order : null; },
    async findByProviderReference(provider, reference) { return [...orders.values()].find((order) => order.provider === provider && order.providerReference === reference) ?? null; },
    async recordProviderEvent() { return true; },
  };
  return { service, balances, ledger, orders };
}

const session = (guest = false) => ({ user: { id: "user-1", email: "owner@example.test", emailVerified: true, name: "Owner" }, session: { id: "s", ...(guest ? { guest: true } : {}) } }) as AuthenticatedSession;
const config = (provider: PaymentProvider | null) => ({ provider, successUrl: "http://localhost:8080/billing/success", cancelUrl: "http://localhost:8080/billing/cancel" });

function redirectGateway(): PaymentProvider & { paid: (reference: string, amountMinor: number, eventId?: string) => { headers: Headers; rawBody: string } } {
  return {
    id: "gateway",
    mode: "live",
    allowsCustomAmount: false,
    async createCheckout({ order }) { return { kind: "redirect", providerReference: `ref_${order.id}`, checkoutUrl: `https://pay.example.test/${order.id}` }; },
    async verifyWebhook({ headers, rawBody }) {
      if (headers.get("x-signature") !== "valid") throw new Error("bad signature");
      return JSON.parse(rawBody);
    },
    paid(reference, amountMinor, eventId = "evt-1") {
      return { headers: new Headers({ "x-signature": "valid" }), rawBody: JSON.stringify({ eventId, providerReference: reference, status: "paid", amountMinor, currency: "KWD" }) };
    },
  };
}

describe("credit top-ups", () => {
  it("credits a package instantly with the manual test provider", async () => {
    const payments = memoryPayments();
    const topUps = createTopUpService({ payments: payments.service, config: config(createManualPaymentProvider()) });
    const result = await topUps.createTopUp(session(), { packageId: "credits-300" }, "topup-key-0001");
    expect(result).toMatchObject({ checkoutUrl: null, order: { status: "credited", credits: 300, amountMinor: 13_000, currency: "KWD" } });
    expect(payments.balances.get("user-1")).toBe(300);
  });

  it("never credits twice when the same request is repeated", async () => {
    const payments = memoryPayments();
    const topUps = createTopUpService({ payments: payments.service, config: config(createManualPaymentProvider()) });
    await topUps.createTopUp(session(), { packageId: "credits-100" }, "topup-key-0002");
    await topUps.createTopUp(session(), { packageId: "credits-100" }, "topup-key-0002");
    expect(payments.balances.get("user-1")).toBe(100);
    expect(payments.ledger).toHaveLength(1);
  });

  it("accepts custom amounts in test mode within limits", async () => {
    const payments = memoryPayments();
    const topUps = createTopUpService({ payments: payments.service, config: config(createManualPaymentProvider()) });
    await expect(topUps.createTopUp(session(), { customCredits: 250 }, "topup-key-0003")).resolves.toMatchObject({ order: { credits: 250, amountMinor: 12_500, packageId: null } });
    await expect(topUps.createTopUp(session(), { customCredits: 5 }, "topup-key-0004")).rejects.toMatchObject({ code: "custom_amount_invalid" });
    await expect(topUps.createTopUp(session(), { customCredits: 20_000 }, "topup-key-0005")).rejects.toMatchObject({ code: "custom_amount_invalid" });
  });

  it("rejects guests, unknown packages and missing providers", async () => {
    const payments = memoryPayments();
    const manual = createTopUpService({ payments: payments.service, config: config(createManualPaymentProvider()) });
    await expect(manual.createTopUp(session(true), { packageId: "credits-100" }, "topup-key-0006")).rejects.toMatchObject({ code: "authentication_required" });
    await expect(manual.createTopUp(session(), { packageId: "credits-9999" }, "topup-key-0007")).rejects.toMatchObject({ code: "package_not_found" });
    const none = createTopUpService({ payments: payments.service, config: config(null) });
    expect(none.packages().payments).toEqual({ available: false, mode: "live", customAmount: null });
    await expect(none.createTopUp(session(), { packageId: "credits-100" }, "topup-key-0008")).rejects.toMatchObject({ code: "payments_unavailable" });
    expect(payments.balances.size).toBe(0);
  });

  it("redirects to a gateway and credits once when its webhook confirms payment", async () => {
    const payments = memoryPayments();
    const gateway = redirectGateway();
    const topUps = createTopUpService({ payments: payments.service, config: config(gateway) });
    await expect(topUps.createTopUp(session(), { customCredits: 100 }, "topup-key-0009")).rejects.toMatchObject({ code: "custom_amount_unavailable" });

    const { order, checkoutUrl } = await topUps.createTopUp(session(), { packageId: "credits-600" }, "topup-key-0010");
    expect(order.status).toBe("pending");
    expect(checkoutUrl).toBe(`https://pay.example.test/${order.id}`);
    expect(payments.balances.get("user-1")).toBeUndefined();

    await expect(topUps.handleWebhook("gateway", { headers: new Headers(), rawBody: "{}" })).rejects.toMatchObject({ code: "webhook_rejected" });
    await topUps.handleWebhook("gateway", gateway.paid(`ref_${order.id}`, 24_000));
    await topUps.handleWebhook("gateway", gateway.paid(`ref_${order.id}`, 24_000, "evt-retry"));
    expect(payments.balances.get("user-1")).toBe(600);
    expect(await topUps.getOrder("user-1", order.id)).toMatchObject({ status: "credited" });
    await expect(topUps.getOrder("someone-else", order.id)).rejects.toMatchObject({ code: "order_not_found" });
  });

  it("refuses a webhook whose amount does not match the order", async () => {
    const payments = memoryPayments();
    const gateway = redirectGateway();
    const topUps = createTopUpService({ payments: payments.service, config: config(gateway) });
    const { order } = await topUps.createTopUp(session(), { packageId: "credits-100" }, "topup-key-0011");
    await expect(topUps.handleWebhook("gateway", gateway.paid(`ref_${order.id}`, 1))).rejects.toMatchObject({ code: "payment_amount_mismatch" });
    expect(payments.balances.get("user-1")).toBeUndefined();
  });

  it("marks the order failed when the payment page cannot be created", async () => {
    const payments = memoryPayments();
    const broken: PaymentProvider = { ...redirectGateway(), createCheckout: vi.fn(async () => { throw new Error("gateway down"); }) };
    const topUps = createTopUpService({ payments: payments.service, config: config(broken) });
    await expect(topUps.createTopUp(session(), { packageId: "credits-100" }, "topup-key-0012")).rejects.toMatchObject({ code: "checkout_failed" });
    expect([...payments.orders.values()][0]).toMatchObject({ status: "failed" });
  });
});

describe("payment provider selection", () => {
  it("enables the free manual provider only outside production", () => {
    expect(createPaymentsConfigFromEnvironment({ APP_ENV: "local", PAYMENTS_PROVIDER: "manual" }).provider?.id).toBe("manual");
    expect(createPaymentsConfigFromEnvironment({ APP_ENV: "production", PAYMENTS_PROVIDER: "manual" }).provider).toBeNull();
    expect(createPaymentsConfigFromEnvironment({ PAYMENTS_PROVIDER: "manual" }).provider).toBeNull();
    expect(createPaymentsConfigFromEnvironment({ APP_ENV: "local", PAYMENTS_PROVIDER: "unknown-gateway" }).provider).toBeNull();
    expect(createPaymentsConfigFromEnvironment({ APP_ENV: "local" }).provider).toBeNull();
  });

  it("builds return URLs from the web origin", () => {
    expect(createPaymentsConfigFromEnvironment({ WEB_ORIGIN: "https://app.movprompt.test/" })).toMatchObject({
      successUrl: "https://app.movprompt.test/billing/success",
      cancelUrl: "https://app.movprompt.test/billing/cancel",
    });
  });
});
