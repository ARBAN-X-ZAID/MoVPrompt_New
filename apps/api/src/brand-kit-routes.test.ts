import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { defaultProductModelAdSettings } from "@movprompt/contracts";
import { createApi } from "./app.js";
import type { BrandKitRepository } from "./brand-kit-repository.js";
import type { AuthGateway } from "./auth-gateway.js";
const userId = "11111111-1111-4111-8111-111111111111";
const auth: AuthGateway = { handle: vi.fn(), getSession: vi.fn(async () => ({ user: { id: userId, email: "test@example.test", emailVerified: true, name: "Test" }, session: { id: "session" } })) };
const snapshot = { ...defaultProductModelAdSettings().brandKit, name: "Test brand" };
const record = { id: "a".repeat(24), revision: 1, snapshot, updatedAt: "2026-10-14T00:00:00Z" };
function repo(): BrandKitRepository { return { find: vi.fn(async () => record), list: vi.fn(async () => [record]), save: vi.fn(async () => record), archive: vi.fn(async () => true) }; }
function body(input: unknown, key = "save-test") { return { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(input) }; }
describe("owner-scoped brand-kit API", () => {
  it("requires authentication before returning the library", async () => {
    expect((await createApi({ brandKitRepository: repo() }).request("/api/v1/brand-kits")).status).toBe(401);
  });
  it("lists only the current owner's library and saves a validated snapshot", async () => {
    const repository = repo(); const app = createApi({ authGateway: auth, brandKitRepository: repository });
    expect((await app.request("/api/v1/brand-kits")).status).toBe(200); expect(repository.list).toHaveBeenCalledWith(userId);
    expect((await app.request("/api/v1/brand-kits", body({ snapshot }))).status).toBe(200); expect(repository.save).toHaveBeenCalledWith(userId, "save-test", { snapshot });
  });
  it.each([{ ...snapshot, website: "javascript:alert(1)" }, { ...snapshot, primaryColor: "red" }, { ...snapshot, name: "" }, { ...snapshot, logoChecksum: "b".repeat(64) }])("rejects invalid or unverified brand data before storage", async invalid => {
    const repository = repo(); const app = createApi({ authGateway: auth, brandKitRepository: repository });
    expect((await app.request("/api/v1/brand-kits", body({ snapshot: invalid }))).status).toBe(400); expect(repository.save).not.toHaveBeenCalled();
  });
  it("rejects a logo without verified owner evidence", async () => {
    const repository = repo(); const app = createApi({ authGateway: auth, brandKitRepository: repository });
    const response = await app.request("/api/v1/brand-kits", body({ snapshot: { ...snapshot, logoChecksum: "b".repeat(64) }, logoSource: { projectId: "c".repeat(24), assetId: "d".repeat(24), checksum: "b".repeat(64) } }));
    expect(response.status).toBe(400); expect(repository.save).not.toHaveBeenCalled();
  });
  it("surfaces revision and idempotency conflicts without overwriting", async () => {
    for (const message of ["brand_kit_revision_conflict", "brand_kit_idempotency_conflict"]) {
      const repository = repo(); vi.mocked(repository.save).mockRejectedValue(new Error(message));
      expect((await createApi({ authGateway: auth, brandKitRepository: repository }).request("/api/v1/brand-kits", body({ snapshot }))).status).toBe(409);
    }
  });
  it("keeps the reusable logo in its own private library namespace", async () => {
    const bytes = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWkQAAAAASUVORK5CYII=", "base64"));
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const logoSource = { projectId: "c".repeat(24), assetId: "d".repeat(24), checksum };
    const kitSnapshot = { ...snapshot, logoChecksum: checksum };
    const repository = repo(); vi.mocked(repository.find).mockResolvedValue({ ...record, snapshot: kitSnapshot, logoSource });
    const assets = { isProjectOwned: vi.fn(async () => true), createOrFind: vi.fn(), findOwned: vi.fn(async () => ({ id: logoSource.assetId, projectId: logoSource.projectId, userId, kind: "logo" as const, bucket: "assets", objectKey: `users/${userId}/projects/${logoSource.projectId}/logo.png`, mimeType: "image/png", sizeBytes: bytes.length, checksumSha256: checksum })) };
    const storage = { assetsBucket: "assets", outputsBucket: "outputs", signUpload: vi.fn(), signDownload: vi.fn(), get: vi.fn(async () => ({ body: bytes, contentType: "image/png" })), put: vi.fn(async input => ({ bucket: input.bucket, key: input.key })), head: vi.fn(), checkBuckets: vi.fn() };
    const app = createApi({ authGateway: auth, brandKitRepository: repository, assetRepository: assets, assetStorage: storage });
    expect((await app.request("/api/v1/brand-kits", body({ snapshot: kitSnapshot, logoSource }))).status).toBe(200);
    expect(storage.put).toHaveBeenCalledWith(expect.objectContaining({ key: `users/${userId}/brand-kits/logos/${checksum}`, body: bytes }));
    const download = await app.request(`/api/v1/brand-kits/${record.id}/logo`);
    expect(download.status).toBe(200); expect(download.headers.get("cache-control")).toBe("private, no-store");
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
    expect(repository.find).toHaveBeenCalledWith(userId, record.id);
    storage.get.mockResolvedValueOnce({ body: new Uint8Array([1]), contentType: "image/png" });
    storage.put.mockClear(); vi.mocked(repository.save).mockClear();
    expect((await app.request("/api/v1/brand-kits", body({ snapshot: kitSnapshot, logoSource }))).status).toBe(400);
    expect(storage.put).not.toHaveBeenCalled(); expect(repository.save).not.toHaveBeenCalled();
  });
});
