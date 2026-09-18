import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMongoDatabase, COLLECTIONS, newMongoObjectId } from "../src/mongo-client.js";
import { ensureMongoIndexes } from "../src/mongo-indexes.js";
import { createMongoGenerationService } from "../src/mongo-generation-service.js";

describe.skipIf(process.env.MOVPROMPT_TEST_MONGO !== "true")("generation index migration and durable acceptance", () => {
  const database = createMongoDatabase({ uri: process.env.MONGODB_URI || "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true", databaseName: `movprompt_generation_indexes_test_${Date.now()}` });
  beforeAll(() => database.connect());
  afterAll(async () => { await database.db.dropDatabase(); await database.close(); });

  it("replaces legacy indexes without deleting records; separate runs can share attempt zero", async () => {
    const attempts = database.collection(COLLECTIONS.renderAttempts);
    const reservations = database.collection(COLLECTIONS.creditReservations);
    await attempts.createIndex({ runId: 1, attemptNumber: 1 }, { unique: true });
    await reservations.createIndex({ runId: 1 }, { unique: true });
    const first = { id: newMongoObjectId(), renderRunId: newMongoObjectId(), attemptNumber: 0 };
    await attempts.insertOne(first);
    await ensureMongoIndexes(database);
    await ensureMongoIndexes(database);
    expect((await attempts.indexes()).map(index => index.name)).not.toContain("runId_1_attemptNumber_1");
    expect((await reservations.indexes()).map(index => index.name)).not.toContain("runId_1");
    await attempts.insertOne({ ...first, id: newMongoObjectId(), renderRunId: newMongoObjectId() });
    await expect(attempts.insertOne({ ...first, id: newMongoObjectId() })).rejects.toMatchObject({ code: 11000 });
    expect(await attempts.countDocuments({ id: first.id })).toBe(1);
    await reservations.insertOne({ id: newMongoObjectId(), renderRunId: newMongoObjectId() });
    await reservations.insertOne({ id: newMongoObjectId(), renderRunId: newMongoObjectId() });
  });

  it("retains an accepted provider identity if saving the dependent attempt fails, and repairs it idempotently", async () => {
    const userId = newMongoObjectId(), runId = newMongoObjectId();
    await database.collection(COLLECTIONS.renderRuns).insertOne({ id: runId, userId, projectId: newMongoObjectId(), projectVersionId: newMongoObjectId(), status: "submitting", qualityAttempt: 0, provider: "test-provider", providerRequestId: null });
    const attempts = database.collection(COLLECTIONS.renderAttempts);
    // Inject a real MongoDB write failure in the dependent attempt collection.
    await database.db.command({ collMod: COLLECTIONS.renderAttempts, validator: { blockedForTest: { $exists: true } }, validationLevel: "strict" });
    const service = createMongoGenerationService(database);
    const input = { runId, userId, provider: "test-provider", providerRequestId: "existing-provider-request" };
    await expect(service.recordProviderSubmission(input)).rejects.toThrow();
    expect((await database.collection(COLLECTIONS.renderRuns).findOne({ id: runId }))?.providerRequestId).toBe(input.providerRequestId);
    await database.db.command({ collMod: COLLECTIONS.renderAttempts, validator: {} });
    await Promise.all([service.recordProviderSubmission(input), service.recordProviderSubmission(input)]);
    expect(await attempts.countDocuments({ renderRunId: runId, attemptNumber: 0 })).toBe(1);
    await expect(service.recordProviderSubmission({ ...input, providerRequestId: "different-provider-request" })).rejects.toThrow();
  });
});
