import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { createPaymentsConfigFromEnvironment } from "./providers.js";
import { createUPaymentsProvider } from "./upayments-provider.js";

const SECRET = "sk_test_unit";
const NOTIFY = "https://api.movprompt.test/api/v1/payments/webhooks/upayments";
const ORDER = { id: "a".repeat(24), credits: 300, amountMinor: 13_000, currency: "KWD" };
const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64");

function gateway(transaction: Record<string, unknown> = {}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    if (String(url).endsWith("/charge")) return new Response(JSON.stringify({ status: true, data: { link: "https://sandbox.upayments.com/pay/xyz" } }), { status: 201 });
    return new Response(JSON.stringify({ status: true, data: { transaction: { result: "CAPTURED", isTerminalStatus: true, total_price: "13.000", currency_type: "KWD", merchant_requested_order_id: ORDER.id, payment_id: "pay-1", ...transaction } } }), { status: 200 });
  });
  const provider = createUPaymentsProvider({ baseUrl: "https://sandboxapi.upayments.com/api/v1/", apiKey: "key_unit", secretKey: SECRET, notificationUrl: NOTIFY }, fetchImpl as typeof fetch);
  return { provider, calls };
}

function webhook(body: Record<string, unknown>, options: { secret?: string; timestamp?: number } = {}) {
  const rawBody = JSON.stringify(body);
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", options.secret ?? SECRET).update(`${timestamp}POST${NOTIFY}${rawBody}`).digest("base64");
  return { headers: new Headers({ "x-timestamp": timestamp, "x-signature": signature }), rawBody };
}

describe("UPayments provider", () => {
  it("creates a signed KWD charge for the order and returns the hosted payment link", async () => {
    const { provider, calls } = gateway();
    const result = await provider.createCheckout({ order: ORDER, customer: { id: "user-1", email: "owner@example.test", name: "Owner" }, successUrl: "https://app.test/billing/success?order=x", cancelUrl: "https://app.test/billing/cancel?order=x", language: "ar" });
    expect(result).toEqual({ kind: "redirect", providerReference: ORDER.id, checkoutUrl: "https://sandbox.upayments.com/pay/xyz" });
    const { url, init } = calls[0]!;
    expect(url).toBe("https://sandboxapi.upayments.com/api/v1/charge");
    const headers = init.headers as Record<string, string>;
    const body = String(init.body);
    expect(headers.authorization).toBe("Bearer key_unit");
    expect(headers["x-signature"]).toBe(sign(`${headers["x-timestamp"]}POSTcharge${body}`));
    expect(JSON.parse(body)).toMatchObject({ order: { id: ORDER.id, currency: "KWD", amount: 13 }, language: "ar", reference: { id: ORDER.id }, notificationUrl: NOTIFY, returnUrl: "https://app.test/billing/success?order=x" });
    expect(provider.mode).toBe("test");
  });

  it("fails without exposing the gateway response when the charge is refused", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ status: false, message: "Invalid amount" }), { status: 400 }));
    const provider = createUPaymentsProvider({ baseUrl: "https://sandboxapi.upayments.com/api/v1", apiKey: "k", secretKey: SECRET, notificationUrl: NOTIFY }, fetchImpl as typeof fetch);
    await expect(provider.createCheckout({ order: ORDER, customer: { id: "u", email: "", name: "" }, successUrl: "https://a.test/s", cancelUrl: "https://a.test/c", language: "en" })).rejects.toMatchObject({ code: "checkout_failed" });
  });

  it("accepts a signed webhook and confirms amount and owner with Get Payment Status", async () => {
    const { provider, calls } = gateway();
    const event = await provider.verifyWebhook!(webhook({ track_id: "track_12345678", requested_order_id: ORDER.id, result: "CAPTURED" }));
    expect(event).toEqual({ eventId: "pay-1", providerReference: ORDER.id, status: "paid", amountMinor: 13_000, currency: "KWD" });
    expect(calls[0]!.url).toBe("https://sandboxapi.upayments.com/api/v1/get-payment-status/track_12345678");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["x-signature"]).toBe(sign(`${headers["x-timestamp"]}GETget-payment-status/track_12345678`));
  });

  it("rejects forged, stale and mismatched webhooks", async () => {
    const { provider } = gateway();
    await expect(provider.verifyWebhook!(webhook({ track_id: "track_12345678" }, { secret: "wrong" }))).rejects.toMatchObject({ code: "webhook_signature_invalid" });
    await expect(provider.verifyWebhook!(webhook({ track_id: "track_12345678" }, { timestamp: Math.floor(Date.now() / 1000) - 3_600 }))).rejects.toMatchObject({ code: "webhook_signature_invalid" });
    await expect(provider.verifyWebhook!(webhook({ track_id: "track_12345678", requested_order_id: "b".repeat(24) }))).rejects.toMatchObject({ code: "webhook_signature_invalid" });
  });

  it("reports failed, cancelled and still-pending payments without crediting", async () => {
    expect(await gateway({ result: "NOT CAPTURED", isTerminalStatus: true }).provider.confirmPayment!({ providerReference: ORDER.id, returnParams: { track_id: "track_12345678" } })).toMatchObject({ status: "failed" });
    expect(await gateway({ result: "CANCELED", isTerminalStatus: true }).provider.confirmPayment!({ providerReference: ORDER.id, returnParams: { track_id: "track_12345678" } })).toMatchObject({ status: "cancelled" });
    expect(await gateway({ result: "CANCELED", isTerminalStatus: undefined, status: "done" }).provider.confirmPayment!({ providerReference: ORDER.id, returnParams: { track_id: "track_12345678" } })).toMatchObject({ status: "cancelled" });
    expect(await gateway({ result: "NOT CAPTURED", isTerminalStatus: undefined, status: "done" }).provider.confirmPayment!({ providerReference: ORDER.id, returnParams: { track_id: "track_12345678" } })).toMatchObject({ status: "failed" });
    expect(await gateway({ result: "INITIATED", isTerminalStatus: false }).provider.confirmPayment!({ providerReference: ORDER.id, returnParams: { track_id: "track_12345678" } })).toMatchObject({ status: "pending" });
    expect(await gateway().provider.confirmPayment!({ providerReference: ORDER.id, returnParams: {} })).toBeNull();
  });
});

