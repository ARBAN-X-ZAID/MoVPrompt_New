import { AD_STUDIO_BRAND_AD_RECIPE } from "@movprompt/creative-engine";
import { createMongoGuestClaimRepository } from "./mongo-guest-claim-repository.js";
import { createGuestClaimService } from "./guest-claim-service.js";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { createMongoDatabase, createReferenceLibraryService, createMongoGenerationService, ensureMongoTemplateCatalog, assertLibraryConfiguration, ensureMongoIndexes, COLLECTIONS, newMongoObjectId, type LibraryStorage } from "@movprompt/db";
import { R2Storage, r2StorageConfigFromEnv } from "@movprompt/storage";
import type { LibraryEntry, LibrarySource, SaveLibraryEntry } from "@movprompt/contracts";
import { GuestClaimSnapshotSchema, TemplateCampaignPayloadSchema } from "@movprompt/contracts";
import { createAssetContentVerifier } from "./asset-content-verifier.js";
import { adStudioBrandAdFixture } from "./ad-studio-brand-ad.test-fixture.js";
import { createApi } from "./app.js";
import type { AuthGateway } from "./auth-gateway.js";

const png = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAAEElEQVR4nGP8wwACLGCSAQANBAECv1AVswAAAABJRU5ErkJggg==", "base64"));
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("private reference libraries: real MongoDB transactions, unpaid", () => {
  const database = createMongoDatabase({ uri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_library_test_${Date.now()}` });
  const owner = newMongoObjectId(), other = newMongoObjectId();
  const objects = new Map<string, Uint8Array>(); let failCopy = false;
  const storage: LibraryStorage = { assetsBucket: "private", get: async ({ key }) => { const body = objects.get(key); if (!body) throw new Error("not_found"); return { body }; }, put: async ({ key, body }) => { if (failCopy && key.includes("/projects/")) throw new Error("interrupted_copy"); objects.set(key, new Uint8Array(body)); } };
  const verify = createAssetContentVerifier().verify;
  const service = createReferenceLibraryService({ database, storage, verify });
  let first: LibraryEntry; let input: SaveLibraryEntry;
  beforeAll(async () => { await database.connect(); await ensureMongoIndexes(database); });
  afterAll(async () => { await database.db.dropDatabase(); await database.close(); });
  async function upload(body = png, name = "photo.png") {
    const metadata = { name, mimeType: "image/png" as const, sizeBytes: body.byteLength, checksumSha256: sha(body) };
    const result = await service.allocateUpload(owner, randomUUID(), metadata);
    await service.writeUpload(owner, result.id, body); return result.id;
  }
  function source(entry: LibraryEntry): LibrarySource { return { entryId: entry.id, photoId: entry.photos[0]!.id, kind: entry.kind, revision: entry.revision, sizeBytes: entry.photos[0]!.sizeBytes }; }
  async function campaign(entry: LibraryEntry, accepted = false, running = false) {
    const id = newMongoObjectId(), versionId = newMongoObjectId(); const now = new Date();
    await database.collection(COLLECTIONS.creatorProjects).insertOne({ id, userId: owner, title: "Independent campaign", mode: "template", status: "ready", currentWorkingVersionId: versionId, currentAcceptedVersionId: accepted ? versionId : null, deletedAt: null, createdAt: now, updatedAt: now });
    const copied = await service.attach(owner, id, source(entry), entry.photos[0]!.checksumSha256);
    const payload = adStudioBrandAdFixture(); const creator = payload.configuration.creatorProject;
    Object.assign(creator, { id });
    creator.product.images = [{ id: copied.assetId, name: "photo.png", url: "", storagePath: copied.objectKey, mimeType: "image/png", checksum: entry.photos[0]!.checksumSha256, source: "upload", referenceRole: "subject", selected: true, librarySource: source(entry) }];
    creator.source.assetKeys = [copied.objectKey];
    payload.configuration.generation.references = [{ objectKey: copied.objectKey, mimeType: "image/png", referenceRole: "subject", librarySource: source(entry) }];
    payload.productRecipe.images = [{ assetId: copied.assetId, name: "photo.png", objectKey: copied.objectKey, mimeType: "image/png", checksumSha256: entry.photos[0]!.checksumSha256, referenceRole: "subject", selected: true, librarySource: source(entry) }];
    await database.collection(COLLECTIONS.creatorProjectVersions).insertOne({ id: versionId, projectId: id, userId: owner, mode: "template", versionNumber: 1, configuration: payload.configuration, productRecipe: payload.productRecipe, campaignRecipe: payload.campaignRecipe, createdAt: now });
    if (running) await database.collection(COLLECTIONS.renderRuns).insertOne({ id: newMongoObjectId(), userId: owner, projectId: id, projectVersionId: versionId, status: "processing", configuration: structuredClone(payload.configuration) });
    return { id, versionId, payload };
  }
  async function current(projectId: string) { const project = await database.collection(COLLECTIONS.creatorProjects).findOne({ id: projectId }); return database.collection(COLLECTIONS.creatorProjectVersions).findOne({ id: project!.currentWorkingVersionId }); }
  it("verifies bytes, makes independent copies, replays saves and isolates accounts", async () => {
    const uploadId = await upload(); input = { name: "Perfume references", kind: "product", approved: true, photos: [{ id: randomUUID(), uploadId }] };
    const key = randomUUID(); const [a, b] = await Promise.all([service.save(owner, key, input), service.save(owner, key, input)]); first = a;
    expect(a).toEqual(b); expect((await service.list(owner)).entries).toHaveLength(1);
    expect((await service.list(other)).entries).toEqual([]);
    await expect(service.find(other, a.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.photo(other, a.id, a.photos[0]!.id)).rejects.toMatchObject({ code: "not_found" });
    await expect(service.save(owner, key, { ...input, name: "Wrong replay" })).rejects.toMatchObject({ code: "conflict" });
    await expect(service.save(other, randomUUID(), { ...input, id: a.id, expectedRevision: 1 })).rejects.toMatchObject({ code: "not_found" });
    expect(objects.size).toBe(2); expect(await service.photo(owner, a.id, a.photos[0]!.id)).toMatchObject({ body: png });
    const rename = { id: a.id, expectedRevision: a.revision, name: "Renamed", kind: a.kind, approved: true, photos: a.photos.map(photo => ({ id: photo.id })) };
    const results = await Promise.allSettled([service.save(owner, randomUUID(), rename), service.save(owner, randomUUID(), { ...rename, name: "Concurrent" })]);
    expect(results.filter(value => value.status === "fulfilled")).toHaveLength(1);
    first = await service.find(owner, a.id);
    await expect(service.save(owner, randomUUID(), rename)).rejects.toMatchObject({ code: "conflict" });
    expect(await database.collection("creator_reference_library_revisions").countDocuments({ entryId: a.id })).toBe(2);
  });
  it("rejects invalid files, checksum mismatch, unfinished uploads and cross-account uploads", async () => {
    const uploadKey = randomUUID(); const metadata = { name: "bad.png", mimeType: "image/png" as const, sizeBytes: png.length, checksumSha256: "f".repeat(64) };
    const allocated = await service.allocateUpload(owner, uploadKey, metadata);
    expect(await service.allocateUpload(owner, uploadKey, metadata)).toEqual(allocated);
    await expect(service.allocateUpload(owner, uploadKey, { ...metadata, name: "Different.png" })).rejects.toMatchObject({ code: "conflict" });
    await expect(service.writeUpload(owner, allocated.id, png)).rejects.toMatchObject({ code: "invalid" });
    await expect(service.save(owner, randomUUID(), { ...input, photos: [{ id: randomUUID(), uploadId: allocated.id }] })).rejects.toMatchObject({ code: "invalid" });
    await expect(service.writeUpload(other, allocated.id, png)).rejects.toMatchObject({ code: "not_found" });
    await expect(upload(new TextEncoder().encode("not a PNG"))).rejects.toThrow();
    await expect(service.allocateUpload(owner, randomUUID(), { name: "x.svg", mimeType: "image/svg+xml", sizeBytes: 10, checksumSha256: "a".repeat(64) })).rejects.toThrow();
  });
  it("replaces linked photos in two drafts, preserves exact copy and immutable accepted/active versions, and recovers interrupted copies", async () => {
    const a = await campaign(first), b = await campaign(first), accepted = await campaign(first, true), running = await campaign(first, false, true);
    const body = new Uint8Array(execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=2x2", "-frames:v", "1", "-threads", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"])); const uploadId = await upload(body, "replacement.png");
    const replacement = await service.save(owner, randomUUID(), { id: first.id, expectedRevision: first.revision, name: first.name, kind: first.kind, approved: true, photos: [{ id: first.photos[0]!.id, uploadId }] });
    await expect(assertLibraryConfiguration(database, owner, a.payload.configuration)).rejects.toMatchObject({ code: "review_required" });
    failCopy = true; await expect(service.reconcileOwner(owner)).rejects.toThrow("interrupted_copy"); failCopy = false;
    expect((await current(a.id))!.id).toBe(a.versionId);
    await service.reconcileOwner(owner);
    for (const draft of [a, b]) {
      const next = (await current(draft.id))!; expect(next.id).not.toBe(draft.versionId);
      expect(next.configuration.creatorProject.libraryReviewRequired).toBe(true);
      expect(next.configuration.creatorProject.product.images[0].checksum).toBe(sha(body));
      expect(next.configuration.creatorProject.offer).toBe(draft.payload.configuration.creatorProject.offer);
      expect(next.configuration.creatorProject.cta).toBe(draft.payload.configuration.creatorProject.cta);
      expect(next.configuration.creatorProject.displayCopy).toEqual(draft.payload.configuration.creatorProject.displayCopy);
      expect(next.configuration.generation.creativeBrief).toEqual(draft.payload.configuration.generation.creativeBrief);
      expect(next.productRecipe.name).toBe(draft.payload.productRecipe.name);
      TemplateCampaignPayloadSchema.parse({ configuration: next.configuration, productRecipe: next.productRecipe, campaignRecipe: next.campaignRecipe });
      await expect(assertLibraryConfiguration(database, owner, next.configuration)).rejects.toMatchObject({ code: "review_required" });
      expect((await database.collection(COLLECTIONS.creatorProjectVersions).findOne({ id: draft.versionId }))!.configuration).toEqual(draft.payload.configuration);
    }
    expect((await current(accepted.id))!.id).toBe(accepted.versionId); expect((await current(running.id))!.id).toBe(running.versionId);
    const count = await database.collection(COLLECTIONS.creatorProjectVersions).countDocuments({ userId: owner }); await service.reconcileOwner(owner);
    expect(await database.collection(COLLECTIONS.creatorProjectVersions).countDocuments({ userId: owner })).toBe(count);
    first = replacement;
  });
  it("withdraws approval, separates presenter roles and removes deleted references without deleting history", async () => {
    const draft = await campaign(first);
    const revoked = await service.save(owner, randomUUID(), { id: first.id, expectedRevision: first.revision, kind: first.kind, name: first.name, approved: false, photos: first.photos.map(photo => ({ id: photo.id })) });
    await service.reconcileOwner(owner); expect((await current(draft.id))!.configuration.creatorProject.libraryReviewRequired).toBe(true);
    await expect(service.copyToClaim(owner, source(revoked), draft.id, randomUUID(), { checksumSha256: revoked.photos[0]!.checksumSha256, mimeType: "image/png", sizeBytes: revoked.photos[0]!.sizeBytes })).rejects.toMatchObject({ code: "review_required" });
    const presenter = await service.save(owner, randomUUID(), { name: "Approved host", kind: "presenter", approved: true, photos: [{ id: randomUUID(), uploadId: await upload() }] });
    const wrongRole = { creatorProject: { product: { images: [{ checksum: presenter.photos[0]!.checksumSha256, referenceRole: "subject", librarySource: source(presenter) }] } } };
    await expect(assertLibraryConfiguration(database, owner, wrongRole)).rejects.toMatchObject({ code: "invalid" });
    await service.remove(owner, first.id, revoked.revision, randomUUID()); await service.reconcileOwner(owner);
    const next = (await current(draft.id))!; expect(next.configuration.creatorProject.product.images).toEqual([]); expect(next.configuration.creatorProject.libraryReviewRequired).toBe(true);
    expect(await database.collection("creator_reference_library_revisions").countDocuments({ entryId: first.id })).toBeGreaterThan(3);
    expect((await database.collection(COLLECTIONS.creatorProjectVersions).findOne({ id: draft.versionId }))!.configuration.creatorProject.product.images).toHaveLength(1);
  });
  it("claims saved photos without browser re-upload and recovers a partial independent copy", async () => {
    const entry = await service.save(owner, randomUUID(), { name: "Claim reference", kind: "product", approved: true, photos: [{ id: randomUUID(), uploadId: await upload() }] });
    const repository = createMongoGuestClaimRepository(database);
    const claims = createGuestClaimService({ repository, copyLibraryAssets: async (userId, snapshot, operation) => {
      for (const asset of snapshot.assetManifest) {
        if (!asset.librarySource) continue;
        const result = await service.copyToClaim(userId, asset.librarySource, operation.projectId, asset.localAssetId, asset);
        await repository.markAssetVerified({ userId, pendingGenerationId: snapshot.pendingGenerationId, localAssetId: asset.localAssetId, bucket: result.bucket, objectKey: result.key });
      }
    } });
    const payload = adStudioBrandAdFixture();
    const image = payload.configuration.creatorProject.product.images[0]!;
    const { storagePath: _path, ...localImage } = image;
    payload.configuration.creatorProject.product.images = [{ ...localImage, id: randomUUID(), librarySource: source(entry), checksum: entry.photos[0]!.checksumSha256 }];
    payload.configuration.creatorProject.source.assetKeys = [];
    payload.configuration.generation.references = []; payload.productRecipe.images = [];
    await ensureMongoTemplateCatalog(database, [AD_STUDIO_BRAND_AD_RECIPE]);
    const templateVersion = await database.collection(COLLECTIONS.videoTemplateVersions).findOne({ "recipe.templatePromptVersion": `ad-studio-brand-ad-v${AD_STUDIO_BRAND_AD_RECIPE.versionNumber}` });
    const snapshot = { templateVersionId: String(templateVersion!.id), draftId: randomUUID(), pendingGenerationId: randomUUID(), snapshotDigest: "a".repeat(64), title: "Claimed reference", mode: "template" as const, ...payload, assetManifest: [{ localAssetId: payload.configuration.creatorProject.product.images[0]!.id, ordinal: 0, kind: "product" as const, mimeType: "image/png", sizeBytes: png.length, checksumSha256: sha(png), librarySource: source(entry) }] };
    GuestClaimSnapshotSchema.parse(snapshot);
    failCopy = true; await expect(claims.startClaim({ userId: owner, snapshot })).rejects.toThrow("interrupted_copy"); failCopy = false;
    const pending = await repository.resume({ userId: owner, pendingGenerationId: snapshot.pendingGenerationId }); expect(pending.nextAsset).not.toBeNull();
    const ready = await claims.startClaim({ userId: owner, snapshot }); expect(ready.nextAsset).toBeNull();
    const receipt = await claims.finalizeClaim({ userId: owner, pendingGenerationId: snapshot.pendingGenerationId });
    expect(receipt.assetManifest).toEqual(snapshot.assetManifest);
    expect((await claims.startClaim({ userId: owner, snapshot })).status).toBe("ready");
    expect((await claims.finalizeClaim({ userId: owner, pendingGenerationId: snapshot.pendingGenerationId })).version.id).toBe(receipt.version.id);
    expect((await database.collection(COLLECTIONS.creatorProjectAssets).findOne({ projectId: ready.projectId }))!.checksumSha256).toBe(sha(png));
  });
  it("blocks stale library references inside atomic render enqueue before any job or charge", async () => {
    const entry = await service.save(owner, randomUUID(), { name: "Enqueue proof", kind: "product", approved: true, photos: [{ id: randomUUID(), uploadId: await upload() }] });
    const draft = await campaign(entry); const domain = createMongoGenerationService(database, { APP_ENV: "local" });
    const configuration = { capability: "video.cinematic", generation: { prompt: "Fixture only", durationSeconds: 8 } };
    const stripped = structuredClone(draft.payload.configuration);
    delete stripped.creatorProject.product.images[0]!.librarySource;
    await expect(assertLibraryConfiguration(database, owner, stripped)).rejects.toMatchObject({ code: "review_required" });
    const mismatched = structuredClone(draft.payload);
    delete mismatched.configuration.generation.references[0]!.librarySource;
    expect(TemplateCampaignPayloadSchema.safeParse(mismatched).success).toBe(false);
    const quote = await domain.createQuote({ userId: owner, capabilityAlias: "video.cinematic", credits: 0, entitlementEligible: false, breakdown: [], configuration, expiresAt: new Date(Date.now() + 60_000) });
    await service.save(owner, randomUUID(), { id: entry.id, expectedRevision: entry.revision, name: entry.name, kind: entry.kind, approved: false, photos: entry.photos.map(photo => ({ id: photo.id })) });
    await expect(domain.startRender({ userId: owner, projectId: draft.id, projectVersionId: draft.versionId, quoteId: quote.id, capabilityAlias: "video.cinematic", idempotencyKey: randomUUID(), configuration })).rejects.toMatchObject({ code: "quote_configuration_mismatch" });
    expect(await database.collection(COLLECTIONS.renderRuns).countDocuments({ projectId: draft.id })).toBe(0);
    expect(await database.collection(COLLECTIONS.creditLedger).countDocuments({ userId: owner })).toBe(0);
    expect(await database.collection(COLLECTIONS.outboxJobs).countDocuments({ "payload.projectId": draft.id })).toBe(0);
  });
  it("gates API operations by account and flag", async () => {
    const disabled = createApi(); expect((await disabled.request("/api/v1/reference-library/status")).status).toBe(200);
    const app = createApi({ referenceLibrary: service, authGateway: { getSession: async () => null } as unknown as AuthGateway });
    expect((await app.request("/api/v1/reference-library")).status).toBe(401);
    expect((await app.request(`/api/v1/reference-library/${first.id}`)).status).toBe(401);
    const authenticated = createApi({ referenceLibrary: service, authGateway: { getSession: async () => ({ user: { id: owner } }) } as unknown as AuthGateway });
    const disabledAccount = createApi({ authGateway: { getSession: async () => ({ user: { id: owner } }) } as unknown as AuthGateway });
    expect((await disabledAccount.request("/api/v1/reference-library")).status).toBe(503);
    expect((await authenticated.request("/api/v1/reference-library", { headers: { "X-Library-Owner": other } })).status).toBe(409);
    const verifiedUpload = await upload();
    const automatic = await authenticated.request("/api/v1/reference-library/auto-save", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID(), "X-Library-Owner": owner }, body: JSON.stringify({ kind: "product", uploadId: verifiedUpload }) });
    expect(automatic.status).toBe(200);
    const allocation = await authenticated.request("/api/v1/reference-library/uploads", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() }, body: JSON.stringify({ name: "invalid.png", mimeType: "image/png", sizeBytes: 9, checksumSha256: sha(new TextEncoder().encode("not a PNG")) }) });
    expect(allocation.status).toBe(200);
    const allocated = await allocation.json() as { uploadId: string };
    const invalid = await authenticated.request(`/api/v1/reference-library/uploads/${allocated.uploadId}/content`, { method: "PUT", body: "not a PNG" });
    expect(invalid.status).toBe(400);
    const result = await authenticated.request("/api/v1/reference-library?kind=presenter");
    expect(result.status).toBe(200); const list = await result.json() as { entries: LibraryEntry[] };
    expect(list.entries.every(entry => entry.kind === "presenter")).toBe(true);
    expect(JSON.stringify(list)).not.toContain("objectKey");
    const presenter = list.entries[0]!;
    const photo = await authenticated.request(`/api/v1/reference-library/${presenter.id}/photos/${presenter.photos[0]!.id}`);
    expect(photo.status).toBe(200); expect(photo.headers.get("Cache-Control")).toBe("private, no-store");
    expect(photo.headers.get("Content-Type")).toBe("image/png");
  });
  it("automatically saves without approval, deduplicates concurrent requests and excludes deleted entries", async () => {
    const automaticPhoto = new Uint8Array(execFileSync(process.env.FFMPEG_PATH || "ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=green:s=4x4", "-frames:v", "1", "-threads", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"]));
    const uploadId = await upload(automaticPhoto, "auto-product.png");
    const initial = await service.autoSave(owner, randomUUID(), { kind: "presenter", uploadId });
    expect(initial.approved).toBe(false); expect(initial.approval.rightsConfirmed).toBe(false);
    const keys = [randomUUID(), randomUUID(), randomUUID()];
    const results = await Promise.all(keys.map(key => service.autoSave(owner, key, { kind: "presenter", uploadId })));
    expect(new Set(results.map(entry => entry.id)).size).toBe(1); expect(results[0]!.id).toBe(initial.id);
    await expect(service.autoSave(other, randomUUID(), { kind: "product", uploadId })).rejects.toMatchObject({ code: "invalid" });
    await service.remove(owner, initial.id, initial.revision, randomUUID());
    const next = await service.autoSave(owner, randomUUID(), { kind: "presenter", uploadId }); expect(next.id).not.toBe(initial.id); expect(next.approved).toBe(false);
    const product = await service.autoSave(owner, randomUUID(), { kind: "product", uploadId }); expect(product.kind).toBe("product"); expect(product.id).not.toBe(next.id);
    const freshOwner = newMongoObjectId();
    const freshUpload = await service.allocateUpload(freshOwner, randomUUID(), { name: "parallel.png", mimeType: "image/png", sizeBytes: automaticPhoto.byteLength, checksumSha256: sha(automaticPhoto) });
    await service.writeUpload(freshOwner, freshUpload.id, automaticPhoto);
    const concurrent = await Promise.all([1, 2, 3].map(() => service.autoSave(freshOwner, randomUUID(), { kind: "product", uploadId: freshUpload.id })));
    expect(new Set(concurrent.map(entry => entry.id)).size).toBe(1);
    const replayKey = randomUUID(); const saved = await service.autoSave(owner, replayKey, { kind: "presenter", uploadId });
    expect(await service.autoSave(owner, replayKey, { kind: "presenter", uploadId })).toEqual(saved);
    await expect(service.autoSave(owner, replayKey, { kind: "product", uploadId })).rejects.toMatchObject({ code: "conflict" });
  });
  it.skipIf(process.env.MOVPROMPT_TEST_R2 !== "true")("verifies upload and two independent campaign copies in real private R2", async () => {
    const r2 = new R2Storage(r2StorageConfigFromEnv(process.env)); const keys = new Set<string>();
    const tracked: LibraryStorage = { assetsBucket: r2.assetsBucket, get: value => r2.get(value), put: value => { keys.add(value.key); return r2.put(value); } };
    const real = createReferenceLibraryService({ database, storage: tracked, verify });
    try {
      const upload = await real.allocateUpload(owner, randomUUID(), { name: "real-r2.png", mimeType: "image/png", sizeBytes: png.length, checksumSha256: sha(png) });
      await real.writeUpload(owner, upload.id, png);
      const entry = await real.save(owner, randomUUID(), { name: "R2 proof", kind: "product", approved: true, photos: [{ id: randomUUID(), uploadId: upload.id }] });
      const firstProject = newMongoObjectId(), secondProject = newMongoObjectId();
      for (const id of [firstProject, secondProject]) await database.collection(COLLECTIONS.creatorProjects).insertOne({ id, userId: owner, deletedAt: null });
      const a = await real.attach(owner, firstProject, source(entry), sha(png)); const b = await real.attach(owner, secondProject, source(entry), sha(png));
      expect(a.objectKey).not.toBe(b.objectKey);
      expect((await r2.get({ bucket: r2.assetsBucket, key: a.objectKey, maxBytes: 1024 })).body).toEqual(png);
      expect((await r2.get({ bucket: r2.assetsBucket, key: b.objectKey, maxBytes: 1024 })).body).toEqual(png);
      const signed = await r2.signDownload({ bucket: r2.assetsBucket, key: a.objectKey });
      const anonymousUrl = new URL(signed.url); anonymousUrl.search = "";
      const privateRead = await fetch(anonymousUrl);
      expect(privateRead.ok).toBe(false); expect([400, 401, 403]).toContain(privateRead.status);
    } finally { for (const key of keys) await r2.delete(r2.assetsBucket, key); }
  }, 90_000);
});
