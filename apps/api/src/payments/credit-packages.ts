import { PAYMENT_CURRENCY, type CreditPackage } from "@movprompt/contracts";

/** Authoritative catalog. The browser only ever sends a package id. Prices are in fils. */
export const CREDIT_PACKAGES: readonly CreditPackage[] = Object.freeze([
  { id: "credits-100", credits: 100, amountMinor: 5_000, currency: PAYMENT_CURRENCY, popular: false },
  { id: "credits-300", credits: 300, amountMinor: 13_000, currency: PAYMENT_CURRENCY, popular: true },
  { id: "credits-600", credits: 600, amountMinor: 24_000, currency: PAYMENT_CURRENCY, popular: false },
]);

export const CUSTOM_TOP_UP_LIMITS = Object.freeze({ min: 10, max: 10_000 });

/** Custom amounts use the base 100-credit rate. */
export const CUSTOM_AMOUNT_MINOR_PER_CREDIT = 50;

export function customTopUpAmountMinor(credits: number): number {
  return credits * CUSTOM_AMOUNT_MINOR_PER_CREDIT;
}
