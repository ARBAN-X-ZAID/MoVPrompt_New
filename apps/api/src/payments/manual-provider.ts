import type { PaymentProvider } from "./provider.js";

/** Test-only provider: approves every top-up instantly without taking payment. */
export function createManualPaymentProvider(): PaymentProvider {
  return {
    id: "manual",
    mode: "test",
    allowsCustomAmount: true,
    async createCheckout({ order }) {
      return { kind: "completed", providerReference: `manual_${order.id}` };
    },
  };
}
