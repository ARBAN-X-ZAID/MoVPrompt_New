/**
 * Contract every payment gateway implements. Adding a gateway (UPayments,
 * Tap, MyFatoorah, ...) means one new file with these two methods plus its
 * entry in providers.ts. Wallet crediting never lives in a provider.
 */
export type CheckoutOrder = {
  id: string;
  credits: number;
  amountMinor: number;
  currency: string;
};

export type CheckoutResult =
  /** Paid immediately (only the manual test provider). */
  | { kind: "completed"; providerReference: string }
  /** The customer must finish payment on the gateway's hosted page. */
  | { kind: "redirect"; providerReference: string; checkoutUrl: string };

export type VerifiedPaymentEvent = {
  /** Gateway's unique event or transaction id, used to ignore repeated webhooks. */
  eventId: string;
  providerReference: string;
  status: "paid" | "failed" | "cancelled";
  amountMinor: number;
  currency: string;
};

export interface PaymentProvider {
  readonly id: string;
  readonly mode: "test" | "live";
  /** Test mode may allow typed amounts; live gateways should sell fixed packages. */
  readonly allowsCustomAmount: boolean;
  createCheckout(input: {
    order: CheckoutOrder;
    customer: { id: string; email: string; name: string };
    successUrl: string;
    cancelUrl: string;
  }): Promise<CheckoutResult>;
  /** Must verify the gateway signature before trusting anything in the body. */
  verifyWebhook?(input: { headers: Headers; rawBody: string }): Promise<VerifiedPaymentEvent>;
}

export class PaymentProviderError extends Error {
  constructor(readonly code: "webhook_signature_invalid" | "checkout_failed", message?: string) {
    super(message ?? code);
    this.name = "PaymentProviderError";
  }
}
