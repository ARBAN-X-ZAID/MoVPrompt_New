import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicTemplate } from "@movprompt/contracts";
import { getCreatorTemplate } from "./templates";

const api = vi.hoisted(() => ({ getTemplate: vi.fn() }));
vi.mock("@/lib/api/portableApiClient", () => ({ portableCreatorApi: api }));
import { useTemplateCampaignOptions } from "./useTemplateCampaignOptions";

const published = { goals: ["launch"], supportedLanguages: ["en"], supportedRatios: ["9:16"] } as PublicTemplate;
describe("published template settings", () => {
  it("uses API restrictions rather than bundled choices and waits for them before being ready", async () => {
    let finish!: (value: PublicTemplate) => void;
    api.getTemplate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useTemplateCampaignOptions(getCreatorTemplate("app-service"), true));
    expect(result.current.ready).toBe(false);
    await act(async () => { finish(published); });
    expect(result.current.ready).toBe(true);
    expect(result.current.options.goals).toEqual(["launch"]);
    expect(result.current.options.languages).toEqual(["en"]);
    expect(result.current.options.ratios).toEqual(["9:16"]);
  });

  it("fails closed on catalog errors and can retry", async () => {
    api.getTemplate.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(published);
    const { result } = renderHook(() => useTemplateCampaignOptions(getCreatorTemplate("app-service"), true));
    await waitFor(() => expect(result.current.error).toContain("supported settings"));
    expect(result.current.ready).toBe(false);
    await act(async () => { result.current.retry(); });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.error).toBe("");
  });

  it("ignores a delayed response for a previously selected template", async () => {
    let finish!: (value: PublicTemplate) => void;
    api.getTemplate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ ...published, goals: ["bookings"] });
    const { result, rerender } = renderHook(({ id }) => useTemplateCampaignOptions(getCreatorTemplate(id), true), { initialProps: { id: "app-service" } });
    rerender({ id: "salon-booking-offer" });
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { finish(published); });
    expect(result.current.options.goals).toEqual(["bookings"]);
  });
});
