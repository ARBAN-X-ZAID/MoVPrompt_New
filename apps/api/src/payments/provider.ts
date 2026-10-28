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
  refundSourceOrderId?: string;
  paymentTrackId?: string;
  /** Gateway's unique event or transaction id, used to ignore repeated webhooks. */
  eventId: string;
  providerReference: string;
  /** "pending" is a non-final update and changes nothing. */
  status: "paid" | "failed" | "cancelled" | "pending";
  amountMinor: number;
  currency: string;
};

export interface PaymentProvider {
  createRefund?(input: { sourceOrderId: string; amountMinor: number; currency: "KWD"; reference: string; reason: string }): Promise<{ refundId: string; status: "submitted" | "uncertain" | "confirmed" }>;
  getRefundStatus?(input: { refundId: string; sourceOrderId: string; amountMinor: number; currency: "KWD" }): Promise<{ status: "submitted" | "uncertain" | "confirmed" }>;
  readonly id: string;
  readonly mode: "test" | "live";
  /** Whether customers may type their own credit amount (priced per credit by the server). */
  readonly allowsCustomAmount: boolean;
  /** "hosted" sends the customer to the gateway's payment page; "instant" credits immediately. */
  readonly checkout: "instant" | "hosted";
  createCheckout(input: {
    order: CheckoutOrder;
    customer: { id: string; email: string; name: string };
    successUrl: string;
    cancelUrl: string;
    language: "en" | "ar";
  }): Promise<CheckoutResult>;
  /** Must verify the gateway signature before trusting anything in the body. */
  verifyWebhook?(input: { headers: Headers; rawBody: string }): Promise<VerifiedPaymentEvent>;
  /**
   * Asks the gateway directly for the outcome when the customer returns, so a
   * late or unreachable webhook never leaves a paid order uncredited.
   * Returns null when the return parameters are not enough to look it up.
   */
  confirmPayment?(input: { providerReference: string; returnParams: Readonly<Record<string, string>> }): Promise<VerifiedPaymentEvent | null>;
}

export class PaymentProviderError extends Error {
  constructor(readonly code: "webhook_signature_invalid" | "checkout_failed", message?: string) {
    super(message ?? code);
    this.name = "PaymentProviderError";
  }
}
