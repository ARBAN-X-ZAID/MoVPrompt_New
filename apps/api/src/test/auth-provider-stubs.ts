import { createHash, randomUUID } from "node:crypto";

import type { AuthGateway, AuthenticatedSession } from "../auth-gateway.js";

type TestSocialProvider = "google" | "apple";

export const TEST_SOCIAL_AUTH_USERS: Record<TestSocialProvider, string> = {
  google: "00000000-0000-4000-8000-000000000021",
  apple: "00000000-0000-4000-8000-000000000022",
};

const CALLBACK_STATES: Record<TestSocialProvider, string> = {
  google: "google-test-state-8d451c3b",
  apple: "apple-test-state-6a927ef0",
};

function safeCallbackReturnPath(value: string): string {
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return "/create";
  const parsed = new URL(candidate, "https://app.movprompt.test");
  if (parsed.origin !== "https://app.movprompt.test") return "/create";
  if (["/auth", "/reset-password"].includes(parsed.pathname)) return "/create";
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function readCookie(headers: Headers, name: string): string | null {
  const match = headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match?.[1] ?? null;
}

export interface TestAuthProviderStubs extends AuthGateway {
  callbackRequest(input: {
    provider: TestSocialProvider;
    state: string;
    next: string;
    cancelled?: boolean;
  }): Request;
}

/**
 * Credential-free fixtures for API tests only. Runtime composition never imports
 * this module, and production loading fails closed even if a bundler includes it.
 */
export function createTestAuthProviderStubs(): TestAuthProviderStubs {
  if (process.env.NODE_ENV === "production") {
    throw new Error("test_auth_provider_stubs_are_not_available_in_production");
  }

  const sessions = new Map<string, AuthenticatedSession>();
  const publicCapability = {
    emailPassword: true as const,
    configuredProviders: ["google", "apple"] as Array<TestSocialProvider>,
    firstCampaignVerificationPolicy: "deferred_until_after_first_campaign" as const,
  };

  return {
    publicCapability,
    callbackRequest({ provider, state, next, cancelled = false }) {
      const url = new URL(`https://api.movprompt.test/api/auth/test-callback/${provider}`);
      url.searchParams.set("state", state);
      url.searchParams.set("next", next);
      if (cancelled) url.searchParams.set("cancelled", "true");
      return new Request(url);
    },
    async handle(request) {
      const url = new URL(request.url);
      const provider = url.pathname.match(/^\/api\/auth\/test-callback\/(google|apple)$/)?.[1] as TestSocialProvider | undefined;
      if (!provider) return new Response("not_found", { status: 404 });
      const returnPath = safeCallbackReturnPath(url.searchParams.get("next") ?? "/create");
      if (url.searchParams.get("cancelled") === "true") {
        return new Response(null, { status: 302, headers: { location: returnPath } });
      }
      if (url.searchParams.get("state") !== CALLBACK_STATES[provider]) {
        return new Response(JSON.stringify({ error: "invalid_callback_state" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const sessionId = createHash("sha256")
        .update(`${provider}:${CALLBACK_STATES[provider]}`)
        .digest("hex");
      sessions.set(sessionId, {
        user: {
          id: TEST_SOCIAL_AUTH_USERS[provider],
          email: `${provider}.callback@movprompt.test`,
          emailVerified: true,
          name: `${provider === "google" ? "Google" : "Apple"} callback owner`,
          role: "user",
        },
        session: { id: `test-${provider}-${randomUUID()}` },
      });
      return new Response(JSON.stringify({ returnPath }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": `movprompt-test-session=${sessionId}; Path=/; HttpOnly; SameSite=Lax`,
        },
      });
    },
    async getSession(headers) {
      const sessionId = readCookie(headers, "movprompt-test-session");
      return sessionId ? sessions.get(sessionId) ?? null : null;
    },
  };
}

export function testCallbackState(provider: TestSocialProvider): string {
  return CALLBACK_STATES[provider];
}
