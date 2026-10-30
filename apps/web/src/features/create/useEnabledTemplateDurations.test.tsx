import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/config/features", () => ({ isFeatureEnabled: () => true }));
vi.mock("@/lib/api/portableApiClient", () => ({
  portableCreatorApi: { getTemplate: vi.fn() },
}));
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { useEnabledTemplateDurations } from "./useEnabledTemplateDurations";
afterEach(cleanup);
it("filters the pinned recipe through live availability and rechecks on focus", async () => {
  vi.mocked(portableCreatorApi.getTemplate).mockResolvedValue({
    supportedDurations: [8, 15],
  } as never);
  const { result } = renderHook(() =>
    useEnabledTemplateDurations("jewelry-product-showcase", [8, 15, 20]),
  );
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.durations).toEqual([8, 15]);
  vi.mocked(portableCreatorApi.getTemplate).mockRejectedValue(
    new Error("Template disabled"),
  );
  act(() => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(result.current.ready).toBe(false));
});
