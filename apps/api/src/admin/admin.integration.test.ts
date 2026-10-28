import {
  EMAIL,
  createAdminEmailService,
  executeEmailDelivery,
  unsubscribeToken,
} from "./email-delivery.js";
import { evaluateAdminSystem } from "./system-monitor.js";
import { createAdminWorkspaceService } from "./workspace-service.js";
import { createAuthenticationEmailRenderer } from "./transactional-email.js";
import { claimFactorUse } from "./factor-uses.js";
import { executeScheduledContent } from "./content-scheduler.js";
import { createCustomerDataService } from "./customer-data.js";
import { createAdminPricingService } from "./pricing-service.js";
import { createVersionedPricingResolver } from "../versioned-pricing.js";
import { createGenerationPricingFromEnvironment } from "../generation-pricing.js";
import { createGenerationApiService } from "../generation-service.js";
import { CapabilityRegistry } from "@movprompt/providers";
import { createMongoCreatorRepository } from "../mongo-creator-repository.js";
import { createMongoGenerationRepository } from "../mongo-generation-repository.js";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ObjectId } from "mongodb";
import { createHash, createHmac, randomUUID } from "node:crypto";
import {
  createMongoDatabase,
  ensureMongoIndexes,
  createMongoPaymentService,
  createMongoGenerationService,
} from "@movprompt/db";
import { createMovPromptAuth, authEnvironmentFromEnv } from "@movprompt/auth";
import { createApi } from "../app.js";
import { createBetterAuthGateway, type AuthGateway } from "../auth-gateway.js";
import { loadApiConfig } from "../config.js";
import {
  ADMIN_COLLECTIONS as A,
  createAdminSecurity,
  ensureAdminIndexes,
} from "./security.js";
import {
  createAdminFinanceService,
  reconstructCreditLots,
} from "./finance-service.js";
import { createAdminOperationWorker } from "./operation-worker.js";
import type { PaymentProvider } from "../payments/provider.js";
import {
  defaultManagedTemplateForm,
  LAUNCH_CREATIVE_TEMPLATE_CATALOG,
} from "@movprompt/creative-engine";
import {
  ensureMongoTemplateCatalog,
  assertLibraryConfiguration,
  designateOwnerAccount,
  activateVerifiedOwnerIntent,
} from "@movprompt/db";
import { createAdminTemplateService } from "./template-service.js";
import type { AssetStorageGateway } from "../asset-storage.js";

