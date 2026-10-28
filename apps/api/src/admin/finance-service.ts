import { createHash } from "node:crypto";
import { ObjectId, type ClientSession, type Document } from "mongodb";
import {
  COLLECTIONS as C,
  reconstructCreditLots,
  CreditAllocationError,
  loadCreditAllocationState,
  allocateCreditLots,
  syncPurchaseAllocations,
  type MongoDatabase,
} from "@movprompt/db";
import type { AdminFinancialRequest } from "@movprompt/contracts";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

const digest = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(adminJson(value)))
    .digest("hex");
export { reconstructCreditLots };
export function createAdminFinanceService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const db = database.db;
  async function allocations(
    userId: string,
    balance: number,
    session?: ClientSession,
    assignLegacy = false,
  ) {
    try {
      return await loadCreditAllocationState(
        database,
        userId,
        balance,
        session,
        assignLegacy,
      );
    } catch (error) {
      if (error instanceof CreditAllocationError)
        return adminError(
          "wallet_reconciliation_required",
          "Reconcile this wallet's ledger, purchase allocations and reservations before approving the operation.",
        );
      throw error;
    }
  }
  async function impact(
    input: AdminFinancialRequest,
    session?: ClientSession,
  ): Promise<Document> {
    const options = session ? { session } : {};
    const userId = adminObjectId(input.userId);
    if (
      input.caseId &&
      !(await db
        .collection(A.cases)
        .findOne({ _id: adminObjectId(input.caseId), userId }, options))
    )
      return adminError(
        "financial_case_owner_mismatch",
        "The related support case must belong to this customer.",
        400,
      );
    if (
      !(session
        ? await db.collection("users").findOneAndUpdate(
            {
              _id: userId,
              ...(input.kind === "cash-refund" ? {} : { erasedAt: null }),
            },
            { $inc: { adminMutationFence: 1 } },
            { session, returnDocument: "after" },
          )
        : await db.collection("users").findOne(
            {
              _id: userId,
              ...(input.kind === "cash-refund" ? {} : { erasedAt: null }),
            },
            options,
          ))
    )
      return adminError("admin_customer_not_found", "Customer not found.", 404);
    const account = await db
      .collection(C.creditAccounts)
      .findOne({ userId }, options);
    const reserved = await db
      .collection(C.creditReservations)
      .find({ userId, status: "reserved" }, options)
      .toArray();
    const balance = Number(account?.balance ?? 0);
    const refundReserved = Number(account?.refundReserved ?? 0);
    const reservedCredits = reserved.reduce(
      (sum, row) => sum + Number(row.amount),
      0,
    );
    if (
      ![balance, refundReserved, reservedCredits].every(
        (value) => Number.isSafeInteger(value) && value >= 0,
      ) ||
      reservedCredits + refundReserved > balance
    )
      return adminError(
        "wallet_reconciliation_required",
        "This wallet needs reconciliation before financial changes can be approved.",
      );
    const base = {
      balance,
      reservedCredits,
      refundReserved,
      available: balance - reservedCredits - refundReserved,
    };
    if (input.kind === "credit-adjustment") {
      if (input.delta < 0) await allocations(input.userId, balance, session);
      if (input.delta < 0 && base.available + input.delta < 0)
        return adminError(
          "insufficient_available_credits",
          "The deduction exceeds available credits.",
        );
      return {
        ...base,
        delta: input.delta,
        balanceAfter: balance + input.delta,
      };
    }
    if (
      input.kind === "generation-restoration" ||
      input.kind === "recovery-render"
    ) {
      const run = await db
        .collection(C.renderRuns)
        .findOne({ _id: adminObjectId(input.runId), userId }, options);
      if (!run)
        return adminError("admin_run_not_found", "Generation not found.", 404);
      if (
        input.kind === "generation-restoration" &&
        (!["failed", "cancelled"].includes(run.status) ||
          run.refundStatus === "refunded")
      )
        return adminError(
          "generation_not_restorable",
          "Only an unsettled failed or cancelled generation can be restored.",
        );
      if (
        input.kind === "recovery-render" &&
        !["failed", "completed"].includes(run.status)
      )
        return adminError(
          "generation_recovery_unsafe",
          "Reconcile or finish the existing run before requesting a replacement.",
        );
      return {
        ...base,
        runStatus: run.status,
        chargedCredits: run.chargedCredits,
        starterEntitlementUsed: run.starterEntitlementUsed,
        refundStatus: run.refundStatus,
        budgetMinor: input.kind === "recovery-render" ? input.budgetMinor : 0,
      };
    }
    const orderId = adminObjectId(input.orderId);
    const order = await db
      .collection(C.paymentOrders)
      .findOne(
        { _id: orderId, userId, status: "credited", currency: "KWD" },
        options,
      );
    if (!order || !order.providerReference)
      return adminError(
        "payment_not_refundable",
        "A verified credited KWD purchase is required.",
      );
    const rows = await db
      .collection(C.creditLedger)
      .find({ userId }, options)
      .sort({ createdAt: 1, _id: 1 })
      .limit(100001)
      .toArray();
    if (rows.length > 100000)
      return adminError(
        "wallet_reconciliation_required",
        "Reconcile this large wallet before approving cash refunds.",
      );
    const provenance = reconstructCreditLots(rows, balance);
    if (!provenance.verified)
      return adminError(
        "wallet_reconciliation_required",
        "Wallet provenance needs review before a cash refund.",
      );
    const purchase = rows.find(
      (row) =>
        row.kind === "purchase" &&
        String(row.referenceId) === input.orderId &&
        Number(row.delta) === Number(order.credits),
    );
    if (!purchase)
      return adminError(
        "purchase_allocation_unverified",
        "No matching verified purchase ledger entry was found.",
      );
    const prior = await db
      .collection(A.financial)
      .find(
        {
          orderId,
          kind: "cash-refund",
          status: { $in: ["approved", "submitted", "uncertain", "confirmed"] },
        },
        options,
      )
      .toArray();
    const priorCash = prior.reduce(
      (sum, row) => sum + Number(row.amountMinor),
      0,
    );
    const remainingCash = Number(order.amountMinor) - priorCash;
    if (input.amountMinor > remainingCash)
      return adminError(
        "refund_exceeds_payment",
        "The refund exceeds the remaining verified payment value.",
      );
    const proportionalCredits =
      (input.amountMinor * Number(order.credits)) / Number(order.amountMinor);
    if (!Number.isSafeInteger(proportionalCredits))
      return adminError(
        "refund_credit_precision",
        "Choose a refund value corresponding to whole credits.",
      );
    const allocationState = await allocations(input.userId, balance, session);
    const unused = allocationState.available
      .filter((lot) => lot.orderId === input.orderId)
      .reduce((sum, lot) => sum + lot.remaining, 0);
    const reservedForOrder = [...allocationState.allocations.values()]
      .flat()
      .filter((slice) => slice.orderId === input.orderId)
      .reduce((sum, slice) => sum + slice.credits, 0);
    if (proportionalCredits > unused && reservedForOrder > 0)
      return adminError(
        "refund_credits_reserved",
        "Wait for generations using this purchase to settle before refunding their reserved value.",
      );
    if (
      input.exception &&
      (await db.collection(C.renderRuns).findOne(
        {
          userId,
          chargedAt: { $ne: null },
          refundStatus: { $ne: "refunded" },
          status: { $ne: "completed" },
        },
        options,
      ))
    )
      return adminError(
        "refund_generation_unsettled",
        "Wait for charged generations and any failed-video restoration to settle before approving a spent-value exception.",
      );
    if (!input.exception && proportionalCredits > unused)
      return adminError(
        "refund_exception_required",
        "This refund includes already-used value. Record an owner exception.",
      );
    const creditsToRetire = Math.min(unused, proportionalCredits);
    if (creditsToRetire > base.available)
      return adminError(
        "refund_credits_reserved",
        "Some affected credits are reserved by active generations. Wait for settlement.",
      );
    return {
      ...base,
      orderAmountMinor: order.amountMinor,
      orderCredits: order.credits,
      priorRefundsMinor: priorCash,
      remainingRefundableMinor: remainingCash,
      unusedPurchaseCredits: unused,
      creditsToRetire,
      consumedValueExceptionCredits: proportionalCredits - creditsToRetire,
      balanceAfter: balance - creditsToRetire,
      gatewayReady: Boolean(order.refundSourceOrderId),
      executionEnabled:
        environment.ADMIN_REFUNDS_ENABLED === "true" &&
        environment.ADMIN_REFUND_ACCEPTANCE_VERIFIED === "true" &&
        environment.FEATURE_PURCHASE_ALLOCATIONS === "true",
    };
  }
  async function request(
    actor: AdminActor,
    key: string,
    input: AdminFinancialRequest,
  ) {
    return security.command(actor, key, input, async (session) => {
      const preview = await impact(input, session);
      const now = new Date();
      const id = new ObjectId();
      await db.collection(A.financial).insertOne(
        {
          _id: id,
          ...input,
          userId: adminObjectId(input.userId),
          ...("orderId" in input
            ? { orderId: adminObjectId(input.orderId) }
            : {}),
          ...("runId" in input ? { runId: adminObjectId(input.runId) } : {}),
          status: "requested",
          revision: 1,
          impact: preview,
          impactHash: digest(preview),
          requestedBy: adminObjectId(actor.userId),
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "finance.request",
        id.toHexString(),
        { kind: input.kind, reason: input.reason, impact: preview },
        session,
      );
      return {
        id: id.toHexString(),
        revision: 1,
        status: "requested",
        impact: preview,
      };
    });
  }
  async function review(
    actor: AdminActor,
    id: string,
    key: string,
    input: {
      expectedRevision: number;
      decision: "approve" | "reject";
      reason: string;
    },
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const requests = db.collection(A.financial);
      const row = await requests.findOne(
        {
          _id: adminObjectId(id),
          status: "requested",
          revision: input.expectedRevision,
        },
        { session },
      );
      if (!row)
        return adminError(
          "financial_request_changed",
          "This request changed or has already been reviewed.",
        );
      const now = new Date();
      let status = "rejected";
      let operationId: ObjectId | null = null;
      if (input.decision === "approve") {
        // This write serializes decisions with generation reservations, top-ups
        // and concurrent owner adjustments on the same wallet.
        await db
          .collection(C.creditAccounts)
          .updateOne(
            { userId: row.userId },
            { $inc: { revision: 1 } },
            { session },
          );
        const parsed = {
          ...row,
          userId: String(row.userId),
          ...(row.orderId ? { orderId: String(row.orderId) } : {}),
          ...(row.runId ? { runId: String(row.runId) } : {}),
        } as unknown as AdminFinancialRequest;
        const current = await impact(parsed, session);
        if (digest(current) !== row.impactHash)
          return adminError(
            "financial_impact_changed",
            "The wallet or payment changed. Create a fresh request to review the current impact.",
          );
        if (
          row.kind === "cash-refund" &&
          (!current.gatewayReady || !current.executionEnabled)
        )
          return adminError(
            "cash_refund_gate_closed",
            "Cash refunds require verified gateway identifiers, merchant permissions and approved sandbox acceptance.",
            503,
          );
        if (row.kind === "recovery-render")
          return adminError(
            "paid_preview_gate_closed",
            "Business-funded renders require a separately verified spending adapter and owner budget acceptance.",
            503,
          );
        status = "approved";
        if (row.kind === "credit-adjustment") {
          const slices =
            row.delta < 0
              ? allocateCreditLots(
                  (
                    await loadCreditAllocationState(
                      database,
                      String(row.userId),
                      Number(current.balance),
                      session,
                      true,
                    )
                  ).available,
                  -Number(row.delta),
                )
              : undefined;
          const account = await db
            .collection(C.creditAccounts)
            .findOneAndUpdate(
              { userId: row.userId },
              {
                $inc: { balance: row.delta },
                $set: { updatedAt: now },
                $setOnInsert: { createdAt: now },
              },
              { upsert: true, returnDocument: "after", session },
            );
          await db.collection(C.creditLedger).insertOne(
            {
              userId: row.userId,
              kind: "adjustment",
              ...(slices
                ? { purchaseAllocations: slices, allocationVersion: 1 }
                : {}),
              delta: row.delta,
              balanceAfter: account!.balance,
              reason: row.reason,
              referenceType: "admin_financial_request",
              referenceId: id,
              idempotencyKey: `admin.adjust:${id}`,
              createdAt: now,
            },
            { session },
          );
          status = "confirmed";
        } else {
          if (row.kind === "cash-refund")
            await db
              .collection(C.creditAccounts)
              .updateOne(
                { userId: row.userId },
                { $inc: { refundReserved: current.creditsToRetire } },
                { session },
              );
          operationId = new ObjectId();
          await db.collection(A.operations).insertOne(
            {
              _id: operationId,
              kind: `finance.${row.kind}`,
              financialRequestId: row._id,
              status: "queued",
              availableAt: now,
              attempts: 0,
              requestId: actor.requestId,
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
        }
      }
      await requests.updateOne(
        { _id: row._id, revision: input.expectedRevision },
        {
          $set: {
            status,
            review: {
              ownerId: adminObjectId(actor.userId),
              reason: input.reason,
              decision: input.decision,
              reviewedAt: now,
            },
            operationId,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
        { session },
      );
      if (input.decision === "approve")
        await syncPurchaseAllocations(database, String(row.userId), session);
      await writeAdminAudit(
        database,
        actor,
        `finance.${input.decision}`,
        id,
        { reason: input.reason, kind: row.kind, impact: row.impact, status },
        session,
      );
      return {
        id,
        status,
        revision: input.expectedRevision + 1,
        operationId: operationId?.toHexString() ?? null,
      };
    });
  }
  return { impact, request, review };
}
