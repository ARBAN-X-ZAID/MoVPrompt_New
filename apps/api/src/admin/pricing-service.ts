import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import {
  AdminPricingPolicySchema,
  AdminReasonSchema,
  type AdminPricingPolicy,
} from "@movprompt/contracts";
import type { MongoDatabase } from "@movprompt/db";
import {
  createGenerationPricingFromEnvironment,
  type GenerationPricing,
} from "../generation-pricing.js";
import {
  defaultAdminPricingPolicy,
  generationPricingForPolicy,
} from "../versioned-pricing.js";
import {
  adminError,
  adminJson,
  adminObjectId,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";
export const AdminPricingDraftSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    policy: AdminPricingPolicySchema,
    reason: AdminReasonSchema,
  })
  .strict();
export const AdminPricingPublishSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    draftRevision: z.number().int().positive(),
    impactHash: z.string().regex(/^[a-f0-9]{64}$/),
    reason: AdminReasonSchema,
  })
  .strict();
export function createAdminPricingService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const db = database.db;
  const fallback = createGenerationPricingFromEnvironment(environment);
  function impact(
    before: GenerationPricing,
    after: AdminPricingPolicy,
    revision: number,
    previousPolicy = defaultAdminPricingPolicy(environment),
  ) {
    const pricing = generationPricingForPolicy(after, "candidate");
    const rows = (["template", "ad_studio", "advanced"] as const).flatMap(
      (product) =>
        ([8, 15, 20] as const).flatMap((durationSeconds) =>
          (["480p", "720p"] as const).map((resolution) => {
            const configuration = { durationSeconds, resolution };
            let previous: number | null = null;
            try {
              previous = before.price(
                "video.product_fidelity",
                configuration,
                durationSeconds,
                product,
              ).credits;
            } catch {
              /* Unavailable is distinct from zero. */
            }
            return {
              product,
              durationSeconds,
              resolution,
              previousCredits: previous,
              nextCredits: pricing.price(
                "video.product_fidelity",
                configuration,
                durationSeconds,
                product,
              ).credits,
            };
          }),
        ),
    );
    const impactHash = createHash("sha256")
      .update(JSON.stringify({ revision, policy: after, rows }))
      .digest("hex");
    const packageChanges = [
      ...new Set([
        ...previousPolicy.packages.map((item) => item.id),
        ...after.packages.map((item) => item.id),
      ]),
    ].map((id) => ({
      id,
      before: previousPolicy.packages.find((item) => item.id === id) ?? null,
      after: after.packages.find((item) => item.id === id) ?? null,
    }));
    return {
      rows,
      impactHash,
      packageChanges,
      customTopUp: {
        before: previousPolicy.customTopUp,
        after: after.customTopUp,
      },
      entitlements: {
        before: previousPolicy.entitlements,
        after: after.entitlements,
      },
      quotePolicy:
        "Existing unexpired server quotes and pending orders retain their original snapshots.",
    };
  }
  async function load() {
    const head = await db
      .collection("admin_pricing_heads")
      .findOne({ key: "current" });
    const version = head?.versionId
      ? await db
          .collection("admin_pricing_versions")
          .findOne({ _id: adminObjectId(String(head.versionId)) })
      : null;
    const draft = await db
      .collection("admin_pricing_drafts")
      .findOne({ key: "current" });
    const policy = version
      ? AdminPricingPolicySchema.parse(version.policy)
      : defaultAdminPricingPolicy(environment);
    const candidate =
      draft?.status === "draft"
        ? AdminPricingPolicySchema.parse(draft.policy)
        : policy;
    const before = version
      ? generationPricingForPolicy(policy, `pricing:${version._id}`)
      : fallback;
    return adminJson({
      headRevision: Number(head?.revision ?? 0),
      versionId: version?._id ?? null,
      policy,
      draft:
        draft?.status === "draft" ? draft : draft ? { ...draft, policy } : null,
      impact: impact(before, candidate, Number(head?.revision ?? 0), policy),
      publishingEnabled: environment.ADMIN_PRICING_ENABLED === "true",
      versions: await db
        .collection("admin_pricing_versions")
        .find(
          {},
          { projection: { createdAt: 1, number: 1, reason: 1, ownerId: 1 } },
        )
        .sort({ number: -1 })
        .limit(50)
        .toArray(),
    });
  }
  async function save(
    actor: AdminActor,
    key: string,
    input: z.infer<typeof AdminPricingDraftSchema>,
  ) {
    return security.command(actor, key, input, async (session) => {
      await db
        .collection("admin_pricing_heads")
        .updateOne(
          { key: "current" },
          { $setOnInsert: { revision: 0 }, $inc: { draftFence: 1 } },
          { upsert: true, session },
        );
      const previous = await db
        .collection("admin_pricing_drafts")
        .findOne({ key: "current" }, { session });
      if (Number(previous?.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "pricing_draft_changed",
          "Reload the pricing draft before saving.",
        );
      const now = new Date();
      const draft = {
        key: "current",
        revision: input.expectedRevision + 1,
        policy: input.policy,
        status: "draft",
        reason: input.reason,
        ownerId: adminObjectId(actor.userId),
        updatedAt: now,
      };
      await db
        .collection("admin_pricing_drafts")
        .updateOne(
          { key: "current" },
          { $set: draft },
          { upsert: true, session },
        );
      await db
        .collection("admin_pricing_draft_revisions")
        .insertOne({ ...draft, createdAt: now }, { session });
      await writeAdminAudit(
        database,
        actor,
        "pricing.draft-save",
        "current",
        { revision: draft.revision, reason: input.reason },
        session,
      );
      return { revision: draft.revision };
    });
  }
  async function publish(
    actor: AdminActor,
    key: string,
    input: z.infer<typeof AdminPricingPublishSchema>,
  ) {
    if (environment.ADMIN_PRICING_ENABLED !== "true")
      return adminError(
        "pricing_publishing_disabled",
        "Pricing publishing is not enabled for rollout.",
      );
    return security.command(actor, key, input, async (session) => {
      const head = await db
        .collection("admin_pricing_heads")
        .findOne({ key: "current" }, { session });
      const draft = await db
        .collection("admin_pricing_drafts")
        .findOne(
          { key: "current", revision: input.draftRevision, status: "draft" },
          { session },
        );
      if (!draft || Number(head?.revision ?? 0) !== input.expectedRevision)
        return adminError(
          "pricing_publication_changed",
          "Reload the price impact before owner approval.",
        );
      const policy = AdminPricingPolicySchema.parse(draft.policy);
      const previous = head?.versionId
        ? await db
            .collection("admin_pricing_versions")
            .findOne(
              { _id: adminObjectId(String(head.versionId)) },
              { session },
            )
        : null;
      const before = previous
        ? generationPricingForPolicy(
            AdminPricingPolicySchema.parse(previous.policy),
            `pricing:${previous._id}`,
          )
        : fallback;
      const reviewed = impact(
        before,
        policy,
        input.expectedRevision,
        previous
          ? AdminPricingPolicySchema.parse(previous.policy)
          : defaultAdminPricingPolicy(environment),
      );
      if (reviewed.impactHash !== input.impactHash)
        return adminError(
          "pricing_impact_changed",
          "Review the current price impact before publishing.",
        );
      const id = new ObjectId();
      const now = new Date();
      const number = input.expectedRevision + 1;
      await db.collection("admin_pricing_versions").insertOne(
        {
          _id: id,
          number,
          policy,
          reason: input.reason,
          ownerId: adminObjectId(actor.userId),
          impact: reviewed,
          previousVersionId: previous?._id ?? null,
          createdAt: now,
        },
        { session },
      );
      await db
        .collection("admin_pricing_heads")
        .updateOne(
          { key: "current" },
          { $set: { versionId: String(id), revision: number, updatedAt: now } },
          { upsert: true, session },
        );
      await db
        .collection("admin_pricing_drafts")
        .updateOne(
          { _id: draft._id },
          { $set: { status: "published", versionId: id, updatedAt: now } },
          { session },
        );
      await writeAdminAudit(
        database,
        actor,
        "pricing.publish",
        String(id),
        { reason: input.reason, number, impact: reviewed },
        session,
      );
      return { versionId: String(id), revision: number };
    });
  }
  return { load, save, publish };
}