const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)("owner admin on real transactional MongoDB", () => {
  const database = createMongoDatabase({
    uri: uri ?? "mongodb://127.0.0.1:27029/",
    databaseName: `movprompt_admin_test_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
  });
  const ownerId = new ObjectId();
  const customerId = new ObjectId();
  const outsiderId = new ObjectId();
  const sessionId = new ObjectId().toHexString();
  const env = {
    FEATURE_OWNER_ADMIN: "true",
    FEATURE_PURCHASE_ALLOCATIONS: "true",
    APP_ENV: "local",
    WEB_ORIGIN: "http://localhost:8080",
    BETTER_AUTH_URL: "http://localhost:8787",
    ADMIN_REFUNDS_ENABLED: "false",
  };
  const auth: AuthGateway = {
    handle: async () => new Response(null, { status: 404 }),
    getSession: async (headers) => {
      const id = headers.get("x-test-user");
      if (!id) return null;
      return {
        user: {
          id,
          name: "Synthetic owner",
          email: "owner@example.test",
          emailVerified: true,
          role: "admin",
        },
        session: { id: sessionId },
      };
    },
    verifyFactor: vi.fn(async (_headers, code) => code === "123456"),
  };
  const security = createAdminSecurity(database, auth);
  const actor = {
    userId: String(ownerId),
    sessionId,
    requestId: "admin-test-request",
  };
  const finance = createAdminFinanceService(database, security, env);
  const app = createApi({
    config: loadApiConfig({ APP_ENV: "test", FEATURE_AUTHENTICATION: "true" }),
    environment: env,
    authGateway: auth,
    admin: { database, auth },
  });
  const headers = (id = String(ownerId), key = randomUUID()) => ({
    "x-test-user": id,
    "content-type": "application/json",
    "idempotency-key": key,
    origin: env.WEB_ORIGIN,
  });
  beforeAll(async () => {
    await database.connect();
    await ensureMongoIndexes(database);
    await ensureAdminIndexes(database);
  });
  beforeEach(async () => {
    for (const name of [
      ...Object.values(EMAIL),
      "users",
      "accounts",
      "authentication_events",
      "notifications",
      "creator_project_assets",
      "exports",
      "sessions",
      "twoFactor",
      A.owners,
      A.assurance,
      A.commands,
      A.financial,
      A.allocations,
      "credit_allocation_reconciliation",
      A.cases,
      A.messages,
      A.content,
      A.contentVersions,
      A.operations,
      A.templateDrafts,
      "admin_template_draft_revisions",
      "video_templates",
      "video_template_versions",
      "credit_accounts",
      "credit_ledger",
      "credit_reservations",
      "payment_orders",
      "payment_events",
      "audit_logs",
      "admin_factor_limits",
      "admin_factor_uses",
      "creator_reference_library",
      "creator_reference_library_revisions",
      "worker_jobs",
      "service_heartbeats",
      "creator_projects",
      "creator_project_versions",
      "render_runs",
      "render_attempts",
      A.moderation,
      "generation_quotes",
      "outbox_jobs",
      "admin_settings",
      "admin_pricing_heads",
      "admin_pricing_versions",
      "admin_pricing_drafts",
      "admin_pricing_draft_revisions",
    ])
      await database.db.collection(name).deleteMany({});
    await database.db.collection("users").insertMany([
      {
        _id: ownerId,
        name: "Owner",
        email: "owner@example.test",
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: new Date(),
      },
      {
        _id: customerId,
        name: "Customer",
        email: "customer@example.test",
        emailVerified: true,
        createdAt: new Date(),
        password: "must-never-leak",
      },
      {
        _id: outsiderId,
        name: "Legacy admin",
        email: "legacy@example.test",
        role: "admin",
        emailVerified: true,
      },
    ]);
    await database.db
      .collection(A.owners)
      .insertOne({ userId: ownerId, role: "owner", active: true });
    await database.db.collection("twoFactor").insertOne({
      userId: ownerId,
      secret: "never-leak",
      backupCodes: "encrypted-backup",
      verified: true,
    });
    await database.db.collection(A.assurance).insertOne({
      userId: ownerId,
      sessionId,
      expiresAt: new Date(Date.now() + 3600000),
      recentUntil: new Date(Date.now() + 300000),
    });
    await database.db
      .collection("credit_accounts")
      .insertOne({ userId: customerId, balance: 0 });
  });
  afterAll(async () => {
    await database.db.dropDatabase();
    await database.close();
  });
  it("records the protected no-SMTP login policy without verifying email or nominating another owner", async () => {
    await database.db
      .collection("users")
      .updateOne({ _id: ownerId }, { $set: { emailVerified: false } });
    await expect(
      security.identity(new Headers(headers())),
    ).rejects.toMatchObject({ code: "owner_verification_required" });
    await designateOwnerAccount(database, String(ownerId), {
      loginMode: "designated-email-password",
    });
    expect(
      (await database.db.collection("users").findOne({ _id: ownerId }))
        ?.emailVerified,
    ).toBe(false);
    expect(await security.identity(new Headers(headers()))).toMatchObject({
      emailVerified: false,
      mfaEnabled: true,
    });
    await expect(
      designateOwnerAccount(database, String(customerId), {
        loginMode: "designated-email-password",
      }),
    ).rejects.toThrow("another_owner_is_already_designated");
  });
  it("allows inspection and MFA assurance but rejects every admin mutation in read-only deployment mode", async () => {
    const readOnlyApp = createApi({
      config: loadApiConfig({
        APP_ENV: "test",
        FEATURE_AUTHENTICATION: "true",
      }),
      environment: { ...env, ADMIN_READ_ONLY: "true" },
      authGateway: auth,
      admin: { database, auth },
    });
    const identity = await readOnlyApp.request("/api/v1/admin/identity", {
      headers: headers(),
    });
    expect(identity.status).toBe(200);
    expect(await identity.json()).toMatchObject({ readOnly: true });
    const mutation = await readOnlyApp.request(
      `/api/v1/admin/customers/${customerId}/actions`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ action: "suspend", reason: "Test write guard" }),
      },
    );
    expect(mutation.status).toBe(503);
    expect(await mutation.json()).toMatchObject({
      error: { code: "admin_read_only" },
    });
    expect(
      (await database.db.collection("users").findOne({ _id: customerId }))
        ?.suspendedAt,
    ).toBeUndefined();
    const assure = await readOnlyApp.request("/api/v1/admin/assurance", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ code: "123456", mode: "totp" }),
    });
    expect(assure.status).toBe(200);
    const outsider = await readOnlyApp.request(
      `/api/v1/admin/customers/${customerId}/actions`,
      {
        method: "POST",
        headers: headers(String(outsiderId)),
        body: JSON.stringify({ action: "suspend", reason: "Test write guard" }),
      },
    );
    expect(outsider.status).toBe(403);
  });
  it("protects operational and migration endpoints and makes reviewed alert actions idempotent", async () => {
    for (const path of ["system/status", "migration/status", "retention"]) {
      expect((await app.request(`/api/v1/admin/${path}`)).status).toBe(401);
      expect(
        (
          await app.request(`/api/v1/admin/${path}`, {
            headers: headers(String(outsiderId)),
          })
        ).status,
      ).toBe(403);
      expect(
        (await app.request(`/api/v1/admin/${path}`, { headers: headers() }))
          .status,
      ).toBe(200);
    }
    await evaluateAdminSystem(database, env);
    const status = await (
      await app.request("/api/v1/admin/system/status", { headers: headers() })
    ).json();
    const alert = status.alerts.find(
      (row: { key: string }) => row.key === "backup-recovery",
    );
    const key = randomUUID();
    const review = () =>
      app.request(`/api/v1/admin/system/alerts/${alert.id}/review`, {
        method: "POST",
        headers: headers(String(ownerId), key),
        body: JSON.stringify({
          expectedRevision: alert.revision,
          reason: "Reviewed missing backup policy in local testing",
        }),
      });
    expect((await review()).status).toBe(200);
    expect((await review()).status).toBe(200);
    expect(
      await database.db
        .collection("audit_logs")
        .countDocuments({ action: "system.alert-review", target: alert.id }),
    ).toBe(1);
    expect(
      (
        await app.request(`/api/v1/admin/system/alerts/${alert.id}/review`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            expectedRevision: alert.revision,
            reason: "Stale review must not silently overwrite",
          }),
        })
      ).status,
    ).toBe(409);
    const scanKey = randomUUID();
    const scan = () =>
      app.request("/api/v1/admin/migration/scan", {
        method: "POST",
        headers: headers(String(ownerId), scanKey),
        body: JSON.stringify({ reason: "Read-only local migration inventory" }),
      });
    const first = await (await scan()).json();
    expect(await (await scan()).json()).toEqual(first);
    expect(
      await database.db.collection(A.operations).countDocuments({
        _id: new ObjectId(first.operationId),
        kind: "migration.scan",
      }),
    ).toBe(1);
  });
  it("publishes and consumes bilingual authentication email revisions without changing secure links", async () => {
    const environment = {
      ADMIN_EMAIL_ENABLED: "true",
      SMTP_HOST: "local-sink",
      EMAIL_FROM: "no-reply@example.test",
    };
    const service = createAdminWorkspaceService(
      database,
      createAdminSecurity(database, auth),
      undefined,
      environment,
    );
    const input = {
      expectedRevision: 0,
      kind: "transactional-email",
      emailPurpose: "verify-email",
      title: { en: "Reviewed verification", ar: "تأكيد البريد" },
      body: {
        en: "Hello {{name}}\n{{actionUrl}}",
        ar: "مرحباً {{name}}\n{{actionUrl}}",
      },
      audience: "all",
      status: "published",
      reason: "Review bilingual authentication email",
    };
    const first = (await service.content(actor, null, randomUUID(), input)) as {
      id: string;
    };
    const renderer = createAuthenticationEmailRenderer(database, environment);
    await database.db
      .collection("users")
      .updateOne({ _id: customerId }, { $set: { locale: "ar" } });
    const rendered = await renderer({
      type: "verify-email",
      name: "عميل",
      to: "customer@example.test",
      url: "https://app.example.test/verify?token=synthetic",
    });
    expect(rendered).toEqual({
      subject: input.title.ar,
      text: "مرحباً عميل\nhttps://app.example.test/verify?token=synthetic",
    });
    expect(
      await createAuthenticationEmailRenderer(
        database,
        {},
      )({
        type: "verify-email",
        name: "QA",
        to: "customer@example.test",
        url: "https://app.example.test/verify",
      }),
    ).toBeNull();
    await service.content(actor, null, randomUUID(), {
      ...input,
      title: { ...input.title, en: "New reviewed subject" },
    });
    expect(
      (
        await database.db
          .collection(A.content)
          .findOne({ _id: new ObjectId(first.id) })
      )?.status,
    ).toBe("archived");
    expect(
      await database.db.collection(A.content).countDocuments({
        kind: "transactional-email",
        status: "published",
        emailPurpose: "verify-email",
      }),
    ).toBe(1);
    await expect(
      service.content(actor, null, randomUUID(), {
        ...input,
        body: { en: "Missing secure link", ar: input.body.ar },
      }),
    ).rejects.toMatchObject({ code: "email_tokens_invalid" });
  });
  it("reviews opted-in email audiences, honors unsubscribe and never blindly resends an uncertain SMTP outcome", async () => {
    const environment = {
      ...env,
      ADMIN_EMAIL_ENABLED: "true",
      SMTP_HOST: "local-sink",
      EMAIL_FROM: "no-reply@example.test",
      BETTER_AUTH_URL: "https://api.example.test",
      BETTER_AUTH_SECRET: "synthetic-email-test-signing-secret-only",
    };
    const emailApp = createApi({
      environment,
      emailRuntime: { database, auth },
      admin: { database, auth },
    });
    const preferences = () =>
      emailApp.request("/api/v1/notification-preferences", {
        headers: headers(String(customerId)),
      });
    expect(await (await preferences()).json()).toMatchObject({
      marketingOptIn: false,
      revision: 0,
    });
    const consent = (revision: number, key = randomUUID()) =>
      emailApp.request("/api/v1/notification-preferences", {
        method: "POST",
        headers: headers(String(customerId), key),
        body: JSON.stringify({
          expectedRevision: revision,
          marketingOptIn: true,
        }),
      });
    const consentKey = randomUUID();
    expect((await consent(0, consentKey)).status).toBe(200);
    expect(await (await consent(0, consentKey)).json()).toMatchObject({
      revision: 1,
    });
    const workspace = createAdminWorkspaceService(
      database,
      security,
      undefined,
      environment,
    );
    const content = (await workspace.content(actor, null, randomUUID(), {
      expectedRevision: 0,
      kind: "promotional-email",
      title: { en: "Exact approved offer", ar: "عرض معتمد" },
      body: { en: "20% off until Friday", ar: "خصم ٢٠٪ حتى الجمعة" },
      audience: "all",
      status: "draft",
      reason: "Prepare consent-based email test",
    })) as { id: string };
    const service = createAdminEmailService(database, security, environment);
    const preview = await service.preview(actor, content.id, randomUUID());
    expect(preview.count).toBe(1);
    const approval = {
      expectedRevision: 1,
      audienceId: preview.id,
      reason: "Reviewed exact bilingual messages and recipients",
    };
    const key = randomUUID();
    const first = await service.approve(actor, content.id, key, approval);
    expect(await service.approve(actor, content.id, key, approval)).toEqual(
      first,
    );
    expect(
      await database.db
        .collection(EMAIL.deliveries)
        .countDocuments({ campaignId: new ObjectId(first.id) }),
    ).toBe(1);
    const token = unsubscribeToken(
      String(customerId),
      environment.BETTER_AUTH_SECRET,
    );
    expect(
      (
        await emailApp.request(`/api/v1/email/unsubscribe?token=${token}x`, {
          method: "POST",
        })
      ).status,
    ).toBe(404);
    const unsub = () =>
      emailApp.request(`/api/v1/email/unsubscribe?token=${token}`, {
        method: "POST",
      });
    expect((await unsub()).status).toBe(200);
    expect((await unsub()).status).toBe(200);
    expect(await (await preferences()).json()).toMatchObject({
      marketingOptIn: false,
      revision: 2,
    });
    const suppressed = await database.db
      .collection(EMAIL.deliveries)
      .findOne({ campaignId: new ObjectId(first.id) });
    const send = vi.fn(async () => {});
    expect(
      await executeEmailDelivery(database, suppressed!._id, environment, send),
    ).toMatchObject({ delivery: "suppressed", delivered: null });
    expect(send).not.toHaveBeenCalled();
    expect((await consent(2)).status).toBe(200);
    const secondPreview = await service.preview(
      actor,
      content.id,
      randomUUID(),
    );
    const second = await service.approve(actor, content.id, randomUUID(), {
      expectedRevision: 2,
      audienceId: secondPreview.id,
      reason: "Review renewed consent before sending",
    });
    const queued = await database.db
      .collection(EMAIL.deliveries)
      .findOne({ campaignId: new ObjectId(second.id) });
    const uncertain = vi.fn(async () => {
      throw new Error("synthetic SMTP disconnect");
    });
    expect(
      await executeEmailDelivery(database, queued!._id, environment, uncertain),
    ).toMatchObject({ delivery: "uncertain", delivered: null });
    await executeEmailDelivery(database, queued!._id, environment, uncertain);
    expect(uncertain).toHaveBeenCalledTimes(1);
    expect(
      await database.db
        .collection(EMAIL.campaigns)
        .findOne({ _id: new ObjectId(second.id) }),
    ).toMatchObject({ status: "review-required", counts: { uncertain: 1 } });
    const ownerTest = await service.test(actor, content.id, randomUUID(), "ar");
    const testRow = await database.db
      .collection(EMAIL.deliveries)
      .findOne({ _id: new ObjectId(ownerTest.id) });
    expect(testRow?.email).toBe("owner@example.test");
    const accepted = vi.fn(async () => {});
    expect(
      await executeEmailDelivery(database, testRow!._id, environment, accepted),
    ).toMatchObject({ delivery: "smtp-accepted", delivered: null });
    expect(accepted.mock.calls).toHaveLength(1);
    const blocked = await emailApp.request(
      `/api/v1/admin/content/${content.id}/email-test`,
      {
        method: "POST",
        headers: headers(String(customerId)),
        body: JSON.stringify({ locale: "en" }),
      },
    );
    expect(blocked.status).toBe(403);
  });
  it("rejects guests, customers and legacy admins despite role flags", async () => {
    expect((await app.request("/api/v1/admin/customers")).status).toBe(401);
    for (const id of [customerId, outsiderId])
      expect(
        (
          await app.request("/api/v1/admin/customers", {
            headers: headers(String(id)),
          })
        ).status,
      ).toBe(403);
    await database.db
      .collection(A.owners)
      .insertOne({ userId: outsiderId, role: "support", active: true });
    expect(
      (
        await app.request("/api/v1/admin/customers", {
          headers: headers(String(outsiderId)),
        })
      ).status,
    ).toBe(403);
    const result = await app.request("/api/v1/admin/customers", {
      headers: headers(),
    });
    expect(result.status).toBe(200);
    expect(await result.text()).not.toContain("must-never-leak");
  });
  it("bounds streamed admin JSON before authentication or factor processing", async () => {
    const response = await app.request("/api/v1/admin/assurance", {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.WEB_ORIGIN },
      body: JSON.stringify({ code: "1".repeat(300000) }),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("admin_payload_too_large");
    expect(
      await database.db.collection("admin_factor_uses").countDocuments({}),
    ).toBe(0);
  });
  it("requires MFA assurance, fresh confirmation and rejects cross-site writes", async () => {
    await database.db
      .collection(A.assurance)
      .updateOne({ sessionId }, { $set: { recentUntil: new Date(0) } });
    const body = JSON.stringify({
      action: "suspend",
      reason: "Test account suspension",
    });
    expect(
      (
        await app.request(`/api/v1/admin/customers/${customerId}/actions`, {
          method: "POST",
          headers: headers(),
          body,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(`/api/v1/admin/customers/${customerId}/actions`, {
          method: "POST",
          headers: { ...headers(), origin: "https://evil.example" },
          body,
        })
      ).status,
    ).toBe(403);
    await database.db.collection(A.assurance).deleteMany({});
    expect(
      (await app.request("/api/v1/admin/overview", { headers: headers() }))
        .status,
    ).toBe(403);
  });
  it("activates only a protected owner intent after actual account verification", async () => {
    await database.db.collection(A.owners).deleteMany({});
    await database.db
      .collection("users")
      .updateOne({ _id: customerId }, { $set: { emailVerified: false } });
    expect(
      await designateOwnerAccount(database, String(customerId)),
    ).toMatchObject({ state: "pending-email-verification" });
    await activateVerifiedOwnerIntent(database, String(customerId));
    expect(
      (await database.db.collection(A.owners).findOne({ userId: customerId }))
        ?.active,
    ).toBe(false);
    await database.db
      .collection("users")
      .updateOne({ _id: customerId }, { $set: { emailVerified: true } });
    await activateVerifiedOwnerIntent(database, String(customerId));
    expect(
      await database.db.collection(A.owners).findOne({ userId: customerId }),
    ).toMatchObject({
      role: "owner",
      active: true,
      pendingVerification: false,
    });
    expect(
      (
        await app.request("/api/v1/admin/customers", {
          headers: headers(String(customerId)),
        })
      ).status,
    ).toBe(403);
    await activateVerifiedOwnerIntent(database, String(outsiderId));
    expect(
      await database.db.collection(A.owners).findOne({ userId: outsiderId }),
    ).toBeNull();
    await expect(
      designateOwnerAccount(database, String(outsiderId)),
    ).rejects.toThrow("another_owner_is_already_designated");
  });
  it("rate limits factor confirmation and rejects code replay", async () => {
    const h = new Headers(headers());
    await expect(
      security.assure(h, "123456", "test-factor"),
    ).resolves.toMatchObject({ role: "owner", mfaEnabled: true });
    await expect(
      security.assure(h, "123456", "test-factor-replay"),
    ).rejects.toMatchObject({ code: "owner_factor_reused" });
    for (let i = 0; i < 3; i++)
      await expect(
        security.assure(h, "000000", "test-factor-invalid"),
      ).rejects.toMatchObject({ code: "owner_factor_invalid" });
    await expect(
      security.assure(h, "000000", "test-factor-limited"),
    ).rejects.toMatchObject({ code: "owner_factor_rate_limit" });
  });
  it("shares an atomic per-code replay fence across login and owner step-up", async () => {
    const uses = await Promise.all([
      claimFactorUse(database, String(ownerId), "totp", "123456"),
      claimFactorUse(database, String(ownerId), "totp", "123456"),
    ]);
    expect(uses.sort()).toEqual([false, true]);
    expect(
      await claimFactorUse(
        database,
        String(ownerId),
        "backup",
        "synthetic-unused-backup",
      ),
    ).toBe(true);
    await expect(
      security.assure(new Headers(headers()), "123456", "login-code-replay"),
    ).rejects.toMatchObject({ code: "owner_factor_reused" });
    await database.db
      .collection("admin_factor_uses")
      .updateMany({ userId: ownerId }, { $set: { expiresAt: new Date(0) } });
    expect(
      await claimFactorUse(database, String(ownerId), "totp", "123456"),
    ).toBe(true);
  });
  it("protects owner access and revokes customer sessions when suspended", async () => {
    const post = (id: ObjectId) =>
      app.request(`/api/v1/admin/customers/${id}/actions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action: "suspend",
          reason: "Verified abuse review",
        }),
      });
    expect((await post(ownerId)).status).toBe(403);
    await database.db.collection("sessions").insertOne({
      userId: customerId,
      token: "secret-token",
      expiresAt: new Date(Date.now() + 100000),
    });
    expect((await post(customerId)).status).toBe(200);
    expect(
      await database.db
        .collection("sessions")
        .countDocuments({ userId: customerId }),
    ).toBe(0);
    expect(
      (await database.db.collection("users").findOne({ _id: customerId }))
        ?.suspendedAt,
    ).toBeInstanceOf(Date);
  });
  it("makes financial request/review idempotent, transactional and impact checked", async () => {
    const key = randomUUID();
    const input = {
      kind: "credit-adjustment" as const,
      userId: String(customerId),
      delta: 100,
      reason: "Goodwill for support issue",
    };
    const result = await Promise.all([
      finance.request(actor, key, input),
      finance.request(actor, key, input),
    ]);
    expect(result[0].id).toBe(result[1].id);
    const reviewKey = randomUUID();
    const review = {
      expectedRevision: 1,
      decision: "approve" as const,
      reason: "Owner reviewed balance impact",
    };
    await Promise.all([
      finance.review(actor, result[0].id, reviewKey, review),
      finance.review(actor, result[0].id, reviewKey, review),
    ]);
    expect(
      (
        await database.db
          .collection("credit_accounts")
          .findOne({ userId: customerId })
      )?.balance,
    ).toBe(100);
    expect(
      await database.db
        .collection("credit_ledger")
        .countDocuments({ userId: customerId }),
    ).toBe(1);
    const stale = await finance.request(actor, randomUUID(), {
      ...input,
      delta: -50,
    });
    await database.db
      .collection("credit_accounts")
      .updateOne({ userId: customerId }, { $inc: { balance: 10 } });
    await expect(
      finance.review(actor, stale.id, randomUUID(), review),
    ).rejects.toMatchObject({ code: "financial_impact_changed" });
    await expect(
      finance.request(actor, key, { ...input, delta: 200 }),
    ).rejects.toMatchObject({ code: "admin_operation_conflict" });
  });
  it("reconstructs purchased vs promotional credits and blocks unverified or excessive cash refunds", async () => {
    const payments = createMongoPaymentService(database);
    const order = await payments.createOrder({
      userId: String(customerId),
      idempotencyKey: randomUUID(),
      credits: 100,
      amountMinor: 5000,
      currency: "KWD",
      provider: "upayments",
      packageId: "credits-100",
    });
    await payments.creditOrder({
      orderId: order.id,
      provider: "upayments",
      providerReference: order.id,
      amountMinor: 5000,
      currency: "KWD",
      refundSourceOrderId: "gateway-verified-order",
    });
    await database.db
      .collection("credit_accounts")
      .updateOne({ userId: customerId }, { $set: { balance: 60 } });
    await database.db.collection("credit_ledger").insertOne({
      userId: customerId,
      kind: "charge",
      delta: -40,
      referenceId: "run-1",
      createdAt: new Date(Date.now() + 10),
    });
    const refund = {
      kind: "cash-refund" as const,
      userId: String(customerId),
      orderId: order.id,
      amountMinor: 3000,
      exception: false,
      reason: "Unused purchase refund review",
    };
    expect(await finance.impact(refund)).toMatchObject({
      unusedPurchaseCredits: 60,
      creditsToRetire: 60,
      balanceAfter: 0,
      executionEnabled: false,
    });
    await expect(
      finance.impact({ ...refund, amountMinor: 5000 }),
    ).rejects.toMatchObject({ code: "refund_exception_required" });
    expect(
      await finance.impact({ ...refund, amountMinor: 5000, exception: true }),
    ).toMatchObject({ creditsToRetire: 60, consumedValueExceptionCredits: 40 });
    const request = await finance.request(actor, randomUUID(), refund);
    await expect(
      finance.review(actor, request.id, randomUUID(), {
        expectedRevision: 1,
        decision: "approve",
        reason: "Reviewed but live gate closed",
      }),
    ).rejects.toMatchObject({ code: "cash_refund_gate_closed" });
    expect(
      (
        await database.db
          .collection("credit_accounts")
          .findOne({ userId: customerId })
      )?.balance,
    ).toBe(60);
  });
  it("never resubmits an uncertain cash refund and finalizes its hold once after reconciliation", async () => {
    const enabledEnv = {
      ...env,
      ADMIN_REFUNDS_ENABLED: "true",
      ADMIN_REFUND_ACCEPTANCE_VERIFIED: "true",
    };
    const enabledFinance = createAdminFinanceService(
      database,
      security,
      enabledEnv,
    );
    const payments = createMongoPaymentService(database);
    const order = await payments.createOrder({
      userId: String(customerId),
      idempotencyKey: randomUUID(),
      credits: 100,
      amountMinor: 5000,
      currency: "KWD",
      provider: "upayments",
      packageId: "credits-100",
    });
    await payments.creditOrder({
      orderId: order.id,
      provider: "upayments",
      providerReference: order.id,
      amountMinor: 5000,
      currency: "KWD",
      refundSourceOrderId: "verified-gateway-order",
    });
    const request = await enabledFinance.request(actor, randomUUID(), {
      kind: "cash-refund",
      userId: String(customerId),
      orderId: order.id,
      amountMinor: 5000,
      exception: false,
      reason: "Synthetic unused purchase refund",
    });
    const approved = await enabledFinance.review(
      actor,
      request.id,
      randomUUID(),
      {
        expectedRevision: 1,
        decision: "approve",
        reason: "Owner reviewed synthetic gateway test",
      },
    );
    const createRefund = vi.fn(async () => {
      throw new Error("Gateway timeout after acceptance");
    });
    const provider: PaymentProvider = {
      id: "upayments",
      mode: "test",
      allowsCustomAmount: false,
      checkout: "hosted",
      createCheckout: async () => {
        throw new Error("not used");
      },
      createRefund,
      getRefundStatus: async () => ({ status: "confirmed" }),
    };
    const worker = createAdminOperationWorker({
      database,
      auth,
      provider,
      environment: enabledEnv,
    });
    await worker.tick();
    expect(
      (
        await database.db
          .collection(A.financial)
          .findOne({ _id: new ObjectId(request.id) })
      )?.status,
    ).toBe("uncertain");
    await database.db
      .collection(A.operations)
      .updateOne(
        { _id: new ObjectId(approved.operationId!) },
        { $set: { availableAt: new Date(0) } },
      );
    await worker.tick();
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(
      (
        await database.db
          .collection("credit_accounts")
          .findOne({ userId: customerId })
      )?.refundReserved,
    ).toBe(100);
    // Simulate a verified merchant reconciliation, never an automatic resubmit.
    await database.db
      .collection(A.financial)
      .updateOne(
        { _id: new ObjectId(request.id) },
        { $set: { "execution.refundId": "verified-refund-operation" } },
      );
    await database.db
      .collection(A.operations)
      .updateOne(
        { _id: new ObjectId(approved.operationId!) },
        { $set: { status: "queued", availableAt: new Date(0) } },
      );
    const reconciliationOnly = createAdminOperationWorker({
      database,
      auth,
      provider,
      environment: { ...enabledEnv, ADMIN_REFUNDS_ENABLED: "false" },
    });
    await reconciliationOnly.tick();
    await reconciliationOnly.tick();
    expect(createRefund).toHaveBeenCalledTimes(1);
    expect(
      await database.db
        .collection("credit_accounts")
        .findOne({ userId: customerId }),
    ).toMatchObject({ balance: 0, refundReserved: 0 });
    expect(
      await database.db
        .collection("credit_ledger")
        .countDocuments({ kind: "cash_refund", userId: customerId }),
    ).toBe(1);
  });
  it("pins purchased-credit lots across concurrent generation and cash-refund reservations", async () => {
    const envEnabled = {
      ...env,
      ADMIN_REFUNDS_ENABLED: "true",
      ADMIN_REFUND_ACCEPTANCE_VERIFIED: "true",
    };
    const funds = createAdminFinanceService(database, security, envEnabled);
    const payments = createMongoPaymentService(database, envEnabled);
    const userId = String(customerId);
    const a = await payments.createOrder({
      userId,
      idempotencyKey: randomUUID(),
      packageId: "lot-a",
      credits: 100,
      amountMinor: 5000,
      currency: "KWD",
      provider: "upayments",
    });
    await payments.creditOrder({
      orderId: a.id,
      provider: "upayments",
      providerReference: "verified-lot-a",
      refundSourceOrderId: "source-a",
      amountMinor: 5000,
      currency: "KWD",
    });
    const b = await payments.createOrder({
      userId,
      idempotencyKey: randomUUID(),
      packageId: "lot-b",
      credits: 100,
      amountMinor: 5000,
      currency: "KWD",
      provider: "upayments",
    });
    await payments.creditOrder({
      orderId: b.id,
      provider: "upayments",
      providerReference: "verified-lot-b",
      refundSourceOrderId: "source-b",
      amountMinor: 5000,
      currency: "KWD",
    });
    const domain = createMongoGenerationService(database, {
      FEATURE_PURCHASE_ALLOCATIONS: "true",
    });
    async function reserve(credits: number) {
      const projectId = new ObjectId();
      const versionId = new ObjectId();
      const configuration = { generation: "immutable reference" };
      await database
        .collection("creator_projects")
        .insertOne({ id: String(projectId), userId, deletedAt: null });
      await database.collection("creator_project_versions").insertOne({
        id: String(versionId),
        projectId: String(projectId),
        userId,
        configuration,
      });
      const quote = await domain.createQuote({
        userId,
        capabilityAlias: "video.cinematic",
        credits,
        entitlementEligible: false,
        breakdown: [{ label: "Video", credits }],
        configuration,
        expiresAt: new Date(Date.now() + 300000),
      });
      return domain.startRender({
        userId,
        projectId: String(projectId),
        projectVersionId: String(versionId),
        quoteId: quote.id,
        configuration,
        capabilityAlias: "video.cinematic",
        idempotencyKey: randomUUID(),
      });
    }
    const first = await reserve(50);
    await expect(
      funds.impact({
        kind: "cash-refund",
        userId,
        orderId: a.id,
        amountMinor: 5000,
        exception: true,
        reason: "Cannot refund value reserved for generation",
      }),
    ).rejects.toMatchObject({ code: "refund_credits_reserved" });
    const request = await funds.request(actor, randomUUID(), {
      kind: "cash-refund",
      userId,
      orderId: a.id,
      amountMinor: 2500,
      exception: false,
      reason: "Return only the unused half of purchase A",
    });
    await funds.review(actor, request.id, randomUUID(), {
      expectedRevision: 1,
      decision: "approve",
      reason: "Owner reviewed exact purchase reservation impact",
    });
    const second = await reserve(75);
    const slices = await database.db
      .collection("credit_reservations")
      .find({ userId: customerId })
      .sort({ createdAt: 1 })
      .toArray();
    expect(
      slices.find((row) => String(row.renderRunId) === first.id)
        ?.purchaseAllocations,
    ).toEqual([{ orderId: a.id, credits: 50 }]);
    expect(
      slices.find((row) => String(row.renderRunId) === second.id)
        ?.purchaseAllocations,
    ).toEqual([{ orderId: b.id, credits: 75 }]);
    for (const run of [first, second]) {
      await domain.recordProviderSubmission({
        userId,
        runId: run.id,
        provider: "synthetic-local",
        providerRequestId: `local-${run.id}`,
      });
      await domain.finalizeProviderAccepted({
        userId,
        runId: run.id,
        provider: "synthetic-local",
        providerRequestId: `local-${run.id}`,
      });
    }
    const provider: PaymentProvider = {
      id: "upayments",
      mode: "test",
      allowsCustomAmount: false,
      checkout: "hosted",
      createCheckout: async () => {
        throw new Error("not used");
      },
      createRefund: async () => ({
        refundId: "synthetic-allocation-refund",
        status: "submitted",
      }),
      getRefundStatus: async () => ({ status: "confirmed" }),
    };
    await createAdminOperationWorker({
      database,
      auth,
      provider,
      environment: envEnabled,
    }).tick();
    const account = (await database.db
      .collection("credit_accounts")
      .findOne({ userId: customerId }))!;
    expect(account.balance).toBe(25);
    expect(account.refundReserved).toBe(0);
    const ledger = await database.db
      .collection("credit_ledger")
      .find({ userId: customerId })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    expect(reconstructCreditLots(ledger, account.balance)).toMatchObject({
      verified: true,
    });
    expect(
      await database.db.collection(A.allocations).findOne({ orderId: a.id }),
    ).toMatchObject({
      verified: true,
      unusedCredits: 0,
      availableCredits: 0,
      generationReservedCredits: 0,
      refundReservedCredits: 0,
    });
    expect(
      await database.db.collection(A.allocations).findOne({ orderId: b.id }),
    ).toMatchObject({
      verified: true,
      unusedCredits: 25,
      availableCredits: 25,
    });
    await database.db
      .collection("render_runs")
      .updateOne(
        { _id: new ObjectId(second.id) },
        { $set: { status: "failed" } },
      );
    await domain.refundRender({
      userId,
      runId: second.id,
      reason: "Synthetic failed-video restoration",
    });
    await domain.refundRender({
      userId,
      runId: second.id,
      reason: "Duplicate restoration must be harmless",
    });
    expect(
      await database.db
        .collection("credit_accounts")
        .findOne({ userId: customerId }),
    ).toMatchObject({ balance: 100, refundReserved: 0 });
    expect(
      await database.db.collection("credit_ledger").countDocuments({
        userId: customerId,
        kind: "refund",
        referenceId: second.id,
      }),
    ).toBe(1);
    expect(
      await database.db.collection(A.allocations).findOne({ orderId: a.id }),
    ).toMatchObject({ unusedCredits: 0, verified: true });
    expect(
      await database.db.collection(A.allocations).findOne({ orderId: b.id }),
    ).toMatchObject({
      unusedCredits: 100,
      availableCredits: 100,
      verified: true,
    });
  });
  it("retains owner publication decisions and immutable versions through startup catalog sync", async () => {
    const recipe = LAUNCH_CREATIVE_TEMPLATE_CATALOG[0]!;
    await ensureMongoTemplateCatalog(database, [recipe]);
    const head = await database.db
      .collection("video_templates")
      .findOne({ slug: recipe.slug });
    const before = await database.db
      .collection("video_template_versions")
      .findOne({ _id: new ObjectId(String(head!.currentPublishedVersionId)) });
    await database.db.collection("video_templates").updateOne(
      { _id: head!._id },
      {
        $set: {
          publishingState: "unpublished",
          adminManaged: true,
          revision: 3,
        },
      },
    );
    await ensureMongoTemplateCatalog(database, [recipe], { prune: true });
    expect(
      await database.db
        .collection("video_templates")
        .findOne({ _id: head!._id }),
    ).toMatchObject({ publishingState: "unpublished", revision: 3 });
    expect(
      await database.db.collection("video_template_versions").findOne({
        _id: new ObjectId(String(head!.currentPublishedVersionId)),
      }),
    ).toEqual(before);
    const service = createAdminTemplateService(database, security);
    const next = {
      ...recipe,
      localizedName: { en: "Owner draft name", ar: "اسم مسودة المالك" },
    };
    const saved = (await service.save(actor, String(head!._id), randomUUID(), {
      expectedRevision: 0,
      baseVersionId: String(before!._id),
      definition: next,
      reason: "Prepare a separate template draft",
    })) as Record<string, unknown>;
    expect(saved.revision).toBe(1);
    expect(
      (
        await database.db
          .collection("video_template_versions")
          .findOne({ _id: before!._id })
      )?.localizedName,
    ).toEqual(recipe.localizedName);
    await expect(
      service.save(actor, String(head!._id), randomUUID(), {
        expectedRevision: 0,
        baseVersionId: String(before!._id),
        definition: next,
        reason: "Concurrent stale draft update",
      }),
    ).rejects.toMatchObject({ code: "template_draft_changed" });
  });
  it("publishes form metadata into immutable versions, rejects unevidenced video changes and preserves rollback snapshots", async () => {
    const recipe = LAUNCH_CREATIVE_TEMPLATE_CATALOG[0]!;
    await ensureMongoTemplateCatalog(database, [
      recipe,
      LAUNCH_CREATIVE_TEMPLATE_CATALOG[1]!,
    ]);
    const head = (await database.db
      .collection("video_templates")
      .findOne({ slug: recipe.slug }))!;
    const original = (await database.db
      .collection("video_template_versions")
      .findOne({ _id: new ObjectId(String(head.currentPublishedVersionId)) }))!;
    const service = createAdminTemplateService(database, security, {
      ADMIN_TEMPLATE_PUBLISHING_ENABLED: "true",
    });
    const definition = {
      ...recipe,
      localizedName: {
        en: "Owner managed phone reveal",
        ar: "عرض الهاتف المدار",
      },
      tags: ["owner-reviewed", "مراجع"],
      sortOrder: 1,
      managedForm: defaultManagedTemplateForm(recipe),
    };
    await service.save(actor, String(head._id), randomUUID(), {
      expectedRevision: 0,
      baseVersionId: String(original._id),
      definition,
      reason: "Review labels for the customer form",
    });
    const key = randomUUID();
    const input = {
      expectedRevision: 0,
      draftRevision: 1,
      reason: "Owner reviewed unchanged footage and form labels",
    };
    const result = await service.publish(actor, String(head._id), key, input);
    expect(await service.publish(actor, String(head._id), key, input)).toEqual(
      result,
    );
    const publishedId = String(result.versionId);
    const creator = createMongoCreatorRepository(database);
    const current = await creator.findPublishedTemplate(recipe.slug);
    expect(current).toMatchObject({
      versionId: publishedId,
      versionNumber: recipe.versionNumber + 1,
      executableDefinition: {
        managedForm: definition.managedForm,
        localizedName: definition.localizedName,
        sortOrder: 1,
        tags: definition.tags,
      },
    });
    expect((await creator.listPublishedTemplates({}))[0]?.versionId).toBe(
      publishedId,
    );
    const runtime =
      await createMongoGenerationRepository(
        database,
      ).findPublishedTemplateVersion(publishedId);
    expect(runtime?.visualRecipe?.definition).toMatchObject({
      versionNumber: recipe.versionNumber + 1,
      managedForm: definition.managedForm,
    });
    expect(
      await database.db
        .collection("video_template_versions")
        .findOne({ _id: original._id }),
    ).toEqual(original);
    const published = (await database.db
      .collection("video_template_versions")
      .findOne({ _id: new ObjectId(publishedId) }))!;
    const changed = {
      ...published.recipe.executableDefinition,
      visualSystem: "A different studio not covered by the previous sample",
    };
    await service.save(actor, String(head._id), randomUUID(), {
      expectedRevision: 1,
      baseVersionId: publishedId,
      definition: changed,
      reason: "Prepare a new visual direction for preview",
    });
    await expect(
      service.publish(actor, String(head._id), randomUUID(), {
        expectedRevision: 1,
        draftRevision: 2,
        reason: "Must not publish without new output evidence",
      }),
    ).rejects.toMatchObject({ code: "template_output_evidence_required" });
    await service.rollback(actor, String(head._id), randomUUID(), {
      expectedRevision: 1,
      versionId: String(original._id),
      reason: "Restore the previous published customer experience",
    });
    expect((await creator.findPublishedTemplate(recipe.slug))?.versionId).toBe(
      String(original._id),
    );
    expect((await creator.findTemplateVersion?.(publishedId))?.versionId).toBe(
      publishedId,
    );
    const alias = await service.duplicate(
      actor,
      String(head._id),
      randomUUID(),
      {
        slug: "owner-phone-sample",
        name: { en: "Phone campaign", ar: "حملة الهاتف" },
        reason: "Create a separate supported family draft",
      },
    );
    const aliasHead = await database.db
      .collection("video_templates")
      .findOne({ _id: new ObjectId(String(alias.id)) });
    expect(aliasHead).toMatchObject({
      publishingState: "unpublished",
      adminManaged: true,
    });
    expect(
      await creator.findPublishedTemplate("owner-phone-sample"),
    ).toBeNull();
    await ensureMongoTemplateCatalog(database, [recipe], { prune: true });
    expect(
      await database.db
        .collection("video_template_versions")
        .findOne({ _id: new ObjectId(publishedId) }),
    ).toEqual(published);
    expect(
      await database.db
        .collection("video_templates")
        .findOne({ _id: aliasHead!._id }),
    ).toMatchObject({ publishingState: "unpublished" });
  });
  it("publishes reviewed pricing while honoring an existing immutable quote", async () => {
    const priceEnv = {
      ADMIN_PRICING_ENABLED: "true",
      GENERATION_STARTER_ONLY: "false",
      GENERATION_PRICING_VERSION: "baseline-test",
      GENERATION_QUOTE_TTL_SECONDS: "900",
      GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND: "2",
      GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND: "2",
    };
    const resolver = createVersionedPricingResolver(database, priceEnv);
    const prices = createAdminPricingService(database, security, priceEnv);
    const initial = (await prices.load()) as Record<string, unknown>;
    const projectId = new ObjectId();
    const versionId = new ObjectId();
    const userId = String(customerId);
    const configuration = {
      generation: {
        prompt: "A verified business product video",
        durationSeconds: 8,
        aspectRatio: "9:16",
        resolution: "720p",
        audio: false,
        references: [],
      },
    };
    await database.db.collection("creator_projects").insertOne({
      _id: projectId,
      userId: customerId,
      currentWorkingVersionId: versionId,
      status: "ready",
    });
    await database.db.collection("creator_project_versions").insertOne({
      _id: versionId,
      projectId,
      userId: customerId,
      mode: "advanced",
      configuration,
      productRecipe: {},
      campaignRecipe: {},
    });
    await database.db
      .collection("credit_accounts")
      .updateOne({ userId: customerId }, { $set: { balance: 500 } });
    const api = createGenerationApiService({
      repository: createMongoGenerationRepository(database),
      generation: createMongoGenerationService(database, {
        GENERATION_STARTER_ONLY: "false",
      }),
      pricing: createGenerationPricingFromEnvironment(priceEnv),
      resolvePricing: resolver.current,
      capabilities: new CapabilityRegistry({
        "video.cinematic": {
          enabled: true,
          adapterId: "vercel-ai-gateway",
          providerModelId: "bytedance/seedance-2.5",
        },
      }),
      starterOnly: false,
    });
    const session = {
      user: {
        id: userId,
        name: "Customer",
        email: "customer@example.test",
        emailVerified: true,
      },
      session: { id: "synthetic-session" },
    };
    const quoted = await api.createQuote(
      { projectVersionId: String(versionId), capability: "video.cinematic" },
      session,
    );
    expect(quoted.credits).toBe(16);
    const policy = structuredClone(
      initial.policy,
    ) as import("@movprompt/contracts").AdminPricingPolicy;
    policy.video.advanced.eightSeconds = 70;
    policy.video.advanced.fifteenSeconds = 90;
    policy.video.advanced.twentySeconds = 110;
    policy.packages[0]!.amountMinor = 6000;
    await prices.save(actor, randomUUID(), {
      expectedRevision: 0,
      policy,
      reason: "Prepare new generation prices for owner review",
    });
    const reviewed = (await prices.load()) as {
      impact: { impactHash: string };
    };
    await expect(
      prices.publish(actor, randomUUID(), {
        expectedRevision: 0,
        draftRevision: 1,
        impactHash: "0".repeat(64),
        reason: "Reject a stale unreviewed pricing impact",
      }),
    ).rejects.toMatchObject({ code: "pricing_impact_changed" });
    const publishKey = randomUUID();
    const review = {
      expectedRevision: 0,
      draftRevision: 1,
      impactHash: reviewed.impact.impactHash,
      reason: "Owner approved the exact reviewed price changes",
    };
    const published = await prices.publish(actor, publishKey, review);
    expect(await prices.publish(actor, publishKey, review)).toEqual(published);
    expect((await resolver.catalog()).packages[0]!.amountMinor).toBe(6000);
    const newQuote = await api.createQuote(
      { projectVersionId: String(versionId), capability: "video.cinematic" },
      session,
    );
    expect(newQuote.credits).toBe(90); // 70 plus the saved Advanced 720p surcharge.
    expect(newQuote.pricingVersion).not.toBe(quoted.pricingVersion);
    const run = await api.startRender({
      userId,
      projectId: String(projectId),
      projectVersionId: String(versionId),
      quoteId: quoted.quoteId!,
      idempotencyKey: randomUUID(),
    });
    expect(run).toMatchObject({ quotedCredits: 16, status: "submitting" });
    const savedQuote = await database.db
      .collection("generation_quotes")
      .findOne({ _id: new ObjectId(quoted.quoteId!) });
    expect(savedQuote).toMatchObject({
      credits: 16,
      pricingVersion: "baseline-test",
      pricingSnapshot: { credits: 16 },
    });
    expect(
      await database.db
        .collection("credit_accounts")
        .findOne({ userId: customerId }),
    ).toMatchObject({ balance: 500 });
    expect(
      await database.db
        .collection("credit_ledger")
        .countDocuments({ userId: customerId }),
    ).toBe(0);
  });
  it("prevents new generation from spending refund-held credits", async () => {
    const projectId = new ObjectId();
    const versionId = new ObjectId();
    const userId = String(customerId);
    const config = { generation: "test" };
    await database.db
      .collection("credit_accounts")
      .updateOne(
        { userId: customerId },
        { $set: { balance: 100, refundReserved: 80 } },
      );
    await database
      .collection("creator_projects")
      .insertOne({ id: String(projectId), userId, deletedAt: null });
    await database.collection("creator_project_versions").insertOne({
      id: String(versionId),
      projectId: String(projectId),
      userId,
      configuration: config,
    });
    const generation = createMongoGenerationService(database, {});
    const quote = await generation.createQuote({
      userId,
      capabilityAlias: "video.cinematic",
      credits: 50,
      entitlementEligible: false,
      breakdown: [{ label: "Video", credits: 50 }],
      configuration: config,
      expiresAt: new Date(Date.now() + 300000),
    });
    await expect(
      generation.startRender({
        userId,
        projectId: String(projectId),
        projectVersionId: String(versionId),
        quoteId: quote.id,
        capabilityAlias: "video.cinematic",
        configuration: config,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "insufficient_credits" });
    expect(await database.db.collection("render_runs").countDocuments({})).toBe(
      0,
    );
  });
  it("pauses only new submissions and preserves an existing run snapshot", async () => {
    const userId = String(customerId);
    const projectId = new ObjectId();
    const versionId = new ObjectId();
    const configuration = { generation: "immutable local snapshot" };
    await database.db
      .collection("credit_accounts")
      .updateOne({ userId: customerId }, { $set: { balance: 100 } });
    await database
      .collection("creator_projects")
      .insertOne({ id: String(projectId), userId, deletedAt: null });
    await database.collection("creator_project_versions").insertOne({
      id: String(versionId),
      projectId: String(projectId),
      userId,
      configuration,
    });
    const domain = createMongoGenerationService(database, {});
    const quote = await domain.createQuote({
      userId,
      capabilityAlias: "video.cinematic",
      credits: 50,
      entitlementEligible: false,
      breakdown: [{ label: "Video", credits: 50 }],
      configuration,
      expiresAt: new Date(Date.now() + 300000),
    });
    const submission = {
      userId,
      projectId: String(projectId),
      projectVersionId: String(versionId),
      quoteId: quote.id,
      capabilityAlias: "video.cinematic",
      configuration,
      idempotencyKey: randomUUID(),
    };
    const active = await domain.startRender(submission);
    const settings = await app.request("/api/v1/admin/settings", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        expectedRevision: 0,
        pauseGeneration: true,
        pausedCapabilities: [],
        maintenanceMessage: { en: "", ar: "" },
        dailyRecoveryBudgetMinor: 0,
        reason: "Temporary local operations pause",
      }),
    });
    expect(settings.status).toBe(200);
    expect((await domain.startRender(submission)).id).toBe(active.id);
    await expect(
      domain.startRender({ ...submission, idempotencyKey: randomUUID() }),
    ).rejects.toMatchObject({ code: "generation_paused" });
    expect(await database.db.collection("render_runs").countDocuments({})).toBe(
      1,
    );
    expect(
      (await app.request("/api/v1/admin/identity", { headers: headers() }))
        .status,
    ).toBe(200);
    expect((await app.request("/healthz")).status).toBe(200);
    expect(
      (
        await database
          .collection("creator_project_versions")
          .findOne({ id: String(versionId) })
      )?.configuration,
    ).toEqual(configuration);
  });
  it("pauses speaking through its semantic capability while ordinary video remains available", async () => {
    const userId = String(customerId);
    const projectId = new ObjectId();
    const versionId = new ObjectId();
    await database.db.collection("admin_settings").insertOne({
      key: "operations",
      pausedCapabilities: ["presenter.ai_ugc"],
    });
    await database
      .collection("creator_projects")
      .insertOne({ id: String(projectId), userId, deletedAt: null });
    const configuration = {
      generation: { creativeBrief: { nativeUgc: { enabled: true } } },
    };
    await database.collection("creator_project_versions").insertOne({
      id: String(versionId),
      userId,
      projectId: String(projectId),
      configuration,
    });
    await database.db
      .collection("credit_accounts")
      .updateOne({ userId: customerId }, { $set: { balance: 100 } });
    const domain = createMongoGenerationService(database, {});
    const quote = await domain.createQuote({
      userId,
      capabilityAlias: "video.cinematic",
      credits: 10,
      entitlementEligible: false,
      breakdown: [{ label: "Video", credits: 10 }],
      configuration,
      expiresAt: new Date(Date.now() + 300000),
    });
    const input = {
      userId,
      projectId: String(projectId),
      projectVersionId: String(versionId),
      quoteId: quote.id,
      capabilityAlias: "video.cinematic",
      configuration,
      idempotencyKey: randomUUID(),
    };
    await expect(domain.startRender(input)).rejects.toMatchObject({
      code: "generation_paused",
    });
    expect(
      await database.db
        .collection("credit_reservations")
        .countDocuments({ userId: customerId }),
    ).toBe(0);
    const ordinary = {
      generation: { creativeBrief: { nativeUgc: { enabled: false } } },
    };
    const ordinaryVersion = new ObjectId();
    await database.collection("creator_project_versions").insertOne({
      id: String(ordinaryVersion),
      userId,
      projectId: String(projectId),
      versionNumber: 2,
      configuration: ordinary,
    });
    const normalQuote = await domain.createQuote({
      userId,
      capabilityAlias: "video.cinematic",
      credits: 10,
      entitlementEligible: false,
      breakdown: [{ label: "Video", credits: 10 }],
      configuration: ordinary,
      expiresAt: new Date(Date.now() + 300000),
    });
    expect(
      (
        await domain.startRender({
          ...input,
          projectVersionId: String(ordinaryVersion),
          configuration: ordinary,
          quoteId: normalQuote.id,
          idempotencyKey: randomUUID(),
        })
      ).status,
    ).toBe("submitting");
  });
  it("publishes only the still-approved scheduled revision and keeps cancelled jobs harmless", async () => {
    const future = new Date(Date.now() + 3600000);
    const body = {
      expectedRevision: 0,
      kind: "announcement",
      title: { en: "Scheduled launch", ar: "إطلاق مجدول" },
      body: { en: "Exact offer 20%!", ar: "خصم ٢٠٪!" },
      audience: "all",
      status: "scheduled",
      scheduledAt: future.toISOString(),
      reason: "Schedule reviewed bilingual announcement",
    };
    const response = await app.request("/api/v1/admin/content", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    expect(response.status).toBe(200);
    const content = await response.json();
    expect(
      (await (await app.request("/api/v1/communications")).json()).items,
    ).toHaveLength(0);
    const job = (await database.db.collection(A.operations).findOne({
      contentId: new ObjectId(content.id),
      kind: "content.publish",
    }))!;
    expect(job.status).toBe("queued");
    expect(
      await executeScheduledContent(
        database,
        job,
        new Date(future.getTime() + 1),
      ),
    ).toMatchObject({ publication: "published", revision: 2 });
    expect(
      (await (await app.request("/api/v1/communications")).json()).items[0]
        .body,
    ).toEqual(body.body);
    expect(
      await executeScheduledContent(
        database,
        job,
        new Date(future.getTime() + 1),
      ),
    ).toEqual({ publication: "superseded-or-cancelled" });
    expect(
      await database.db
        .collection(A.contentVersions)
        .countDocuments({ contentId: new ObjectId(content.id) }),
    ).toBe(2);
    const next = await app.request(`/api/v1/admin/content/${content.id}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        ...body,
        expectedRevision: 2,
        reason: "Schedule a second announcement revision",
      }),
    });
    expect(next.status).toBe(200);
    const nextJob = (await database.db.collection(A.operations).findOne({
      contentId: new ObjectId(content.id),
      kind: "content.publish",
      contentRevision: 3,
    }))!;
    expect(
      (
        await app.request(`/api/v1/admin/content/${content.id}`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            ...body,
            expectedRevision: 3,
            status: "archived",
            reason: "Withdraw before scheduled publication",
          }),
        })
      ).status,
    ).toBe(200);
    expect(
      await executeScheduledContent(
        database,
        nextJob,
        new Date(future.getTime() + 1),
      ),
    ).toEqual({ publication: "superseded-or-cancelled" });
    expect(
      (
        await database.db
          .collection(A.content)
          .findOne({ _id: new ObjectId(content.id) })
      )?.status,
    ).toBe("archived");
  });
  it("exposes only due published notices and exact maintenance wording to the customer reader", async () => {
    const now = new Date();
    await database.db.collection(A.settings).insertOne({
      key: "operations",
      pauseGeneration: true,
      maintenanceMessage: {
        en: "Uploads remain available until 17:30.",
        ar: "رفع الصور متاح حتى ١٧:٣٠.",
      },
      dailyRecoveryBudgetMinor: 555,
    });
    const shared = {
      kind: "announcement",
      title: { en: "Notice", ar: "إشعار" },
      body: { en: "Exact 20%!", ar: "خصم ٢٠٪!" },
      revision: 1,
      audience: "all",
      publishedAt: now,
    };
    await database.db.collection(A.content).insertMany([
      { ...shared, status: "published" },
      {
        ...shared,
        status: "draft",
        title: { en: "Draft excluded", ar: "مسودة" },
      },
      {
        ...shared,
        status: "scheduled",
        scheduledAt: new Date(Date.now() + 600000).toISOString(),
      },
      {
        ...shared,
        status: "published",
        audience: "verified",
        title: { en: "Verified only", ar: "خاص" },
      },
    ]);
    const response = await app.request("/api/v1/communications/status");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(1);
    expect(data.items[0].body).toEqual(shared.body);
    expect(data.maintenanceMessage.ar).toBe("رفع الصور متاح حتى ١٧:٣٠.");
    expect(JSON.stringify(data)).not.toContain("555");
    expect(
      (
        await (
          await app.request("/api/v1/communications/status", {
            headers: headers(String(customerId)),
          })
        ).json()
      ).items,
    ).toHaveLength(2);
  });
  it("accepts only owner-scoped customer follow-up replies and preserves private notes", async () => {
    const created = await app.request("/api/v1/admin/support", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        userId: String(customerId),
        subject: "Campaign audio investigation",
        category: "generation",
        message: "Private internal note",
      }),
    });
    const record = await created.json();
    const replyKey = randomUUID();
    const body = JSON.stringify({
      expectedRevision: 1,
      message: "My product photo was saved but the audio is missing.",
    });
    const send = (user = String(customerId), key = replyKey) =>
      app.request(`/api/v1/support/${record.id}/replies`, {
        method: "POST",
        headers: headers(user, key),
        body,
      });
    const first = await send();
    expect(first.status).toBe(200);
    expect((await send()).status).toBe(200);
    expect(
      await database.db.collection(A.messages).countDocuments({
        caseId: new ObjectId(record.id),
        visibility: "customer",
      }),
    ).toBe(1);
    expect((await send(String(outsiderId), randomUUID())).status).toBe(409);
    const visible = await app.request(`/api/v1/support/${record.id}`, {
      headers: headers(String(customerId)),
    });
    const text = await visible.text();
    expect(text).toContain("audio is missing");
    expect(text).not.toContain("Private internal note");
    expect(
      (
        await app.request(`/api/v1/support/${record.id}/replies`, {
          method: "POST",
          headers: {
            ...headers(String(customerId), randomUUID()),
            origin: "https://untrusted.example",
          },
          body,
        })
      ).status,
    ).toBe(403);
  });
  it("records moderation decisions, protects the owner and keeps requested cancellation distinct from completion", async () => {
    const assetId = new ObjectId();
    await database.db.collection("creator_reference_library").insertOne({
      _id: assetId,
      userId: customerId,
      kind: "presenter",
      deleted: false,
      value: {
        id: String(assetId),
        kind: "presenter",
        name: "Consented adult",
        revision: 1,
        approved: true,
        deleted: false,
        photos: [
          { id: String(new ObjectId()), objectKey: "private/presenter.png" },
        ],
        approval: { approved: true },
      },
    });
    const create = await app.request("/api/v1/admin/moderation", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        category: "permission-dispute",
        userId: String(customerId),
        assetId: String(assetId),
        reason: "Review the permission dispute for this adult",
      }),
    });
    const review = await create.json();
    const key = randomUUID();
    const decision = {
      expectedRevision: 1,
      action: "quarantine-asset",
      assetRevision: 1,
      reason: "Restrict reuse until the permission dispute is resolved",
    };
    const decide = () =>
      app.request(`/api/v1/admin/moderation/${review.id}/decision`, {
        method: "POST",
        headers: headers(String(ownerId), key),
        body: JSON.stringify(decision),
      });
    expect((await decide()).status).toBe(200);
    expect((await decide()).status).toBe(200);
    expect(
      await database.db
        .collection("creator_reference_library")
        .findOne({ _id: assetId }),
    ).toMatchObject({
      quarantinedAt: expect.any(Date),
      value: { revision: 2, approved: false },
    });
    expect(
      await database
        .collection("creator_reference_library_revisions")
        .findOne({ entryId: String(assetId), revision: 2 }),
    ).toBeTruthy();
    const ownReview = await app.request("/api/v1/admin/moderation", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        category: "abuse",
        userId: String(ownerId),
        reason: "Synthetic owner protection acceptance check",
      }),
    });
    const own = await ownReview.json();
    expect(
      (
        await app.request(`/api/v1/admin/moderation/${own.id}/decision`, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            expectedRevision: 1,
            action: "suspend-account",
            reason: "The designated owner must stay protected",
          }),
        })
      ).status,
    ).toBe(409);
    const runId = new ObjectId();
    await database.db
      .collection("render_runs")
      .insertOne({ _id: runId, userId: customerId, status: "processing" });
    const genReview = await app.request("/api/v1/admin/moderation", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        category: "reported-media",
        userId: String(customerId),
        reason: "Review an active reported generation",
      }),
    });
    const gen = await genReview.json();
    const cancellation = await app.request(
      `/api/v1/admin/moderation/${gen.id}/decision`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          expectedRevision: 1,
          action: "request-cancellation",
          runId: String(runId),
          reason:
            "Request safe cancellation through the normal generation domain",
        }),
      },
    );
    expect(await cancellation.json()).toMatchObject({
      status: "action-requested",
      decision: { outcome: "requested" },
    });
    expect(
      await database.db.collection("render_runs").findOne({ _id: runId }),
    ).toMatchObject({ status: "processing" });
  });
  it("reconciles report totals to canonical purchases, credit usage and explicit missing-cost coverage", async () => {
    await database.db.collection("payment_orders").insertMany([
      {
        userId: customerId,
        status: "credited",
        idempotencyKey: "report-order-1",
        currency: "KWD",
        amountMinor: 5000,
        credits: 100,
        creditedAt: new Date(),
      },
      {
        userId: customerId,
        status: "failed",
        idempotencyKey: "report-order-2",
        currency: "KWD",
        amountMinor: 999000,
        credits: 100,
        createdAt: new Date(),
      },
    ]);
    await database.db.collection("credit_ledger").insertMany([
      {
        userId: customerId,
        kind: "purchase",
        delta: 100,
        createdAt: new Date(),
      },
      { userId: customerId, kind: "charge", delta: -40, createdAt: new Date() },
    ]);
    await database.db.collection("render_attempts").insertOne({
      renderRunId: new ObjectId(),
      attemptNumber: 0,
      provider: "synthetic",
      createdAt: new Date(),
    });
    const response = await app.request(
      "/api/v1/admin/reports/summary?days=30",
      { headers: headers() },
    );
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.reports.cashCollections.rows).toEqual([
      expect.objectContaining({ amountMinor: 5000, purchasedCredits: 100 }),
    ]);
    expect(result.reports.creditLedger.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "charge", credits: -40 }),
      ]),
    );
    expect(result.reports.providerCosts.rows).toEqual([
      expect.objectContaining({
        reportedCostMicrousd: null,
        coverage: "unavailable",
      }),
    ]);
  });
  it("keeps private support notes inaccessible to customers", async () => {
    const body = {
      userId: String(customerId),
      subject: "Audio issue",
      category: "generation",
      message: "Private investigation note",
    };
    const created = await app.request("/api/v1/admin/support", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const record = await created.json();
    expect(created.status).toBe(200);
    const response = await app.request(`/api/v1/support/${record.id}`, {
      headers: headers(String(customerId)),
    });
    expect(await response.text()).not.toContain("Private investigation note");
    expect(
      (
        await app.request(`/api/v1/support/${record.id}`, {
          headers: headers(String(outsiderId)),
        })
      ).status,
    ).toBe(404);
  });
  it("creates a new unapproved asset revision and recoverable trash without altering accepted output", async () => {
    const entry = new ObjectId();
    const accepted = new ObjectId();
    const project = new ObjectId();
    await database.db.collection("creator_reference_library").insertOne({
      _id: entry,
      userId: customerId,
      kind: "product",
      deleted: false,
      value: {
        id: String(entry),
        kind: "product",
        name: "Perfume",
        revision: 1,
        approved: true,
        photos: [{ id: "photo-1", objectKey: "private/product.png" }],
        deleted: false,
        approval: { approved: true },
      },
    });
    await database.db.collection("creator_projects").insertOne({
      _id: project,
      userId: customerId,
      currentAcceptedVersionId: accepted,
      currentWorkingVersionId: accepted,
    });
    const post = (action: string, expectedRevision: number) =>
      app.request(`/api/v1/admin/assets/${entry}/actions`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          action,
          expectedRevision,
          reason: "Permission review test case",
        }),
      });
    expect((await post("trash", 1)).status).toBe(200);
    expect((await post("trash", 1)).status).toBe(409);
    const row = await database.db
      .collection("creator_reference_library")
      .findOne({ _id: entry });
    expect(row?.value.deleted).toBe(true);
    expect(row?.trashUntil).toBeInstanceOf(Date);
    expect((await post("restore", 2)).status).toBe(200);
    const restored = await database.db
      .collection("creator_reference_library")
      .findOne({ _id: entry });
    expect(restored?.value).toMatchObject({
      revision: 3,
      approved: false,
      deleted: false,
    });
    expect(
      (
        await database.db
          .collection("creator_projects")
          .findOne({ _id: project })
      )?.currentAcceptedVersionId,
    ).toEqual(accepted);
  });
  it("blocks a quarantined photo even when a fresh upload omits its library link", async () => {
    const checksum = "b".repeat(64);
    await database.db.collection("creator_reference_library").insertOne({
      userId: customerId,
      quarantinedAt: new Date(),
      value: { photos: [{ checksumSha256: checksum }] },
    });
    await expect(
      assertLibraryConfiguration(database, String(customerId), {
        creatorProject: {
          product: { images: [{ checksum, referenceRole: "subject" }] },
        },
      }),
    ).rejects.toMatchObject({ code: "review_required" });
  });
  it("returns truthful metrics and preserves exact bilingual content", async () => {
    const body = {
      expectedRevision: 0,
      kind: "announcement",
      title: { en: "Service notice", ar: "إشعار الخدمة" },
      body: { en: "20% off until Friday", ar: "خصم ٢٠٪ حتى الجمعة" },
      audience: "all",
      status: "published",
      reason: "Owner approved communication",
    };
    expect(
      (
        await app.request("/api/v1/admin/content", {
          method: "POST",
          headers: headers(),
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(200);
    const publicResult = await (
      await app.request("/api/v1/communications")
    ).json();
    expect(publicResult.items[0].body).toEqual(body.body);
    const response = await app.request("/api/v1/admin/overview", {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    expect((await response.json()).providerCosts.status).toBe("unavailable");
  });
  it("traces a library photo through working, accepted and active snapshots without cross-account references", async () => {
    const entry = new ObjectId();
    const project = new ObjectId();
    const working = new ObjectId();
    const accepted = new ObjectId();
    const photo = String(new ObjectId());
    const now = new Date();
    const image = {
      id: photo,
      librarySource: {
        entryId: String(entry),
        photoId: photo,
        revision: 1,
        kind: "product",
        sizeBytes: 10,
      },
    };
    await database.db.collection("creator_reference_library").insertOne({
      _id: entry,
      userId: customerId,
      kind: "product",
      deleted: false,
      value: { name: "Perfume", photos: [{ id: photo }], revision: 1 },
    });
    await database.db.collection("creator_projects").insertOne({
      _id: project,
      userId: customerId,
      title: "Perfume launch",
      currentWorkingVersionId: working,
      currentAcceptedVersionId: accepted,
    });
    await database.db.collection("creator_project_versions").insertMany([
      {
        _id: working,
        userId: customerId,
        projectId: project,
        versionNumber: 2,
        configuration: { creatorProject: { product: { images: [image] } } },
        createdAt: now,
      },
      {
        _id: accepted,
        userId: customerId,
        projectId: project,
        versionNumber: 1,
        productRecipe: { images: [image] },
        createdAt: now,
      },
      {
        userId: outsiderId,
        projectId: new ObjectId(),
        versionNumber: 1,
        configuration: { creatorProject: { product: { images: [image] } } },
      },
    ]);
    await database.db.collection("render_runs").insertOne({
      userId: customerId,
      projectId: project,
      projectVersionId: working,
      status: "processing",
      idempotencyKey: randomUUID(),
    });
    const response = await app.request(`/api/v1/admin/assets/${entry}`, {
      headers: headers(),
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.related.references.total).toBe(2);
    expect(
      data.related.references.items.find(
        (item: { versionId: string }) => item.versionId === String(working),
      ),
    ).toMatchObject({
      working: true,
      accepted: false,
      activeRuns: [{ status: "processing" }],
    });
    expect(
      data.related.references.items.find(
        (item: { versionId: string }) => item.versionId === String(accepted),
      ),
    ).toMatchObject({
      working: false,
      accepted: true,
      linkedPhotos: [{ photoId: photo, revision: 1 }],
    });
  });
  it("exports immutable customer versions and media history without credentials, other accounts or private notes", async () => {
    const project = new ObjectId();
    const version = new ObjectId();
    const entry = new ObjectId();
    const spoken = "هذا المنتج متوفر بحجم ٥٠ مل.";
    const display = "20% off until Friday!";
    await database.db.collection("creator_project_versions").insertOne({
      _id: version,
      projectId: project,
      userId: customerId,
      versionNumber: 1,
      configuration: {
        spokenScript: spoken,
        displayCopy: { offer: display, closingMessage: "" },
        image: { url: "https://storage.test/photo?X-Amz-Signature=secret" },
        providerModelId: "server-only",
      },
      productRecipe: { facts: { size: "٥٠ مل" } },
      createdAt: new Date(),
    });
    await database.db
      .collection("creator_reference_library_revisions")
      .insertOne({
        entryId: String(entry),
        userId: customerId,
        revision: 1,
        value: {
          name: "Perfume",
          photos: [
            {
              id: String(new ObjectId()),
              objectKey: "users/synthetic/library/photo",
              checksumSha256: "a".repeat(64),
            },
          ],
        },
      });
    await database.db.collection(A.messages).insertMany([
      {
        userId: customerId,
        visibility: "private",
        message: "Owner note excluded",
      },
      {
        userId: customerId,
        visibility: "customer",
        message: "Customer-visible reply",
      },
      {
        userId: outsiderId,
        visibility: "customer",
        message: "Other account excluded",
      },
    ]);
    await database.db.collection("accounts").insertOne({
      userId: customerId,
      providerId: "credential",
      accountId: "customer@example.test",
      password: "must-never-export-password",
      accessToken: "must-never-export-token",
    });
    const result =
      await createCustomerDataService(database).exportData(customerId);
    const text = new TextDecoder().decode(result.body);
    const body = JSON.parse(text);
    expect(body.records.versions[0].configuration).toEqual({
      spokenScript: spoken,
      displayCopy: { offer: display, closingMessage: "" },
      image: {},
    });
    expect(body.records.supportMessages).toHaveLength(1);
    expect(body.mediaInventory[0].objectKey).toBe(
      "users/synthetic/library/photo",
    );
    for (const excluded of [
      "must-never-export",
      "Owner note excluded",
      "Other account excluded",
      "X-Amz-Signature",
      "server-only",
    ])
      expect(text).not.toContain(excluded);
    expect(
      await database.db
        .collection("creator_project_versions")
        .findOne({ _id: version }),
    ).toMatchObject({
      configuration: { spokenScript: spoken, displayCopy: { offer: display } },
    });
  });
  it("prepares a deletion manifest with active and financial holds, then cancels without clearing unrelated suspension", async () => {
    const project = new ObjectId();
    const version = new ObjectId();
    const now = new Date();
    await database.db.collection("creator_projects").insertOne({
      _id: project,
      userId: customerId,
      currentAcceptedVersionId: version,
      status: "generating",
    });
    await database.db.collection("creator_project_versions").insertOne({
      _id: version,
      userId: customerId,
      projectId: project,
      configuration: { offer: "خصم ٢٠٪" },
    });
    await database.db.collection("render_runs").insertOne({
      userId: customerId,
      projectId: project,
      projectVersionId: version,
      status: "processing",
      idempotencyKey: randomUUID(),
    });
    await database.db.collection("credit_reservations").insertOne({
      userId: customerId,
      renderRunId: new ObjectId(),
      amount: 10,
      status: "reserved",
    });
    await database.db
      .collection("users")
      .updateOne({ _id: customerId }, { $set: { suspendedAt: now } });
    const path = `/api/v1/admin/customers/${customerId}/actions`;
    const response = await app.request(path, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        action: "delete-request",
        reason: "Prepare reviewed account deletion",
      }),
    });
    expect(response.status).toBe(200);
    const request = await response.json();
    expect(
      (
        await app.request(path, {
          method: "POST",
          headers: headers(),
          body: JSON.stringify({
            action: "delete-request",
            reason: "Avoid duplicate privacy request",
          }),
        })
      ).status,
    ).toBe(409);
    await createAdminOperationWorker({
      database,
      auth,
      environment: env,
    }).tick();
    const inventory = await (
      await app.request(`/api/v1/admin/privacy/${request.operationId}`, {
        headers: headers(),
      })
    ).json();
    expect(inventory.status).toBe("review-required");
    expect(inventory.manifest.blockers).toEqual(
      expect.arrayContaining([
        { code: "retention-policy-review", count: 1 },
        { code: "active-generations", count: 1 },
        { code: "reserved-credits", count: 1 },
      ]),
    );
    const reviewPath = `/api/v1/admin/privacy/${request.operationId}/review`;
    const key = randomUUID();
    const review = {
      expectedRevision: 1,
      action: "cancel-request",
      reason: "Customer withdrew the deletion request",
    };
    const cancelled = await app.request(reviewPath, {
      method: "POST",
      headers: headers(String(ownerId), key),
      body: JSON.stringify(review),
    });
    expect(cancelled.status).toBe(200);
    expect(
      (
        await app.request(reviewPath, {
          method: "POST",
          headers: headers(String(ownerId), key),
          body: JSON.stringify(review),
        })
      ).status,
    ).toBe(200);
    const user = await database.db
      .collection("users")
      .findOne({ _id: customerId });
    expect(user?.deletionRequestedAt).toBeUndefined();
    expect(user?.suspendedAt).toEqual(now);
    expect(
      await database.db
        .collection("creator_projects")
        .findOne({ _id: project }),
    ).toMatchObject({
      currentAcceptedVersionId: version,
      status: "generating",
    });
    expect(
      await database.db
        .collection("render_runs")
        .findOne({ userId: customerId }),
    ).toMatchObject({ status: "processing" });
  });
  it("publishes a real operation-worker heartbeat and records graceful shutdown", async () => {
    const worker = createAdminOperationWorker({
      database,
      auth,
      environment: env,
    });
    worker.start();
    try {
      await vi.waitFor(async () =>
        expect(
          await database.db.collection("service_heartbeats").findOne({
            serviceName: "movprompt-admin-worker",
            status: "ready",
          }),
        ).toBeTruthy(),
      );
    } finally {
      await worker.stop();
    }
    expect(
      await database.db
        .collection("service_heartbeats")
        .findOne({ serviceName: "movprompt-admin-worker" }),
    ).toMatchObject({ status: "stopping" });
  });
  it("creates private bounded exports through a leased worker and avoids formula injection", async () => {
    const objects = new Map<string, Uint8Array>();
    const storage = {
      outputsBucket: "outputs",
      head: async (_bucket: string, key: string) => ({
        contentLength: objects.get(key)?.length,
        checksumSha256: createHash("sha256")
          .update(objects.get(key)!)
          .digest("hex"),
      }),
      put: async ({ key, body }: { key: string; body: Uint8Array }) => {
        objects.set(key, body);
        return { key, bucket: "outputs" };
      },
    } as AssetStorageGateway;
    await database.db
      .collection("users")
      .updateOne(
        { _id: customerId },
        { $set: { name: '=HYPERLINK("https://evil.test")' } },
      );
    const now = new Date();
    const operation = await database.db.collection(A.operations).insertOne({
      kind: "report.export",
      report: "customers",
      from: new Date(0),
      to: new Date(Date.now() + 100000),
      status: "queued",
      availableAt: now,
      attempts: 0,
      createdAt: now,
    });
    const worker = createAdminOperationWorker({
      database,
      auth,
      storage,
      environment: env,
    });
    await worker.tick();
    const result = await database.db
      .collection(A.operations)
      .findOne({ _id: operation.insertedId });
    expect(result?.status).toBe("completed");
    expect(result?.rowCount).toBe(2);
    expect(new TextDecoder().decode(objects.get(result!.objectKey))).toContain(
      "'=HYPERLINK",
    );
    expect(result?.objectKey).not.toContain("http");
    await database.db.collection("credit_ledger").insertOne({
      userId: customerId,
      kind: "adjustment",
      delta: -10,
      balanceAfter: 90,
      reason: "=SUM(1,2)",
      createdAt: now,
      idempotencyKey: randomUUID(),
    });
    const creditsExport = await database.db.collection(A.operations).insertOne({
      kind: "report.export",
      report: "credits",
      from: new Date(0),
      to: new Date(Date.now() + 100000),
      status: "queued",
      availableAt: now,
      attempts: 0,
      createdAt: now,
    });
    await worker.tick();
    const creditsFile = await database.db
      .collection(A.operations)
      .findOne({ _id: creditsExport.insertedId });
    expect(creditsFile?.status).toBe("completed");
    const csv = new TextDecoder().decode(objects.get(creditsFile!.objectKey));
    expect(csv).toContain('"-10"');
    expect(csv).not.toContain('"\'-10"');
    expect(csv).toContain("'=SUM(1,2)");
  });
});

describe("wallet provenance", () => {
  it("restores the original purchase lot after a failed generation without turning goodwill into cash", () => {
    const result = reconstructCreditLots(
      [
        {
          kind: "purchase",
          referenceType: "payment_order",
          referenceId: "p1",
          delta: 100,
        },
        { kind: "adjustment", delta: 20 },
        { kind: "charge", referenceId: "r1", delta: -60 },
        { kind: "refund", referenceId: "r1", delta: 60 },
      ],
      120,
    );
    expect(result.verified).toBe(true);
    expect(
      result.lots
        .filter((lot) => lot.orderId === "p1")
        .reduce((sum, lot) => sum + lot.remaining, 0),
    ).toBe(100);
    expect(
      reconstructCreditLots([{ kind: "charge", delta: -20 }], -20).verified,
    ).toBe(false);
  });
});

describe.skipIf(!uri)("owner MFA with the actual Better Auth adapter", () => {
  const database = createMongoDatabase({
    uri: uri ?? "mongodb://127.0.0.1:27029/",
    databaseName: `movprompt_admin_auth_test_${Date.now()}`,
  });
  beforeAll(async () => {
    await database.connect();
    await ensureMongoIndexes(database);
    await ensureAdminIndexes(database);
  });
  afterAll(async () => {
    await database.db.dropDatabase();
    await database.close();
  });
  it.each(["verified-email", "designated-email-password"] as const)(
    "requires protected owner membership and real MFA with %s",
    async (loginMode) => {
      const environment = authEnvironmentFromEnv({
        BETTER_AUTH_URL: "http://localhost:8787",
        BETTER_AUTH_SECRET: "synthetic-local-admin-auth-test-secret-2026",
      });
      const auth = createMovPromptAuth({
        db: database,
        environment,
        sendEmail: async () => undefined,
      });
      const gateway = createBetterAuthGateway(
        auth,
        environment.publicCapability,
        database,
      );
      const cookies = new Map<string, string>();
      async function call(path: string, body: unknown) {
        const headers = new Headers({
          "content-type": "application/json",
          origin: "http://localhost:8787",
          cookie: Array.from(cookies.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join("; "),
        });
        const response = await gateway.handle(
          new Request(`http://localhost:8787/api/auth/${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
          }),
        );
        for (const cookie of response.headers.getSetCookie()) {
          const pair = cookie.split(";")[0]!;
          const index = pair.indexOf("=");
          cookies.set(pair.slice(0, index), pair.slice(index + 1));
        }
        return { status: response.status, data: await response.json() };
      }
      const headers = () =>
        new Headers({
          cookie: Array.from(cookies.entries())
            .map(([key, value]) => `${key}=${value}`)
            .join("; "),
        });
      const password = "Synthetic-local-only-2026!";
      const email = `${loginMode}.owner.auth@example.test`;
      const signup = await call("sign-up/email", {
        email,
        name: "Auth test owner",
        password,
      });
      expect(signup.status).toBe(200);
      const userId = signup.data.user.id;
      const security = createAdminSecurity(database, gateway);
      await expect(security.identity(headers())).rejects.toMatchObject({
        code: "owner_required",
      });
      await database.db
        .collection(A.owners)
        .insertOne({
          userId: new ObjectId(userId),
          role: "owner",
          active: true,
        });
      await expect(security.identity(headers())).rejects.toMatchObject({
        code: "owner_verification_required",
      });
      if (loginMode === "verified-email")
        await database.db
          .collection("users")
          .updateOne(
            { _id: new ObjectId(userId) },
            { $set: { emailVerified: true } },
          );
      else
        await database.db
          .collection(A.owners)
          .updateOne({ userId: new ObjectId(userId) }, { $set: { loginMode } });
      const enabled = await call("two-factor/enable", {
        password,
        issuer: "MovPrompt",
      });
      expect(enabled.status).toBe(200);
      expect(enabled.data.backupCodes.length).toBeGreaterThan(0);
      const secret = new URL(enabled.data.totpURI).searchParams.get("secret")!;
      const code = () => {
        let bits = "";
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        for (const character of secret.toUpperCase().replace(/=+$/, ""))
          bits += alphabet.indexOf(character).toString(2).padStart(5, "0");
        const bytes = Buffer.from(
          (bits.match(/.{8}/g) ?? []).map((value) => Number.parseInt(value, 2)),
        );
        const counter = Buffer.alloc(8);
        counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
        const hmac = createHmac("sha1", bytes).update(counter).digest();
        const offset = hmac[hmac.length - 1]! & 15;
        return String(
          (hmac.readUInt32BE(offset) & 0x7fffffff) % 1000000,
        ).padStart(6, "0");
      };
      expect(
        (
          await call("two-factor/verify-totp", {
            code: code(),
            trustDevice: false,
          })
        ).status,
      ).toBe(200);
      expect(await security.identity(headers())).toMatchObject({
        emailVerified: loginMode === "verified-email",
        mfaEnabled: true,
        recoveryReady: true,
        assuredUntil: expect.any(String),
      });
      expect((await call("two-factor/disable", { password })).status).toBe(403);
      expect((await call("two-factor/enable", { password })).status).toBe(403);
      const recovered = await security.assure(
        headers(),
        enabled.data.backupCodes[1],
        "real-owner-recovery",
        "backup",
      );
      expect(recovered.assuredUntil).toBeTruthy();
      await expect(
        security.assure(
          headers(),
          enabled.data.backupCodes[1],
          "reused-owner-recovery",
          "backup",
        ),
      ).rejects.toMatchObject({ code: "owner_factor_invalid" });
      expect((await call("two-factor/get-totp-uri", { password })).status).toBe(
        200,
      );

      await call("sign-out", {});
      const signin = await call("sign-in/email", {
        email,
        password,
      });
      expect(signin.data.twoFactorRedirect).toBe(true);
      expect(await gateway.getSession(headers())).toBeNull();
      expect(
        (
          await call("two-factor/verify-totp", {
            code: code(),
            trustDevice: false,
          })
        ).status,
      ).toBe(200);
      expect((await gateway.getSession(headers()))?.user.id).toBe(userId);
      await database.db
        .collection("users")
        .updateOne(
          { _id: new ObjectId(userId) },
          { $set: { suspendedAt: new Date() } },
        );
      expect(await gateway.getSession(headers())).toBeNull();
      const events = await database.db
        .collection("authentication_events")
        .find({ userId: new ObjectId(userId) })
        .toArray();
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "password-sign-in",
            outcome: "factor-required",
          }),
          expect.objectContaining({
            kind: "authenticator-verification",
            outcome: "authenticated",
          }),
          expect.objectContaining({ kind: "sign-out", outcome: "signed-out" }),
        ]),
      );
      const audit = JSON.stringify(events);
      for (const secret of [
        password,
        code(),
        enabled.data.backupCodes[0],
        "otpauth://",
      ])
        expect(audit).not.toContain(secret);
    },
  );
});
