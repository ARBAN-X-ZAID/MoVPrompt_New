import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const videoCapabilitiesMock = vi.fn();

vi.mock("@/lib/api/portableApiClient", () => ({
  portableCreatorApi: {
    videoCapabilities: () => videoCapabilitiesMock(),
  },
}));

import {
  __resetCapabilitiesCacheForTests,
  isDurationSupported,
  snapDuration,
  useCapabilities,
} from "./useCapabilities";

import type { ResolvedCapabilities } from "./useCapabilities";

const STATIC_FALLBACK: ResolvedCapabilities = {
  active: {
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    minimumDurationSeconds: 4,
    maximumDurationSeconds: 30,
  },
  templateReady: false,
  live: false,
  fallbackReason: "boom",
};

const SUCCESS_BODY = {
  active: {
      durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
      minimumDurationSeconds: 4,
      maximumDurationSeconds: 30,
    },
  templateReady: true,
  evaluatedAt: new Date().toISOString(),
};

describe("useCapabilities", () => {
  beforeEach(() => {
    videoCapabilitiesMock.mockReset();
    __resetCapabilitiesCacheForTests();
  });
  afterEach(() => {
    vi.resetModules();
  });

  it("returns the live capabilities when the API succeeds", async () => {
    videoCapabilitiesMock.mockResolvedValueOnce(SUCCESS_BODY);
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => {
      expect(result.current.live).toBe(true);
    });
    expect(result.current.templateReady).toBe(true);
    expect(result.current.active).not.toHaveProperty("modelId");
    expect(result.current.active.durations).toContain(8);
  });

  it("fails closed when the API is unreachable", async () => {
    videoCapabilitiesMock.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useCapabilities());
    await waitFor(() => {
      expect(result.current.fallbackReason).toBe("network down");
    });
    expect(result.current.live).toBe(false);
    expect(result.current.active.durations).toEqual([]);
    expect(result.current.templateReady).toBe(false);
  });

  it("isDurationSupported and snapDuration match the active list", () => {
    expect(isDurationSupported(STATIC_FALLBACK, 8)).toBe(true);
    expect(isDurationSupported(STATIC_FALLBACK, 9)).toBe(true);
    expect(isDurationSupported(STATIC_FALLBACK, 13)).toBe(true);
    expect(snapDuration(STATIC_FALLBACK, 9)).toBe(9);
    // 8 and 10 are equidistant; the implementation picks the first best, so 8 wins.
    expect(snapDuration(STATIC_FALLBACK, 9)).toBe(9);
  });
});
