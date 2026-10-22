import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { deviceLibrary } from "./deviceLibrary";
import { AutomaticAssetsRuntime } from "./automaticAssets";
import { drainAutomaticPhotos, queueAutomaticPhoto } from "./automaticAssetQueue";
import { putGuestAsset, deleteGuestDraft } from "../create/guestDraftStore";
import { libraryApi } from "./libraryApi";
const auth = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user, loading: false }) }));
vi.mock("@/config/features", () => ({ isFeatureEnabled: () => true }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("./libraryApi", () => ({ libraryApi: { status: vi.fn(async () => true), assertOwner: vi.fn(async () => ({ ownerId: "owner-a" })), upload: vi.fn(async () => "upload-id"), save: vi.fn(), autoSave: vi.fn() } }));
const checksum = "c".repeat(64);
const file = () => new File(["photo"], "perfume.png", { type: "image/png" });
const entry = () => ({ id: "a".repeat(24), kind: "product" as const, revision: 1, approved: false, deleted: false, name: "perfume", photos: [{ id: "b".repeat(24), checksumSha256: checksum }] });
beforeEach(async () => {
  for (const owner of [null, "owner-a", "owner-b"]) for (const row of await deviceLibrary.all(owner)) await deviceLibrary.remove(row.id);
  auth.user = null; vi.clearAllMocks(); vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 2, height: 2, close: vi.fn() }))); vi.mocked(libraryApi.save).mockResolvedValue({ ...entry(), approved: true, revision: 2 } as never); vi.mocked(libraryApi.assertOwner).mockResolvedValue({ ownerId: "owner-a" }); vi.mocked(libraryApi.autoSave).mockResolvedValue(entry() as never);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("automatic asset durability and account queue", () => {
  it("deduplicates guest photos by type, retains them independently and requires approval", async () => {
    const first = await deviceLibrary.add(file(), "product", checksum, null);
    await deviceLibrary.add(file(), "product", checksum, null);
    await deviceLibrary.add(file(), "presenter", checksum, null);
    expect(await deviceLibrary.all(null)).toHaveLength(2);
    expect(first.approved).toBe(false); expect(first.status).toBe("device"); expect(first.blob).toBeDefined();
    expect(await deviceLibrary.all("owner-a")).toEqual([]);
    await deviceLibrary.put({ ...first, approved: true });
    expect((await deviceLibrary.get(first.id))?.approved).toBe(true);
  });
  it("keeps device photos when their original draft and its blobs are deleted", async () => {
    const draftId = crypto.randomUUID(); await putGuestAsset(draftId, file());
    const saved = await deviceLibrary.add(file(), "product", checksum, null);
    await deleteGuestDraft(draftId);
    expect((await deviceLibrary.get(saved.id))?.blob).toBeDefined();
  });
  it("does not adopt guest photos when the authenticated account no longer matches", async () => {
    await deviceLibrary.add(file(), "product", checksum, null);
    vi.mocked(libraryApi.assertOwner).mockRejectedValue(new Error("Account changed"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    auth.user = { id: "owner-a" }; render(<AutomaticAssetsRuntime />);
    await waitFor(() => expect(libraryApi.assertOwner).toHaveBeenCalled()); await drainAutomaticPhotos();
    expect(await deviceLibrary.all(null)).toHaveLength(1); expect(libraryApi.upload).not.toHaveBeenCalled(); warning.mockRestore();
  });
  it("retains an offline upload and resumes after reconnecting", async () => {
    const offline = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    auth.user = { id: "owner-a" }; render(<AutomaticAssetsRuntime />);
    await queueAutomaticPhoto(file(), "product", checksum);
    expect(libraryApi.upload).not.toHaveBeenCalled(); expect((await deviceLibrary.all("owner-a"))[0]?.blob).toBeDefined();
    offline.mockRestore(); window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(libraryApi.autoSave).toHaveBeenCalled()); await drainAutomaticPhotos();
    expect((await deviceLibrary.all("owner-a"))[0]?.status).toBe("saved");
  });
  it("rejects empty files without creating a saved item", async () => {
    await expect(queueAutomaticPhoto(new File([], "empty.png", { type: "image/png" }), "product", checksum)).rejects.toThrow();
    expect(await deviceLibrary.all(null)).toEqual([]);
  });
  it("does not let an old save receipt overwrite a fresh upload of the same file", async () => {
    const first = await deviceLibrary.add(file(), "product", checksum, "owner-a");
    const second = await deviceLibrary.add(file(), "product", checksum, "owner-a");
    expect(first.operationKey).not.toBe(second.operationKey);
    expect(await deviceLibrary.replaceIfCurrent({ ...first, status: "saved", blob: undefined })).toBe(false);
    expect((await deviceLibrary.get(first.id))?.blob).toBeDefined(); expect((await deviceLibrary.get(first.id))?.operationKey).toBe(second.operationKey);
  });
  it("transfers a guest's explicit approval only for the exact single-photo revision", async () => {
    const row = await deviceLibrary.add(file(), "product", checksum, null); await deviceLibrary.put({ ...row, approved: true });
    auth.user = { id: "owner-a" }; render(<AutomaticAssetsRuntime />);
    await waitFor(() => expect(libraryApi.save).toHaveBeenCalled()); await drainAutomaticPhotos();
    expect(libraryApi.save).toHaveBeenCalledWith(expect.objectContaining({ approved: true, expectedRevision: 1 }), expect.any(String), "owner-a");
  });
  it("does not approve unseen extra photos when a guest photo matches a multi-photo account entry", async () => {
    const row = await deviceLibrary.add(file(), "product", checksum, null); await deviceLibrary.put({ ...row, approved: true });
    vi.mocked(libraryApi.autoSave).mockResolvedValue({ ...entry(), photos: [...entry().photos, { id: "d".repeat(24), checksumSha256: "d".repeat(64) }] } as never);
    auth.user = { id: "owner-a" }; render(<AutomaticAssetsRuntime />);
    await waitFor(() => expect(libraryApi.autoSave).toHaveBeenCalled()); await drainAutomaticPhotos(); expect(libraryApi.save).not.toHaveBeenCalled();
    expect((await deviceLibrary.all("owner-a"))[0]?.status).toBe("saved");
  });
  it("atomically claims guest photos into only the first account", async () => {
    await deviceLibrary.add(file(), "product", checksum, null);
    await deviceLibrary.adopt("owner-a"); await deviceLibrary.adopt("owner-b");
    expect(await deviceLibrary.all(null)).toEqual([]);
    expect(await deviceLibrary.all("owner-a")).toHaveLength(1); expect(await deviceLibrary.all("owner-b")).toEqual([]);
  });
  it("saves guests immediately without contacting account storage", async () => {
    render(<AutomaticAssetsRuntime />);
    await queueAutomaticPhoto(file(), "product", checksum);
    expect(await deviceLibrary.all(null)).toHaveLength(1); expect(libraryApi.upload).not.toHaveBeenCalled();
  });
  it("removes the local blob only after a verified account receipt", async () => {
    await deviceLibrary.add(file(), "product", checksum, null);
    auth.user = { id: "owner-a" }; render(<AutomaticAssetsRuntime />);
    await waitFor(() => expect(libraryApi.autoSave).toHaveBeenCalled());
    await drainAutomaticPhotos();
    const [saved] = await deviceLibrary.all("owner-a");
    expect(saved?.status).toBe("saved"); expect(saved?.blob).toBeUndefined(); expect(saved?.receipt?.checksumSha256).toBe(checksum);
    expect(libraryApi.upload).toHaveBeenCalledWith(expect.any(File), expect.any(String), "owner-a");
    expect(saved?.receipt).not.toHaveProperty("librarySource");
  });
  it("retains failed copies and retries the same idempotent operation", async () => {
    vi.mocked(libraryApi.autoSave).mockRejectedValueOnce(new Error("offline"));
    auth.user = { id: "owner-a" }; render(<AutomaticAssetsRuntime />);
    await waitFor(() => expect(libraryApi.status).toHaveBeenCalled());
    await queueAutomaticPhoto(file(), "product", checksum); await drainAutomaticPhotos();
    const [failed] = await deviceLibrary.all("owner-a"); expect(failed?.status).toBe("failed"); expect(failed?.blob).toBeDefined();
    await drainAutomaticPhotos(true);
    const [saved] = await deviceLibrary.all("owner-a"); expect(saved?.status).toBe("saved"); expect(saved?.operationKey).toBe(failed?.operationKey);
  });
});
