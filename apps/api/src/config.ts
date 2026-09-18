import type { ProductFeatureFlags } from "@movprompt/contracts";

export type ApiConfig = {
  serviceName: string;
  version: string;
  commitSha: string;
  builtAt: string | null;
  environment: string;
  port: number;
  corsOrigins: string[];
  featureFlags: ProductFeatureFlags;
  requestRateLimit: {
    publicScanLimit: number;
    authenticatedMirrorLimit: number;
    windowSeconds: number;
    trustedProxyHops: number;
  };
};

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === "true";
}

function readPort(value: string | undefined): number {
  const parsed = Number(value ?? "3001");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error("API_PORT or PORT must be an integer between 1 and 65535.");
  }
  return parsed;
}

function readBoundedInteger(value: string | undefined, fallback: number, label: string, minimum: number, maximum: number): number {
  const parsed = Number(value ?? String(fallback));
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function readBuildTime(value: string | undefined): string | null {
  if (!value) return null;
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.valueOf())) {
    throw new Error("BUILD_TIME must be a valid ISO-8601 timestamp.");
  }
  return timestamp.toISOString();
}

function readOrigins(environment: Readonly<Record<string, string | undefined>>): string[] {
  const values = [environment.WEB_ORIGIN, environment.CORS_ALLOWED_ORIGINS]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(","));
  const origins = new Set<string>();

  for (const value of values) {
    const candidate = value.trim();
    if (!candidate) continue;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(`Invalid API CORS origin: ${candidate}`);
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error(`API CORS origin must use HTTP(S): ${candidate}`);
    }
    origins.add(parsed.origin);
  }
  return [...origins];
}

export function loadApiConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ApiConfig {
  return {
    serviceName: "movprompt-api",
    version: environment.APP_VERSION?.trim() || "0.1.0-dev",
    commitSha: environment.COMMIT_SHA?.trim() || "local",
    builtAt: readBuildTime(environment.BUILD_TIME),
    environment: environment.APP_ENV?.trim() || "development",
    // Render exposes the assigned listener through PORT. API_PORT remains the
    // explicit local/container override so existing development commands keep
    // their current behavior.
    port: readPort(environment.API_PORT ?? environment.PORT),
    corsOrigins: readOrigins(environment),
    requestRateLimit: {
      publicScanLimit: readBoundedInteger(environment.SOURCE_SCAN_RATE_LIMIT, 20, "Source scan rate limit", 1, 100000),
      authenticatedMirrorLimit: readBoundedInteger(environment.AUTHENTICATED_MIRROR_RATE_LIMIT, 50, "Authenticated mirror rate limit", 1, 100000),
      windowSeconds: readBoundedInteger(environment.RATE_LIMIT_WINDOW_SECONDS, 600, "Rate-limit window", 1, 86400),
      trustedProxyHops: readBoundedInteger(environment.TRUSTED_PROXY_HOPS, 0, "Trusted proxy hops", 0, 32),
    },
    featureFlags: {
      authentication: readBoolean(environment.FEATURE_AUTHENTICATION, false),
      assets: readBoolean(environment.FEATURE_ASSETS, false),
      templateMode: readBoolean(environment.FEATURE_TEMPLATE_MODE, true),
      advancedMode: readBoolean(environment.FEATURE_ADVANCED_MODE, true),
      generation: readBoolean(environment.FEATURE_GENERATION, false),
      exports: readBoolean(environment.FEATURE_EXPORTS, false),
      billing: readBoolean(environment.FEATURE_BILLING, false),
    },
  };
}
