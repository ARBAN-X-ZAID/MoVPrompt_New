import { describe, expect, it, vi } from "vitest";

import {
  AuthenticationEmailDeliveryError,
  dispatchAuthenticationEmail,
} from "../src/auth";

describe("authentication email delivery", () => {
  const email = {
    type: "reset-password" as const,
    to: "owner@example.test",
    name: "Campaign owner",
    url: "https://app.movprompt.test/reset-password/token",
  };

  it("waits for the configured sender before acknowledging delivery", async () => {
    const sender = vi.fn(async () => undefined);

    await expect(dispatchAuthenticationEmail(sender, email)).resolves.toBeUndefined();
    expect(sender).toHaveBeenCalledWith(email);
  });

  it("returns a retryable, non-provider-specific failure when delivery is rejected", async () => {
    const sender = vi.fn(async () => { throw new Error("smtp secret diagnostic"); });

    await expect(dispatchAuthenticationEmail(sender, email)).rejects.toEqual(
      expect.objectContaining({ name: "AuthenticationEmailDeliveryError", type: "reset-password" }),
    );
    await expect(dispatchAuthenticationEmail(sender, email)).rejects.toBeInstanceOf(AuthenticationEmailDeliveryError);
  });
});
