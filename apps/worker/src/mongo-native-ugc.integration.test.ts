import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { defaultNativeUgcSettings, type GenerationJobPayload } from "@movprompt/contracts";
import { COLLECTIONS, createMongoDatabase, newMongoObjectId } from "@movprompt/db";
import { adStudioBrandAdFixture } from "../../api/src/ad-studio-brand-ad.test-fixture.js";
import { createMongoRenderLifecycleStore } from "./mongo-render-lifecycle-store.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("native UGC Mongo worker snapshot", () => {
  const database = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27028/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_native_worker_test_${Date.now()}` });
  beforeAll(() => database.connect());
  afterAll(async () => { await database.db.dropDatabase(); await database.close(); });
  it("records terminal time only at completion and preserves it on repeated terminal writes", async () => {
    const userId = newMongoObjectId(), runId = newMongoObjectId(), projectId = newMongoObjectId(), projectVersionId = newMongoObjectId();
    const now = new Date();
    await database.collection(COLLECTIONS.renderRuns).insertOne({ id: runId, userId, projectId, projectVersionId, status: "queued", idempotencyKey: randomUUID() });
    const store = createMongoRenderLifecycleStore(database);
    await store.updateProviderStatus({ runId, userId, status: "processing", now });
    expect((await database.collection(COLLECTIONS.renderRuns).findOne({ id: runId }))?.finishedAt).toBeUndefined();
    await store.markTerminal({ runId, userId, status: "failed", errorCode: "synthetic_failure", attemptNumber: 0, now });
    await store.markTerminal({ runId, userId, status: "failed", errorCode: "synthetic_failure", attemptNumber: 0, now: new Date(now.getTime() + 60000) });
    expect((await database.collection(COLLECTIONS.renderRuns).findOne({ id: runId }))?.finishedAt).toEqual(now);
  });
  it("loads immutable UGC recipes and verifies owned checksummed assets before submission", async () => {
    const campaign = adStudioBrandAdFixture();
    campaign.configuration.generation.creativeBrief.templateId = "female-product-review";
    campaign.configuration.generation.creativeBrief.nativeUgc = { ...defaultNativeUgcSettings(), enabled: true };
    const userId = newMongoObjectId();
    const payload: GenerationJobPayload = { renderRunId: newMongoObjectId(), projectId: newMongoObjectId(), projectVersionId: newMongoObjectId(), userId, quoteId: newMongoObjectId(), capability: "video.product_fidelity", requestId: randomUUID() };
    await database.collection(COLLECTIONS.renderRuns).insertOne({ id: payload.renderRunId, userId, projectId: payload.projectId, projectVersionId: payload.projectVersionId, quoteId: payload.quoteId, capabilityAlias: payload.capability, status: "submitting", processingStage: "preparing", idempotencyKey: randomUUID() });
    await database.collection(COLLECTIONS.creatorProjectVersions).insertOne({ id: payload.projectVersionId, userId, configuration: campaign.configuration, productRecipe: campaign.productRecipe, campaignRecipe: campaign.campaignRecipe });
    const image = campaign.configuration.creatorProject.product.images[0]!;
    await database.collection(COLLECTIONS.creatorProjectAssets).insertOne({ id: newMongoObjectId(), userId, projectId: payload.projectId, objectKey: image.storagePath, checksumSha256: image.checksum, mimeType: image.mimeType, sizeBytes: 500 });
    const store = createMongoRenderLifecycleStore(database);
    const loaded = await store.load(payload);
    expect(loaded.productRecipe).toEqual(campaign.productRecipe);
    expect(loaded.campaignRecipe).toEqual(campaign.campaignRecipe);
    await expect(store.load({ ...payload, userId: newMongoObjectId() })).rejects.toMatchObject({ code: "render_not_found" });
    await database.collection(COLLECTIONS.creatorProjectAssets).updateOne({ userId, projectId: payload.projectId }, { $set: { checksumSha256: "b".repeat(64) } });
    await expect(store.load(payload)).rejects.toMatchObject({ code: "invalid_generation_reference" });
    await database.collection(COLLECTIONS.creatorProjectVersions).updateOne({ id: payload.projectVersionId }, { $unset: { "configuration.generation.creativeBrief.nativeUgc": "", "configuration.generation.creativeBrief.displayCopy": "" } });
    const legacy = await store.load(payload);
    expect(legacy.productRecipe).toBeUndefined();
    expect(legacy.campaignRecipe).toBeUndefined();
  });
});
