import { createHmac, timingSafeEqual } from "node:crypto";

import { PaymentProviderError, type PaymentProvider, type VerifiedPaymentEvent } from "./provider.js";

export type UPaymentsConfig = {
  /** e.g. https://sandboxapi.upayments.com/api/v1 */
  baseUrl: string;
  /** Bearer API key from the UPayments dashboard. */
  apiKey: string;
  /** HMAC "API Secret Key"; signs every request and verifies webhooks. */
  secretKey: string;
  /** Absolute public URL UPayments posts payment results to. */
  notificationUrl: string;
};

type Fetch = typeof fetch;

const TRACK_ID = /^[A-Za-z0-9_-]{8,80}$/;
const WEBHOOK_MAX_AGE_SECONDS = 300;

function sign(secretKey: string, payload: string): string {
  return createHmac("sha256", secretKey).update(payload, "utf8").digest("base64");
}

function sameSignature(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/** KWD has three decimals; UPayments reports amounts like "13.000". */
function toFils(value: unknown): number {
  const amount = Number(text(value));
  return Number.isFinite(amount) ? Math.round(amount * 1000) : -1;
}

/**
 * UPayments hosted checkout (KNET and cards). Every request carries an HMAC
 * signature over timestamp + method + path + body; webhooks are verified the
 * same way and then confirmed against Get Payment Status, because the webhook
 * itself carries no amount.
 */
export function createUPaymentsProvider(config: UPaymentsConfig, fetchImpl: Fetch = fetch): PaymentProvider {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const sandbox = new URL(baseUrl).hostname.includes("sandbox");

  async function call(method: "GET" | "POST", path: string, body?: unknown): Promise<Record<string, unknown>> {
    const raw = body === undefined ? "" : JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const response = await fetchImpl(`${baseUrl}/${path}`, {
      method,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiKey}`,
        "x-timestamp": timestamp,
        "x-signature": sign(config.secretKey, `${timestamp}${method}${path}${raw}`),
        ...(raw ? { "content-type": "application/json" } : {}),
      },
      ...(raw ? { body: raw } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    const parsed = record(await response.json().catch(() => null));
    if (!response.ok || parsed.status === false) {
      // Never surface gateway bodies to customers; log only the status and message.
      console.warn(JSON.stringify({ level: "warn", message: "upayments_request_failed", path: path.split("/")[0], status: response.status, gatewayMessage: text(parsed.message).slice(0, 200) }));
      throw new PaymentProviderError("checkout_failed");
    }
    return parsed;
  }

  async function paymentStatus(trackId: string, expectedReference?: string): Promise<VerifiedPaymentEvent> {
    if (!TRACK_ID.test(trackId)) throw new PaymentProviderError("webhook_signature_invalid", "Invalid track id.");
    const transaction = record(record((await call("GET", `get-payment-status/${trackId}`)).data).transaction);
    const reference = text(transaction.merchant_requested_order_id);
    if (!reference || (expectedReference && reference !== expectedReference)) {
      throw new PaymentProviderError("webhook_signature_invalid", "Payment does not belong to this order.");
    }
    const result = text(transaction.result).toUpperCase();
    const cancelled = result.startsWith("CANCEL");
    // Sandbox reports a cancelled KNET payment as status "done" without isTerminalStatus.
    const terminal = transaction.isTerminalStatus === true || text(transaction.isTerminalStatus) === "true" || text(transaction.status).toLowerCase() === "done";
    return {
      eventId: text(transaction.payment_id) || trackId,
      providerReference: reference,
      status: result === "CAPTURED" ? "paid" : cancelled ? "cancelled" : terminal ? "failed" : "pending",
      amountMinor: toFils(transaction.total_price),
      currency: text(transaction.currency_type).toUpperCase() || "KWD",
    };
  }

  return {
    id: "upayments",
    mode: sandbox ? "test" : "live",
    allowsCustomAmount: false,
    checkout: "hosted",

    async createCheckout({ order, customer, successUrl, cancelUrl, language }) {
      const response = await call("POST", "charge", {
        order: {
          id: order.id,
          reference: order.id,
          description: `MovPrompt ${order.credits} credits`,
          currency: order.currency,
          amount: order.amountMinor / 1000,
        },
        language,
        reference: { id: order.id },
        customer: {
          uniqueId: customer.id.slice(0, 50),
          ...(customer.name ? { name: customer.name.slice(0, 50) } : {}),
          ...(customer.email && customer.email.length <= 50 ? { email: customer.email } : {}),
        },
        returnUrl: successUrl,
        cancelUrl,
        notificationUrl: config.notificationUrl,
      });
      const link = text(record(response.data).link);
      if (!/^https:\/\//.test(link)) throw new PaymentProviderError("checkout_failed");
      // Our order id travels as merchant_requested_order_id, so it is the stable reference.
      return { kind: "redirect", providerReference: order.id, checkoutUrl: link };
    },

    async verifyWebhook({ headers, rawBody }) {
      const timestamp = headers.get("x-timestamp")?.trim() ?? "";
      const signature = headers.get("x-signature")?.trim() ?? "";
      const age = Math.abs(Date.now() / 1000 - Number(timestamp));
      if (!/^\d{9,11}$/.test(timestamp) || !signature || !(age <= WEBHOOK_MAX_AGE_SECONDS)) {
        throw new PaymentProviderError("webhook_signature_invalid");
      }
      if (!sameSignature(sign(config.secretKey, `${timestamp}POST${config.notificationUrl}${rawBody}`), signature)) {
        throw new PaymentProviderError("webhook_signature_invalid");
      }
      const body = record(JSON.parse(rawBody));
      const requested = text(body.requested_order_id);
      return paymentStatus(text(body.track_id), requested || undefined);
    },

    async confirmPayment({ providerReference, returnParams }) {
      const trackId = returnParams.track_id ?? "";
      if (!TRACK_ID.test(trackId)) return null;
      return paymentStatus(trackId, providerReference);
    },
  };
}
