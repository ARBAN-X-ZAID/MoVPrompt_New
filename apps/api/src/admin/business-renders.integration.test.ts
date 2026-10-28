import { createAdminTemplateService } from "./template-service.js";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { ObjectId } from "mongodb";
import { randomUUID } from "node:crypto";
import {
  createMongoDatabase,
  ensureMongoIndexes,
  ensureMongoTemplateCatalog,
  createMongoGenerationService,
} from "@movprompt/db";
import {
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
  getCreativeTemplate,
} from "@movprompt/creative-engine";
import { adStudioBrandAdFixture } from "../ad-studio-brand-ad.test-fixture.js";
import { createMongoCreatorRepository } from "../mongo-creator-repository.js";
import { createMongoRenderLifecycleStore } from "../../../worker/src/mongo-render-lifecycle-store.js";
import { createAdminSecurity, ensureAdminIndexes } from "./security.js";
import type { AuthGateway } from "../auth-gateway.js";
import {
  createAdminBusinessRenderService,
  createBusinessGenerationFactory,
  executeBusinessRender,
} from "./business-renders.js";

const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)(
  "business-funded render accounting and immutable candidates",
  () => {
    const database = createMongoDatabase({
      uri: uri ?? "mongodb://127.0.0.1:27029/",
      databaseName: `movprompt_admin_business_test_${Date.now()}`,
    });
    const owner = new ObjectId(),
      customer = new ObjectId();
    const actor = {
      userId: String(owner),
      sessionId: "synthetic-owner",
      requestId: "business-test",
    };
    const auth: AuthGateway = {
      handle: async () => new Response(null),
      getSession: async () => null,
    };
    const security = createAdminSecurity(database, auth);
    const environment = {
      APP_ENV: "local",
      ADMIN_BUSINESS_MAX_ATTEMPT_COST_USD: "0.25",
      ADMIN_BUSINESS_DAILY_BUDGET_USD: "0.5",
      ADMIN_BUSINESS_RENDERS_ENABLED: "true",
      ADMIN_BUSINESS_COST_ACCEPTANCE_VERIFIED: "true",
      GENERATION_PRICING_VERSION: "business-test-v1",
      GENERATION_QUOTE_TTL_SECONDS: "900",
      GENERATION_TEMPLATE_CREDITS_PER_GENERATION: "50",
      GENERATION_AD_STUDIO_CREDITS_PER_GENERATION: "80",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ENABLED: "true",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ADAPTER_ID:
        "synthetic-provider",
      MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID:
        "bytedance/seedance-2.5",
    };
    const generation = createBusinessGenerationFactory(database, environment);
    const service = createAdminBusinessRenderService(
      database,
      security,
      environment,
    );
    const execution = {
      environment,
      security,
      generation,
      ready: async () => true,
    };
    beforeAll(async () => {
      await database.connect();
      await ensureMongoIndexes(database);
      await ensureAdminIndexes(database);
    });
    beforeEach(async () => {
      for (const name of (await database.db.listCollections().toArray()).map(
        (item) => item.name,
      ))
        await database.db.collection(name).deleteMany({});
      await ensureMongoTemplateCatalog(database, [
        ...LAUNCH_CREATIVE_TEMPLATE_CATALOG,
        getCreativeTemplate("ad-studio-brand-ad"),
      ]);
      await database.db.collection("users").insertMany([
        {
          _id: owner,
          name: "QA owner",
          email: "owner@example.test",
          emailVerified: true,
        },
        {
          _id: customer,
          name: "QA customer",
          email: "customer@example.test",
          emailVerified: true,
        },
      ]);
      await database.db
        .collection("credit_accounts")
        .insertOne({ userId: customer, balance: 100, lifetimeSpent: 0 });
    });
    afterAll(async () => {
      await database.db.dropDatabase();
      await database.close();
    });
    async function source(userId = customer) {
      const head = await database.db
        .collection("video_templates")
        .findOne({ slug: "ad-studio-brand-ad" });
      const projectId = new ObjectId(),
        versionId = new ObjectId(),
        runId = new ObjectId();
      const original = adStudioBrandAdFixture({ audio: false });
      const payload = JSON.parse(
        JSON.stringify(original)
          .replaceAll("11111111-1111-4111-8111-111111111111", String(userId))
          .replaceAll("22222222-2222-4222-8222-222222222222", String(projectId))
          .replaceAll(
            "33333333-3333-4333-8333-333333333333",
            String(head!.currentPublishedVersionId),
          ),
      );
      const now = new Date();
      await database.db.collection("creator_projects").insertOne({
        _id: projectId,
        userId,
        title: "Approved QA campaign",
        mode: "template",
        status: "completed",
        currentWorkingVersionId: versionId,
        currentAcceptedVersionId: versionId,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      await database.db.collection("creator_project_versions").insertOne({
        _id: versionId,
        projectId,
        userId,
        mode: "template",
        versionNumber: 1,
        templateVersionId: new ObjectId(
          String(head!.currentPublishedVersionId),
        ),
        ...payload,
        createdAt: now,
      });
      for (const photo of payload.configuration.creatorProject.product.images)
        await database.db.collection("creator_project_assets").insertOne({
          projectId,
          userId,
          kind: "product",
          objectKey: photo.storagePath,
          mimeType: photo.mimeType,
          checksumSha256: photo.checksum,
          sizeBytes: 100,
          bucket: "private-qa",
        });
      await database.db.collection("render_runs").insertOne({
        _id: runId,
        userId,
        projectId,
        projectVersionId: versionId,
        idempotencyKey: randomUUID(),
        status: "completed",
        createdAt: now,
      });
      return { projectId, versionId, runId, payload, head };
    }
    it("requires owner budget approval, queues one uncharged candidate and preserves accepted/working snapshots", async () => {
      const input = await source();
      const request = await service.request(actor, randomUUID(), {
        purpose: "recovery",
        sourceVersionId: String(input.versionId),
        originalRunId: String(input.runId),
        publicPreviewPermissionConfirmed: false,
        reason: "Owner-funded recovery review without altering customer copy",
      });
      await executeBusinessRender(
        database,
        {
          kind: "business.prepare",
          businessRequestId: new ObjectId(request.id),
        },
        execution,
      );
      const prepared = await database.db
        .collection("admin_business_renders")
        .findOne({ _id: new ObjectId(request.id) });
      expect(prepared).toMatchObject({
        status: "ready",
        revision: 2,
        worstCaseMicrousd: 250000,
      });
      const creator = createMongoCreatorRepository(database);
      expect(
        await creator.listVersions(String(customer), String(input.projectId)),
      ).toHaveLength(1);
      await expect(
        generation(request.id).startRender({
          userId: String(customer),
          projectId: String(input.projectId),
          projectVersionId: prepared!.projectVersionId,
          quoteId: prepared!.quoteId,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: "invalid_generation_configuration" });
      const review = {
        action: "approve" as const,
        expectedRevision: 2,
        expectedCostMicrousd: prepared!.worstCaseMicrousd,
        reason: "Owner approved the exact USD ceiling including retries",
      };
      const operation = randomUUID();
      expect(
        await service.review(actor, request.id, operation, review),
      ).toEqual(await service.review(actor, request.id, operation, review));
      await executeBusinessRender(
        database,
        { kind: "business.start", businessRequestId: new ObjectId(request.id) },
        execution,
      );
      await executeBusinessRender(
        database,
        { kind: "business.start", businessRequestId: new ObjectId(request.id) },
        execution,
      );
      const running = await database.db
        .collection("admin_business_renders")
        .findOne({ _id: new ObjectId(request.id) });
      const run = await database.db
        .collection("render_runs")
        .findOne({ _id: new ObjectId(running!.runId) });
      expect(run).toMatchObject({
        quotedCredits: 0,
        chargedCredits: 0,
        businessFundingId: request.id,
      });
      expect(
        await database.db
          .collection("render_runs")
          .countDocuments({ businessFundingId: request.id }),
      ).toBe(1);
      expect(
        await database.db
          .collection("credit_reservations")
          .countDocuments({ userId: customer }),
      ).toBe(0);
      expect(
        await database.db
          .collection("credit_ledger")
          .countDocuments({ userId: customer }),
      ).toBe(0);
      expect(
        await database.db
          .collection("credit_accounts")
          .findOne({ userId: customer }),
      ).toMatchObject({ balance: 100, lifetimeSpent: 0 });
      expect(
        await database.db
          .collection("creator_projects")
          .findOne({ _id: input.projectId }),
      ).toMatchObject({
        currentWorkingVersionId: input.versionId,
        currentAcceptedVersionId: input.versionId,
        status: "completed",
      });
      const candidate = await database.db
        .collection("creator_project_versions")
        .findOne({ _id: new ObjectId(prepared!.projectVersionId) });
      expect(candidate?.configuration).toEqual(input.payload.configuration);
      await database.db.collection("render_attempts").insertOne({
        renderRunId: run!._id,
        userId: customer,
        attemptNumber: 0,
        status: "processing",
      });
      const store = createMongoRenderLifecycleStore(database);
      await store.complete({
        runId: String(run!._id),
        userId: String(customer),
        outputBucket: "private-output",
        outputObjectKey: "qa/synthetic-result.mp4",
        attemptNumber: 0,
        qualityDecision: {
          status: "accepted",
          score: 95,
          failedDimensions: [],
        },
        now: new Date(),
      });
      await executeBusinessRender(
        database,
        {
          kind: "business.monitor",
          businessRequestId: new ObjectId(request.id),
        },
        execution,
      );
      expect(
        await creator.listVersions(String(customer), String(input.projectId)),
      ).toHaveLength(2);
      expect(
        await database.db
          .collection("creator_projects")
          .findOne({ _id: input.projectId }),
      ).toMatchObject({ currentAcceptedVersionId: input.versionId });
      await creator.acceptVersion(
        String(customer),
        String(input.projectId),
        String(candidate!._id),
      );
      expect(
        await database.db
          .collection("creator_projects")
          .findOne({ _id: input.projectId }),
      ).toMatchObject({ currentAcceptedVersionId: candidate!._id });
      expect(
        await database.db
          .collection("admin_business_renders")
          .findOne({ _id: new ObjectId(request.id) }),
      ).toMatchObject({ status: "completed" });
    });
    it("prepares a private edited-template preview from owner references without exposing or activating it", async () => {
      const input = await source(owner);
      const templates = createAdminTemplateService(database, security, {
        ADMIN_TEMPLATE_PUBLISHING_ENABLED: "true",
      });
      const loaded = (await templates.load(String(input.head!._id))) as {
        definition: unknown;
        activeVersionId: string;
      };
      const definition = structuredClone(loaded.definition) as Record<
        string,
        unknown
      >;
      definition.visualSystem = "Reviewed blue studio camera direction";
      await templates.save(actor, String(input.head!._id), randomUUID(), {
        expectedRevision: 0,
        baseVersionId: loaded.activeVersionId,
        definition: definition as never,
        reason: "Prepare a visually changed draft for preview",
      });
      await expect(
        service.request(actor, randomUUID(), {
          purpose: "preview",
          sourceVersionId: String(input.versionId),
          templateId: String(input.head!._id),
          draftRevision: 1,
          publicPreviewPermissionConfirmed: false,
          reason: "Cannot skip company public preview permission",
        }),
      ).rejects.toMatchObject({ code: "admin_business_preview_review" });
      const request = await service.request(actor, randomUUID(), {
        purpose: "preview",
        sourceVersionId: String(input.versionId),
        templateId: String(input.head!._id),
        draftRevision: 1,
        publicPreviewPermissionConfirmed: true,
        reason: "Owner approved company references for a public preview",
      });
      await executeBusinessRender(
        database,
        {
          kind: "business.prepare",
          businessRequestId: new ObjectId(request.id),
        },
        execution,
      );
      const prepared = await database.db
        .collection("admin_business_renders")
        .findOne({ _id: new ObjectId(request.id) });
      expect(prepared?.status).toBe("ready");
      const candidate = await database.db
        .collection("creator_project_versions")
        .findOne({ _id: new ObjectId(prepared!.projectVersionId) });
      expect(candidate?.configuration.creatorProject.product).toEqual(
        input.payload.configuration.creatorProject.product,
      );
      expect(
        candidate?.configuration.generation.creativeBrief.displayCopy,
      ).toEqual(
        input.payload.configuration.generation.creativeBrief.displayCopy,
      );
      expect(
        candidate?.configuration.generation.creativeBrief.templateVisualSystem,
      ).toBe("Reviewed blue studio camera direction");
      expect(
        await createMongoCreatorRepository(database).findTemplateVersion!(
          prepared!.candidateTemplateVersionId,
        ),
      ).toBeNull();
      const gated = createAdminBusinessRenderService(database, security, {
        ...environment,
        ADMIN_BUSINESS_RENDERS_ENABLED: "false",
      });
      await expect(
        gated.review(actor, request.id, randomUUID(), {
          action: "approve",
          expectedRevision: 2,
          expectedCostMicrousd: 250000,
          reason: "Execution must stay disabled without live cost acceptance",
        }),
      ).rejects.toMatchObject({ code: "admin_business_gate_closed" });
      expect(
        await database.db
          .collection("admin_business_budget_days")
          .countDocuments({}),
      ).toBe(0);
    });
    it("blocks another recovery while a failed prior funded attempt still has an uncertain provider outcome", async () => {
      const input = await source(),
        child = new ObjectId();
      await database.db.collection("render_runs").insertOne({
        _id: child,
        userId: customer,
        status: "failed",
        errorCode: "provider_submission_unknown",
        idempotencyKey: randomUUID(),
      });
      await database.db.collection("admin_business_renders").insertOne({
        userId: customer,
        originalRunId: String(input.runId),
        runId: String(child),
        status: "failed",
        active: false,
      });
      const body = {
        purpose: "recovery" as const,
        sourceVersionId: String(input.versionId),
        originalRunId: String(input.runId),
        publicPreviewPermissionConfirmed: false,
        reason: "Review a failed previous funded operation",
      };
      await expect(
        service.request(actor, randomUUID(), body),
      ).rejects.toMatchObject({ code: "admin_business_reconcile_first" });
      await database.db
        .collection("render_runs")
        .updateOne({ _id: child }, { $set: { errorCode: null } });
      const attempt = await database.db
        .collection("render_attempts")
        .insertOne({
          renderRunId: child,
          userId: customer,
          attemptNumber: 0,
          status: "processing",
        });
      await expect(
        service.request(actor, randomUUID(), body),
      ).rejects.toMatchObject({ code: "admin_business_reconcile_first" });
      await database.db
        .collection("render_attempts")
        .updateOne({ _id: attempt.insertedId }, { $set: { status: "failed" } });
      await expect(
        service.request(actor, randomUUID(), body),
      ).resolves.toMatchObject({ status: "preparing" });
    });
    it("blocks unknown original outcomes and refuses a second approval beyond the daily ceiling", async () => {
      const input = await source();
      await database.db
        .collection("render_runs")
        .updateOne({ _id: input.runId }, { $set: { status: "processing" } });
      const body = {
        purpose: "recovery" as const,
        sourceVersionId: String(input.versionId),
        originalRunId: String(input.runId),
        publicPreviewPermissionConfirmed: false,
        reason: "Review repeated business requests",
      };
      await expect(
        service.request(actor, randomUUID(), body),
      ).rejects.toMatchObject({ code: "admin_business_reconcile_first" });
      await database.db
        .collection("render_runs")
        .updateOne({ _id: input.runId }, { $set: { status: "completed" } });
      for (let index = 0; index < 3; index++) {
        const next = index === 0 ? input : await source();
        const request = await service.request(actor, randomUUID(), {
          ...body,
          sourceVersionId: String(next.versionId),
          originalRunId: String(next.runId),
        });
        await executeBusinessRender(
          database,
          {
            kind: "business.prepare",
            businessRequestId: new ObjectId(request.id),
          },
          execution,
        );
        const approve = () =>
          service.review(actor, request.id, randomUUID(), {
            action: "approve",
            expectedRevision: 2,
            expectedCostMicrousd: 250000,
            reason: "Review daily conservative business budget",
          });
        if (index < 2)
          expect(await approve()).toMatchObject({ status: "approved" });
        else
          await expect(approve()).rejects.toMatchObject({
            code: "admin_business_daily_budget",
          });
      }
      expect(
        await database.db
          .collection("credit_ledger")
          .countDocuments({ userId: customer }),
      ).toBe(0);
    });
  },
);
