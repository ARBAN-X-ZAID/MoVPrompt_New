import { createManualPaymentProvider } from "./manual-provider.js";
import { createUPaymentsProvider } from "./upayments-provider.js";
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
    case "upayments": {
      const baseUrl = environment.UPAYMENTS_API_BASE_URL?.trim() ?? "";
      const apiKey = environment.UPAYMENTS_API_KEY?.trim() ?? "";
      const secretKey = environment.UPAYMENTS_SECRET_KEY?.trim() ?? "";
      const apiOrigin = environment.API_ORIGIN?.trim().replace(/\/$/, "") ?? "";
      const notificationUrl = environment.UPAYMENTS_NOTIFICATION_URL?.trim() || (apiOrigin ? `${apiOrigin}/api/v1/payments/webhooks/upayments` : "");
      let sandbox = false;
      try { sandbox = new URL(baseUrl).hostname.includes("sandbox"); } catch { /* reported below */ }
      if (!/^https:\/\//.test(baseUrl) || !apiKey || !secretKey || !notificationUrl) {
        console.warn("[MovPrompt] UPayments needs UPAYMENTS_API_BASE_URL (https), UPAYMENTS_API_KEY, UPAYMENTS_SECRET_KEY and API_ORIGIN. Top-ups are disabled.");
      } else if (production && sandbox) {
        // Public sandbox cards would otherwise buy real credits.
        console.warn("[MovPrompt] UPayments sandbox is ignored in production. Top-ups are disabled.");
      } else {
        provider = createUPaymentsProvider({ baseUrl, apiKey, secretKey, notificationUrl, refundPrecisionVerified: environment.ADMIN_REFUND_ACCEPTANCE_VERIFIED === "true" });
      }
      break;
    }
    case "":
      break;
    default:
      console.warn(`[MovPrompt] Unknown PAYMENTS_PROVIDER "${selected}". Top-ups are disabled.`);
  }
  return { provider, successUrl, cancelUrl };
}
