import { describe, expect, it } from "vitest";

import { automaticQuoteRetryDelay } from "./quoteRecovery";

describe("automaticQuoteRetryDelay", () => {
  it("retries transient quote failures with bounded backoff", () => {
    expect(automaticQuoteRetryDelay(0, true)).toBe(2_000);
    expect(automaticQuoteRetryDelay(1, true)).toBe(5_000);
    expect(automaticQuoteRetryDelay(2, true)).toBe(10_000);
    expect(automaticQuoteRetryDelay(3, true)).toBeNull();
  });

  it("never retries non-retryable or invalid attempts", () => {
    expect(automaticQuoteRetryDelay(0, false)).toBeNull();
    expect(automaticQuoteRetryDelay(-1, true)).toBeNull();
    expect(automaticQuoteRetryDelay(0.5, true)).toBeNull();
  });
});

