export const FIRST_CAMPAIGN_VERIFICATION_POLICY = "deferred_until_after_first_campaign" as const;

export type FirstCampaignVerificationPolicy =
  typeof FIRST_CAMPAIGN_VERIFICATION_POLICY;

export interface AuthPublicCapability {
  emailPassword: true;
  configuredProviders: Array<"google" | "apple">;
  firstCampaignVerificationPolicy: FirstCampaignVerificationPolicy;
}

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
