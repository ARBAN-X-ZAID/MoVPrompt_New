import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMongoDatabase, COLLECTIONS, ensureMongoIndexes, newMongoObjectId } from "@movprompt/db";
import type { GuestClaimSnapshot } from "@movprompt/contracts";
import { objectKeys } from "@movprompt/storage";
import { R2Storage, r2StorageConfigFromEnv } from "@movprompt/storage";
import { createHash } from "node:crypto";
import { createMongoGuestClaimRepository } from "./mongo-guest-claim-repository.js";
import { createMongoAssetRepository } from "./mongo-asset-repository.js";
import { createAssetStorageGateway } from "./asset-storage.js";
import { createGuestClaimService } from "./guest-claim-service.js";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("Mongo campaign claim recovery", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_claim_recovery_test_${Date.now()}` });
  const repo = createMongoGuestClaimRepository(db);
  const userId = newMongoObjectId();
  const snapshot: GuestClaimSnapshot = {
    draftId: "c9a2985b-3166-4d5f-8114-c2c1e039286a",
    pendingGenerationId: "11111111-1111-4111-8111-111111111111",
    snapshotDigest: "a".repeat(64), title: "Claim test", mode: "advanced",
    configuration: {}, productRecipe: {}, campaignRecipe: {},
    assetManifest: [{ localAssetId: "a081d16d-6e4d-474e-9478-f1d10996daf5", ordinal: 0, kind: "product", mimeType: "image/png", sizeBytes: 68, checksumSha256: "b".repeat(64) }],
  };
  beforeAll(async () => { await db.connect(); await ensureMongoIndexes(db); });
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });

  it("replays an unchanged save and rejects altered data under the same intent or a different owner", async () => {
    const first = await repo.start({ userId, snapshot });
    expect(first.projectId).toMatch(/^[a-f0-9]{24}$/);
    expect(await repo.start({ userId, snapshot })).toEqual(first);
    await expect(repo.start({ userId, snapshot: { ...snapshot, title: "Changed" } })).rejects.toMatchObject({ code: "conflict" });
    await expect(repo.start({ userId: newMongoObjectId(), snapshot })).rejects.toMatchObject({ code: "conflict" });
    expect(await db.collection(COLLECTIONS.creatorProjects).countDocuments({ userId })).toBe(1);
  });

  it("replaces an unfinished intent once, preserves its history and finalizes only the new selected media", async () => {
    const original = await repo.resume({ userId, pendingGenerationId: snapshot.pendingGenerationId });
    const changed: GuestClaimSnapshot = { ...snapshot, pendingGenerationId: "22222222-2222-4222-8222-222222222222", snapshotDigest: "c".repeat(64), title: "Changed image", assetManifest: [{ ...snapshot.assetManifest[0]!, localAssetId: "33333333-3333-4333-8333-333333333333" }] };
    const [first, duplicate] = await Promise.all([repo.start({ userId, snapshot: changed }), repo.start({ userId, snapshot: changed })]);
    expect(first).toEqual(duplicate);
    expect(first.projectId).toBe(original.projectId);
    expect(first.nextAsset?.localAssetId).toBe(changed.assetManifest[0]!.localAssetId);
    expect(await db.collection(COLLECTIONS.creatorProjects).countDocuments({ userId })).toBe(1);
    const history = await db.collection(COLLECTIONS.guestClaimOperations).findOne({ id: original.id });
    expect(history?.snapshot).toEqual(snapshot);
    expect(history?.originalDraftId).toBe(snapshot.draftId);
    await expect(repo.finalize({ userId, pendingGenerationId: snapshot.pendingGenerationId })).rejects.toMatchObject({ code: "not_found" });
    await expect(repo.finalize({ userId, pendingGenerationId: changed.pendingGenerationId })).rejects.toMatchObject({ code: "assets_pending" });
    const asset = changed.assetManifest[0]!;
    await repo.markAssetVerified({ userId, pendingGenerationId: changed.pendingGenerationId, localAssetId: asset.localAssetId, bucket: "movprompt", objectKey: objectKeys.creatorAsset({ userId, projectId: first.projectId, assetId: asset.localAssetId, kind: asset.kind, checksumSha256: asset.checksumSha256 }) });
    const [receipt, repeated] = await Promise.all([repo.finalize({ userId, pendingGenerationId: changed.pendingGenerationId }), repo.finalize({ userId, pendingGenerationId: changed.pendingGenerationId })]);
    expect(receipt.project.id).toBe(first.projectId);
    expect(repeated.project.currentWorkingVersionId).toBe(receipt.project.currentWorkingVersionId);
    expect(receipt.assetManifest).toEqual(changed.assetManifest);
    expect(await db.collection(COLLECTIONS.creatorProjectVersions).countDocuments({ projectId: first.projectId })).toBe(1);
    const saved = await db.db.collection(COLLECTIONS.creatorProjectAssets).findOne({ projectId: (await db.db.collection(COLLECTIONS.creatorProjects).findOne({ title: changed.title }))!._id });
    expect(saved?._id.toHexString()).toMatch(/^[a-f0-9]{24}$/);
    expect(saved?.id).toBeUndefined();
    await expect(repo.start({ userId, snapshot: { ...changed, pendingGenerationId: "44444444-4444-4444-8444-444444444444" } })).rejects.toMatchObject({ code: "conflict" });
  });

  it("does not replace an accepted version when finalization races with an edited draft", async () => {
    const original = { ...snapshot, draftId: newMongoObjectId(), pendingGenerationId: newMongoObjectId(), assetManifest: [] };
    const operation = await repo.start({ userId, snapshot: original });
    const changed = { ...original, title: "Edited concurrently", pendingGenerationId: newMongoObjectId(), snapshotDigest: "d".repeat(64) };
    const [finalized, replaced] = await Promise.allSettled([
      repo.finalize({ userId, pendingGenerationId: original.pendingGenerationId }),
      repo.start({ userId, snapshot: changed }),
    ]);
    if (finalized.status === "fulfilled") {
      expect(replaced.status).toBe("rejected");
      expect((replaced as PromiseRejectedResult).reason).toMatchObject({ code: "conflict" });
      expect(finalized.value.project.title).toBe(original.title);
    } else {
      expect(finalized.reason).toMatchObject({ code: "not_found" });
      expect(replaced.status).toBe("fulfilled");
      const receipt = await repo.finalize({ userId, pendingGenerationId: changed.pendingGenerationId });
      expect(receipt.project.title).toBe(changed.title);
    }
    expect(await db.collection(COLLECTIONS.creatorProjectVersions).countDocuments({ projectId: operation.projectId })).toBe(1);
  });

  it.skipIf(process.env.MOVPROMPT_TEST_R2 !== "true")("uploads and completes an actual R2 image through the API using MongoDB ObjectIds", async () => {
    const bytes = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGP8wwACLGCSAQANBAECv1AVswAAAABJRU5ErkJggg==", "base64"));
    const image = { ...snapshot.assetManifest[0]!, localAssetId: "55555555-5555-4555-8555-555555555555", sizeBytes: bytes.byteLength, checksumSha256: createHash("sha256").update(bytes).digest("hex") };
    const testSnapshot = { ...snapshot, draftId: "66666666-6666-4666-8666-666666666666", pendingGenerationId: "77777777-7777-4777-8777-777777777777", assetManifest: [image] };
    const operation = await repo.start({ userId, snapshot: testSnapshot });
    const storage = new R2Storage(r2StorageConfigFromEnv());
    const claims = createGuestClaimService({ repository: repo });
    const app = createApi({ config: loadApiConfig({ APP_ENV: "test", FEATURE_AUTHENTICATION: "true", FEATURE_ASSETS: "true" }),
      authGateway: { handle: async () => new Response(), getSession: async () => ({ user: { id: userId, email: "claim-test@example.test", name: "Test", emailVerified: true }, session: { id: "test" } }) },
      assetRepository: createMongoAssetRepository(db), assetStorage: createAssetStorageGateway(storage), guestClaimService: claims,
    });
    let objectKey: string | undefined;
    try {
      const reservation = await app.request(`/api/v1/projects/${operation.projectId}/assets/upload-url`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "test-image-reservation" }, body: JSON.stringify({ assetId: image.localAssetId, kind: image.kind, metadata: { mimeType: image.mimeType, sizeBytes: image.sizeBytes, checksumSha256: image.checksumSha256 } }) });
      expect(reservation.status).toBe(201);
      const reserved = await reservation.json();
      objectKey = reserved.asset.objectKey;
      expect(reserved.asset.id).toMatch(/^[a-f0-9]{24}$/);
      expect(reserved.asset.id).not.toBe(image.localAssetId);
      const base = `/api/v1/projects/${operation.projectId}/assets/${reserved.asset.id}`;
      expect((await app.request(`${base}/content`, { method: "PUT", headers: { "content-type": image.mimeType }, body: bytes })).status).toBe(201);
      const complete = await app.request(`${base}/complete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pendingGenerationId: testSnapshot.pendingGenerationId, localAssetId: image.localAssetId }) });
      expect(complete.status).toBe(200);
      expect((await complete.json()).asset.id).toBe(reserved.asset.id);
      const receipt = await claims.finalizeClaim({ userId, pendingGenerationId: testSnapshot.pendingGenerationId });
      expect(receipt.status).toBe("ready");
      expect(receipt.assetManifest[0]?.localAssetId).toBe(image.localAssetId);
      const preview = await app.request(`${base}/download-url`);
      expect(preview.status).toBe(200);
      const signed = await preview.json();
      const retrieved = await fetch(signed.download.url);
      expect(retrieved.status).toBe(200);
      expect(createHash("sha256").update(new Uint8Array(await retrieved.arrayBuffer())).digest("hex")).toBe(image.checksumSha256);
    } finally {
      // Only this test's newly created image is removed; existing storage is untouched.
      if (objectKey) await storage.delete(storage.assetsBucket, objectKey);
    }
  }, 30_000);
});
