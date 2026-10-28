import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { TemplateCampaignPayloadSchema } from "@movprompt/contracts";
import {
  CreativeBriefSchema,
  compileTemplatePrompt,
  resolveDurationRecipe,
  CreativeTemplateRecipeSchema,
} from "@movprompt/creative-engine";
import {
  COLLECTIONS as C,
  createMongoGenerationService,
  mongoTemplateCatalogDocuments,
  resolveStoredTemplateDefinition,
  assertLibraryConfiguration,
  type MongoDatabase,
} from "@movprompt/db";
import { createCapabilityRegistryFromEnvironment } from "@movprompt/providers";
import {
  createGenerationApiService,
  type GenerationApiService,
} from "../generation-service.js";
import { createMongoGenerationRepository } from "../mongo-generation-repository.js";
import { createVersionedPricingResolver } from "../versioned-pricing.js";
import { createGenerationPricingFromEnvironment } from "../generation-pricing.js";
import { createAdminOwnedMediaService } from "./owned-media-service.js";
import type { AssetStorageGateway } from "../asset-storage.js";
import { templateOutputHash } from "./template-publishing.js";
import {
  ADMIN_COLLECTIONS as A,
  adminError,
  adminObjectId,
  adminJson,
  writeAdminAudit,
  type AdminActor,
  type AdminSecurity,
} from "./security.js";

export const BUSINESS_RENDERS = "admin_business_renders";
export const BusinessRenderInputSchema = z
  .object({
    purpose: z.enum(["preview", "recovery"]),
    sourceVersionId: z.string().regex(/^[a-f0-9]{24}$/i),
    templateId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    draftRevision: z.number().int().positive().optional(),
    originalRunId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .optional(),
    publicPreviewPermissionConfirmed: z.boolean().default(false),
    reason: z.string().trim().min(8).max(1000),
  })
  .strict();
export const BusinessRenderReviewSchema = z
  .object({
    action: z.enum(["approve", "reject", "retry-preparation"]),
    expectedRevision: z.number().int().positive(),
    expectedCostMicrousd: z.number().int().positive().optional(),
    reason: z.string().trim().min(8).max(1000),
  })
  .strict();

