import { erasurePolicyHash } from "./account-erasure.js";
import { retentionPolicy } from "./media-retention.js";
import { ObjectId } from "mongodb";
import type { z } from "zod";
import type { MongoDatabase } from "@movprompt/db";
import { AdminPrivacyReviewSchema } from "@movprompt/contracts";
import { createCustomerDataService } from "./customer-data.js";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

export function createAdminPrivacyService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>> = {},
) {
  const operations = database.db.collection(A.operations);
  const customerData = createCustomerDataService(database, environment);
  async function load(id: string) {
    const row = await operations.findOne(
      { _id: adminObjectId(id), kind: "customer.delete-request" },
      {
        projection: {
          userId: 1,
          status: 1,
          privacyRevision: 1,
          eligibleAt: 1,
          erasedAt: 1,
          approvedPolicyVersion: 1,
          mediaCleanupResult: 1,
          manifest: 1,
          nextStep: 1,
          review: 1,
          failureCode: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    );
    if (!row)
      return adminError(
        "privacy_request_not_found",
        "This privacy request was not found.",
        404,
      );
    return adminJson({ ...row, privacyRevision: row.privacyRevision ?? 0 });
  }
  async function review(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof AdminPrivacyReviewSchema>,
  ) {
    // Read-only inventory may run outside the mutation transaction. The resulting
    // manifest is advisory and cannot authorize a purge or bypass retention.
    const request = await operations.findOne({
      _id: adminObjectId(id),
      kind: "customer.delete-request",
    });
    if (!request)
      return adminError(
        "privacy_request_not_found",
        "This privacy request was not found.",
        404,
      );
    const manifest =
      input.action !== "cancel-request"
        ? await customerData.deletionManifest(request.userId)
        : null;
    return security.command(actor, key, { id, ...input }, async (session) => {
      const row = await operations.findOne(
        { _id: request._id, kind: "customer.delete-request" },
        { session },
      );
      if (
        !row ||
        (row.privacyRevision ?? 0) !== input.expectedRevision ||
        ["cancelled", "erased"].includes(row.status)
      )
        return adminError(
          "privacy_request_changed",
          "Reload this privacy request before reviewing it.",
        );
      if (row.status === "running")
        return adminError(
          "privacy_manifest_busy",
          "Wait for the current inventory operation to finish.",
        );
      const now = new Date();
      if (input.action === "approve-erasure") {
        const policy = retentionPolicy(environment);
        if (!policy.enabled)
          return adminError(
            "privacy_retention_gate_closed",
            "A reviewed retention policy and execution gate are required before erasure.",
            503,
          );
        if (
          !manifest ||
          manifest.manifestHash !== input.manifestHash ||
          policy.version !== input.policyVersion ||
          String(row.userId) !== input.confirmCustomerId
        )
          return adminError(
            "privacy_review_changed",
            "Review the exact customer, manifest and retention policy again.",
          );
        if (manifest.blockers.length)
          return adminError(
            "privacy_review_blocked",
            "Resolve the listed financial, legal and active-operation blockers first.",
          );
        if (
          row.status !== "review-required" ||
          (await database.db
            .collection(A.owners)
            .findOne({ userId: row.userId, role: "owner" }, { session }))
        )
          return adminError(
            "privacy_review_blocked",
            "This account cannot be scheduled for erasure.",
          );
        const user = await database.db
          .collection("users")
          .findOne(
            { _id: row.userId, deletionOperationId: row._id },
            { session },
          );
        if (!user?.deletionRequestedAt)
          return adminError(
            "privacy_request_changed",
            "Reload the current account deletion request.",
          );
        const eligibleAt = new Date(
          new Date(user.deletionRequestedAt).getTime() +
            policy.accountErasureGraceDays! * 86400000,
        );
        const result = {
          status: "erasure-scheduled",
          privacyRevision: input.expectedRevision + 1,
          approvedManifestHash: manifest.manifestHash,
          approvedPolicyVersion: policy.version,
          approvedPolicyHash: erasurePolicyHash(environment),
          eligibleAt,
          review: {
            actorId: adminObjectId(actor.userId),
            reason: input.reason,
            action: input.action,
            reviewedAt: now,
          },
          updatedAt: now,
        };
        await operations.updateOne(
          { _id: row._id },
          { $set: result },
          { session },
        );
        await operations.insertOne(
          {
            _id: new ObjectId(),
            kind: "privacy.erase",
            privacyRequestId: row._id,
            approvedManifestHash: manifest.manifestHash,
            approvedPolicyHash: erasurePolicyHash(environment),
            actorId: adminObjectId(actor.userId),
            status: "queued",
            attempts: 0,
            availableAt: eligibleAt > now ? eligibleAt : now,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        await writeAdminAudit(
          database,
          actor,
          "privacy.erasure-approved",
          id,
          {
            manifestHash: manifest.manifestHash,
            policyVersion: policy.version,
            eligibleAt,
            reason: input.reason,
          },
          session,
        );
        return adminJson({ id, ...result });
      }
      await operations.updateMany(
        { kind: "privacy.erase", privacyRequestId: row._id, status: "queued" },
        { $set: { status: "cancelled", updatedAt: now } },
        { session },
      );
      if (input.action === "cancel-request") {
        await database.db.collection("users").updateOne(
          { _id: row.userId, deletionOperationId: row._id },
          {
            $unset: { deletionRequestedAt: "", deletionOperationId: "" },
            $set: { updatedAt: now },
          },
          { session },
        );
      }
      const result = {
        status:
          input.action === "cancel-request" ? "cancelled" : "review-required",
        privacyRevision: input.expectedRevision + 1,
        review: {
          actorId: adminObjectId(actor.userId),
          reason: input.reason,
          action: input.action,
          reviewedAt: now,
        },
        ...(manifest ? { manifest } : {}),
        updatedAt: now,
        leaseOwner: null,
        leaseExpiresAt: null,
      };
      await operations.updateOne(
        { _id: row._id },
        { $set: result },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        `privacy.${input.action}`,
        id,
        {
          reason: input.reason,
          revision: result.privacyRevision,
          manifestHash: manifest?.manifestHash ?? null,
        },
        session,
      );
      return adminJson({ id, ...result });
    });
  }
  return { load, review };
}
