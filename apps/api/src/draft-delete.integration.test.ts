import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS, createMongoDatabase, ensureMongoIndexes, newMongoObjectId } from "@movprompt/db";
import { createMongoGenerationService } from "../../../packages/db/src/mongo-generation-service.js";
import { createMongoCreatorRepository } from "./mongo-creator-repository.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("unfinished project deletion", () => {
  const db = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_delete_test_${Date.now()}` });
  const repo = createMongoCreatorRepository(db);
  const generation = createMongoGenerationService(db, { APP_ENV: "local" });
  beforeAll(async () => { await db.connect(); await ensureMongoIndexes(db); });
  afterAll(async () => { await db.db.dropDatabase(); await db.close(); });
  async function seed(extra = {}) {
    const userId = newMongoObjectId(), projectId = newMongoObjectId(), projectVersionId = newMongoObjectId();
    await db.collection(COLLECTIONS.creatorProjects).insertOne({ id: projectId, userId, title: "Disposable delete test", mode: "advanced", status: "ready", deletedAt: null, currentAcceptedVersionId: null, currentWorkingVersionId: projectVersionId, createdAt: new Date(), updatedAt: new Date(), ...extra });
    await db.collection(COLLECTIONS.creatorProjectVersions).insertOne({ id: projectVersionId, projectId, userId, mode: "advanced", versionNumber: 1, configuration: {}, createdAt: new Date() });
    return { userId, projectId, projectVersionId };
  }
  async function renderInput(ids: Awaited<ReturnType<typeof seed>>) {
    const quote = await generation.createQuote({ userId: ids.userId, capabilityAlias: "video.product_fidelity", credits: 0, entitlementEligible: false, breakdown: [], configuration: {}, expiresAt: new Date(Date.now() + 60_000) });
    return { ...ids, quoteId: quote.id, capabilityAlias: "video.product_fidelity" as const, idempotencyKey: `test-delete-${ids.projectId}`, configuration: {} };
  }
  it("soft deletes an unfinished draft idempotently without deleting its records", async () => {
    const ids = await seed();
    const first = await repo.trashProject(ids.userId, ids.projectId);
    expect(first.status).toBe("trashed");
    expect((await repo.trashProject(ids.userId, ids.projectId)).deletedAt).toBe(first.deletedAt);
    expect(await db.collection(COLLECTIONS.creatorProjectVersions).countDocuments({ projectId: ids.projectId })).toBe(1);
    expect(await repo.listProjects(ids.userId, { includeTrashed: false })).toHaveLength(0);
  });
  it("rejects another owner's delete", async () => {
    const ids = await seed();
    await expect(repo.trashProject(newMongoObjectId(), ids.projectId)).rejects.toMatchObject({ code: "project_not_found" });
  });
  it.each(["completed"])("protects %s projects", async status => {
    const ids = await seed({ status });
    await expect(repo.trashProject(ids.userId, ids.projectId)).rejects.toMatchObject({ code: "project_has_generated_video" });
  });
  it.each(["review", "exporting", "draft", "failed"])("allows %s projects without generated output", async status => {
    const ids = await seed({ status });
    expect((await repo.trashProject(ids.userId, ids.projectId)).status).toBe("trashed");
  });
  it("protects accepted and historical output after the working version changes", async () => {
    const accepted = await seed({ currentAcceptedVersionId: newMongoObjectId() });
    await expect(repo.trashProject(accepted.userId, accepted.projectId)).rejects.toMatchObject({ code: "project_has_generated_video" });
    const ids = await seed();
    await db.collection(COLLECTIONS.renderRuns).insertOne({ id: newMongoObjectId(), projectId: ids.projectId, projectVersionId: newMongoObjectId(), userId: ids.userId, status: "completed", outputObjectKey: "test/never-uploaded.mp4" });
    expect((await repo.findOwnedProject(ids.userId, ids.projectId))?.hasGeneratedVideo).toBe(true);
    await expect(repo.trashProject(ids.userId, ids.projectId)).rejects.toMatchObject({ code: "project_has_generated_video" });
  });
  it("protects saved output on failed runs and recorded exports", async () => {
    const ids = await seed();
    await db.collection(COLLECTIONS.renderRuns).insertOne({ id: newMongoObjectId(), ...ids, status: "failed", outputObjectKey: "test/never-uploaded.mp4" });
    await expect(repo.trashProject(ids.userId, ids.projectId)).rejects.toMatchObject({ code: "project_has_generated_video" });
    const exported = await seed();
    await db.collection(COLLECTIONS.exports).insertOne({ id: newMongoObjectId(), ...exported, status: "completed" });
    await expect(repo.trashProject(exported.userId, exported.projectId)).rejects.toMatchObject({ code: "project_has_generated_video" });
  });
  it.each(["submitting", "queued", "processing", "cancelling"])("protects %s runs", async status => {
    const ids = await seed();
    await db.collection(COLLECTIONS.renderRuns).insertOne({ id: newMongoObjectId(), ...ids, status });
    await expect(repo.trashProject(ids.userId, ids.projectId)).rejects.toMatchObject({ code: "project_generation_in_progress" });
  });
  it.each(["failed", "cancelled"])("allows unfinished %s renders even if the project status is stale", async status => {
    const ids = await seed({ status: "generating" });
    await db.collection(COLLECTIONS.renderRuns).insertOne({ id: newMongoObjectId(), ...ids, status, outputObjectKey: null });
    expect((await repo.findOwnedProject(ids.userId, ids.projectId))?.hasActiveGeneration).toBe(false);
    expect((await repo.trashProject(ids.userId, ids.projectId)).status).toBe("trashed");
  });
  it("cannot submit a new render after deletion", async () => {
    const ids = await seed(), input = await renderInput(ids);
    await repo.trashProject(ids.userId, ids.projectId);
    await expect(generation.startRender(input)).rejects.toMatchObject({ code: "project_version_not_found" });
    expect(await db.collection(COLLECTIONS.renderRuns).countDocuments({ projectId: ids.projectId })).toBe(0);
  });
  it("serializes simultaneous generation and deletion without orphaned jobs", async () => {
    const ids = await seed(), input = await renderInput(ids);
    const outcomes = await Promise.allSettled([generation.startRender(input), repo.trashProject(ids.userId, ids.projectId)]);
    expect(outcomes.filter(x => x.status === "fulfilled")).toHaveLength(1);
    const project = await repo.findOwnedProject(ids.userId, ids.projectId);
    const count = await db.collection(COLLECTIONS.renderRuns).countDocuments({ projectId: ids.projectId });
    expect(count).toBe(project?.deletedAt ? 0 : 1);
  });
});
