import { ObjectId } from "mongodb";
import { COLLECTIONS, newMongoObjectId, type MongoDatabase } from "./mongo-client.js";
import {
  assertApprovedCapability,
  GenerationDomainError,
  hashGenerationConfiguration,
} from "./generation-policy.js";
import type { GenerationService } from "./generation-service.js";

function idempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 200) throw new GenerationDomainError("idempotency_conflict");
  return normalized;
}

export function createMongoGenerationService(database: MongoDatabase, environment: NodeJS.ProcessEnv = process.env): GenerationService {
  const quotes = database.collection(COLLECTIONS.generationQuotes);
  const runs = database.collection(COLLECTIONS.renderRuns);
  const reservations = database.collection(COLLECTIONS.creditReservations);
  const entitlements = database.collection(COLLECTIONS.entitlements);
  const accounts = database.collection(COLLECTIONS.creditAccounts);
  const ledger = database.collection(COLLECTIONS.creditLedger);

  return {
    async createQuote(input) {
      assertApprovedCapability(input.capabilityAlias);
      const now = input.now ?? new Date();
      if (!Number.isSafeInteger(input.credits) || input.credits < 0) throw new Error("credits must be a non-negative integer");
      if (!(input.expiresAt instanceof Date) || input.expiresAt <= now) throw new GenerationDomainError("invalid_quote_expiry");
      if (input.breakdown.some((row) => !row.label.trim() || !Number.isSafeInteger(row.credits) || row.credits < 0) || input.breakdown.reduce((sum, row) => sum + row.credits, 0) !== input.credits) throw new GenerationDomainError("invalid_quote_breakdown");
      const row = { id: newMongoObjectId(), userId: input.userId ?? null, templateVersionId: input.templateVersionId ?? null, capabilityAlias: input.capabilityAlias, credits: input.credits, entitlementEligible: input.entitlementEligible, breakdown: input.breakdown, configurationHash: hashGenerationConfiguration(input.configuration), expiresAt: input.expiresAt, createdAt: now };
      await quotes.insertOne(row);
      return row as never;
    },
    async startRender(input) {
      assertApprovedCapability(input.capabilityAlias);
      const operationKey = idempotencyKey(input.idempotencyKey); const configurationHash = hashGenerationConfiguration(input.configuration); const now = input.now ?? new Date();
      return database.transaction(async (session) => {
        const existing = await runs.findOne({ userId: input.userId, idempotencyKey: operationKey }, { session });
        if (existing) {
          if (existing.projectId !== input.projectId || existing.projectVersionId !== input.projectVersionId || existing.quoteId !== input.quoteId || existing.capabilityAlias !== input.capabilityAlias) throw new GenerationDomainError("idempotency_conflict");
          const bound = await quotes.findOne({ id: existing.quoteId }, { session });
          if (!bound) throw new GenerationDomainError("quote_not_found");
          if (bound.userId !== input.userId) throw new GenerationDomainError("quote_owner_mismatch");
          if (bound.configurationHash !== configurationHash) throw new GenerationDomainError("quote_configuration_mismatch");
          if (bound.capabilityAlias !== input.capabilityAlias) throw new GenerationDomainError("quote_capability_mismatch");
          return existing as never;
        }
        if (!(await database.collection(COLLECTIONS.creatorProjects).findOne({ id: input.projectId, userId: input.userId, deletedAt: null }, { session }))) throw new GenerationDomainError("project_version_not_found");
        if (!(await database.collection(COLLECTIONS.creatorProjectVersions).findOne({ id: input.projectVersionId, projectId: input.projectId, userId: input.userId }, { session }))) throw new GenerationDomainError("project_version_not_found");
        const quote = await quotes.findOne({ id: input.quoteId }, { session });
        if (!quote) throw new GenerationDomainError("quote_not_found");
        if ((quote.expiresAt as Date) <= now) throw new GenerationDomainError("quote_expired");
        if (quote.userId !== input.userId) throw new GenerationDomainError("quote_owner_mismatch");
        if (quote.configurationHash !== configurationHash) throw new GenerationDomainError("quote_configuration_mismatch");
        if (quote.capabilityAlias !== input.capabilityAlias) throw new GenerationDomainError("quote_capability_mismatch");
        const active = await runs.find({ userId: input.userId, status: { $in: ["submitting", "queued", "processing", "cancelling"] } }, { session }).toArray();
        if (active.some((row) => row.projectId === input.projectId)) throw new GenerationDomainError("project_render_active");
        if (active.length >= 2) throw new GenerationDomainError("user_render_limit_reached");
        const guest = await database.db.collection("guest_sessions").findOne({ _id: new ObjectId(input.userId), claimedBy: null }, { session });
        let guestCostCeilingUsd = 0;
        if (guest) {
          // The same document is updated by account claiming/expiry: no render may race an ownership transfer.
          const locked = await database.db.collection("guest_sessions").updateOne({ _id: guest._id, claimedBy: null, cleanupState: { $ne: "deleting" }, expiresAt: { $gt: now } }, { $inc: { revision: 1 } }, { session });
          if (!locked.matchedCount) throw new GenerationDomainError("user_render_limit_reached");
          if (environment.APP_ENV !== "local") {
            const cap = Number(environment.GUEST_DAILY_BUDGET_USD);
            guestCostCeilingUsd = Number(environment.GUEST_MAX_RENDER_COST_USD);
            if (!Number.isFinite(cap) || !Number.isFinite(guestCostCeilingUsd) || !(cap > 0) || !(guestCostCeilingUsd > 0) || guestCostCeilingUsd > cap) throw new GenerationDomainError("user_render_limit_reached");
            // Serialize quota/budget decisions across API replicas inside the enqueue transaction.
            await database.db.collection("guest_budget_locks").updateOne({ _id: new ObjectId("000000000000000000000001") }, { $inc: { revision: 1 } }, { upsert: true, session });
            const since = new Date(now.getTime() - 86400_000);
            const recent = await runs.find({ guestIpHash: { $exists: true }, $or: [{ createdAt: { $gt: since } }, { completedAt: { $gt: since } }, { status: { $in: ["submitting", "queued", "processing", "cancelling"] } }] }, { session }).toArray();
            if (recent.some(r => (r.guestIpHash === guest.ipHash || r.userId === input.userId) && !["failed", "cancelled"].includes(String(r.status)))) throw new GenerationDomainError("user_render_limit_reached");
            // Reserve worst-case provider cost including retries. Failed requests still count toward spend.
            if (recent.reduce((sum, r) => sum + Number(r.guestCostCeilingUsd ?? cap), 0) + guestCostCeilingUsd > cap) throw new GenerationDomainError("user_render_limit_reached");
          }
        }
        let starterEntitlementUsed = false;
        if (quote.entitlementEligible) {
          const reserved = await entitlements.findOneAndUpdate({ userId: input.userId, type: "starter_template_render", status: "available" }, { $set: { status: "reserved", reservedOperationKey: operationKey, updatedAt: now } }, { session, returnDocument: "after" });
          if (!reserved) throw new GenerationDomainError("starter_entitlement_unavailable");
          starterEntitlementUsed = true;
        } else if (Number(quote.credits) > 0) {
          const account = await accounts.findOne({ userId: input.userId }, { session });
          const holds = await reservations.find({ userId: input.userId, status: "reserved" }, { session }).toArray();
          if (!account || Number(account.balance ?? 0) - holds.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) < Number(quote.credits)) throw new GenerationDomainError("insufficient_credits");
        }
        const run = { ...(guest ? { guestIpHash: guest.ipHash, guestCostCeilingUsd } : {}), id: newMongoObjectId(), projectId: input.projectId, projectVersionId: input.projectVersionId, userId: input.userId, idempotencyKey: operationKey, capabilityAlias: input.capabilityAlias, quoteId: quote.id, quotedCredits: Number(quote.credits), chargedCredits: 0, starterEntitlementUsed, status: "submitting", processingStage: "preparing", refundStatus: "not_required", qualityAttempt: 0, provider: null, providerRequestId: null, outputBucket: null, outputObjectKey: null, errorCode: null, errorMessage: null, chargedAt: null, completedAt: null, createdAt: now, updatedAt: now };
        await runs.insertOne(run, { session });
        if (starterEntitlementUsed) await entitlements.updateOne({ userId: input.userId, type: "starter_template_render", status: "reserved", reservedOperationKey: operationKey }, { $set: { reservedRunId: run.id, updatedAt: now } }, { session });
        else if (Number(quote.credits) > 0) await reservations.insertOne({ id: newMongoObjectId(), userId: input.userId, renderRunId: run.id, amount: Number(quote.credits), status: "reserved", idempotencyKey: `render.reserve:${run.id}`, createdAt: now, updatedAt: now }, { session });
        await database.collection(COLLECTIONS.outboxJobs).updateOne({ topic: "render.start", operationKey: `render.start:${run.id}` }, { $setOnInsert: { id: newMongoObjectId(), topic: "render.start", operationKey: `render.start:${run.id}`, payload: { runId: run.id, userId: input.userId, projectId: input.projectId, projectVersionId: input.projectVersionId, quoteId: quote.id, capabilityAlias: input.capabilityAlias, configurationHash }, status: "pending", attempts: 0, availableAt: now, createdAt: now, updatedAt: now } }, { upsert: true, session });
        const projectUpdate = await database.collection(COLLECTIONS.creatorProjects).updateOne({ id: input.projectId, userId: input.userId, deletedAt: null }, { $set: { status: "generating", currentWorkingVersionId: input.projectVersionId, updatedAt: now } }, { session });
        if (!projectUpdate.matchedCount) throw new GenerationDomainError("project_version_not_found");
        return run as never;
      });
    },
    async recordProviderSubmission(input) {
      const now = input.now ?? new Date(); const provider = input.provider.trim(); const providerRequestId = input.providerRequestId.trim();
      if (!provider || !providerRequestId) throw new Error("provider and providerRequestId are required");
      // Save the accepted identity independently. A later attempt/ledger write
      // failure must never roll it back and cause another billable submission.
      const saved = await runs.updateOne({ id: input.runId, userId: input.userId, status: "submitting", providerRequestId: null, provider: { $in: [null, provider] } }, { $set: { provider, providerRequestId, processingStage: "rendering", updatedAt: now } });
      if (!saved.matchedCount) {
        const existing = await runs.findOne({ id: input.runId, userId: input.userId });
        if (!existing) throw new GenerationDomainError("render_not_found");
        if (existing.providerRequestId && (existing.provider !== provider || existing.providerRequestId !== providerRequestId)) throw new GenerationDomainError("idempotency_conflict");
        if (!existing.providerRequestId) throw new GenerationDomainError("render_submission_not_recordable");
      }
      return database.transaction(async (session) => {
        const run = await runs.findOne({ id: input.runId, userId: input.userId }, { session }); if (!run) throw new GenerationDomainError("render_not_found");
        if (run.provider !== provider || run.providerRequestId !== providerRequestId) throw new GenerationDomainError("idempotency_conflict");
        await database.collection(COLLECTIONS.renderAttempts).updateOne({ renderRunId: run.id, userId: run.userId, attemptNumber: run.qualityAttempt }, { $setOnInsert: { id: newMongoObjectId(), renderRunId: run.id, projectId: run.projectId, projectVersionId: run.projectVersionId, userId: run.userId, attemptNumber: run.qualityAttempt, provider, providerRequestId, status: "submitted", createdAt: now, updatedAt: now } }, { upsert: true, session });
        await database.collection(COLLECTIONS.renderAttempts).updateOne({ renderRunId: run.id, userId: run.userId, attemptNumber: run.qualityAttempt }, { $set: { provider, providerRequestId, updatedAt: now } }, { session });
        await database.collection(COLLECTIONS.renderAttempts).updateOne({ renderRunId: run.id, userId: run.userId, attemptNumber: run.qualityAttempt, status: "submitting" }, { $set: { status: "submitted", updatedAt: now } }, { session });
        await runs.updateOne({ id: run.id, userId: input.userId }, { $set: { errorCode: null, errorMessage: null, updatedAt: now } }, { session });
        return (await runs.findOne({ id: run.id, userId: input.userId }, { session })) as never;
      });
    },
    async finalizeProviderAccepted(input) {
      const now = input.now ?? new Date(); const provider = input.provider.trim(); const providerRequestId = input.providerRequestId.trim();
      return database.transaction(async (session) => {
        const run = await runs.findOne({ id: input.runId, userId: input.userId }, { session }); if (!run) throw new GenerationDomainError("render_not_found");
        if (run.chargedAt) { if (run.provider !== provider || run.providerRequestId !== providerRequestId) throw new GenerationDomainError("idempotency_conflict"); return run as never; }
        let chargedCredits = 0;
        if (run.starterEntitlementUsed) {
          const result = await entitlements.updateOne({ userId: input.userId, type: "starter_template_render", status: "reserved", reservedRunId: run.id }, { $set: { status: "consumed", consumedAt: now, updatedAt: now } }, { session }); if (!result.matchedCount) throw new GenerationDomainError("render_not_chargeable");
        } else if (Number(run.quotedCredits) > 0) {
          const reservation = await reservations.findOne({ userId: input.userId, renderRunId: run.id, status: "reserved" }, { session }); if (!reservation) throw new GenerationDomainError("render_not_chargeable");
          const account = await accounts.findOne({ userId: input.userId }, { session }); if (!account || Number(account.balance) < Number(run.quotedCredits)) throw new GenerationDomainError("insufficient_credits");
          const balanceAfter = Number(account.balance) - Number(run.quotedCredits); chargedCredits = Number(run.quotedCredits);
          await accounts.updateOne({ userId: input.userId }, { $set: { balance: balanceAfter, updatedAt: now }, $inc: { lifetimeSpent: chargedCredits } }, { session });
          await ledger.updateOne({ idempotencyKey: `render.charge:${run.id}` }, { $setOnInsert: { id: newMongoObjectId(), userId: input.userId, kind: "charge", delta: -chargedCredits, balanceAfter, reason: "video_generation", referenceType: "render_run", referenceId: run.id, idempotencyKey: `render.charge:${run.id}`, metadata: { provider, providerRequestId }, createdAt: now } }, { upsert: true, session });
          await reservations.updateOne({ id: reservation.id }, { $set: { status: "charged", settlementReason: "provider_accepted", settledAt: now, updatedAt: now } }, { session });
        }
        await runs.updateOne({ id: run.id, userId: input.userId }, { $set: { provider, providerRequestId, chargedCredits, chargedAt: now, providerAcceptedAt: now, status: "queued", processingStage: "rendering", updatedAt: now } }, { session });
        return (await runs.findOne({ id: run.id, userId: input.userId }, { session })) as never;
      });
    },
    async releaseRenderReservation(input) {
      const now = input.now ?? new Date(); const reason = input.reason.trim(); const terminal = input.terminalStatus ?? "failed";
      return database.transaction(async (session) => {
        const run = await runs.findOne({ id: input.runId, userId: input.userId }, { session }); if (!run) throw new GenerationDomainError("render_not_found");
        if (run.chargedAt || run.providerRequestId) throw new GenerationDomainError("render_not_releasable");
        if (run.starterEntitlementUsed) await entitlements.updateOne({ userId: input.userId, reservedRunId: run.id, status: "reserved" }, { $set: { status: "available", reservedRunId: null, reservedOperationKey: null, consumedAt: null, updatedAt: now } }, { session });
        else await reservations.updateOne({ userId: input.userId, renderRunId: run.id, status: "reserved" }, { $set: { status: "released", settlementReason: reason, settledAt: now, updatedAt: now } }, { session });
        await runs.updateOne({ id: run.id, userId: input.userId }, { $set: { status: terminal, processingStage: terminal === "cancelled" ? "cancelled" : "failed", ...(terminal === "failed" ? { errorCode: reason } : {}), updatedAt: now } }, { session });
        return (await runs.findOne({ id: run.id, userId: input.userId }, { session })) as never;
      });
    },
    async refundRender(input) {
      const now = input.now ?? new Date(); const reason = input.reason.trim();
      return database.transaction(async (session) => {
        const run = await runs.findOne({ id: input.runId, userId: input.userId }, { session }); if (!run) throw new GenerationDomainError("render_not_found"); if (run.refundStatus === "refunded") return run as never; if (!run.chargedAt) throw new GenerationDomainError("render_not_refundable");
        if (run.starterEntitlementUsed) await entitlements.updateOne({ userId: input.userId, reservedRunId: run.id }, { $set: { status: "available", reservedRunId: null, reservedOperationKey: null, consumedAt: null, updatedAt: now } }, { session });
        else if (Number(run.chargedCredits) > 0) {
          const account = await accounts.findOne({ userId: input.userId }, { session }); if (!account) throw new GenerationDomainError("render_not_refundable"); const balanceAfter = Number(account.balance) + Number(run.chargedCredits);
          await accounts.updateOne({ userId: input.userId }, { $set: { balance: balanceAfter, updatedAt: now }, $inc: { lifetimeSpent: -Number(run.chargedCredits) } }, { session });
          await ledger.updateOne({ idempotencyKey: `render.refund:${run.id}` }, { $setOnInsert: { id: newMongoObjectId(), userId: input.userId, kind: "refund", delta: Number(run.chargedCredits), balanceAfter, reason, referenceType: "render_run", referenceId: run.id, idempotencyKey: `render.refund:${run.id}`, createdAt: now } }, { upsert: true, session });
          await reservations.updateOne({ userId: input.userId, renderRunId: run.id }, { $set: { status: "refunded", settlementReason: reason, settledAt: now, updatedAt: now } }, { session });
        }
        await runs.updateOne({ id: run.id, userId: input.userId }, { $set: { refundStatus: "refunded", updatedAt: now } }, { session }); return (await runs.findOne({ id: run.id, userId: input.userId }, { session })) as never;
      });
    },
  };
}
