import { createHash } from "node:crypto";
import { COLLECTIONS, type MongoDatabase } from "@movprompt/db";


export const DEFAULT_PUBLIC_SCAN_LIMIT = 20;
export const DEFAULT_AUTHENTICATED_MIRROR_LIMIT = 50;
export const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

export type RequestRateAction = "public_source_scan" | "authenticated_remote_image_mirror";


export type TrustedClientIpInput = {
  headers: Headers;
  directAddress?: string | null;
  trustedProxyHops: number;
};

export type RequestRateLimiter = {
  consume(input: { action: RequestRateAction; subject: string }): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
  consumePublicScan(input: { headers: Headers; directAddress?: string | null }): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
  consumeAuthenticatedMirror(userId: string): Promise<{
    allowed: boolean;
    retryAfterSeconds: number;
  }>;
};

function positiveInteger(value: number, label: string, maximum: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function normalizedIp(value: string): string | null {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  const bracketed = trimmed.match(/^\[([^\]]+)\](?::\d+)?$/)?.[1];
  return (bracketed ?? trimmed).toLowerCase();
}

function forwardedValues(headers: Headers): string[] {
  const forwarded = headers.get("forwarded");
  if (forwarded) {
    const values = forwarded
      .split(",")
      .map((part) => part.split(";").find((parameter) => parameter.trim().toLowerCase().startsWith("for=")))
      .map((parameter) => parameter?.slice(parameter.indexOf("=") + 1) ?? "")
      .map(normalizedIp);
    if (values.length > 0 && values.every((value): value is string => value !== null)) return values;
  }
  return (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map(normalizedIp)
    .filter((value): value is string => value !== null);
}

export function resolveTrustedClientIp(input: TrustedClientIpInput): string {
  const directAddress = normalizedIp(input.directAddress ?? "") ?? "unknown-direct-client";
  if (input.trustedProxyHops === 0) return directAddress;

  const forwarded = forwardedValues(input.headers);
  const selected = forwarded[forwarded.length - input.trustedProxyHops];
  return selected ?? directAddress;
}

function hashSubject(subject: string): string {
  return createHash("sha256").update("movprompt-rate-limit-v1\0").update(subject).digest("hex");
}

export function createMongoRequestRateLimiter(options: {
  database: MongoDatabase;
  publicScanLimit?: number;
  authenticatedMirrorLimit?: number;
  windowSeconds?: number;
  trustedProxyHops?: number;
}): RequestRateLimiter {
  const publicScanLimit = positiveInteger(options.publicScanLimit ?? DEFAULT_PUBLIC_SCAN_LIMIT, "Public source scan limit", 100000);
  const authenticatedMirrorLimit = positiveInteger(options.authenticatedMirrorLimit ?? DEFAULT_AUTHENTICATED_MIRROR_LIMIT, "Authenticated image mirror limit", 100000);
  const windowSeconds = positiveInteger(options.windowSeconds ?? DEFAULT_RATE_LIMIT_WINDOW_SECONDS, "Rate-limit window", 86400);
  const trustedProxyHops = options.trustedProxyHops ?? 0;
  if (!Number.isSafeInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > 32) {
    throw new Error("Trusted proxy hops must be an integer between 0 and 32.");
  }

  async function consume(input: { action: RequestRateAction; subject: string }) {
    const limit = input.action === "public_source_scan" ? publicScanLimit : authenticatedMirrorLimit;
    const now = new Date();
    const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1_000)) * windowSeconds * 1_000);
    const expiresAt = new Date(windowStart.getTime() + windowSeconds * 1_000);
    const key = `${input.action}:${hashSubject(input.subject)}:${windowStart.toISOString()}`;
    const result = await options.database.collection(COLLECTIONS.requestRateLimits).findOneAndUpdate(
      { key },
      {
        $inc: { count: 1 },
        $setOnInsert: { action: input.action, subjectHash: hashSubject(input.subject), windowStart, expiresAt },
        $set: { updatedAt: now },
      },
      { upsert: true, returnDocument: "after" },
    );
    const count = typeof result?.count === "number" ? result.count : limit + 1;
    return {
      allowed: count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1_000)),
    };
  }

  return {
    consume,
    consumePublicScan(input) {
      return consume({ action: "public_source_scan", subject: resolveTrustedClientIp({ ...input, trustedProxyHops }) });
    },
    consumeAuthenticatedMirror(userId) {
      return consume({ action: "authenticated_remote_image_mirror", subject: userId });
    },
  };
}
