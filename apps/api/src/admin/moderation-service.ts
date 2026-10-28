import { ObjectId } from "mongodb";
import type { z } from "zod";
import type { AdminModerationDecisionSchema } from "@movprompt/contracts";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";
import { applyAdminAssetAction } from "./asset-moderation.js";
export function createAdminModerationService(
  database: MongoDatabase,
  security: AdminSecurity,
) {
  const db = database.db;
  async function decide(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof AdminModerationDecisionSchema>,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const row = await db.collection(A.moderation).findOne(
        {
          _id: adminObjectId(id),
          revision: input.expectedRevision,
          status: "open",
        },
        { session },
      );
      if (!row)
        return adminError(
          "moderation_review_changed",
          "Reload the open review before deciding.",
        );
      const now = new Date();
      let operationId: ObjectId | null = null;
      if (
        input.action === "quarantine-asset" ||
        input.action === "withdraw-permission"
      ) {
        if (!row.assetId)
          return adminError(
            "moderation_asset_required",
            "This review needs a linked customer asset.",
          );
        const asset = await db
          .collection("creator_reference_library")
          .findOne({ _id: row.assetId, userId: row.userId }, { session });
        if (!asset)
          return adminError(
            "moderation_link_invalid",
            "The linked asset is unavailable or has a different owner.",
          );
        await applyAdminAssetAction(
          database,
          actor,
          String(row.assetId),
          {
            expectedRevision: input.assetRevision,
            action:
              input.action === "quarantine-asset"
                ? "quarantine"
                : "withdraw-permission",
            reason: input.reason,
          },
          session,
        );
      }
      if (input.action === "suspend-account") {
        if (
          await db
            .collection(A.owners)
            .findOne({ userId: row.userId, role: "owner" }, { session })
        )
          return adminError(
            "last_owner_protected",
            "The designated owner cannot be suspended through moderation.",
          );
        const result = await db.collection("users").updateOne(
          { _id: row.userId },
          {
            $set: {
              suspendedAt: now,
              suspensionReason: input.reason,
              updatedAt: now,
            },
          },
          { session },
        );
        if (!result.matchedCount)
          return adminError(
            "admin_customer_not_found",
            "Customer not found.",
            404,
          );
        await db
          .collection("sessions")
          .deleteMany({ userId: row.userId }, { session });
      }
      if (input.action === "request-cancellation") {
        const run = await db.collection(C.renderRuns).findOne(
          {
            _id: adminObjectId(input.runId!),
            userId: row.userId,
            ...(row.projectId ? { projectId: row.projectId } : {}),
            status: {
              $in: ["submitting", "queued", "processing", "cancelling"],
            },
          },
          { session },
        );
        if (!run)
          return adminError(
            "moderation_run_unavailable",
            "Choose a related active generation. Completed outputs cannot be cancelled.",
          );
        operationId = new ObjectId();
        await db.collection(A.operations).insertOne(
          {
            _id: operationId,
            userId: row.userId,
            runId: run._id,
            kind: "generation.cancel",
            status: "queued",
            availableAt: now,
            retryCount: 0,
            createdAt: now,
            updatedAt: now,
            actorId: adminObjectId(actor.userId),
            reason: input.reason,
            moderationId: row._id,
          },
          { session },
        );
      }
      const decision = {
        action: input.action,
        reason: input.reason,
        ownerId: adminObjectId(actor.userId),
        reviewedAt: now,
        ...(operationId
          ? { operationId, outcome: "requested" }
          : { outcome: "applied" }),
      };
      const status = operationId
        ? "action-requested"
        : input.action === "dismiss"
          ? "dismissed"
          : "restricted";
      await db
        .collection(A.moderation)
        .updateOne(
          { _id: row._id, revision: input.expectedRevision },
          { $set: { status, decision, updatedAt: now }, $inc: { revision: 1 } },
          { session },
        );
      await writeAdminAudit(
        database,
        actor,
        `moderation.${input.action}`,
        id,
        {
          reason: input.reason,
          userId: row.userId,
          assetId: row.assetId ?? null,
          operationId,
          clinicReviewNotBypassed: row.category === "clinic-review",
        },
        session,
      );
      return adminJson({
        id,
        status,
        revision: input.expectedRevision + 1,
        decision,
        ...(operationId ? { operationId } : {}),
        acceptedOutputsPreserved: true,
      });
    });
  }
  return { decide };
}
