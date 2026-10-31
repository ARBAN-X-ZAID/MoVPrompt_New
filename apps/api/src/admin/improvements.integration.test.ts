import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { createHash, randomUUID } from "node:crypto";
import {
  createMongoDatabase,
  ensureMongoIndexes,
  ensureMongoTemplateCatalog,
  COLLECTIONS as C,
} from "@movprompt/db";
import { LAUNCH_CREATIVE_TEMPLATE_CATALOG } from "@movprompt/creative-engine";
import { createMovPromptAuth, authEnvironmentFromEnv } from "@movprompt/auth";
import { createBetterAuthGateway } from "../auth-gateway.js";
import { createAdminSecurity, ensureAdminIndexes } from "./security.js";
import {
  migrateOwnerPasswordPolicy,
  restoreOwnerAuthenticationPolicy,
} from "./password-policy.js";
import {
  checkPasswordAttempt,
  PasswordCooldownError,
} from "../password-attempts.js";
import { createCustomerViews, paymentDateRange } from "./customer-views.js";
import {
  AdminPaymentQuerySchema,
  AdminListQuerySchema,
  AdminCustomerRecordsSchema,
  AdminDurationAvailabilitySchema,
} from "@movprompt/contracts";
import { createAdminDataService } from "./data-service.js";
import { createAdminTemplateService } from "./template-service.js";
import { createMongoCreatorRepository } from "../mongo-creator-repository.js";
import { createMongoGenerationRepository } from "../mongo-generation-repository.js";

