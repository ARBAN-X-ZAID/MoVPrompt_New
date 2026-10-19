import { createManualPaymentProvider } from "./manual-provider.js";
import type { PaymentProvider } from "./provider.js";

export type PaymentsConfig = {
  provider: PaymentProvider | null;
  successUrl: string;
  cancelUrl: string;
};

/**
 * Selects the active gateway from PAYMENTS_PROVIDER. Fails closed: an unknown
 * value, or the free manual provider in production, disables top-ups.
 * Register a new gateway by adding a case that builds it from its env keys.
 */
export function createPaymentsConfigFromEnvironment(environment: Readonly<Record<string, string | undefined>>): PaymentsConfig {
  const selected = environment.PAYMENTS_PROVIDER?.trim().toLowerCase() ?? "";
  const production = (environment.APP_ENV?.trim().toLowerCase() ?? "production") === "production";
  const webOrigin = environment.WEB_ORIGIN?.trim().replace(/\/$/, "") || "http://localhost:8080";
  const successUrl = environment.PAYMENTS_SUCCESS_URL?.trim() || `${webOrigin}/billing/success`;
  const cancelUrl = environment.PAYMENTS_CANCEL_URL?.trim() || `${webOrigin}/billing/cancel`;

  let provider: PaymentProvider | null = null;
  switch (selected) {
    case "manual":
      if (production) console.warn("[MovPrompt] PAYMENTS_PROVIDER=manual is ignored in production. Top-ups are disabled.");
      else provider = createManualPaymentProvider();
      break;
    case "":
      break;
    default:
      console.warn(`[MovPrompt] Unknown PAYMENTS_PROVIDER "${selected}". Top-ups are disabled.`);
  }
  return { provider, successUrl, cancelUrl };
}
