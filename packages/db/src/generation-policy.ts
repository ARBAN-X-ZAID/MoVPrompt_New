import { createHash } from "node:crypto";

export const APPROVED_CAPABILITY_ALIASES = [
  "video.cinematic",
  "video.product_fidelity",
  "image.product",
  "presenter.ai_ugc",
  "avatar.enroll",
  "avatar.perform",
  "voice.clone",
  "speech.generate",
  "speech.lip_sync",
  "media.transcribe",
  "media.moderate",
] as const;

export type ApprovedCapabilityAlias = (typeof APPROVED_CAPABILITY_ALIASES)[number];

const APPROVED_CAPABILITY_SET = new Set<string>(APPROVED_CAPABILITY_ALIASES);

export class GenerationDomainError extends Error {
  constructor(
    readonly code:
      | "unapproved_capability"
      | "invalid_configuration"
      | "invalid_configuration_hash"
      | "invalid_quote_expiry"
      | "invalid_quote_breakdown"
      | "quote_not_found"
      | "quote_expired"
      | "quote_owner_mismatch"
      | "quote_configuration_mismatch"
      | "quote_capability_mismatch"
      | "project_version_not_found"
      | "starter_entitlement_unavailable"
      | "insufficient_credits"
      | "project_render_active"
      | "user_render_limit_reached"
      | "idempotency_conflict"
      | "render_not_found"
      | "render_not_chargeable"
      | "render_submission_not_recordable"
      | "render_not_releasable"
      | "render_not_refundable",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "GenerationDomainError";
  }
}

export function assertApprovedCapability(alias: string): asserts alias is ApprovedCapabilityAlias {
  if (!APPROVED_CAPABILITY_SET.has(alias)) {
    throw new GenerationDomainError("unapproved_capability");
  }
}

function stableJson(value: unknown, stack: Set<object>): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new GenerationDomainError("invalid_configuration");
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item, stack)).join(",")}]`;
  if (typeof value !== "object") throw new GenerationDomainError("invalid_configuration");

  const record = value as Record<string, unknown>;
  if (stack.has(record)) throw new GenerationDomainError("invalid_configuration");
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new GenerationDomainError("invalid_configuration");
  }

  stack.add(record);
  const serialized = `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key], stack)}`)
    .join(",")}}`;
  stack.delete(record);
  return serialized;
}

/** Canonical JSON used as the authoritative generation configuration preimage. */
export function canonicalizeGenerationConfiguration(configuration: unknown): string {
  return stableJson(configuration, new Set());
}

export function hashGenerationConfiguration(configuration: unknown): string {
  return createHash("sha256").update(canonicalizeGenerationConfiguration(configuration)).digest("hex");
}

export function assertConfigurationHash(configurationHash: string): string {
  const normalized = configurationHash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new GenerationDomainError("invalid_configuration_hash");
  }
  return normalized;
}
