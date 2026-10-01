/**
 * useCapabilities — fetch and cache the public video capabilities from
 * `/api/v1/capabilities/video`. Fails closed if the API is unreachable.
 *
 * Cache: module-level single-flight, shared by every component that calls
 * `useCapabilities()` in the same session. Refresh on focus and each minute
 * so recovery never requires discarding the buyer's selected duration.
 */
import { useEffect, useState } from "react";
import type { VideoModelCapabilities } from "@movprompt/contracts";
import { portableCreatorApi } from "@/lib/api/portableApiClient";

export interface ResolvedCapabilities {
  /** Public delivery capabilities, without provider identities. */
  active: VideoModelCapabilities;
  /** Required template model and generation readiness have been verified. */
  templateReady: boolean;
  /** True if the data came from the live API; false if we fell back. */
  live: boolean;
  /** Last error message, if the live fetch failed and we used the fallback. */
  fallbackReason: string | null;
}

const FALLBACK: ResolvedCapabilities = {
  active: { durations: [], minimumDurationSeconds: 4, maximumDurationSeconds: 30 },
  templateReady: false,
  live: false,
  fallbackReason: null,
};

let cache: Promise<ResolvedCapabilities> | undefined;

function loadCapabilities(): Promise<ResolvedCapabilities> {
  cache ??= (async () => {
    try {
      const response = await portableCreatorApi.videoCapabilities();
      return {
        active: response.active,
        templateReady: response.templateReady,
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
    const refresh = () => {
      cache = undefined;
      void loadCapabilities().then(next => { if (active) setState(next); });
    };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
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
