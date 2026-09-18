/**
 * useCapabilities — fetch and cache the public video capabilities from
 * `/api/v1/capabilities/video`. Falls back to the static Seedance 2.5 list
 * baked into `@movprompt/creative-engine` if the API is unreachable.
 *
 * Cache: module-level single-flight, shared by every component that calls
 * `useCapabilities()` in the same session. No re-fetch on remount; the
 * same response is reused for the lifetime of the page.
 */
import { useEffect, useState } from "react";
import {
  DEFAULT_SEEDANCE_CAPABILITIES,
  type SeedanceCapabilities,
} from "@movprompt/creative-engine";
import { portableCreatorApi } from "@/lib/api/portableApiClient";

export interface ResolvedCapabilities {
  /** The model the server says is active right now. */
  active: SeedanceCapabilities;
  /** All known models from the server (production + local). */
  models: readonly SeedanceCapabilities[];
  /** True if the data came from the live API; false if we fell back. */
  live: boolean;
  /** Last error message, if the live fetch failed and we used the fallback. */
  fallbackReason: string | null;
}

const FALLBACK: ResolvedCapabilities = {
  active: DEFAULT_SEEDANCE_CAPABILITIES,
  models: [DEFAULT_SEEDANCE_CAPABILITIES],
  live: false,
  fallbackReason: null,
};

let cache: Promise<ResolvedCapabilities> | undefined;

function loadCapabilities(): Promise<ResolvedCapabilities> {
  cache ??= (async () => {
    try {
      const response = await portableCreatorApi.videoCapabilities();
      const models = response.models as SeedanceCapabilities[];
      const active =
        models.find((model) => model.modelId === response.activeModelId) ??
        models[0] ??
        DEFAULT_SEEDANCE_CAPABILITIES;
      return {
        active,
        models: models.length ? models : [DEFAULT_SEEDANCE_CAPABILITIES],
        live: true,
        fallbackReason: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "capabilities endpoint unavailable";
      return {
        ...FALLBACK,
        fallbackReason: message,
      };
    }
  })();
  return cache;
}

/**
 * Returns the resolved video capabilities. Safe to call from many components
 * in the same session — only one network request is made.
 */
export function useCapabilities(): ResolvedCapabilities {
  const [state, setState] = useState<ResolvedCapabilities>(() => ({
    ...FALLBACK,
  }));
  useEffect(() => {
    let active = true;
    void loadCapabilities().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return state;
}

/** True if `seconds` is in the active model's accepted durations. */
export function isDurationSupported(capabilities: ResolvedCapabilities, seconds: number) {
  return capabilities.active.durations.includes(seconds);
}

/**
 * Pick the closest supported duration for the active model when a persisted
 * length is no longer in the live list.
 */
export function snapDuration(capabilities: ResolvedCapabilities, seconds: number): number {
  const list = capabilities.active.durations;
  if (list.includes(seconds)) return seconds;
  let nearest = list[0]!;
  let bestDelta = Math.abs(nearest - seconds);
  for (const candidate of list) {
    const delta = Math.abs(candidate - seconds);
    if (delta < bestDelta) {
      nearest = candidate;
      bestDelta = delta;
    }
  }
  return nearest;
}

/** Test-only: drop the session-level cache so the next useCapabilities() re-fetches. */
export function __resetCapabilitiesCacheForTests() {
  cache = undefined;
}
