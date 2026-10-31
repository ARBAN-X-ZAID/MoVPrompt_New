import {
  evaluateAdminSystem,
  scheduleAdminMaintenance,
} from "./system-monitor.js";
import { executeMigrationOperation } from "./migration-service.js";
import { executeAccountErasure, erasurePolicyHash } from "./account-erasure.js";
import {
  inventoryRetiredMedia,
  executeMediaCleanup,
  retentionPolicy,
} from "./media-retention.js";
import {
  createBusinessGenerationFactory,
  executeBusinessRender,
} from "./business-renders.js";
import { createAdminSecurity } from "./security.js";
import type { GenerationAvailabilityService } from "../generation-availability.js";
import { executeEmailDelivery } from "./email-delivery.js";
import {
  createApplicationEmailSenderFromEnv,
  type ApplicationEmailSender,
} from "../email.js";
import { executeScheduledContent } from "./content-scheduler.js";
import { executeOwnedMediaImport } from "./owned-media-service.js";
import { createHash, randomUUID } from "node:crypto";
import { ObjectId, type Document } from "mongodb";
import {
  COLLECTIONS as C,
  createMongoGenerationService,
  createMongoServiceHeartbeatRepository,
  hashGenerationConfiguration,
  syncPurchaseAllocations,
  type MongoDatabase,
} from "@movprompt/db";
import type { AuthGateway } from "../auth-gateway.js";
import type { AssetStorageGateway } from "../asset-storage.js";
import type { GenerationApiService } from "../generation-service.js";
import { createCustomerDataService } from "./customer-data.js";
import { ADMIN_RESOURCES } from "./data-service.js";
import {
  ADMIN_COLLECTIONS as A,
  adminJson,
  writeAdminAudit,
} from "./security.js";
import type { PaymentProvider } from "../payments/provider.js";

const csvCell = (value: unknown) => {
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object" && value !== null
        ? JSON.stringify(adminJson(value))
        : String(value ?? "");
  if (
    typeof value !== "number" &&
    (/^[\s]*[=+@-]/.test(text) || /^\d{15,}$/.test(text))
  )
    text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};
