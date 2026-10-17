import { afterEach, describe, expect, it, vi } from "vitest";
import { libraryApi } from "./libraryApi";
vi.mock("@/config/features", () => ({ isFeatureEnabled: () => true }));
vi.mock("@/lib/api/portableApiClient", () => ({ apiOrigin: () => "https://api.example.test", request: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
describe("public library availability", () => {
  it("does not depend on cross-site session credentials or private API transport", async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ enabled: true }) })); vi.stubGlobal("fetch", fetch);
    expect(await libraryApi.status()).toBe(true);
    expect(fetch).toHaveBeenCalledWith("https://api.example.test/api/v1/reference-library/status", { credentials: "omit" });
  });
  it("honors a disabled server flag and rejects invalid availability responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })));
    expect(await libraryApi.status()).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: "true" }) })));
    await expect(libraryApi.status()).rejects.toThrow();
  });
});
