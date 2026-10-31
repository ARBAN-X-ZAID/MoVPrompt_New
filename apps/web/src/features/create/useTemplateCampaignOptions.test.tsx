import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicTemplate } from "@movprompt/contracts";
import { getCreativeTemplate } from "@movprompt/creative-engine";
import { getCreatorTemplate } from "./templates";

const api = vi.hoisted(() => ({ getTemplate: vi.fn(), getTemplateVersion: vi.fn() }));
vi.mock("@/lib/api/portableApiClient", () => ({ portableCreatorApi: api }));
import { useTemplateCampaignOptions } from "./useTemplateCampaignOptions";

const published = { slug: "app-service", name: { en: "Owner name", ar: "اسم المالك" }, description: { en: "Owner copy", ar: "وصف المالك" }, outcome: "Owner outcome", category: "digital-service", discoveryCategory: "other", tags: ["owner"], goals: ["launch"], supportedLanguages: ["en"], supportedRatios: ["9:16"] } as PublicTemplate;
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

  it("shows owner settings and refreshes them when the tab regains focus", async () => {
    api.getTemplate.mockResolvedValueOnce(published).mockResolvedValueOnce({ ...published, supportedLanguages: ["ar"] });
    const { result } = renderHook(() => useTemplateCampaignOptions(getCreatorTemplate("app-service"), true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.template).toMatchObject({ name: "Owner name", description: "Owner copy" });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(result.current.options.languages).toEqual(["ar"]));
  });

  it("keeps loaded settings when a background refresh fails", async () => {
    api.getTemplate.mockResolvedValueOnce(published).mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useTemplateCampaignOptions(getCreatorTemplate("app-service"), true));
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { result.current.refresh(); });
    expect(result.current.ready).toBe(true);
    expect(result.current.error).toBe("");
  });

  it("says a template was unpublished instead of offering a retry that cannot help", async () => {
    api.getTemplate.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }));
    const { result } = renderHook(() => useTemplateCampaignOptions(getCreatorTemplate("app-service"), true));
    await waitFor(() => expect(result.current.unavailable).toBe(true));
  });

  it("reads live languages for a pinned draft without replacing its recipe", async () => {
    const pinned = { ...getCreatorTemplate("premium-phone-reveal"), versionId: "66e6d8e7c51fa82b8e426931", definition: getCreativeTemplate("premium-phone-reveal") };
    api.getTemplateVersion.mockResolvedValueOnce({ ...published, slug: "premium-phone-reveal", supportedLanguages: ["ar"] });
    const { result } = renderHook(() => useTemplateCampaignOptions(pinned, true));
    expect(result.current.ready).toBe(true);
    await waitFor(() => expect(result.current.options.languages).toEqual(["ar"]));
    expect(api.getTemplateVersion).toHaveBeenCalledWith(pinned.versionId);
    expect(result.current.template).toMatchObject({ name: "Owner name", definition: pinned.definition, versionId: pinned.versionId });
    expect(result.current.options.ratios).toEqual(pinned.definition.supportedRatios);
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
