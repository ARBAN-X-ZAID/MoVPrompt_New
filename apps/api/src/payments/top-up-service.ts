import type { CreditCatalog } from "../versioned-pricing.js";
import { PAYMENT_CURRENCY, type CreateTopUpRequest, type CreditPackagesResponse, type TopUpOrder } from "@movprompt/contracts";
import { PaymentDomainError, type PaymentService, type TopUpOrderRecord } from "@movprompt/db";

import type { AuthenticatedSession } from "../auth-gateway.js";
import { CREDIT_PACKAGES, CUSTOM_AMOUNT_MINOR_PER_CREDIT, CUSTOM_TOP_UP_LIMITS } from "./credit-packages.js";
import { PaymentProviderError, type VerifiedPaymentEvent } from "./provider.js";
import type { PaymentsConfig } from "./providers.js";

export class TopUpError extends Error {
  constructor(
    readonly code:
      | "payments_unavailable"
      | "authentication_required"
      | "package_not_found"
      | "custom_amount_unavailable"
      | "custom_amount_invalid"
      | "order_not_found"
      | "checkout_failed"
      | "webhook_rejected"
      | PaymentDomainError["code"],
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TopUpError";
  }
}

export type TopUpService = {
  packages(): Omit<CreditPackagesResponse, "requestId">;
  packagesAsync?(): Promise<Omit<CreditPackagesResponse, "requestId">>;
  createTopUp(session: AuthenticatedSession, request: CreateTopUpRequest, idempotencyKey: string): Promise<{ order: TopUpOrder; checkoutUrl: string | null }>;
  /** returnParams are the gateway's redirect parameters; they let a pending order be confirmed directly. */
  getOrder(userId: string, orderId: string, returnParams?: Readonly<Record<string, string>>): Promise<TopUpOrder>;
  handleWebhook(providerId: string, input: { headers: Headers; rawBody: string }): Promise<void>;
};

export function publicOrder(order: TopUpOrderRecord): TopUpOrder {
  return {
    id: order.id,
    status: order.status,
    credits: order.credits,
    amountMinor: order.amountMinor,
    currency: PAYMENT_CURRENCY,
    provider: order.provider,
    packageId: order.packageId,
    createdAt: order.createdAt.toISOString(),
    creditedAt: order.creditedAt ? order.creditedAt.toISOString() : null,
  };
}

function rethrowDomain(error: unknown): never {
  if (error instanceof PaymentDomainError) throw new TopUpError(error.code);
  throw error;
}

const CONFIRM_INTERVAL_MS = 10_000;

