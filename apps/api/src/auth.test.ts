import { describe, expect, it, vi } from "vitest";
import type { AuthGateway } from "./auth-gateway.js";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";

function configuredAuthApi(authGateway?: AuthGateway) {
  return createApi({
    config: loadApiConfig({
      APP_ENV: "test",
      API_PORT: "3001",
      FEATURE_AUTHENTICATION: "true",
    }),
    ...(authGateway ? { authGateway } : {}),
  });
}

describe("Better Auth mount", () => {
  it("forwards auth requests and preserves cookies with a request ID", async () => {
    const gateway: AuthGateway = {
      handle: vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": "movprompt.session=test; Path=/; HttpOnly",
          },
        }),
      ),
      getSession: vi.fn(async () => null),
    };
    const response = await configuredAuthApi(gateway).request("/api/auth/ok", {
      headers: { "x-request-id": "request-auth-1" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("request-auth-1");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(gateway.handle).toHaveBeenCalledOnce();
  });

  it("fails closed when the auth runtime is not configured", async () => {
    const response = await configuredAuthApi().request("/api/auth/ok");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "authentication_service_unavailable",
        retryable: true,
      },
    });
  });
});
