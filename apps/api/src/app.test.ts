import { describe, expect, it } from "vitest";
import { CapabilityRegistry } from "@movprompt/providers";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";

const config = loadApiConfig({
  APP_VERSION: "1.2.3",
  COMMIT_SHA: "test-sha",
  APP_ENV: "test",
  API_PORT: "3001",
  FEATURE_TEMPLATE_MODE: "true",
  FEATURE_ADVANCED_MODE: "true",
  FEATURE_GENERATION: "false",
  FEATURE_EXPORTS: "false",
  FEATURE_BILLING: "false",
});

describe("MovPrompt API foundation", () => {
  it("returns version metadata with the request ID", async () => {
    const app = createApi({ config, capabilityRegistry: new CapabilityRegistry() });
    const response = await app.request("/api/v1/version", {
      headers: { "x-request-id": "request-1234" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request-1234");
    await expect(response.json()).resolves.toMatchObject({
      service: "movprompt-api",
      version: "1.2.3",
      commitSha: "test-sha",
    });
  });

  it("returns only server-evaluated public capability state", async () => {
    const capabilityRegistry = new CapabilityRegistry({
      "video.cinematic": {
        enabled: true,
        adapterId: "private-adapter",
        providerModelId: "private-model-id",
      },
    });
    const app = createApi({ config, capabilityRegistry });
    const response = await app.request("/api/v1/feature-flags");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("video.cinematic");
    expect(body).not.toContain("private-adapter");
    expect(body).not.toContain("private-model-id");
  });

  it("returns only configured auth method names and the shared verification policy", async () => {
    const app = createApi({
      config: loadApiConfig({
        APP_ENV: "test",
        API_PORT: "3001",
        FEATURE_AUTHENTICATION: "true",
      }),
      authGateway: {
        handle: async () => new Response("ok"),
        getSession: async () => null,
        publicCapability: {
          emailPassword: true,
          configuredProviders: ["google"],
          firstCampaignVerificationPolicy: "deferred_until_after_first_campaign",
        },
      },
    });

    const response = await app.request("/api/v1/feature-flags");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body)).toMatchObject({
      auth: {
        emailPassword: true,
        configuredProviders: ["google"],
        firstCampaignVerificationPolicy: "deferred_until_after_first_campaign",
      },
    });
    expect(body).not.toContain("clientSecret");
    expect(body).not.toContain("oauth-state");
  });

  it("keeps public product scanning available before authentication", async () => {
    const app = createApi({
      config,
      capabilityRegistry: new CapabilityRegistry(),
      sourceScanner: {
        scan: async ({ url, kind, requestId }) => ({
          kind,
          canonicalUrl: url,
          facts: [{ field: "name", value: "Imported product", source: "page_title" }],
          imageCandidates: ["https://cdn.example.com/product.jpg"],
          requestId,
        }),
      },
      requestRateLimiter: {
        consume: async () => ({ allowed: true, retryAfterSeconds: 1 }),
        consumePublicScan: async () => ({ allowed: true, retryAfterSeconds: 1 }),
        consumeAuthenticatedMirror: async () => ({ allowed: true, retryAfterSeconds: 1 }),
      },
    });
    const response = await app.request("/api/v1/product-scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://shop.example.com/product" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toMatchObject({
      kind: "product",
      canonicalUrl: "https://shop.example.com/product",
      facts: [{ field: "name", value: "Imported product" }],
      imageCandidates: ["https://cdn.example.com/product.jpg"],
    });
  });

  it("fails readiness when a required dependency is unavailable", async () => {
    const app = createApi({
      config,
      capabilityRegistry: new CapabilityRegistry(),
      readinessDependencies: [
        {
          name: "postgres",
          check: async () => {
            throw new Error("offline");
          },
        },
      ],
    });
    const response = await app.request("/api/v1/health");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "unavailable",
      dependencies: [{ name: "postgres", status: "unavailable" }],
    });
  });

  it("uses the standard error envelope for unknown routes", async () => {
    const app = createApi({ config, capabilityRegistry: new CapabilityRegistry() });
    const response = await app.request("/api/v1/unknown");

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "route_not_found",
        retryable: false,
      },
    });
  });

  it("reports auth and assets disabled when their runtime services are missing", async () => {
    const enabledConfig = loadApiConfig({
      APP_ENV: "test",
      API_PORT: "3001",
      FEATURE_AUTHENTICATION: "true",
      FEATURE_ASSETS: "true",
    });
    const app = createApi({
      config: enabledConfig,
      capabilityRegistry: new CapabilityRegistry(),
    });
    const response = await app.request("/api/v1/feature-flags");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      features: {
        authentication: false,
        assets: false,
      },
    });
  });

  it("allows the required asset idempotency header in CORS preflight", async () => {
    const corsConfig = loadApiConfig({
      APP_ENV: "test",
      API_PORT: "3001",
      WEB_ORIGIN: "https://app.movprompt.test",
    });
    const app = createApi({ config: corsConfig, capabilityRegistry: new CapabilityRegistry() });
    const response = await app.request("/api/v1/projects/project/assets/upload-url", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.movprompt.test",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,idempotency-key,x-request-id",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.movprompt.test",
    );
    expect(response.headers.get("access-control-allow-headers")?.toLowerCase()).toContain(
      "idempotency-key",
    );
  });
});
