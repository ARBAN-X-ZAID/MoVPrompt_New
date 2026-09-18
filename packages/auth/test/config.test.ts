import { describe, expect, it } from "vitest";

import { authEnvironmentFromEnv, sessionCookieAttributes } from "../src/config";

const base = {
  BETTER_AUTH_URL: "https://app.movprompt.test",
  BETTER_AUTH_SECRET: "a-secure-auth-secret-with-more-than-32-characters",
};

describe("Better Auth environment", () => {
  it("publishes only method names and the fixed first-campaign policy", () => {
    const config = authEnvironmentFromEnv({
      ...base,
      BETTER_AUTH_TRUSTED_ORIGINS: "https://www.movprompt.test,http://127.0.0.1:8080",
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
    });

    expect(config.google?.clientId).toBe("google-client");
    expect(config.apple).toBeUndefined();
    expect(config.trustedOrigins).toContain("https://app.movprompt.test");
    expect(config.trustedOrigins).toContain("http://127.0.0.1:8080");
    expect(config.firstCampaignVerificationPolicy).toBe("deferred_until_after_first_campaign");
    expect(config.publicCapability).toEqual({
      emailPassword: true,
      configuredProviders: ["google"],
      firstCampaignVerificationPolicy: "deferred_until_after_first_campaign",
    });
    expect(JSON.stringify(config.publicCapability)).not.toContain("google-client");
    expect(JSON.stringify(config.publicCapability)).not.toContain("google-secret");
  });

  it("uses the same deferred policy in every environment", () => {
    const config = authEnvironmentFromEnv({
      ...base,
      APP_ENV: "production",
    });

    expect(config.firstCampaignVerificationPolicy).toBe("deferred_until_after_first_campaign");
  });

  it("rejects a deployment override for the first-campaign policy", () => {
    expect(() => authEnvironmentFromEnv({
      ...base,
      AUTH_REQUIRE_EMAIL_VERIFICATION: "true",
    })).toThrow(/not configurable/);
  });

  it("rejects partially configured providers", () => {
    expect(() => authEnvironmentFromEnv({ ...base, APPLE_CLIENT_ID: "services-id" })).toThrow(
      /configured together/,
    );
  });

  it("keeps both configured social method names without credential details", () => {
    const config = authEnvironmentFromEnv({
      ...base,
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      APPLE_CLIENT_ID: "apple-client",
      APPLE_CLIENT_SECRET: "apple-secret",
    });

    expect(config.publicCapability.configuredProviders).toEqual(["google", "apple"]);
    expect(JSON.stringify(config.publicCapability)).not.toContain("apple-client");
    expect(JSON.stringify(config.publicCapability)).not.toContain("apple-secret");
  });
});

describe("session cookie attributes", () => {
  it("keeps Lax cookies for localhost web and API ports", () => {
    expect(sessionCookieAttributes({
      baseUrl: "http://localhost:8787",
      trustedOrigins: ["http://localhost:8787", "http://localhost:8080", "http://127.0.0.1:8080"],
    })).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });
  });

  it("uses partitioned cross-site cookies when Render web and API hosts differ", () => {
    expect(sessionCookieAttributes({
      baseUrl: "https://movprompt-new.onrender.com",
      trustedOrigins: ["https://movprompt-new.onrender.com", "https://website-xrha.onrender.com"],
    })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
    });
  });

  it("keeps Lax cookies when the API and web share one origin", () => {
    expect(sessionCookieAttributes({
      baseUrl: "https://app.movprompt.test",
      trustedOrigins: ["https://app.movprompt.test"],
    })).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });

  it("keeps Lax cookies for same-site custom API and web subdomains", () => {
    expect(sessionCookieAttributes({
      baseUrl: "https://api.example.com",
      trustedOrigins: ["https://api.example.com", "https://app.example.com"],
    })).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
  });
});