describe("Kuwait payment periods", () => {
  it("includes both custom dates and crosses UTC midnight correctly", () => {
    const result = paymentDateRange(
      AdminPaymentQuerySchema.parse({
        period: "custom",
        start: "2026-10-01",
        end: "2026-10-02",
      }),
    );
    expect(result.from.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(result.to.toISOString()).toBe("2026-10-02T21:00:00.000Z");
    expect(
      paymentDateRange(
        AdminPaymentQuerySchema.parse({}),
        new Date("2026-10-30T22:00:00Z"),
      ).from.toISOString(),
    ).toBe("2026-10-24T21:00:00.000Z");
  });
  it("rejects invalid and reversed dates", () => {
    for (const [start, end] of [
      ["2026-02-30", "2026-03-02"],
      ["2026-03-02", "2026-03-01"],
    ])
      expect(() =>
        paymentDateRange(
          AdminPaymentQuerySchema.parse({ period: "custom", start, end }),
        ),
      ).toThrow();
  });
});

const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)("simplified admin on real MongoDB", () => {
  const database = createMongoDatabase({
    uri: uri ?? "mongodb://127.0.0.1:27029/",
    databaseName: `admin_improvements_${Date.now()}`,
  });
  const customer = new ObjectId();
  beforeAll(async () => {
    await database.connect();
    await ensureMongoIndexes(database);
    await ensureAdminIndexes(database);
    await ensureMongoTemplateCatalog(
      database,
      LAUNCH_CREATIVE_TEMPLATE_CATALOG,
    );
  });
  afterAll(async () => {
    await database.db.dropDatabase();
    await database.close();
  });
  it("locks on the tenth failure, persists across calls, resets after cooldown and success", async () => {
    const subject = `login:${randomUUID()}@example.test`;
    for (let i = 0; i < 9; i++)
      expect(
        await checkPasswordAttempt(database, subject, async () => ({
          valid: false,
          value: false,
        })),
      ).toBe(false);
    await expect(
      checkPasswordAttempt(database, subject, async () => ({
        valid: false,
        value: false,
      })),
    ).rejects.toMatchObject({ retryAfter: 300 });
    let invoked = false;
    await expect(
      checkPasswordAttempt(database, subject, async () => {
        invoked = true;
        return { valid: true, value: true };
      }),
    ).rejects.toBeInstanceOf(PasswordCooldownError);
    expect(invoked).toBe(false);
    await expect(
      checkPasswordAttempt(
        database,
        subject,
        async () => ({ valid: true, value: true }),
        new Date(Date.now() + 301000),
      ),
    ).resolves.toBe(true);
    for (let i = 0; i < 9; i++)
      await checkPasswordAttempt(database, subject, async () => ({
        valid: false,
        value: false,
      }));
    await expect(
      checkPasswordAttempt(database, subject, async () => ({
        valid: true,
        value: true,
      })),
    ).resolves.toBe(true);
  });
  it("serializes concurrent checks across different service callers", async () => {
    const subject = `parallel:${randomUUID()}`;
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = checkPasswordAttempt(database, subject, async () => {
      started();
      await gate;
      return { valid: false, value: false };
    });
    await began;
    const attempts = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        checkPasswordAttempt(database, subject, async () => ({
          valid: false,
          value: false,
        })),
      ),
    );
    expect(attempts.every((result) => result.status === "rejected")).toBe(true);
    release();
    await first;
  });
  it("fails closed if a slow password check loses its lease", async () => {
    const subject = `expired:${randomUUID()}`;
    const id = createHash("sha256").update(subject).digest("hex");
    await expect(
      checkPasswordAttempt(database, subject, async () => {
        await database.db
          .collection("password_attempts")
          .updateOne({ subject: id }, { $set: { lockUntil: new Date(0) } });
        return { valid: true, value: "must-not-return" };
      }),
    ).rejects.toThrow("password_check_lease_lost");
  });
  it("migrates only the designated owner and issues 60-day password sessions with protected step-up", async () => {
    const auth = createMovPromptAuth({
      db: database,
      environment: authEnvironmentFromEnv({
        APP_ENV: "local",
        BETTER_AUTH_URL: "http://localhost:18787",
        WEB_ORIGIN: "http://localhost:18080",
        BETTER_AUTH_SECRET: randomUUID() + randomUUID(),
      }),
      sendEmail: async () => {},
    });
    const password = `Test-${randomUUID()}`;
    const signed = await auth.api.signUpEmail({
      body: {
        email: "owner-improvements@example.test",
        password,
        name: "Local owner",
      },
    });
    const ownerId = new ObjectId(signed.user.id);
    await database.db
      .collection("users")
      .updateOne(
        { _id: ownerId },
        { $set: { emailVerified: true, twoFactorEnabled: true } },
      );
    await database.db.collection("admin_owners").insertOne({
      userId: ownerId,
      role: "owner",
      active: true,
      createdAt: new Date(),
    });
    await database.db.collection("users").insertOne({
      _id: customer,
      name: "Local retailer",
      email: "retailer@example.test",
      createdAt: new Date(),
      twoFactorEnabled: true,
    });
    expect(await migrateOwnerPasswordPolicy(database, String(ownerId))).toEqual(
      { changed: true },
    );
    expect(await migrateOwnerPasswordPolicy(database, String(ownerId))).toEqual(
      { changed: false },
    );
    expect(
      (await database.db.collection("users").findOne({ _id: customer }))
        ?.twoFactorEnabled,
    ).toBe(true);
    expect(
      await database.db
        .collection("sessions")
        .countDocuments({ userId: ownerId }),
    ).toBe(0);
    const gateway = createBetterAuthGateway(
      auth,
      { emailPassword: true } as never,
      database,
    );
    const response = await gateway.handle(
      new Request("http://localhost:18787/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:18080",
        },
        body: JSON.stringify({ email: signed.user.email, password }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.clone().json();
    expect(body.twoFactorRedirect).toBeUndefined();
    const cookies = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const headers = new Headers({ cookie: cookies });
    const security = createAdminSecurity(database, gateway);
    const identity = await security.identity(headers);
    expect(identity.authenticationPolicy).toBe("password");
    expect(
      new Date(identity.assuredUntil!).getTime() - Date.now(),
    ).toBeGreaterThan(59 * 86400000);
    await expect(
      security.requireOwner(headers, "test", true),
    ).rejects.toMatchObject({ code: "owner_step_up_required" });
    await expect(
      security.confirmPassword(headers, "bad-password", "test"),
    ).rejects.toMatchObject({ code: "owner_password_invalid" });
    await security.confirmPassword(headers, password, "test");
    await expect(
      security.requireOwner(headers, "test", true),
    ).resolves.toMatchObject({ userId: String(ownerId) });
    await expect(
      security.requireOwner(new Headers(), "test"),
    ).rejects.toMatchObject({ code: "authentication_required" });
    await database.db.collection("sessions").updateMany(
      { userId: ownerId },
      {
        $set: {
          expiresAt: new Date(Date.now() + 3 * 86400000),
          updatedAt: new Date(Date.now() - 2 * 86400000),
        },
      },
    );
    const renewed = await gateway.getSession(headers);
    expect(
      new Date(String(renewed?.session.expiresAt)).getTime() - Date.now(),
    ).toBeGreaterThan(59 * 86400000);
    for (const email of [
      signed.user.email.toUpperCase(),
      "unknown-password-check@example.test",
    ]) {
      for (let attempt = 1; attempt <= 10; attempt++) {
        const rejected = await gateway.handle(
          new Request("http://localhost:18787/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              origin: "http://localhost:18080",
            },
            body: JSON.stringify({
              email,
              password: "incorrect-local-password",
            }),
          }),
        );
        expect(rejected.status).toBe(attempt < 10 ? 401 : 429);
        if (attempt === 10)
          expect((await rejected.json()).code).toBe("PASSWORD_COOLDOWN");
      }
    }
    await database.db
      .collection("admin_session_assurance")
      .updateMany({ userId: ownerId }, { $set: { recentUntil: new Date(0) } });
    await expect(
      security.requireOwner(headers, "expired-password-confirmation", true),
    ).rejects.toMatchObject({ code: "owner_step_up_required" });
    await auth.api.signOut({ headers });
    expect(await gateway.getSession(headers)).toBeNull();
    await restoreOwnerAuthenticationPolicy(database, String(ownerId));
    expect(
      (await database.db.collection("users").findOne({ _id: ownerId }))
        ?.twoFactorEnabled,
    ).toBe(true);
    expect(
      await database.db
        .collection("sessions")
        .countDocuments({ userId: ownerId }),
    ).toBe(0);
    const before = await database.db
      .collection("users")
      .findOne({ _id: ownerId });
    expect(before?.emailVerified).toBe(true);
  });
  it("shows balances with all reservations and payments with customer search and settled-event totals", async () => {
    const now = new Date();
    await database.db
      .collection(C.creditAccounts)
      .insertOne({ userId: customer, balance: 100, refundReserved: 10 });
    await database.db
      .collection(C.creditReservations)
      .insertOne({ userId: customer, status: "reserved", amount: 20 });
    await database.db.collection(C.paymentOrders).insertMany(
      Array.from({ length: 30 }, (_, i) => ({
        userId: customer,
        idempotencyKey: randomUUID(),
        status: i === 29 ? "pending" : "credited",
        currency: "KWD",
        amountMinor: 5000,
        credits: 100,
        createdAt: now,
        creditedAt: now,
      })),
    );
    await database.db.collection(C.paymentOrders).insertOne({
      userId: customer,
      idempotencyKey: randomUUID(),
      status: "credited",
      currency: "KWD",
      amountMinor: 9000,
      credits: 100,
      createdAt: new Date("2020-01-01"),
      creditedAt: new Date("2020-01-01"),
    });
    await database.db.collection("admin_financial_requests").insertMany([
      {
        userId: customer,
        kind: "cash-refund",
        status: "confirmed",
        amountMinor: 1000,
        execution: { confirmedAt: now },
      },
      {
        userId: customer,
        kind: "cash-refund",
        status: "submitted",
        amountMinor: 4000,
        execution: { confirmedAt: now },
      },
    ]);
    await database.db
      .collection(C.creditLedger)
      .insertMany(
        Array.from({ length: 31 }, (_, index) => ({
          userId: customer,
          kind: "purchase",
          reason: "credit_top_up",
          delta: 1,
          balanceAfter: index + 1,
          idempotencyKey: randomUUID(),
          createdAt: now,
          privateInternalField: "must not cross tab boundary",
        })),
      );
    const data = createAdminDataService(
      database,
      createAdminSecurity(database, {
        handle: async () => new Response(),
        getSession: async () => null,
      }),
    );
    const firstPage = AdminCustomerRecordsSchema.parse(
      await data.list(
        "credits",
        AdminListQuerySchema.parse({
          userId: String(customer),
          limit: 25,
          page: 1,
        }),
      ),
    );
    const secondPage = AdminCustomerRecordsSchema.parse(
      await data.list(
        "credits",
        AdminListQuerySchema.parse({
          userId: String(customer),
          limit: 25,
          page: 2,
        }),
      ),
    );
    expect(firstPage.items).toHaveLength(25);
    expect(secondPage.items).toHaveLength(6);
    expect(firstPage.total).toBe(31);
    expect(firstPage.items[0]).not.toHaveProperty("privateInternalField");
    const views = createCustomerViews(database, {});
    expect((await views.summary(String(customer))).wallet).toEqual({
      balance: 100,
      reserved: 30,
      available: 70,
    });
    const payments = (await views.payments(
      AdminPaymentQuerySchema.parse({ search: "retailer@example.test" }),
    )) as {
      items: unknown[];
      total: number;
      totals: { collected: number; refunded: number; net: number };
    };
    expect(payments.items).toHaveLength(25);
    expect(payments.total).toBe(30);
    expect(payments.totals).toEqual({
      collected: 145000,
      refunded: 1000,
      net: 144000,
    });
  });
  it("version-checks duration switches without changing recipes or startup catalog decisions", async () => {
    const auth = {
      handle: async () => new Response(),
      getSession: async () => null,
    };
    const security = createAdminSecurity(database, auth);
    const service = createAdminTemplateService(database, security, {});
    const head = await database.db
      .collection(C.videoTemplates)
      .findOne({ slug: "jewelry-product-showcase" });
    const actor = {
      userId: String(customer),
      sessionId: new ObjectId().toHexString(),
      requestId: "availability-test",
    };
    const version = await database.db
      .collection(C.videoTemplateVersions)
      .findOne({ _id: new ObjectId(head!.currentPublishedVersionId) });
    expect(
      AdminDurationAvailabilitySchema.safeParse({
        expectedRevision: 0,
        enabledDurations: [],
      }).success,
    ).toBe(false);
    await expect(
      service.availability(actor, String(head!._id), randomUUID(), {
        expectedRevision: head!.revision ?? 0,
        enabledDurations: [99],
      }),
    ).rejects.toMatchObject({ code: "unsupported_template_duration" });
    const key = randomUUID();
    const input = {
      expectedRevision: head!.revision ?? 0,
      enabledDurations: [15],
    };
    await service.availability(actor, String(head!._id), key, input);
    await service.availability(actor, String(head!._id), key, input);
    await expect(
      service.availability(actor, String(head!._id), randomUUID(), input),
    ).rejects.toMatchObject({ code: "template_publication_changed" });
    const publicTemplate = await createMongoCreatorRepository(
      database,
    ).findPublishedTemplate("jewelry-product-showcase");
    expect(publicTemplate?.supportedDurations).toEqual([15]);
    const generationTemplate = await createMongoGenerationRepository(
      database,
    ).findPublishedTemplateVersion(String(version!._id));
    expect(generationTemplate?.enabledDurations).toEqual([15]);
    expect(
      await database.db
        .collection(C.videoTemplateVersions)
        .findOne({ _id: version!._id }),
    ).toEqual(version);
    await ensureMongoTemplateCatalog(
      database,
      LAUNCH_CREATIVE_TEMPLATE_CATALOG,
    );
    expect(
      (
        await database.db
          .collection(C.videoTemplates)
          .findOne({ _id: head!._id })
      )?.enabledDurations,
    ).toEqual([15]);
  });

  it("applies owner settings to the catalog and quotes, and keeps them across startup", async () => {
    const auth = { handle: async () => new Response(), getSession: async () => null };
    const service = createAdminTemplateService(database, createAdminSecurity(database, auth), {});
    const actor = { userId: String(customer), sessionId: new ObjectId().toHexString(), requestId: "template-details-test" };
    const repository = createMongoCreatorRepository(database);
    const head = await database.db
      .collection(C.videoTemplates)
      .findOne({ slug: "premium-phone-reveal" });
    const versionId = String(head!.currentPublishedVersionId);
    const version = await database.db
      .collection(C.videoTemplateVersions)
      .findOne({ _id: new ObjectId(versionId) });
    const id = String(head!._id);
    const expectedRevision = head!.revision ?? 0;
    await expect(
      service.details(actor, id, randomUUID(), { expectedRevision, category: "not-a-category" }),
    ).rejects.toMatchObject({ code: "unsupported_template_category" });
    await expect(
      service.details(actor, id, randomUUID(), { expectedRevision: expectedRevision + 9, tags: ["x"] }),
    ).rejects.toMatchObject({ code: "template_publication_changed" });
    const key = randomUUID();
    const input = {
      expectedRevision,
      displayName: { en: "Owner phone", ar: "هاتف المالك" },
      displayDescription: { en: "Owner description", ar: "وصف المالك" },
      displayOutcome: { en: "Owner outcome", ar: "نتيجة المالك" },
      category: "brand",
      discoveryCategory: "brand" as const,
      tags: ["owner-tag"],
      sortOrder: 0,
      enabledLanguages: ["ar" as const],
    };
    const saved = await service.details(actor, id, key, input);
    expect(saved).toMatchObject({ revision: expectedRevision + 1, overrides: { enabledLanguages: ["ar"], category: "brand" } });
    expect(await service.details(actor, id, key, input)).toEqual(saved);
    const expectations = {
      name: input.displayName,
      description: input.displayDescription,
      outcome: "Owner outcome",
      localizedOutcome: input.displayOutcome,
      category: "brand",
      discoveryCategory: "brand",
      tags: ["owner-tag"],
      supportedLanguages: ["ar"],
    };
    const assertCatalog = async () => {
      const list = await repository.listPublishedTemplates({});
      expect(list[0]).toMatchObject({ slug: "premium-phone-reveal", ...expectations });
      expect(await repository.findPublishedTemplate("premium-phone-reveal")).toMatchObject(expectations);
      expect(await repository.findTemplateVersion(versionId)).toMatchObject(expectations);
    };
    await assertCatalog();
    expect(await repository.listPublishedTemplates({ language: "en" })).not.toContainEqual(expect.objectContaining({ slug: "premium-phone-reveal" }));
    const generation = await createMongoGenerationRepository(database).findPublishedTemplateVersion(versionId);
    expect(generation).toMatchObject({ enabledLanguages: ["ar"], supportedLanguages: ["ar"], eligibility: { supportedLanguages: ["ar"] } });
    await ensureMongoTemplateCatalog(database, LAUNCH_CREATIVE_TEMPLATE_CATALOG);
    await assertCatalog();
    expect(await database.db.collection(C.videoTemplateVersions).findOne({ _id: version!._id })).toEqual(version);
    expect(await database.db.collection(C.videoTemplates).findOne({ _id: head!._id })).not.toHaveProperty("adminManaged");
    await expect(
      service.details(actor, id, randomUUID(), { expectedRevision: expectedRevision + 1, enabledLanguages: ["en"], displayName: null }),
    ).resolves.toMatchObject({ overrides: { displayName: null, enabledLanguages: ["en"] } });
    expect(await repository.findPublishedTemplate("premium-phone-reveal")).toMatchObject({ name: { en: version!.localizedName.en }, supportedLanguages: ["en"] });
  });
});
