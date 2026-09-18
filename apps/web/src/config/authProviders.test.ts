import { describe, expect, it, vi } from "vitest";
import type { AuthCapability } from "@movprompt/contracts";

import { enabledSocialAuthProviders, isSocialAuthProviderEnabled } from "./authProviders";

describe("social authentication provider visibility", () => {
  const capability: AuthCapability = {
    emailPassword: true,
    configuredProviders: ["google", "apple"],
    firstCampaignVerificationPolicy: "deferred_until_after_first_campaign",
  };

  it("fails closed before the server capability is available", () => {
    expect(isSocialAuthProviderEnabled(undefined, "google")).toBe(false);
    expect(isSocialAuthProviderEnabled(undefined, "apple")).toBe(false);
    expect(enabledSocialAuthProviders(undefined)).toEqual([]);
  });

  it("mirrors the configured social methods from the server capability", () => {
    expect(enabledSocialAuthProviders({ ...capability, configuredProviders: ["google"] })).toEqual(["google"]);
    expect(enabledSocialAuthProviders({ ...capability, configuredProviders: ["apple"] })).toEqual(["apple"]);
    expect(enabledSocialAuthProviders(capability)).toEqual(["google", "apple"]);
  });

  it("does not permit a browser environment override", () => {
    vi.stubEnv("VITE_AUTH_GOOGLE_ENABLED", "true");
    vi.stubEnv("VITE_AUTH_APPLE_ENABLED", "true");

    expect(enabledSocialAuthProviders({ ...capability, configuredProviders: [] })).toEqual([]);
  });
});
