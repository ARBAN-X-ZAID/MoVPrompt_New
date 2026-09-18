import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadStoredVideo } from "./downloadStoredVideo";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("private stored-video download", () => {
  it("retrieves the authenticated API attachment and downloads a local blob", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("test-mp4", { headers: { "content-type": "video/mp4" } }));
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:download-test"); static revokeObjectURL = vi.fn(); });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function () {
      expect(this.isConnected).toBe(true);
      expect(this.href).toBe("blob:download-test");
      expect(this.download).toBe("campaign.mp4");
      expect(this.rel).toBe("noreferrer");
    });
    await downloadStoredVideo("https://api.example.test/output/file", "campaign.mp4");
    expect(click).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("https://api.example.test/output/file", expect.objectContaining({ credentials: "include" }));
    expect(document.querySelector('a[download="campaign.mp4"]')).toBeNull();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects invalid attachment URLs before navigation", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await expect(downloadStoredVideo("javascript:alert(1)", "campaign.mp4")).rejects.toThrow();
    expect(click).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("does not download an API error page as a video", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("denied", { status: 401 }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await expect(downloadStoredVideo("https://api.example.test/output/file", "campaign.mp4")).rejects.toThrow();
    expect(click).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