describe("UPayments configuration", () => {
  const env = { PAYMENTS_PROVIDER: "upayments", UPAYMENTS_API_KEY: "k", UPAYMENTS_SECRET_KEY: "s", API_ORIGIN: "https://api.movprompt.test" };
  it("enables sandbox outside production and live keys in production", () => {
    expect(createPaymentsConfigFromEnvironment({ ...env, APP_ENV: "local", UPAYMENTS_API_BASE_URL: "https://sandboxapi.upayments.com/api/v1" }).provider).toMatchObject({ id: "upayments", mode: "test" });
    expect(createPaymentsConfigFromEnvironment({ ...env, APP_ENV: "production", UPAYMENTS_API_BASE_URL: "https://uapi.upayments.com/api/v1" }).provider).toMatchObject({ id: "upayments", mode: "live" });
  });
  it("refuses sandbox keys in production and incomplete configuration", () => {
    expect(createPaymentsConfigFromEnvironment({ ...env, APP_ENV: "production", UPAYMENTS_API_BASE_URL: "https://sandboxapi.upayments.com/api/v1" }).provider).toBeNull();
    expect(createPaymentsConfigFromEnvironment({ ...env, APP_ENV: "local", UPAYMENTS_API_BASE_URL: "https://sandboxapi.upayments.com/api/v1", UPAYMENTS_SECRET_KEY: "" }).provider).toBeNull();
    expect(createPaymentsConfigFromEnvironment({ ...env, APP_ENV: "local", UPAYMENTS_API_BASE_URL: "http://sandboxapi.upayments.com/api/v1" }).provider).toBeNull();
  });
});

describe("UPayments refund acceptance boundary", () => {
  it("keeps refund creation disabled without verified merchant/precision acceptance", async () => {
    const fetchImpl = vi.fn();
    const provider = createUPaymentsProvider({ baseUrl: "https://sandboxapi.upayments.com/api/v1", apiKey: "test", secretKey: "test", notificationUrl: "https://api.example.test/hooks" }, fetchImpl);
    await expect(provider.createRefund!({ sourceOrderId: "verified-payment-order", amountMinor: 1234, currency: "KWD", reference: "reviewed-request", reason: "Unused credit refund" })).rejects.toMatchObject({ code: "checkout_failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("sends exact fils and treats a created refund as submitted until matching status confirms it", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => new Response(JSON.stringify(String(url).includes("create-refund") ? { status: true, data: { orderId: "refund-operation-1" } } : { status: true, data: { refund: [{ order_id: "another-refund", is_refunded: true, refunded_date: "2026-10-27" }, { order_id: "refund-operation-1", is_refunded: true, refunded_date: "2026-10-27" }] } }), { status: 201 }));
    const provider = createUPaymentsProvider({ baseUrl: "https://sandboxapi.upayments.com/api/v1", apiKey: "test", secretKey: "test", notificationUrl: "https://api.example.test/hooks", refundPrecisionVerified: true }, fetchImpl as typeof fetch);
    expect(await provider.createRefund!({ sourceOrderId: "verified-payment-order", amountMinor: 1234, currency: "KWD", reference: "reviewed-request", reason: "Unused credit refund" })).toEqual({ refundId: "refund-operation-1", status: "submitted" });
    expect(JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ totalPrice: "1.234", orderId: "verified-payment-order", reference: "reviewed-request" });
    expect(await provider.getRefundStatus!({ refundId: "refund-operation-1", sourceOrderId: "verified-payment-order", amountMinor: 1234, currency: "KWD" })).toEqual({ status: "confirmed" });
  });
});
