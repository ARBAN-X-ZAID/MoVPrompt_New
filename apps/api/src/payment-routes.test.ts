import { describe, expect, it, vi } from "vitest";

import type { AuthGateway } from "./auth-gateway.js";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";
import type { TopUpService } from "./payments/top-up-service.js";
import { TopUpError } from "./payments/top-up-service.js";

const config = loadApiConfig({ APP_ENV: "test", API_PORT: "3001", FEATURE_AUTHENTICATION: "true" });
const ORDER = { id: "a".repeat(24), status: "credited" as const, credits: 300, amountMinor: 13_000, currency: "KWD" as const, provider: "manual", packageId: "credits-300", createdAt: new Date(0).toISOString(), creditedAt: new Date(0).toISOString() };

function auth(signedIn = true): AuthGateway {
  return {
    handle: vi.fn(async () => new Response("ok")),
    getSession: vi.fn(async () => signedIn ? { user: { id: "user-1", email: "owner@example.test", emailVerified: true, name: "Owner", role: "user" as const }, session: { id: "s" } } : null),
  };
}

function topUps(overrides: Partial<TopUpService> = {}): TopUpService {
  return {
    packages: () => ({ packages: [], payments: { available: true, mode: "test", customAmount: { min: 10, max: 10_000 } } }),
    createTopUp: vi.fn(async () => ({ order: ORDER, checkoutUrl: null })),
    getOrder: vi.fn(async () => ORDER),
    handleWebhook: vi.fn(async () => undefined),
    ...overrides,
  };
}

const post = (body: unknown, key = "topup-key-0001") => ({ method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });

describe("credit top-up routes", () => {
  it("reports top-ups as unavailable when no service is configured", async () => {
    const response = await createApi({ config, authGateway: auth() }).request("/api/v1/credits/packages");
    expect(response.status).toBe(503);
  });

  it("requires a signed-in account and an idempotency key", async () => {
    const service = topUps();
    expect((await createApi({ config, authGateway: auth(false), topUpService: service }).request("/api/v1/credits/top-ups", post({ packageId: "credits-300" }))).status).toBe(401);
    const app = createApi({ config, authGateway: auth(), topUpService: service });
    expect((await app.request("/api/v1/credits/top-ups", { ...post({ packageId: "credits-300" }), headers: { "content-type": "application/json" } })).status).toBe(400);
    expect(service.createTopUp).not.toHaveBeenCalled();
  });

  it("rejects a request naming both a package and a custom amount", async () => {
    const service = topUps();
    const response = await createApi({ config, authGateway: auth(), topUpService: service }).request("/api/v1/credits/top-ups", post({ packageId: "credits-300", customCredits: 50 }));
    expect(response.status).toBe(400);
    expect(service.createTopUp).not.toHaveBeenCalled();
  });

  it("creates a top-up and returns the order", async () => {
    const service = topUps();
    const response = await createApi({ config, authGateway: auth(), topUpService: service }).request("/api/v1/credits/top-ups", post({ packageId: "credits-300" }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ order: { status: "credited", credits: 300 }, checkoutUrl: null });
    expect(service.createTopUp).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ id: "user-1" }) }), { packageId: "credits-300" }, "topup-key-0001");
  });

  it("maps the hourly limit to 429", async () => {
    const service = topUps({ createTopUp: vi.fn(async () => { throw new TopUpError("top_up_limit_reached"); }) });
    const response = await createApi({ config, authGateway: auth(), topUpService: service }).request("/api/v1/credits/top-ups", post({ packageId: "credits-300" }));
    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "top_up_limit_reached" } });
  });

  it("passes the raw webhook body to the provider without requiring a session", async () => {
    const service = topUps();
    const response = await createApi({ config, authGateway: auth(false), topUpService: service }).request("/api/v1/payments/webhooks/gateway", { method: "POST", headers: { "x-signature": "sig" }, body: "{\"raw\":true}" });
    expect(response.status).toBe(200);
    expect(service.handleWebhook).toHaveBeenCalledWith("gateway", expect.objectContaining({ rawBody: "{\"raw\":true}" }));
  });
});
