import type { MongoDatabase } from "./mongo-client.js";
import { COLLECTIONS } from "./mongo-client.js";

export async function ensureMongoIndexes(database: MongoDatabase): Promise<void> {
  // Establish the canonical constraints before removing the obsolete indexes.
  // Old runId indexes treated every renderRunId document as the same null run.
  for (const [name, key, legacyName] of [
    [COLLECTIONS.renderAttempts, { renderRunId: 1, attemptNumber: 1 }, "runId_1_attemptNumber_1"],
    [COLLECTIONS.creditReservations, { renderRunId: 1 }, "runId_1"],
  ] as const) {
    const collection = database.collection(name);
    await collection.createIndex(key, { unique: true });
    const legacy = (await collection.indexes()).find(index => index.name === legacyName);
    if (legacy) {
      try { await collection.dropIndex(legacyName); }
      catch (error) {
        // API and worker can perform startup repair concurrently.
        if (![26, 27].includes(Number((error as { code?: number }).code))) throw error;
      }
    }
  }
  const workerJobs = database.collection(COLLECTIONS.workerJobs);
  const creatorProjectVersions = database.collection(COLLECTIONS.creatorProjectVersions);
  const singletonIndexName = "name_1_singletonKey_1";
  const operationKeyIndexName = "userId_1_operationKey_1";
  let singletonIndex;
  let operationKeyIndex;
  try {
    singletonIndex = (await workerJobs.indexes()).find((index) => index.name === singletonIndexName);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== 26) throw error;
  }
  try {
    operationKeyIndex = (await creatorProjectVersions.indexes()).find((index) => index.name === operationKeyIndexName);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
    if (code !== 26) throw error;
  }

  // A sparse compound index still indexes jobs because `name` is always present,
  // treating a missing singleton key as null. Replace that form so ordinary jobs
  // can coexist while named singleton jobs remain unique.
  if (singletonIndex && !singletonIndex.partialFilterExpression) {
    await workerJobs.dropIndex(singletonIndexName);
  }

  // Initial claimed versions have no idempotency operation. A sparse index
  // still indexes an explicit null, so the second campaign for a user would
  // collide. Only actual operation keys participate in uniqueness.
  if (operationKeyIndex && !operationKeyIndex.partialFilterExpression) {
    await creatorProjectVersions.dropIndex(operationKeyIndexName);
  }

  await Promise.all([
    database.collection(COLLECTIONS.users).createIndex({ email: 1 }, { unique: true, collation: { locale: "en", strength: 2 } }),
    database.collection(COLLECTIONS.sessions).createIndex({ token: 1 }, { unique: true }),
    database.collection(COLLECTIONS.sessions).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection(COLLECTIONS.accounts).createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
    database.collection(COLLECTIONS.verifications).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection(COLLECTIONS.videoTemplates).createIndex({ slug: 1 }, { unique: true }),
    database.collection(COLLECTIONS.videoTemplateVersions).createIndex({ templateId: 1, versionNumber: 1 }, { unique: true }),
    database.collection(COLLECTIONS.creatorProjects).createIndex({ clientDraftId: 1 }, { unique: true, sparse: true }),
    database.collection(COLLECTIONS.creatorProjects).createIndex({ userId: 1, updatedAt: -1 }),
    database.collection(COLLECTIONS.creatorProjects).createIndex({ userId: 1, id: 1 }),
    database.collection(COLLECTIONS.creatorProjectVersions).createIndex({ userId: 1, id: 1 }),
    database.collection(COLLECTIONS.creatorProjectVersions).createIndex({ userId: 1, projectId: 1 }),
    database.collection(COLLECTIONS.renderRuns).createIndex({ userId: 1, projectId: 1, createdAt: -1 }),
    database.collection(COLLECTIONS.renderRuns).createIndex({ userId: 1, createdAt: -1 }),
    database.collection(COLLECTIONS.exports).createIndex({ userId: 1, projectId: 1 }),
    database.collection(COLLECTIONS.creatorProjectVersions).createIndex({ projectId: 1, versionNumber: 1 }, { unique: true }),
    creatorProjectVersions.createIndex(
      { userId: 1, operationKey: 1 },
      {
        unique: true,
        partialFilterExpression: { operationKey: { $type: "string" } },
      },
    ),
    database.collection(COLLECTIONS.creatorProjectAssets).createIndex({ userId: 1, projectId: 1, objectKey: 1 }, { unique: true }),
    database.collection(COLLECTIONS.guestClaimOperations).createIndex({ draftId: 1 }, { unique: true }),
    database.collection(COLLECTIONS.guestClaimOperations).createIndex({ userId: 1, pendingGenerationId: 1 }, { unique: true }),
    database.collection(COLLECTIONS.guestClaimAssets).createIndex({ claimOperationId: 1, localAssetId: 1 }, { unique: true }),
    database.collection(COLLECTIONS.requestRateLimits).createIndex({ key: 1 }, { unique: true }),
    database.collection(COLLECTIONS.requestRateLimits).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection(COLLECTIONS.generationQuotes).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 }),
    database.collection(COLLECTIONS.renderRuns).createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true }),
    database.collection(COLLECTIONS.entitlements).createIndex({ userId: 1, type: 1 }, { unique: true }),
    database.collection(COLLECTIONS.creditAccounts).createIndex({ userId: 1 }, { unique: true }),
    database.collection(COLLECTIONS.outboxJobs).createIndex({ topic: 1, operationKey: 1 }, { unique: true }),
    database.collection(COLLECTIONS.outboxJobs).createIndex({ status: 1, availableAt: 1, leaseExpiresAt: 1 }),
    database.collection(COLLECTIONS.serviceHeartbeats).createIndex({ serviceName: 1, instanceId: 1 }, { unique: true }),
    workerJobs.createIndex(
      { name: 1, singletonKey: 1 },
      {
        unique: true,
        partialFilterExpression: { singletonKey: { $type: "string" } },
      },
    ),
    database.collection(COLLECTIONS.workerJobs).createIndex({ status: 1, startAfter: 1, leaseExpiresAt: 1 }),
  ]);
}
