import { describe, expect, it, vi } from "vitest";
import { AuthRequestTimeoutError, withAuthRequestTimeout } from "./requestTimeout";

describe("withAuthRequestTimeout", () => {
  it("returns a result that arrives before the deadline", async () => {
    await expect(withAuthRequestTimeout(Promise.resolve("ready"), 50)).resolves.toBe("ready");
  });

  it("rejects a request that remains pending at the deadline", async () => {
    vi.useFakeTimers();
    try {
      const request = withAuthRequestTimeout(new Promise<never>(() => {}), 30_000);
      const rejection = expect(request).rejects.toBeInstanceOf(AuthRequestTimeoutError);
      await vi.advanceTimersByTimeAsync(30_000);
      await rejection;
    } finally {
      vi.useRealTimers();
    }
  });
});
