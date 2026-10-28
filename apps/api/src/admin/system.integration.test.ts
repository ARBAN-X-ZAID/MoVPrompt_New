import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createMongoDatabase, ensureMongoIndexes } from "@movprompt/db";
import { ensureAdminIndexes } from "./security.js";
import {
  backupPolicy,
  evaluateAdminSystem,
  scheduleAdminMaintenance,
  SYSTEM,
} from "./system-monitor.js";
import { executeMigrationOperation } from "./migration-service.js";
import { runIsolatedAdminBackupDrill } from "./backup-drill.js";
import { R2Storage, r2StorageConfigFromEnv } from "@movprompt/storage";
import { createAssetStorageGateway } from "../asset-storage.js";

const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)(
  "operational monitoring and historical reconciliation",
  () => {
    const database = createMongoDatabase({
      uri: uri ?? "mongodb://127.0.0.1:27029/",
      databaseName: `movprompt_admin_system_test_${Date.now()}`,
    });
    const customer = new ObjectId(),
      owner = new ObjectId();
    beforeAll(async () => {
      await database.connect();
      await ensureMongoIndexes(database);
      await ensureAdminIndexes(database);
    });
    beforeEach(async () => {
      for (const collection of await database.db.listCollections().toArray())
        await database.db.collection(collection.name).deleteMany({});
    });
    afterAll(async () => {
      await database.db.dropDatabase();
      await database.close();
    });
    it("uses unavailable for missing backup/cost evidence, detects staleness and resolves alerts without hiding history", async () => {
      const now = new Date();
      expect(backupPolicy({ ADMIN_BACKUP_RPO_MINUTES: "-2" }).approved).toBe(
        false,
      );
      const first = await evaluateAdminSystem(database, {}, now);
      expect(
        first.checks.find((row) => row.key === "backup-recovery")?.state,
      ).toBe("unavailable");
      expect(
        first.checks.find((row) => row.key === "provider-reported-spending")
          ?.observed,
      ).toBeNull();
      await database.db.collection("service_heartbeats").insertOne({
        serviceName: "movprompt-admin-worker",
        status: "ready",
        lastSeenAt: now,
      });
      await database.db.collection("admin_backup_evidence").insertOne({
        scope: "isolated-local-drill",
        completedAt: now,
        databaseVerified: true,
      });
      const second = await evaluateAdminSystem(database, {}, now);
      expect(
        second.checks.find((row) => row.key === "admin-worker")?.state,
      ).toBe("healthy");
      expect(
        second.checks.find((row) => row.key === "backup-recovery")?.state,
      ).toBe("unavailable");
      expect(
        await database.db
          .collection(SYSTEM.alerts)
          .findOne({ key: "admin-worker" }),
      ).toMatchObject({ active: false });
      const stale = await evaluateAdminSystem(
        database,
        {},
        new Date(now.getTime() + 61000),
      );
      expect(
        stale.checks.find((row) => row.key === "admin-worker")?.state,
      ).toBe("attention");
      expect(
        await database.db
          .collection(SYSTEM.alerts)
          .findOne({ key: "admin-worker" }),
      ).toMatchObject({ active: true, reviewedAt: null });
    });
    it("schedules one monitor per minute and no destructive maintenance without approved policy", async () => {
      const now = new Date();
      await Promise.all([
        scheduleAdminMaintenance(database, {}, true, now),
        scheduleAdminMaintenance(database, {}, true, now),
      ]);
      expect(
        await database.db
          .collection("admin_operations")
          .countDocuments({ kind: "system.monitor" }),
      ).toBe(1);
      expect(
        await database.db
          .collection("admin_operations")
          .countDocuments({ kind: "media.inventory" }),
      ).toBe(0);
      await database.db
        .collection("admin_owners")
        .insertOne({ userId: owner, active: true, role: "owner" });
      const policy = {
        ADMIN_RETENTION_EXECUTION_ENABLED: "true",
        ADMIN_RETENTION_POLICY_VERSION: "test-only-v1",
        ADMIN_RETENTION_APPROVAL_REFERENCE: "synthetic-fixture",
        ADMIN_FINANCIAL_RETENTION_DAYS: "2555",
        ADMIN_ACCOUNT_ERASURE_GRACE_DAYS: "30",
      };
      await scheduleAdminMaintenance(database, policy, true, now);
      await scheduleAdminMaintenance(database, policy, true, now);
      expect(
        await database.db
          .collection("admin_operations")
          .countDocuments({ kind: "media.inventory" }),
      ).toBe(1);
    });
    async function wallet() {
      const order = new ObjectId();
      await database.db
        .collection("users")
        .insertOne({ _id: customer, name: "Synthetic wallet owner" });
      await database.db
        .collection("credit_accounts")
        .insertOne({ userId: customer, balance: 100, lifetimeSpent: 0 });
      await database.db.collection("payment_orders").insertOne({
        _id: order,
        userId: customer,
        status: "credited",
        currency: "KWD",
        credits: 100,
        amountMinor: 5000,
        providerReference: "verified-fixture",
      });
      await database.db.collection("credit_ledger").insertOne({
        userId: customer,
        kind: "purchase",
        delta: 100,
        referenceType: "payment_order",
        referenceId: String(order),
        createdAt: new Date(),
        idempotencyKey: `migration-${order}`,
      });
      const scanId = new ObjectId();
      const scan = await executeMigrationOperation(database, {
        kind: "migration.scan",
      });
      await database.db.collection("admin_operations").insertOne({
        _id: scanId,
        kind: "migration.scan",
        status: "completed",
        ...scan,
      });
      return { scanId, scan };
    }
    it("reconciles reviewed purchase provenance idempotently without changing cash, balances, ledger or accepted configurations", async () => {
      const { scanId, scan } = await wallet();
      expect(scan.items[0]).toMatchObject({ state: "ready", balance: 100 });
      const canonical = await database.db
        .collection("credit_ledger")
        .find({})
        .toArray();
      const job = {
        _id: new ObjectId(),
        kind: "migration.reconcile",
        scanId,
        fingerprint: scan.fingerprint,
        actorId: owner,
      };
      const first = await executeMigrationOperation(database, job);
      expect(first.outcomes).toMatchObject([
        { status: "reconciled", canonicalBalanceUnchanged: true },
      ]);
      expect(await executeMigrationOperation(database, job)).toEqual(first);
      expect(
        await database.db
          .collection("credit_purchase_allocations")
          .countDocuments({ userId: customer, verified: true }),
      ).toBe(1);
      expect(
        (
          await database.db
            .collection("credit_accounts")
            .findOne({ userId: customer })
        )?.balance,
      ).toBe(100);
      expect(
        await database.db.collection("credit_ledger").find({}).toArray(),
      ).toEqual(canonical);
    });
    it("rejects stale reviewed batches and refuses to turn unproven purchase data into cash credit allocations", async () => {
      const { scanId, scan } = await wallet();
      await database.db
        .collection("credit_accounts")
        .updateOne({ userId: customer }, { $set: { balance: 90 } });
      const result = await executeMigrationOperation(database, {
        _id: new ObjectId(),
        kind: "migration.reconcile",
        scanId,
        fingerprint: scan.fingerprint,
        actorId: owner,
      });
      expect(result.outcomes).toMatchObject([
        { status: "review-required", reason: "source_changed" },
      ]);
      expect(
        await database.db
          .collection("credit_purchase_allocations")
          .countDocuments({}),
      ).toBe(0);
      await database.db.collection("payment_orders").deleteMany({});
      const scan2 = await executeMigrationOperation(database, {
        kind: "migration.scan",
      });
      expect(scan2.items[0]?.state).toBe("review-required");
    });
  },
);
describe.skipIf(!uri || process.env.ADMIN_REAL_STORAGE_TEST !== "true")(
  "isolated database and private R2 recovery",
  () => {
    it("restores encrypted records/indexes/media and replays charge/refund safely", async () => {
      const result = await runIsolatedAdminBackupDrill(
        uri!,
        createAssetStorageGateway(
          new R2Storage(r2StorageConfigFromEnv(process.env)),
        ),
      );
      expect(result).toMatchObject({
        databaseVerified: true,
        indexesVerified: true,
        mediaVerified: true,
        accountIsolationVerified: true,
        economicsVerified: true,
        paidProviderCalls: 0,
        productionRpoRtoVerified: false,
      });
    }, 60000);
  },
);
