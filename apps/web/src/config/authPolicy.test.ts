import { describe, expect, it, vi } from "vitest";

describe("email verification policy", () => {
  it("defaults to deferred verification for the first private-beta campaign", async () => {
    vi.stubEnv("VITE_AUTH_REQUIRE_EMAIL_VERIFICATION", "");
    vi.resetModules();
    const { isEmailVerificationRequired } = await import("./authPolicy");
    expect(isEmailVerificationRequired()).toBe(false);
  });

  it("can defer verification for a private beta", async () => {
    vi.stubEnv("VITE_AUTH_REQUIRE_EMAIL_VERIFICATION", "false");
    vi.resetModules();
    const { isEmailVerificationRequired } = await import("./authPolicy");
    expect(isEmailVerificationRequired()).toBe(false);
  });
});
