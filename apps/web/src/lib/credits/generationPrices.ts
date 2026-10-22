// Display copy only; the API quote locks the authoritative price before every render.
// Mirrors VIDEO_LENGTH_PRICE_TIERS and HD_RESOLUTION_SURCHARGE_CREDITS in apps/api/src/generation-pricing.ts.
export const VIDEO_LENGTH_CREDIT_PRICES = Object.freeze([
  { seconds: 8, credits: 50 },
  { seconds: 15, credits: 80 },
  { seconds: 20, credits: 100 },
] as const);

export const HD_RESOLUTION_EXTRA_CREDITS = 20;

/** The cheapest video, used to warn when a wallet cannot cover any generation. */
export const MINIMUM_VIDEO_CREDITS = VIDEO_LENGTH_CREDIT_PRICES[0].credits;
