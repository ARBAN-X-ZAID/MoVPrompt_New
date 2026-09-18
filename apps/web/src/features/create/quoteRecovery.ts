const AUTOMATIC_QUOTE_RETRY_DELAYS_MS = [2_000, 5_000, 10_000] as const;

export function automaticQuoteRetryDelay(
  attempt: number,
  retryable: boolean,
): number | null {
  if (!retryable || !Number.isInteger(attempt) || attempt < 0) return null;
  return AUTOMATIC_QUOTE_RETRY_DELAYS_MS[attempt] ?? null;
}