export function createTopUpService(options: { payments: PaymentService; config: PaymentsConfig; now?: () => number; catalog?: () => Promise<CreditCatalog> }): TopUpService {
  const { payments, config } = options;
  const now = options.now ?? Date.now;
  // Gateways rate-limit status lookups, so a polling return page confirms at most every few seconds.
  const lastConfirm = new Map<string, number>();

  /** The single path from a verified gateway outcome to the wallet; safe to repeat. */
  async function applyEvent(order: TopUpOrderRecord, event: VerifiedPaymentEvent): Promise<void> {
    if (event.status === "pending") return;
    try {
      if (event.status === "paid") {
        await payments.creditOrder({ orderId: order.id, provider: order.provider, providerReference: event.providerReference, amountMinor: event.amountMinor, currency: event.currency, ...(event.refundSourceOrderId ? { refundSourceOrderId: event.refundSourceOrderId } : {}), ...(event.paymentTrackId ? { paymentTrackId: event.paymentTrackId } : {}) });
      } else {
        await payments.closeOrder({ orderId: order.id, status: event.status, reason: `provider_${event.status}` });
      }
    } catch (error) {
      rethrowDomain(error);
    }
  }

  function requireProvider() {
    if (!config.provider) throw new TopUpError("payments_unavailable", "Credit top-ups are not available yet.");
    return config.provider;
  }

  const catalog = async (): Promise<CreditCatalog> => options.catalog ? options.catalog() : { packages:[...CREDIT_PACKAGES], customTopUp:{...CUSTOM_TOP_UP_LIMITS,amountMinorPerCredit:CUSTOM_AMOUNT_MINOR_PER_CREDIT},pricingVersion:"credit-packages-baseline-v1" };
  return {
    async packagesAsync() {
      const current = await catalog(); const provider = config.provider;
      return { packages:current.packages, payments:{available:Boolean(provider),mode:provider?.mode ?? "live",checkout:provider?.checkout ?? "hosted",customAmount:provider?.allowsCustomAmount ? current.customTopUp : null} };
    },
    packages() {
      const provider = config.provider;
      return {
        packages: [...CREDIT_PACKAGES],
        payments: {
          available: Boolean(provider),
          mode: provider?.mode ?? "live",
          checkout: provider?.checkout ?? "hosted",
          customAmount: provider?.allowsCustomAmount ? { ...CUSTOM_TOP_UP_LIMITS, amountMinorPerCredit: CUSTOM_AMOUNT_MINOR_PER_CREDIT } : null,
        },
      };
    },

    async createTopUp(session, request, idempotencyKey) {
      if (session.session.guest === true) throw new TopUpError("authentication_required", "Sign in to top up credits.");
      const provider = requireProvider();
      const existing = await payments.findOrderByIdempotency?.(session.user.id, idempotencyKey);
      if (existing && (existing.packageId !== (request.packageId ?? null) || (!request.packageId && request.customCredits !== existing.credits))) throw new TopUpError("idempotency_conflict");
      const current = await catalog();
      let credits: number;
      let amountMinor: number;
      let packageId: string | null = null;
      if (request.packageId) {
        const selected = (existing ? [{id:existing.packageId,credits:existing.credits,amountMinor:existing.amountMinor}] : current.packages).find((item) => item.id === request.packageId);
        if (!selected) throw new TopUpError("package_not_found");
        ({ credits, amountMinor } = selected);
        packageId = selected.id ?? null;
      } else {
        if (!provider.allowsCustomAmount) throw new TopUpError("custom_amount_unavailable", "Choose one of the credit packages.");
        credits = request.customCredits!;
        if (!existing && (credits < current.customTopUp.min || credits > current.customTopUp.max)) {
          throw new TopUpError("custom_amount_invalid", `Enter between ${current.customTopUp.min} and ${current.customTopUp.max} credits.`);
        }
        amountMinor = existing?.amountMinor ?? credits * current.customTopUp.amountMinorPerCredit;
      }

      let order: TopUpOrderRecord;
      try {
        order = await payments.createOrder({ userId: session.user.id, idempotencyKey, credits, amountMinor, currency: PAYMENT_CURRENCY, provider: provider.id, packageId, pricingVersion:existing?.pricingVersion ?? current.pricingVersion });
      } catch (error) {
        rethrowDomain(error);
      }
      if (order.status !== "pending") return { order: publicOrder(order), checkoutUrl: null };

      let checkout;
      try {
        checkout = await provider.createCheckout({
          order: { id: order.id, credits: order.credits, amountMinor: order.amountMinor, currency: order.currency },
          customer: { id: session.user.id, email: session.user.email, name: session.user.name },
          successUrl: `${config.successUrl}?order=${order.id}`,
          cancelUrl: `${config.cancelUrl}?order=${order.id}`,
          language: request.language ?? "en",
        });
      } catch (error) {
        await payments.closeOrder({ orderId: order.id, status: "failed", reason: error instanceof PaymentProviderError ? error.code : "checkout_failed" });
        throw new TopUpError("checkout_failed", "The payment page could not be opened. You were not charged.");
      }

      try {
        if (checkout.kind === "completed") {
          const credited = await payments.creditOrder({ orderId: order.id, provider: provider.id, providerReference: checkout.providerReference, amountMinor: order.amountMinor, currency: order.currency });
          return { order: publicOrder(credited), checkoutUrl: null };
        }
        await payments.attachProviderReference({ orderId: order.id, providerReference: checkout.providerReference });
        return { order: publicOrder(order), checkoutUrl: checkout.checkoutUrl };
      } catch (error) {
        rethrowDomain(error);
      }
    },

    async getOrder(userId, orderId, returnParams) {
      const order = await payments.findOwnedOrder(userId, orderId);
      if (!order) throw new TopUpError("order_not_found");
      const provider = config.provider;
      const due = now() - (lastConfirm.get(order.id) ?? 0) >= CONFIRM_INTERVAL_MS;
      if (order.status !== "pending" || !returnParams || !provider?.confirmPayment || provider.id !== order.provider || !due) return publicOrder(order);
      lastConfirm.set(order.id, now());
      let event: VerifiedPaymentEvent | null = null;
      try {
        event = await provider.confirmPayment({ providerReference: order.providerReference ?? order.id, returnParams });
      } catch {
        // The webhook remains the fallback; the page keeps polling.
        return publicOrder(order);
      }
      if (!event) return publicOrder(order);
      await applyEvent(order, event);
      return publicOrder((await payments.findOwnedOrder(userId, orderId)) ?? order);
    },

    async handleWebhook(providerId, input) {
      const provider = config.provider;
      if (!provider || provider.id !== providerId || !provider.verifyWebhook) throw new TopUpError("payments_unavailable");
      let event;
      try {
        event = await provider.verifyWebhook(input);
      } catch {
        throw new TopUpError("webhook_rejected");
      }
      const order = await payments.findByProviderReference(provider.id, event.providerReference);
      if (!order) throw new TopUpError("order_not_found");
      // Crediting and closing are idempotent, so gateway retries are safe; the event log is an audit trail.
      await applyEvent(order, event);
      await payments.recordProviderEvent({ provider: provider.id, eventId: event.eventId, orderId: order.id, type: event.status });
    },
  };
}