export function createAdminOperationWorker(input: {
  database: MongoDatabase;
  auth: AuthGateway;
  storage?: AssetStorageGateway;
  generation?: GenerationApiService;
  generationAvailability?: GenerationAvailabilityService;
  businessGeneration?: (id: string) => GenerationApiService;
  provider?: PaymentProvider | null;
  sendEmail?: ApplicationEmailSender;
  environment: Readonly<Record<string, string | undefined>>;
}) {
  const { database, auth, storage, generation } = input;
  const restricted = input.environment.ADMIN_READ_ONLY === "true";
  const walletEnabled = input.environment.ADMIN_WALLET_MANAGEMENT_ENABLED === "true";
  const db = database.db;
  const workerId = `admin-${randomUUID()}`;
  const operations = db.collection(A.operations);
  const customerData = createCustomerDataService(database, input.environment);
  const businessGeneration =
    input.businessGeneration ??
    createBusinessGenerationFactory(database, input.environment);
  const sendEmail =
    input.sendEmail ?? createApplicationEmailSenderFromEnv(input.environment);
  async function persistExport(
    key: string,
    body: Uint8Array,
    contentType: string,
  ) {
    if (!storage) throw new Error("private_storage_unavailable");
    const checksumSha256 = createHash("sha256").update(body).digest("hex");
    await storage.put({
      bucket: storage.outputsBucket,
      key,
      body,
      contentType,
      metadata: { "sha256-hex": checksumSha256 },
    });
    const verified = await storage.head(storage.outputsBucket, key);
    if (
      verified.contentLength !== body.length ||
      verified.checksumSha256 !== checksumSha256
    )
      throw new Error("private_storage_export_verification_failed");
    return {
      objectKey: key,
      bucket: storage.outputsBucket,
      contentType,
      sizeBytes: body.length,
      checksumSha256,
      expiresAt: new Date(Date.now() + 24 * 3600000),
    };
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  let inFlight: Promise<boolean> | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatInFlight: Promise<void> | undefined;
  const heartbeats = createMongoServiceHeartbeatRepository(database);
  let operationLoopHealthy = true;
  let heartbeatFailed = false;
  let scheduledMinute = -1;
  const heartbeat = () => {
    if (!heartbeatInFlight)
      heartbeatInFlight = heartbeats
        .beat({
          serviceName: "movprompt-admin-worker",
          instanceId: workerId,
          status: operationLoopHealthy ? "ready" : "starting",
          metadata: {
            operationLoopHealthy,
            walletOnly: restricted && walletEnabled,
            mutationsEnabled: !restricted || walletEnabled,
            privateStorageConfigured: Boolean(storage),
            generationRecoveryConfigured: Boolean(generation),
            cashRefundExecutionEnabled:
              input.environment.ADMIN_REFUNDS_ENABLED === "true" &&
              input.environment.ADMIN_REFUND_ACCEPTANCE_VERIFIED === "true",
          },
        })
        .then(() => {
          heartbeatFailed = false;
        })
        .catch(() => {
          if (!heartbeatFailed)
            console.warn(
              JSON.stringify({
                message: "admin_worker_heartbeat_failed",
                workerId,
              }),
            );
          heartbeatFailed = true;
        })
        .finally(() => {
          heartbeatInFlight = undefined;
        });
  };
  async function execute(row: Document): Promise<Document> {
    if (["migration.scan", "migration.reconcile"].includes(row.kind))
      return executeMigrationOperation(database, row);
    if (row.kind === "system.monitor") {
      const result = await evaluateAdminSystem(database, input.environment);
      return {
        checksEvaluated: result.checks.length,
        evaluatedAt: result.evaluatedAt,
      };
    }
    if (row.kind === "privacy.erase")
      return executeAccountErasure(database, row, input.environment, storage);
    if (row.kind === "media.inventory") {
      if (!storage) throw new Error("private_storage_unavailable");
      const result = await inventoryRetiredMedia(database, storage);
      if (retentionPolicy(input.environment).enabled)
        await operations.updateOne(
          { kind: "media.cleanup", inventoryOperationId: row._id },
          {
            $setOnInsert: {
              kind: "media.cleanup",
              policyHash: erasurePolicyHash(input.environment),
              inventoryOperationId: row._id,
              actorId: row.actorId,
              status: "queued",
              attempts: 0,
              availableAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      return result;
    }
    if (row.kind === "media.cleanup") {
      if (
        row.policyHash &&
        row.policyHash !== erasurePolicyHash(input.environment)
      )
        throw new Error("admin_retention_policy_changed");
      if (!storage) throw new Error("private_storage_unavailable");
      const result = await executeMediaCleanup(
        database,
        storage,
        input.environment,
        String(row.actorId),
      );
      if (row.privacyRequestId)
        await operations.updateOne(
          { _id: row.privacyRequestId, status: "erased" },
          {
            $set: {
              mediaCleanupResult: result,
              nextStep: result.retained
                ? "retained-independent-references"
                : "cleanup-completed",
              updatedAt: new Date(),
            },
          },
        );
      return result;
    }
    if (
      ["business.prepare", "business.start", "business.monitor"].includes(
        row.kind,
      )
    )
      return executeBusinessRender(database, row, {
        environment: input.environment,
        security: createAdminSecurity(database, auth),
        ...(storage ? { storage } : {}),
        generation: businessGeneration,
        ready: async () =>
          Boolean(
            input.generationAvailability &&
            (await input.generationAvailability.evaluate()).status === "ready",
          ),
      });
    if (row.kind === "email.send")
      return executeEmailDelivery(
        database,
        row.deliveryId,
        input.environment,
        sendEmail,
      );
    if (
      row.kind === "customer.password-reset" ||
      row.kind === "customer.verify-email"
    ) {
      const user = await db
        .collection("users")
        .findOne({ _id: row.userId }, { projection: { email: 1 } });
      if (!user || !auth.sendAccountEmail)
        throw new Error("account_email_unavailable");
      // An interrupted SMTP send can be repeated, but never changes credentials
      // or reports customer delivery. Better Auth owns token creation/expiry.
      await auth.sendAccountEmail(
        row.kind === "customer.password-reset"
          ? "password-reset"
          : "verify-email",
        user.email,
      );
      return { delivery: "smtp-accepted", delivered: null };
    }
    if (row.kind === "content.publish")
      return executeScheduledContent(
        database,
        row,
        new Date(),
        input.environment,
      );
    if (row.kind === "media.import") {
      if (!storage) throw new Error("private_storage_unavailable");
      return executeOwnedMediaImport(database, storage, row);
    }
    if (row.kind === "customer.reconcile-credits") {
      return database.transaction(async (session) => {
        const account = await db
          .collection(C.creditAccounts)
          .findOneAndUpdate(
            { userId: row.userId },
            { $inc: { revision: 1 } },
            { session, returnDocument: "after" },
          );
        if (!account) throw new Error("admin_wallet_missing");
        const result = await syncPurchaseAllocations(
          database,
          String(row.userId),
          session,
        );
        await writeAdminAudit(
          database,
          {
            userId: String(row.actorId),
            sessionId: "worker",
            requestId: row.requestId ?? `allocation:${String(row._id)}`,
          },
          "finance.allocations-reconciled",
          String(row.userId),
          { result },
          session,
        );
        return {
          ...result,
          ...(result && "reconciliationRequired" in result
            ? { status: "review-required", nextStep: "canonical-ledger-review" }
            : { verified: true }),
        };
      });
    }
    if (row.kind === "customer.delete-request") {
      const manifest = await customerData.deletionManifest(row.userId);
      return {
        status: "review-required",
        nextStep: "privacy-retention-review",
        privacyRevision: 1,
        manifest,
      };
    }
    if (row.kind === "customer.export") {
      const result = await customerData.exportData(row.userId);
      return {
        ...(await persistExport(
          `admin/exports/${String(row._id)}.json`,
          result.body,
          "application/json",
        )),
        rowCount: result.recordCount,
        mediaCount: result.mediaCount,
        schemaVersion: 1,
      };
    }
    if (row.kind === "report.export") {
      if (!storage) throw new Error("private_storage_unavailable");
      const config =
        ADMIN_RESOURCES[row.report as keyof typeof ADMIN_RESOURCES];
      if (!config) throw new Error("unsupported_report");
      const fields = ["_id", ...config.fields];
      const cursor = db
        .collection(config.collection)
        .find(
          { [config.date ?? "createdAt"]: { $gte: row.from, $lt: row.to } },
          {
            projection: Object.fromEntries(fields.map((field) => [field, 1])),
            maxTimeMS: 30000,
          },
        )
        .sort({ [config.date ?? "createdAt"]: 1, _id: 1 })
        .limit(10001)
        .batchSize(100);
      const get = (record: Document, path: string): unknown =>
        path
          .split(".")
          .reduce<unknown>(
            (value, part) =>
              value && typeof value === "object"
                ? (value as Document)[part]
                : undefined,
            record,
          );
      const lines = [fields.map(csvCell).join(",")];
      let sizeBytes = new TextEncoder().encode(lines[0]!).length;
      let rowCount = 0;
      let truncated = false;
      for await (const record of cursor) {
        if (rowCount === 10000) {
          truncated = true;
          break;
        }
        const line = fields
          .map((field) => csvCell(get(record, field)))
          .join(",");
        sizeBytes += new TextEncoder().encode(line).length + 2;
        if (sizeBytes > 30 * 1024 * 1024)
          throw new Error("admin_report_requires_larger_reviewed_manifest");
        lines.push(line);
        rowCount++;
      }
      const csv = lines.join("\r\n");
      const key = `admin/reports/${String(row._id)}.csv`;
      return {
        ...(await persistExport(
          key,
          new TextEncoder().encode(`\uFEFF${csv}`),
          "text/csv; charset=utf-8",
        )),
        rowCount,
        truncated,
      };
    }
    if (row.kind === "finance.generation-restoration") {
      const request = await db.collection(A.financial).findOne({
        _id: row.financialRequestId,
        status: { $in: ["approved", "confirmed"] },
      });
      if (!request) throw new Error("approved_financial_request_missing");
      const run = await db
        .collection(C.renderRuns)
        .findOne({ _id: request.runId, userId: request.userId });
      if (!run || !["failed", "cancelled"].includes(run.status))
        throw new Error("generation_not_restorable");
      const domain = createMongoGenerationService(database, input.environment);
      if (run.chargedAt)
        await domain.refundRender({
          userId: String(request.userId),
          runId: String(request.runId),
          reason: request.reason,
        });
      else
        await domain.releaseRenderReservation({
          userId: String(request.userId),
          runId: String(request.runId),
          reason: request.reason,
          terminalStatus: run.status,
        });
      await db.collection(A.financial).updateOne(
        { _id: request._id, status: "approved" },
        {
          $set: { status: "confirmed", updatedAt: new Date() },
          $inc: { revision: 1 },
        },
      );
      return { restored: true };
    }
    if (row.kind === "finance.cash-refund") return executeRefund(row);
    if (row.kind === "generation.cancel" || row.kind === "generation.recover") {
      if (!generation) throw new Error("generation_service_unavailable");
      const run = await db
        .collection(C.renderRuns)
        .findOne({ _id: row.runId, userId: row.userId });
      if (!run) throw new Error("generation_not_found");
      const operationGeneration = run.businessFundingId
        ? businessGeneration(String(run.businessFundingId))
        : generation;
      if (row.kind === "generation.cancel")
        return {
          run: await operationGeneration.cancelRender(
            String(row.userId),
            String(row.runId),
            `admin.cancel:${row._id}`,
          ),
        };
      return {
        run: await operationGeneration.retryRenderOutput(
          String(row.userId),
          String(row.runId),
          `admin.recover:${row._id}`,
        ),
      };
    }
    if (row.kind === "generation.reconcile") {
      await database.transaction(async (session) => {
        const run = await db
          .collection(C.renderRuns)
          .findOne({ _id: row.runId, userId: row.userId }, { session });
        if (
          !run ||
          !["submitting", "queued", "processing", "cancelling"].includes(
            run.status,
          )
        )
          throw new Error("generation_not_active");
        const activeJob = await db.collection(C.workerJobs).findOne(
          {
            "data.renderRunId": String(run._id),
            status: "active",
            leaseExpiresAt: { $gt: new Date() },
          },
          { session },
        );
        if (activeJob) throw new Error("generation_worker_busy_retry_later");
        const version = await db
          .collection(C.creatorProjectVersions)
          .findOne(
            { _id: run.projectVersionId, userId: run.userId },
            { session },
          );
        if (!version) throw new Error("generation_snapshot_missing");
        // This uses the normal lifecycle, which reconciles saved provider IDs.
        // It never creates a new quote, customer charge or accepted output.
        const now = new Date();
        await db.collection(C.outboxJobs).updateOne(
          {
            topic: "render.start",
            operationKey: `admin.reconcile:${row._id}`,
          },
          {
            $setOnInsert: {
              topic: "render.start",
              operationKey: `admin.reconcile:${row._id}`,
              payload: {
                runId: String(run._id),
                userId: String(run.userId),
                projectId: String(run.projectId),
                projectVersionId: String(run.projectVersionId),
                quoteId: String(run.quoteId),
                capabilityAlias: run.capabilityAlias,
                configurationHash: hashGenerationConfiguration(
                  version.configuration,
                ),
                qualityAttempt: run.qualityAttempt,
              },
              status: "pending",
              attempts: 0,
              availableAt: now,
              createdAt: now,
              updatedAt: now,
            },
          },
          { session, upsert: true },
        );
      });
      return { reconciliation: "queued" };
    }
    throw new Error("admin_operation_not_supported");
  }
  async function executeRefund(row: Document): Promise<Document> {
    let request = await db
      .collection(A.financial)
      .findOne({ _id: row.financialRequestId, kind: "cash-refund" });
    if (!request) throw new Error("refund_request_missing");
    if (request.status === "confirmed") return { refunded: true };
    const provider = input.provider;
    if (!provider?.getRefundStatus)
      throw new Error("cash_refund_adapter_unavailable");
    // Disabling new refunds must not strand a submitted payment. Known gateway
    // identifiers remain eligible for read-only reconciliation during rollback.
    if (
      request.status === "approved" &&
      (input.environment.ADMIN_REFUNDS_ENABLED !== "true" ||
        input.environment.ADMIN_REFUND_ACCEPTANCE_VERIFIED !== "true" ||
        !provider.createRefund)
    )
      throw new Error("cash_refund_gate_closed");
    if (!["approved", "submitted", "uncertain"].includes(request.status))
      throw new Error("refund_request_not_executable");
    const order = await db.collection(C.paymentOrders).findOne({
      _id: request.orderId,
      userId: request.userId,
      status: "credited",
    });
    if (!order?.refundSourceOrderId || order.provider !== provider.id)
      throw new Error("refund_source_unverified");
    // Persist submitted BEFORE crossing the gateway boundary. A crash/timeout
    // after this point can only reconcile, never blindly create another refund.
    if (request.status === "approved") {
      const acquired = await db.collection(A.financial).findOneAndUpdate(
        { _id: request._id, status: "approved" },
        {
          $set: {
            status: "submitted",
            "execution.submittedAt": new Date(),
            "execution.reference": String(request._id),
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
      if (acquired) {
        try {
          const result = await provider.createRefund!({
            sourceOrderId: order.refundSourceOrderId,
            amountMinor: request.amountMinor,
            currency: "KWD",
            reference: String(request._id),
            reason: request.reason,
          });
          await db.collection(A.financial).updateOne(
            { _id: request._id, status: "submitted" },
            {
              $set: {
                "execution.refundId": result.refundId,
                status:
                  result.status === "confirmed" ? "submitted" : result.status,
                updatedAt: new Date(),
              },
            },
          );
        } catch {
          await db
            .collection(A.financial)
            .updateOne(
              { _id: request._id, status: "submitted" },
              { $set: { status: "uncertain", updatedAt: new Date() } },
            );
          throw new Error("refund_outcome_uncertain_reconciliation_required");
        }
      }
    }
    request = await db.collection(A.financial).findOne({ _id: request._id });
    if (!request) throw new Error("refund_request_missing");
    if (!request.execution?.refundId)
      throw new Error(
        "refund_identifier_missing_manual_gateway_reconciliation_required",
      );
    const status = await provider.getRefundStatus({
      refundId: request.execution.refundId,
      sourceOrderId: order.refundSourceOrderId,
      amountMinor: request.amountMinor,
      currency: "KWD",
    });
    if (status.status !== "confirmed")
      throw new Error("refund_pending_reconciliation");
    await database.transaction(async (session) => {
      const latest = await db
        .collection(A.financial)
        .findOne({ _id: request!._id }, { session });
      if (latest?.status === "confirmed") return;
      if (!latest || !["submitted", "uncertain"].includes(latest.status))
        throw new Error("refund_finalization_conflict");
      const retired = Number(latest.impact.creditsToRetire);
      const account = await db.collection(C.creditAccounts).findOneAndUpdate(
        {
          userId: latest.userId,
          balance: { $gte: retired },
          refundReserved: { $gte: retired },
        },
        {
          $inc: { balance: -retired, refundReserved: -retired, revision: 1 },
          $set: { updatedAt: new Date() },
        },
        { session, returnDocument: "after" },
      );
      if (!account) throw new Error("refund_wallet_hold_missing");
      await db.collection(C.creditLedger).insertOne(
        {
          userId: latest.userId,
          kind: "cash_refund",
          delta: -retired,
          balanceAfter: account.balance,
          referenceType: "payment_order",
          referenceId: String(latest.orderId),
          reason: latest.reason,
          idempotencyKey: `cash.refund:${latest._id}`,
          createdAt: new Date(),
        },
        { session },
      );
      await db.collection(A.financial).updateOne(
        { _id: latest._id },
        {
          $set: {
            status: "confirmed",
            "execution.confirmedAt": new Date(),
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      await db.collection(C.notifications).insertOne(
        {
          userId: latest.userId,
          type: "refund-confirmed",
          title: "Refund confirmed",
          body: "Your payment refund has been verified.",
          financialRequestId: latest._id,
          createdAt: new Date(),
          readAt: null,
        },
        { session },
      );
      await syncPurchaseAllocations(database, String(request!.userId), session);
    });
    return { refunded: true };
  }
  async function tick(): Promise<boolean> {
    if (restricted && !walletEnabled) return false;
    const now = new Date();
    const row = await operations.findOneAndUpdate(
      {
        availableAt: { $lte: now },
        ...(restricted ? { kind: { $in: ["finance.generation-restoration", "finance.cash-refund"] } } : {}),
        $or: [
          { status: "queued" },
          { status: "running", leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: "running",
          leaseOwner: workerId,
          leaseExpiresAt: new Date(now.getTime() + 120000),
          updatedAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { availableAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!row) return false;
    const renew = setInterval(() => {
      void operations
        .updateOne(
          { _id: row._id, status: "running", leaseOwner: workerId },
          { $set: { leaseExpiresAt: new Date(Date.now() + 120000) } },
        )
        .catch(() => undefined);
    }, 30000);
    renew.unref();
    try {
      const result = await execute(row);
      await operations.updateOne(
        { _id: row._id, leaseOwner: workerId, status: "running" },
        {
          $set: {
            ...result,
            status:
              result.status === "review-required"
                ? "review-required"
                : "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
            leaseOwner: null,
            leaseExpiresAt: null,
          },
        },
      );
    } catch (error) {
      const candidate =
        typeof (error as { code?: unknown })?.code === "string"
          ? String((error as { code: string }).code)
          : error instanceof Error
            ? error.message
            : "";
      const code =
        /^(owned_media_|admin_|refund_|generation_|render_|private_storage_|customer_export_|account_email_|approved_financial_|cash_refund_|unsupported_report|checkout_failed)[a-z_]*$/.test(
          candidate,
        )
          ? candidate
          : "admin_operation_failed";
      const retry =
        code === "refund_pending_reconciliation" ||
        code === "admin_business_pending" ||
        (row.attempts < 5 &&
          !/manual_|requires_larger|not_supported|retention|gate_closed|checksum_mismatch|source_changed|revision_missing|source_invalid|source_mismatch|source_too_large/.test(
            code,
          ));
      await operations.updateOne(
        { _id: row._id, leaseOwner: workerId, status: "running" },
        {
          $set: {
            status: retry ? "queued" : "failed",
            failureCode: code.slice(0, 160),
            availableAt: new Date(
              Date.now() + Math.min(900000, 30000 * 2 ** row.attempts),
            ),
            leaseOwner: null,
            leaseExpiresAt: null,
            updatedAt: new Date(),
          },
        },
      );
    } finally {
      clearInterval(renew);
    }
    return true;
  }
  return {
    tick,
    scheduleMaintenance: () => restricted ? Promise.resolve() :
      scheduleAdminMaintenance(database, input.environment, Boolean(storage)),
    start() {
      heartbeat();
      heartbeatTimer ??= setInterval(heartbeat, 15000);
      heartbeatTimer.unref();
      timer ??= setInterval(() => {
        if (!inFlight)
          inFlight = (async () => {
            const minute = Math.floor(Date.now() / 60000);
            if (!restricted && minute !== scheduledMinute) {
              await scheduleAdminMaintenance(
                database,
                input.environment,
                Boolean(storage),
              );
              scheduledMinute = minute;
            }
            return tick();
          })()
            .then((result) => {
              operationLoopHealthy = true;
              return result;
            })
            .catch(() => {
              if (operationLoopHealthy)
                console.warn(
                  JSON.stringify({
                    message: "admin_operation_poll_failed",
                    workerId,
                  }),
                );
              operationLoopHealthy = false;
              return false;
            })
            .finally(() => {
              inFlight = undefined;
            });
      }, 1000);
      timer.unref();
    },
    async stop() {
      const wasStarted = Boolean(timer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
      if (timer) clearInterval(timer);
      timer = undefined;
      await inFlight;
      await heartbeatInFlight;
      if (wasStarted)
        await heartbeats.beat({
          serviceName: "movprompt-admin-worker",
          instanceId: workerId,
          status: "stopping",
        });
    },
  };
}