export function createBusinessGenerationFactory(
  database: MongoDatabase,
  environment: NodeJS.ProcessEnv,
) {
  const pricing = createVersionedPricingResolver(database, environment);
  const domain = createMongoGenerationService(database, environment);
  return (requestId: string): GenerationApiService =>
    createGenerationApiService({
      repository: createMongoGenerationRepository(database, {
        businessRequestId: requestId,
      }),
      generation: {
        ...domain,
        createQuote: (input) =>
          domain.createQuote({ ...input, businessFundingId: requestId }),
      },
      pricing: createGenerationPricingFromEnvironment(environment),
      capabilities: createCapabilityRegistryFromEnvironment(environment),
      assertLibraryReferences: (userId, configuration) =>
        assertLibraryConfiguration(database, userId, configuration),
      freeAccounts: true,
      starterOnly: false,
      starterRenders: false,
      resolvePricing: async () => {
        const current = await pricing.current();
        return {
          pricing: current.pricing,
          policy: {
            entitlements: {
              freeAccounts: true,
              starterOnly: false,
              starterRenders: false,
            },
          },
        };
      },
    });
}
function costPolicy(environment: Readonly<Record<string, string | undefined>>) {
  const attempt = Number(environment.ADMIN_BUSINESS_MAX_ATTEMPT_COST_USD);
  const daily = Number(environment.ADMIN_BUSINESS_DAILY_BUDGET_USD);
  if (
    !Number.isFinite(attempt) ||
    !Number.isFinite(daily) ||
    attempt <= 0 ||
    daily < attempt ||
    !Number.isSafeInteger(Math.round(daily * 1e6))
  )
    return adminError(
      "admin_business_cost_unavailable",
      "Configure reviewed USD cost ceilings and a daily business budget before preparing paid requests.",
      503,
    );
  return {
    perAttempt: Math.ceil(attempt * 1e6),
    daily: Math.floor(daily * 1e6),
  };
}
export function createAdminBusinessRenderService(
  database: MongoDatabase,
  security: AdminSecurity,
  environment: Readonly<Record<string, string | undefined>>,
) {
  const db = database.db;
  const requests = db.collection(BUSINESS_RENDERS);
  async function request(
    actor: AdminActor,
    key: string,
    input: z.infer<typeof BusinessRenderInputSchema>,
  ) {
    const costs = costPolicy(environment);
    return security.command(actor, key, input, async (session) => {
      const source = await db
        .collection(C.creatorProjectVersions)
        .findOne(
          { _id: adminObjectId(input.sourceVersionId), mode: "template" },
          { session },
        );
      if (!source)
        return adminError(
          "admin_business_source_missing",
          "Choose a saved compatible campaign version.",
          404,
        );
      if (
        !(await db
          .collection("users")
          .findOneAndUpdate(
            { _id: source.userId, erasedAt: null, deletionRequestedAt: null },
            { $inc: { adminMutationFence: 1 } },
            { session, returnDocument: "after" },
          ))
      )
        return adminError(
          "admin_business_customer_unavailable",
          "This account cannot start a new business render.",
        );
      const project = await db
        .collection(C.creatorProjects)
        .findOne(
          { _id: source.projectId, userId: source.userId, deletedAt: null },
          { session },
        );
      if (!project)
        return adminError(
          "admin_business_source_missing",
          "The source campaign is unavailable.",
          404,
        );
      if (input.purpose === "preview" && String(source.userId) !== actor.userId)
        return adminError(
          "admin_business_preview_ownership",
          "Public previews must use the owner's own company references.",
          403,
        );
      const template = await db
        .collection(C.videoTemplateVersions)
        .findOne({ _id: source.templateVersionId }, { session });
      const head = template
        ? await db
            .collection(C.videoTemplates)
            .findOne({ _id: template.templateId }, { session })
        : null;
      if (!template || !head)
        return adminError(
          "admin_business_template_missing",
          "The pinned template is unavailable.",
        );
      let definition = resolveStoredTemplateDefinition(
        template,
        String(template.recipe?.familyId ?? head.slug),
      );
      const requestId = new ObjectId();
      let candidateTemplateVersionId = String(template._id);
      if (input.purpose === "preview") {
        if (
          !input.templateId ||
          !input.draftRevision ||
          !input.publicPreviewPermissionConfirmed
        )
          return adminError(
            "admin_business_preview_review",
            "Select a saved template draft and confirm public preview rights.",
          );
        const draft = await db.collection(A.templateDrafts).findOne(
          {
            templateId: adminObjectId(input.templateId),
            revision: input.draftRevision,
            status: "draft",
            "validation.passed": true,
          },
          { session },
        );
        if (!draft || draft.definition.id !== definition.id)
          return adminError(
            "admin_business_draft_changed",
            "Save and validate a matching family draft before preparing its preview.",
          );
        definition = CreativeTemplateRecipeSchema.parse({
          ...draft.definition,
          versionNumber: definition.versionNumber + 1,
        });
        const record = mongoTemplateCatalogDocuments([definition]).versions[0]!;
        const {
          _id: _ignored,
          id: _id,
          templateId: _templateId,
          ...fields
        } = record as Document;
        candidateTemplateVersionId = String(new ObjectId());
        await db.collection(C.videoTemplateVersions).insertOne(
          {
            ...fields,
            _id: adminObjectId(candidateTemplateVersionId),
            templateId: adminObjectId(input.templateId),
            publishedAt: null,
            recipe: {
              ...record.recipe,
              businessRequestId: String(requestId),
              familyId: definition.id,
            },
          },
          { session },
        );
      } else {
        const original = input.originalRunId
          ? await db.collection(C.renderRuns).findOne(
              {
                _id: adminObjectId(input.originalRunId),
                projectVersionId: source._id,
                userId: source.userId,
                status: { $in: ["failed", "cancelled", "completed"] },
              },
              { session },
            )
          : null;
        const uncertain = original
          ? await db.collection(C.renderAttempts).findOne(
              {
                renderRunId: original._id,
                $or: [
                  { status: { $in: ["submitting", "uncertain"] } },
                  { submissionState: "uncertain" },
                ],
              },
              { session },
            )
          : null;
        if (
          !original ||
          uncertain ||
          /unknown|uncertain|reconcil/i.test(String(original.errorCode ?? ""))
        )
          return adminError(
            "admin_business_reconcile_first",
            "Reconcile the existing provider operation before requesting another render.",
          );
        const previousRequests = await requests
          .find(
            { originalRunId: input.originalRunId, userId: source.userId },
            { session, projection: { runId: 1 } },
          )
          .limit(1001)
          .toArray();
        if (previousRequests.length > 1000)
          return adminError(
            "admin_business_reconcile_first",
            "Review the prior funded attempts before another request.",
          );
        const runIds = [
          original._id,
          ...previousRequests
            .filter((row) => row.runId)
            .map((row) => adminObjectId(String(row.runId))),
        ];
        const outstanding = await db.collection(C.renderAttempts).findOne(
          {
            renderRunId: { $in: runIds },
            $or: [
              {
                status: {
                  $in: ["submitting", "submitted", "processing", "uncertain"],
                },
              },
              { submissionState: "uncertain" },
            ],
          },
          { session },
        );
        const unknownPrior = await db.collection(C.renderRuns).findOne(
          {
            _id: { $in: runIds },
            $or: [
              {
                status: {
                  $in: ["submitting", "queued", "processing", "cancelling"],
                },
              },
              { errorCode: /unknown|uncertain|reconcil/i },
            ],
          },
          { session },
        );
        if (outstanding || unknownPrior)
          return adminError(
            "admin_business_reconcile_first",
            "Reconcile all prior provider and funded attempts before requesting another render.",
          );
        if (
          await requests.findOne(
            {
              originalRunId: input.originalRunId,
              userId: source.userId,
              active: true,
            },
            { session },
          )
        )
          return adminError(
            "admin_business_request_active",
            "A funded request for this original run is already pending or active.",
          );
      }
      if (definition.verticals.includes("clinic"))
        return adminError(
          "admin_business_clinic_review",
          "Documented external clinic review is required; owner funding cannot bypass it.",
        );
      const configuration = structuredClone(source.configuration);
      const generation = configuration.generation;
      if (input.purpose === "preview") {
        const brief = generation.creativeBrief;
        const photos = configuration.creatorProject.product.images.filter(
          (photo: Document) => photo.selected !== false,
        );
        brief.templateRecipeVersion = definition.versionNumber;
        brief.templatePromptVersion = `${definition.id}-v${definition.versionNumber}`;
        brief.templateVisualSystem = definition.visualSystem;
        brief.qualityPolicy = definition.qualityPolicy;
        const scenes = resolveDurationRecipe({
          id: definition.id,
          durationRecipes: definition.durationRecipes!,
          duration: generation.durationSeconds,
          photos,
        });
        brief.durationVariant = scenes.id;
        brief.scenes = scenes.scenes.map((scene, index) => ({
          ...scene,
          ...(brief.scenes[index]?.headline
            ? { headline: brief.scenes[index].headline }
            : {}),
        }));
        configuration.creatorProject.templateDefinition = definition;
        configuration.creatorProject.pinnedTemplateVersionId =
          candidateTemplateVersionId;
        generation.prompt = compileTemplatePrompt({
          templateDefinition: definition,
          brief: CreativeBriefSchema.parse(brief),
          photos,
          aspectRatio: generation.aspectRatio,
          audio: generation.audio,
        }).prompt;
      }
      TemplateCampaignPayloadSchema.parse({
        configuration,
        productRecipe: source.productRecipe,
        campaignRecipe: source.campaignRecipe,
      });
      const now = new Date();
      const nextVersionId = String(new ObjectId());
      await db
        .collection(C.creatorProjects)
        .updateOne(
          { _id: project._id },
          { $inc: { revision: 1 } },
          { session },
        );
      const latest = await db
        .collection(C.creatorProjectVersions)
        .find({ projectId: project._id, userId: source.userId }, { session })
        .sort({ versionNumber: -1 })
        .limit(1)
        .next();
      await db.collection(C.creatorProjectVersions).insertOne(
        {
          ...source,
          _id: adminObjectId(nextVersionId),
          templateVersionId: adminObjectId(candidateTemplateVersionId),
          parentVersionId: source._id,
          versionNumber:
            Number(latest?.versionNumber ?? source.versionNumber) + 1,
          configuration,
          changeReason:
            "Business-funded candidate; requires customer acceptance",
          businessRequestId: String(requestId),
          createdAt: now,
        },
        { session },
      );
      const worstCaseMicrousd =
        costs.perAttempt * (1 + definition.qualityPolicy.internalRetryLimit);
      if (worstCaseMicrousd > costs.daily)
        return adminError(
          "admin_business_budget_too_small",
          "The daily business budget is below this request's worst-case cost ceiling.",
        );
      const record = {
        _id: requestId,
        ...input,
        sourceVersionId: source._id,
        userId: source.userId,
        projectId: source.projectId,
        projectVersionId: nextVersionId,
        candidateTemplateVersionId,
        templateId: input.templateId
          ? adminObjectId(input.templateId)
          : head._id,
        definition,
        outputHash: templateOutputHash(definition),
        status: "preparing",
        active: true,
        revision: 1,
        worstCaseMicrousd,
        perAttemptMicrousd: costs.perAttempt,
        currency: "USD",
        costBasis:
          "configured ceiling including quality retries; actual provider costs may be unavailable",
        requestedBy: adminObjectId(actor.userId),
        runId: null,
        createdAt: now,
        updatedAt: now,
      };
      await requests.insertOne(record, { session });
      await db.collection(A.operations).insertOne(
        {
          kind: "business.prepare",
          businessRequestId: requestId,
          actorId: adminObjectId(actor.userId),
          status: "queued",
          attempts: 0,
          availableAt: now,
          createdAt: now,
          updatedAt: now,
        },
        { session },
      );
      await writeAdminAudit(
        database,
        actor,
        "business-render.request",
        String(requestId),
        {
          purpose: input.purpose,
          sourceVersionId: source._id,
          worstCaseMicrousd,
          reason: input.reason,
        },
        session,
      );
      return {
        id: String(requestId),
        status: "preparing",
        revision: 1,
        worstCaseMicrousd,
        currency: "USD",
      };
    });
  }
  async function review(
    actor: AdminActor,
    id: string,
    key: string,
    input: z.infer<typeof BusinessRenderReviewSchema>,
  ) {
    return security.command(actor, key, { id, ...input }, async (session) => {
      const row = await requests.findOne(
        { _id: adminObjectId(id), revision: input.expectedRevision },
        { session },
      );
      if (!row)
        return adminError(
          "admin_business_changed",
          "Reload this request before reviewing it.",
        );
      const now = new Date();
      if (input.action === "approve") {
        if (
          environment.ADMIN_BUSINESS_RENDERS_ENABLED !== "true" ||
          environment.ADMIN_BUSINESS_COST_ACCEPTANCE_VERIFIED !== "true"
        )
          return adminError(
            "admin_business_gate_closed",
            "Business-funded execution awaits explicit paid-budget and provider-cost acceptance.",
            503,
          );
        if (
          row.status !== "ready" ||
          row.worstCaseMicrousd !== input.expectedCostMicrousd
        )
          return adminError(
            "admin_business_changed",
            "Review the prepared quote and cost ceiling again.",
          );
        const quote = await db.collection(C.generationQuotes).findOne(
          {
            _id: adminObjectId(row.quoteId),
            businessFundingId: String(row._id),
            expiresAt: { $gt: new Date(Date.now() + 300000) },
          },
          { session },
        );
        if (!quote)
          return adminError(
            "admin_business_quote_expired",
            "Reprepare this quote before approval.",
          );
        const costs = costPolicy(environment);
        if (row.perAttemptMicrousd !== costs.perAttempt)
          return adminError(
            "admin_business_cost_changed",
            "Reprepare after a cost-policy change.",
          );
        const day = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Kuwait",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(now);
        const budget = await db
          .collection("admin_business_budget_days")
          .findOneAndUpdate(
            { _id: day as never },
            {
              $inc: { reservedMicrousd: row.worstCaseMicrousd },
              $set: { updatedAt: now },
            },
            { session, upsert: true, returnDocument: "after" },
          );
        if (Number(budget?.reservedMicrousd) > costs.daily)
          return adminError(
            "admin_business_daily_budget",
            "This request exceeds the remaining daily business budget.",
          );
        await requests.updateOne(
          { _id: row._id },
          {
            $set: {
              status: "approved",
              approvedBy: adminObjectId(actor.userId),
              approvalReason: input.reason,
              approvedAt: now,
              budgetDay: day,
              updatedAt: now,
            },
            $inc: { revision: 1 },
          },
          { session },
        );
        await db.collection(A.operations).insertOne(
          {
            kind: "business.start",
            businessRequestId: row._id,
            actorId: adminObjectId(actor.userId),
            status: "queued",
            attempts: 0,
            availableAt: now,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      } else if (input.action === "reject") {
        if (!["preparing", "ready"].includes(row.status))
          return adminError(
            "admin_business_changed",
            "This request is already executing or terminal.",
          );
        await requests.updateOne(
          { _id: row._id },
          {
            $set: {
              status: "rejected",
              active: false,
              reviewReason: input.reason,
              updatedAt: now,
            },
            $inc: { revision: 1 },
          },
          { session },
        );
      } else {
        if (!["preparing", "ready"].includes(row.status))
          return adminError(
            "admin_business_changed",
            "This request cannot be reprepared.",
          );
        const active = await db.collection(A.operations).findOne(
          {
            businessRequestId: row._id,
            kind: "business.prepare",
            status: { $in: ["queued", "running"] },
          },
          { session },
        );
        if (active)
          return adminError(
            "admin_business_busy",
            "Wait for the current preparation job.",
          );
        await requests.updateOne(
          { _id: row._id },
          {
            $set: { status: "preparing", updatedAt: now },
            $inc: { revision: 1 },
          },
          { session },
        );
        await db.collection(A.operations).insertOne(
          {
            kind: "business.prepare",
            businessRequestId: row._id,
            actorId: adminObjectId(actor.userId),
            status: "queued",
            attempts: 0,
            availableAt: now,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
      }
      await writeAdminAudit(
        database,
        actor,
        `business-render.${input.action}`,
        id,
        { reason: input.reason, worstCaseMicrousd: row.worstCaseMicrousd },
        session,
      );
      return {
        id,
        status:
          input.action === "approve"
            ? "approved"
            : input.action === "reject"
              ? "rejected"
              : "preparing",
        revision: input.expectedRevision + 1,
      };
    });
  }
  return { request, review };
}

export async function executeBusinessRender(
  database: MongoDatabase,
  row: Document,
  input: {
    environment: Readonly<Record<string, string | undefined>>;
    security: AdminSecurity;
    storage?: AssetStorageGateway;
    generation: (id: string) => GenerationApiService;
    ready: () => Promise<boolean>;
  },
) {
  const requests = database.db.collection(BUSINESS_RENDERS);
  const request = await requests.findOne({ _id: row.businessRequestId });
  if (!request) throw new Error("admin_business_request_missing");
  if (["rejected", "completed", "failed"].includes(request.status))
    return { status: request.status };
  const generation = input.generation(String(request._id));
  if (row.kind === "business.prepare") {
    if (request.status !== "preparing") return { status: "superseded" };
    const user = await database.db.collection("users").findOne({
      _id: request.userId,
      suspendedAt: null,
      deletionRequestedAt: null,
    });
    if (!user) throw new Error("admin_business_customer_unavailable");
    const quote = await generation.createQuote(
      { projectVersionId: request.projectVersionId },
      {
        user: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified === true,
        },
        session: { id: "business-preparation" },
      },
    );
    if (!quote.quoteId || quote.credits !== 0 || quote.entitlementEligible)
      throw new Error("admin_business_quote_invalid");
    await database.transaction(async (session) => {
      await database.db.collection(C.generationQuotes).updateOne(
        { _id: adminObjectId(String(quote.quoteId)), userId: request.userId },
        {
          $set: {
            businessFundingId: String(request._id),
            expiresAt: new Date(Date.now() + 86400000),
          },
        },
        { session },
      );
      await requests.updateOne(
        { _id: request._id, status: "preparing" },
        {
          $set: {
            status: "ready",
            quoteId: quote.quoteId,
            configurationHash: quote.configurationHash,
            preparedAt: new Date(),
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { session },
      );
    });
    return {
      status: "review-required",
      businessRequestId: String(request._id),
    };
  }
  if (row.kind === "business.start") {
    if (!request.runId && !(await input.ready()))
      throw new Error("admin_business_runtime_unavailable");
    const run = request.runId
      ? { id: String(request.runId) }
      : await generation.startRender({
          userId: String(request.userId),
          projectId: String(request.projectId),
          projectVersionId: request.projectVersionId,
          quoteId: request.quoteId,
          idempotencyKey: `business.render:${request._id}`,
          businessAuthorization: String(request._id),
        });
    const now = new Date();
    await database.db.collection(A.operations).updateOne(
      { kind: "business.monitor", businessRequestId: request._id },
      {
        $setOnInsert: {
          kind: "business.monitor",
          businessRequestId: request._id,
          actorId: request.requestedBy,
          status: "queued",
          attempts: 0,
          availableAt: new Date(now.getTime() + 30000),
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
    return { runId: run.id, businessRequestId: String(request._id) };
  }
  const run = request.runId
    ? await database.db
        .collection(C.renderRuns)
        .findOne({ _id: adminObjectId(request.runId), userId: request.userId })
    : null;
  if (!run || !["completed", "failed", "cancelled"].includes(run.status))
    throw new Error("admin_business_pending");
  if (run.status !== "completed") {
    await requests.updateOne(
      { _id: request._id },
      {
        $set: {
          status: "failed",
          active: false,
          failureCode: run.errorCode ?? run.status,
          updatedAt: new Date(),
        },
      },
    );
    return { status: "review-required", runId: String(run._id) };
  }
  const proof = await database.db.collection(C.renderAttempts).findOne({
    renderRunId: run._id,
    attemptNumber: run.qualityAttempt,
    status: "accepted",
    "qualityDecision.status": "accepted",
    qualityScore: { $gte: request.definition.qualityPolicy.acceptanceScore },
  });
  if (!proof || !run.outputObjectKey)
    throw new Error("admin_business_quality_evidence_missing");
  if (request.purpose === "preview") {
    const owned = createAdminOwnedMediaService(
      database,
      input.security,
      input.storage,
    );
    const media = (await owned.importRevision(
      {
        userId: String(request.requestedBy),
        sessionId: "worker",
        requestId: `business-preview:${request._id}`,
      },
      null,
      `business.preview-media:${request._id}`,
      {
        expectedRevision: 0,
        expectedStateRevision: 0,
        name: `Template preview · ${request.definition.localizedName.en}`,
        kind: "video-preview",
        source: { type: "generation", runId: String(run._id) },
        rightsConfirmed: true,
        adultLikenessConfirmed: true,
        reason: "Owner approved business preview and public media rights",
      },
    )) as { id: string };
    await database.db.collection("admin_template_quality_evidence").updateOne(
      { businessRequestId: request._id },
      {
        $setOnInsert: {
          templateId: request.templateId,
          outputHash: request.outputHash,
          status: "passed",
          businessFunded: true,
          sourceRunId: String(run._id),
          businessRequestId: request._id,
          previewMediaId: media.id,
          previewObjectKey: run.outputObjectKey,
          posterObjectKey: null,
          qualityDecision: proof.qualityDecision,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
    await requests.updateOne(
      { _id: request._id },
      { $set: { previewMediaId: media.id } },
    );
  }
  await database.transaction(async (session) => {
    if (request.purpose === "recovery") {
      await database.db.collection(C.creatorProjectVersions).updateOne(
        {
          _id: adminObjectId(request.projectVersionId),
          userId: request.userId,
        },
        { $set: { businessCandidateReady: true } },
        { session },
      );
      await database.db
        .collection(C.renderRuns)
        .updateOne(
          { _id: run._id, userId: request.userId },
          { $set: { businessCandidateReady: true } },
          { session },
        );
      await database.db.collection(C.notifications).updateOne(
        { userId: request.userId, businessRequestId: request._id },
        {
          $setOnInsert: {
            userId: request.userId,
            businessRequestId: request._id,
            type: "support-replacement",
            projectId: request.projectId,
            title: "Replacement video ready · فيديو بديل جاهز",
            body: "Review the new campaign version before accepting it. Your previous accepted video remains available. راجع النسخة الجديدة قبل اعتمادها. تبقى النسخة المعتمدة السابقة متاحة.",
            readAt: null,
            createdAt: new Date(),
          },
        },
        { session, upsert: true },
      );
    }
    await requests.updateOne(
      { _id: request._id },
      {
        $set: {
          status: "completed",
          active: false,
          qualityDecision: proof.qualityDecision,
          updatedAt: new Date(),
        },
      },
      { session },
    );
  });
  return {
    status: "completed",
    runId: String(run._id),
    customerCreditsCharged: 0,
  };
}
