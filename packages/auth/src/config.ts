export const FIRST_CAMPAIGN_VERIFICATION_POLICY = "deferred_until_after_first_campaign" as const;

export type FirstCampaignVerificationPolicy =
  typeof FIRST_CAMPAIGN_VERIFICATION_POLICY;

export interface AuthPublicCapability {
  emailPassword: true;
  configuredProviders: Array<"google" | "apple">;
  firstCampaignVerificationPolicy: FirstCampaignVerificationPolicy;
}

export type SessionCookieAttributes = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "none";
  partitioned?: true;
};

export interface AuthEnvironment {
  baseUrl: string;
  secret: string;
  trustedOrigins: string[];
  firstCampaignVerificationPolicy: FirstCampaignVerificationPolicy;
  publicCapability: AuthPublicCapability;
  google?: {
    clientId: string;
    clientSecret: string;
  };
  apple?: {
    clientId: string;
    clientSecret: string;
    appBundleIdentifier?: string;
  };
}

const MULTI_PART_PUBLIC_SUFFIXES = [
  "onrender.com",
  "github.io",
  "vercel.app",
  "netlify.app",
  "railway.app",
  "fly.dev",
  "herokuapp.com",
] as const;

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" || hostname.endsWith(".localhost");
}

function registrableSite(hostname: string): string {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  for (const suffix of MULTI_PART_PUBLIC_SUFFIXES) {
    if (host === suffix || host.endsWith(`.${suffix}`)) return host;
  }
  const labels = host.split(".");
  return labels.length <= 2 ? host : labels.slice(-2).join(".");
}

function isCrossSiteOrigin(base: URL, trusted: URL): boolean {
  if (base.origin === trusted.origin) return false;
  if (isLoopbackHostname(base.hostname) && isLoopbackHostname(trusted.hostname) && base.protocol === trusted.protocol) {
    return false;
  }
  return base.protocol !== trusted.protocol || registrableSite(base.hostname) !== registrableSite(trusted.hostname);
}

/**
 * Split web and API hosts (for example two Render services) are cross-site.
 * Browsers will not store a `SameSite=Lax` session cookie on that XHR, so
 * sign-up appears to succeed and then the next page still shows Sign in.
 * Localhost stays Lax because different ports on localhost are same-site.
 * Same-site custom domains such as app.example.com and api.example.com also
 * stay Lax.
 */
export function sessionCookieAttributes(input: {
  baseUrl: string;
  trustedOrigins: readonly string[];
}): SessionCookieAttributes {
  const base = new URL(input.baseUrl);
  const crossSite = input.trustedOrigins.some((origin) => isCrossSiteOrigin(base, new URL(origin)));
  if (crossSite) {
    return {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
    };
  }
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: base.protocol === "https:",
  };
}

function optionalPair(
  env: NodeJS.ProcessEnv,
  idKey: string,
  secretKey: string,
): { clientId: string; clientSecret: string } | undefined {
  const clientId = env[idKey]?.trim();
  const clientSecret = env[secretKey]?.trim();
  if (Boolean(clientId) !== Boolean(clientSecret)) {
    throw new Error(`${idKey} and ${secretKey} must be configured together`);
  }
  return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

export function authEnvironmentFromEnv(env: NodeJS.ProcessEnv = process.env): AuthEnvironment {
  const baseUrl = env.BETTER_AUTH_URL?.trim();
  const secret = env.BETTER_AUTH_SECRET?.trim();
  if (!baseUrl) throw new Error("BETTER_AUTH_URL is required");
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");

  let baseOrigin: string;
  try {
    const parsed = new URL(baseUrl);
    if (!/^https?:$/.test(parsed.protocol)) throw new Error("unsupported protocol");
    baseOrigin = parsed.origin;
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute HTTP(S) URL");
  }

  const trustedOrigins = new Set([baseOrigin]);
  for (const rawOrigin of (env.BETTER_AUTH_TRUSTED_ORIGINS ?? "").split(",")) {
    const origin = rawOrigin.trim();
    if (!origin) continue;
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Invalid trusted origin: ${origin}`);
    }
    if (!/^https?:$/.test(parsed.protocol)) throw new Error(`Trusted origin must use HTTP(S): ${origin}`);
    trustedOrigins.add(parsed.origin);
  }

  const google = optionalPair(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  const appleCredentials = optionalPair(env, "APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET");
  if (env.AUTH_REQUIRE_EMAIL_VERIFICATION?.trim()) {
    throw new Error("AUTH_REQUIRE_EMAIL_VERIFICATION is not configurable; first-campaign verification is deferred");
  }
  const configuredProviders = [
    ...(google ? ["google" as const] : []),
    ...(appleCredentials ? ["apple" as const] : []),
  ];

  return {
    baseUrl,
    secret,
    trustedOrigins: [...trustedOrigins],
    firstCampaignVerificationPolicy: FIRST_CAMPAIGN_VERIFICATION_POLICY,
    publicCapability: {
      emailPassword: true,
      configuredProviders,
      firstCampaignVerificationPolicy: FIRST_CAMPAIGN_VERIFICATION_POLICY,
    },
    ...(google ? { google } : {}),
    ...(appleCredentials
      ? {
          apple: {
            ...appleCredentials,
            ...(env.APPLE_APP_BUNDLE_IDENTIFIER?.trim()
              ? { appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER.trim() }
              : {}),
          },
        }
      : {}),
  };
}
