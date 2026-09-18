/**
 * Single source of truth for Seedance video generation capabilities.
 *
 * The numbers come from the Vercel AI Gateway readiness response
 * (`apps/worker/src/gateway-local-cli.ts:101`) and the model policy
 * (`packages/providers/src/vercel-gateway-seedance.ts:140-180`).
 *
 * Two surface rules:
 *  - Production (Seedance 2.5): durations 4..16s, policy 4..30s.
 *  - Local (Seedance v1.0 Pro Fast): durations 2..12s, policy 2..12s,
 *    local-only — refuses to resolve in any other environment.
 *
 * Anything that needs to know "which seconds can the user pick" should
 * import from this file. Do not hard-code duration lists anywhere else.
 */

export const SEEDANCE_25_MODEL_ID = "bytedance/seedance-2.5";
export const SEEDANCE_FAST_MODEL_ID = "bytedance/seedance-v1.0-pro-fast";

/** Durations the runtime actually accepts per model (from readiness). */
export const SEEDANCE_25_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
export const SEEDANCE_FAST_DURATIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** Policy limits (more permissive than the readiness list). */
export const SEEDANCE_25_POLICY = { minimumDurationSeconds: 4, maximumDurationSeconds: 30 } as const;
export const SEEDANCE_FAST_POLICY = { minimumDurationSeconds: 2, maximumDurationSeconds: 12 } as const;

export type SeedanceModelId =
  | typeof SEEDANCE_25_MODEL_ID
  | typeof SEEDANCE_FAST_MODEL_ID;

export interface SeedanceCapabilities {
  modelId: SeedanceModelId;
  displayName: string;
  environment: "production" | "local";
  durations: readonly number[];
  minimumDurationSeconds: number;
  maximumDurationSeconds: number;
}

const SEEDANCE_25: SeedanceCapabilities = {
  modelId: SEEDANCE_25_MODEL_ID,
  displayName: "Seedance 2.5",
  environment: "production",
  durations: SEEDANCE_25_DURATIONS,
  minimumDurationSeconds: SEEDANCE_25_POLICY.minimumDurationSeconds,
  maximumDurationSeconds: SEEDANCE_25_POLICY.maximumDurationSeconds,
};

const SEEDANCE_FAST: SeedanceCapabilities = {
  modelId: SEEDANCE_FAST_MODEL_ID,
  displayName: "Seedance 1.0 Pro Fast",
  environment: "local",
  durations: SEEDANCE_FAST_DURATIONS,
  minimumDurationSeconds: SEEDANCE_FAST_POLICY.minimumDurationSeconds,
  maximumDurationSeconds: SEEDANCE_FAST_POLICY.maximumDurationSeconds,
};

/** Public, frozen capability records for the two known Seedance models. */
export const SEEDANCE_25_CAPABILITIES: Readonly<SeedanceCapabilities> = Object.freeze(SEEDANCE_25);
export const SEEDANCE_FAST_CAPABILITIES: Readonly<SeedanceCapabilities> = Object.freeze(SEEDANCE_FAST);

/** Default = production model (Seedance 2.5). */
export const DEFAULT_SEEDANCE_CAPABILITIES: SeedanceCapabilities = SEEDANCE_25;

export function resolveSeedanceCapabilities(
  modelId: string | null | undefined,
  environment: "production" | "local" | "staging" = "production",
): SeedanceCapabilities {
  const normalized = modelId?.trim();
  if (normalized === SEEDANCE_FAST_MODEL_ID) {
    if (environment !== "local") {
      // Fast model is local-only by policy. Fall back to 2.5 rather than throw —
      // callers handle downstream validation, but we never expose the wrong options
      // to a non-local user.
      return SEEDANCE_25;
    }
    return SEEDANCE_FAST;
  }
  if (normalized === SEEDANCE_25_MODEL_ID) return SEEDANCE_25;
  // Unknown or unset → default to production-quality.
  return SEEDANCE_25;
}

/** True iff `seconds` is in the model's accepted durations list. */
export function isSupportedDuration(
  capabilities: SeedanceCapabilities,
  seconds: number,
): boolean {
  return capabilities.durations.includes(seconds);
}

/**
 * Snap a user-chosen duration to the nearest supported value. Useful for the
 * DurationSelector when the policy widens but readiness hasn't been refreshed.
 */
export function snapToSupportedDuration(
  capabilities: SeedanceCapabilities,
  seconds: number,
): number {
  if (isSupportedDuration(capabilities, seconds)) return seconds;
  let nearest = capabilities.durations[0]!;
  let bestDelta = Math.abs(nearest - seconds);
  for (const candidate of capabilities.durations) {
    const delta = Math.abs(candidate - seconds);
    if (delta < bestDelta) {
      nearest = candidate;
      bestDelta = delta;
    }
  }
  return nearest;
}
