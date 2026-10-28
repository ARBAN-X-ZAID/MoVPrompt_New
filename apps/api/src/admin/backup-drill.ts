import assert from "node:assert/strict";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { BSON, ObjectId, type Document } from "mongodb";
import {
  createMongoDatabase,
  createMongoGenerationService,
  ensureMongoIndexes,
} from "@movprompt/db";
import { createMongoCreatorRepository } from "../mongo-creator-repository.js";
import type { AssetStorageGateway } from "../asset-storage.js";

const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
function seal(bytes: Uint8Array, key: Uint8Array) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
}
function open(bytes: Uint8Array, key: Uint8Array) {
  const buffer = Buffer.from(bytes),
    decipher = createDecipheriv("aes-256-gcm", key, buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final(),
  ]);
}
/** Disposable local recovery evidence, never a production backup or key escrow. */
export async function runIsolatedAdminBackupDrill(
  uri: string,
  storage: AssetStorageGateway,
) {
  const host = new URL(uri).hostname;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(host))
    throw new Error("admin_drill_requires_local_database");
  if (!storage.delete) throw new Error("admin_drill_requires_private_delete");
  const nonce = randomUUID().replaceAll("-", "");
  const source = createMongoDatabase({
    uri,
    databaseName: `movprompt_admin_drill_source_${nonce}`,
  });
  const restored = createMongoDatabase({
    uri,
    databaseName: `movprompt_admin_drill_restore_${nonce}`,
  });
  const keys = {
    photo: `admin-drill/${nonce}/source.png`,
    snapshot: `admin-drill/${nonce}/snapshot.encrypted`,
    mediaBackup: `admin-drill/${nonce}/media.encrypted`,
  };
  const encryptionKey = randomBytes(32);
  const photo = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
    "base64",
  );
  const userId = new ObjectId().toHexString(),
    otherUserId = new ObjectId().toHexString(),
    projectId = new ObjectId().toHexString(),
    versionId = new ObjectId().toHexString();
  async function put(
    key: string,
    body: Uint8Array,
    contentType = "application/octet-stream",
  ) {
    await storage.put({
      bucket: storage.assetsBucket,
      key,
      body,
      contentType,
      metadata: { "sha256-hex": hash(body) },
    });
    const head = await storage.head(storage.assetsBucket, key);
    assert.equal(head.contentLength, body.length);
    assert.equal(head.checksumSha256, hash(body));
  }
  let outcome: Document | undefined;
  let cleanupFailed = false;
  try {
    await source.connect();
    await restored.connect();
    await ensureMongoIndexes(source);
    await source.db.collection("users").insertMany([
      {
        _id: new ObjectId(userId),
        email: "restore-a@example.test",
        name: "Restore A",
      },
      {
        _id: new ObjectId(otherUserId),
        email: "restore-b@example.test",
        name: "Restore B",
      },
    ]);
    await source.collection("credit_accounts").insertOne({
      id: new ObjectId().toHexString(),
      userId,
      balance: 100,
      lifetimeSpent: 0,
      createdAt: new Date(),
    });
    await source.collection("credit_ledger").insertOne({
      id: new ObjectId().toHexString(),
      userId,
      kind: "grant",
      delta: 100,
      balanceAfter: 100,
      idempotencyKey: `drill-grant:${nonce}`,
      referenceType: "drill",
      referenceId: projectId,
      createdAt: new Date(),
    });
    const configuration = {
      displayCopy: {
        openingMessage: "",
        offer: "20% off until Friday",
        closingMessage: "",
      },
      approvedSpeech: "نص معتمد دون تغيير",
    };
    await source.collection("creator_projects").insertOne({
      id: projectId,
      userId,
      mode: "template",
      title: "Disposable restore drill",
      status: "ready",
      deletedAt: null,
      currentWorkingVersionId: versionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await source.collection("creator_project_versions").insertOne({
      id: versionId,
      userId,
      projectId,
      mode: "template",
      versionNumber: 1,
      configuration,
      createdAt: new Date(),
    });
    await source.collection("creator_project_assets").insertOne({
      id: new ObjectId().toHexString(),
      userId,
      projectId,
      kind: "image",
      role: "product",
      bucket: storage.assetsBucket,
      objectKey: keys.photo,
      mimeType: "image/png",
      sizeBytes: photo.length,
      checksumSha256: hash(photo),
    });
    await put(keys.photo, photo, "image/png");
    const generation = createMongoGenerationService(source, {
      APP_ENV: "test",
    });
    const quote = await generation.createQuote({
      userId,
      capabilityAlias: "video.product_fidelity",
      credits: 10,
      entitlementEligible: false,
      breakdown: [{ label: "Restore fixture", credits: 10 }],
      configuration,
      expiresAt: new Date(Date.now() + 600000),
    });
    const input = {
      userId,
      projectId,
      projectVersionId: versionId,
      quoteId: quote.id,
      idempotencyKey: `drill-render:${nonce}`,
      capabilityAlias: "video.product_fidelity",
      configuration,
    };
    const run = await generation.startRender(input);
    const accepted = {
      userId,
      runId: run.id,
      provider: "isolated-drill-no-network",
      providerRequestId: `synthetic-${nonce}`,
    };
    await generation.recordProviderSubmission(accepted);
    await generation.finalizeProviderAccepted(accepted);
    assert.equal(
      (await source.collection("credit_accounts").findOne({ userId }))?.balance,
      90,
    );
    const collections = await source.db
      .listCollections({}, { nameOnly: true })
      .toArray();
    const indexes: Record<string, Document[]> = {};
    for (const collection of collections)
      indexes[collection.name] = await source.db
        .collection(collection.name)
        .indexes();
    const snapshotAt = new Date();
    const records: Record<string, Document[]> = await source.transaction(
      async (session) => {
        const result: Record<string, Document[]> = {};
        for (const collection of collections)
          result[collection.name] = await source.db
            .collection(collection.name)
            .find({}, { session })
            .sort({ _id: 1 })
            .toArray();
        return result;
      },
    );
    const snapshot = Buffer.from(
      BSON.EJSON.stringify(
        { version: 1, snapshotAt, records, indexes },
        { relaxed: false },
      ),
    );
    await put(keys.snapshot, seal(snapshot, encryptionKey));
    await put(keys.mediaBackup, seal(photo, encryptionKey));
    const start = Date.now();
    const read = await storage.get({
      bucket: storage.assetsBucket,
      key: keys.snapshot,
      maxBytes: 30 * 1024 * 1024,
    });
    const decrypted = open(read.body, encryptionKey);
    assert.equal(hash(decrypted), hash(snapshot));
    const archive = BSON.EJSON.parse(decrypted.toString(), {
      relaxed: false,
    }) as {
      records: Record<string, Document[]>;
      indexes: Record<string, Document[]>;
    };
    for (const [name, documents] of Object.entries(archive.records)) {
      await restored.db.createCollection(name);
      if (documents.length)
        await restored.db.collection(name).insertMany(documents);
      for (const index of archive.indexes[name] ?? []) {
        if (index.name === "_id_") continue;
        const { key, name: indexName, ...options } = index;
        delete options.v;
        delete options.ns;
        delete options.background;
        await restored.db
          .collection(name)
          .createIndex(key, { ...options, name: indexName });
      }
      const actual = await restored.db
        .collection(name)
        .find({})
        .sort({ _id: 1 })
        .toArray();
      assert.equal(
        hash(Buffer.from(BSON.EJSON.stringify(actual, { relaxed: false }))),
        hash(Buffer.from(BSON.EJSON.stringify(documents, { relaxed: false }))),
      );
      assert.deepEqual(
        (await restored.db.collection(name).indexes())
          .map((row) => row.name)
          .sort(),
        archive.indexes[name]!.map((row) => row.name).sort(),
      );
    }
    // Only this drill's unique synthetic photo is deleted and restored.
    await storage.delete(storage.assetsBucket, keys.photo);
    const backedUpPhoto = await storage.get({
      bucket: storage.assetsBucket,
      key: keys.mediaBackup,
      maxBytes: 1024 * 1024,
    });
    await put(keys.photo, open(backedUpPhoto.body, encryptionKey), "image/png");
    const verified = await storage.get({
      bucket: storage.assetsBucket,
      key: keys.photo,
      maxBytes: 1024 * 1024,
    });
    assert.equal(hash(verified.body), hash(photo));
    const repository = createMongoCreatorRepository(restored);
    assert.equal(
      (await repository.listProjects(otherUserId, { includeTrashed: false }))
        .length,
      0,
    );
    assert.equal(
      (await repository.listProjects(userId, { includeTrashed: false })).length,
      1,
    );
    const recovery = createMongoGenerationService(restored, {
      APP_ENV: "test",
    });
    await recovery.recordProviderSubmission(accepted);
    await recovery.finalizeProviderAccepted(accepted);
    await recovery.finalizeProviderAccepted(accepted);
    assert.equal(
      (await restored.collection("credit_accounts").findOne({ userId }))
        ?.balance,
      90,
    );
    await recovery.refundRender({
      userId,
      runId: run.id,
      reason: "Disposable restore drill",
    });
    await recovery.refundRender({
      userId,
      runId: run.id,
      reason: "Disposable restore drill",
    });
    assert.equal(
      (await restored.collection("credit_accounts").findOne({ userId }))
        ?.balance,
      100,
    );
    assert.equal(
      await restored
        .collection("credit_ledger")
        .countDocuments({ kind: "charge" }),
      1,
    );
    assert.equal(
      await restored
        .collection("credit_ledger")
        .countDocuments({ kind: "refund" }),
      1,
    );
    assert.deepEqual(
      (
        await restored
          .collection("creator_project_versions")
          .findOne({ id: versionId })
      )?.configuration,
      configuration,
    );
    outcome = {
      scope: "isolated-local-drill",
      completedAt: new Date(),
      snapshotAt,
      restoreDurationMs: Date.now() - start,
      databaseVerified: true,
      indexesVerified: true,
      mediaVerified: true,
      accountIsolationVerified: true,
      economicsVerified: true,
      paidProviderCalls: 0,
      collectionCount: collections.length,
      snapshotSha256: hash(snapshot),
      snapshotBytes: snapshot.length,
      encryptedPrivateArchive: true,
      productionRpoRtoVerified: false,
      independentFailureDomainVerified: false,
      retainedBackup: false,
    };
  } finally {
    const cleanup = await Promise.allSettled([
      ...Object.values(keys).map((key) =>
        storage.delete!(storage.assetsBucket, key),
      ),
      source.db.dropDatabase(),
      restored.db.dropDatabase(),
    ]);
    await source.close();
    await restored.close();
    encryptionKey.fill(0);
    cleanupFailed = cleanup.some((row) => row.status === "rejected");
    if (cleanupFailed) console.error("admin_drill_cleanup_failed");
  }
  if (cleanupFailed) throw new Error("admin_drill_cleanup_failed");
  return outcome!;
}
