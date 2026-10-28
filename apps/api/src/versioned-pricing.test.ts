import { describe, expect, it } from "vitest";
import { AdminPricingPolicySchema } from "@movprompt/contracts";
import {
  defaultAdminPricingPolicy,
  generationPricingForPolicy,
} from "./versioned-pricing.js";
import { createTopUpService } from "./payments/top-up-service.js";
import {
  createMongoDatabase,
  ensureMongoIndexes,
  createMongoPaymentService,
} from "@movprompt/db";

it("validates integer money, unique package identities and duration ordering", () => {
  const policy = defaultAdminPricingPolicy({});
  expect(AdminPricingPolicySchema.safeParse(policy).success).toBe(true);
  expect(
    AdminPricingPolicySchema.safeParse({
      ...policy,
      packages: [{ ...policy.packages[0]!, amountMinor: 5000.5 }],
    }).success,
  ).toBe(false);
  expect(
    AdminPricingPolicySchema.safeParse({
      ...policy,
      packages: [policy.packages[0]!, policy.packages[0]!],
    }).success,
  ).toBe(false);
  expect(() =>
    generationPricingForPolicy(policy, "test").price("video.cinematic", {
      durationSeconds: 21,
      resolution: "720p",
    }),
  ).toThrow();
  expect(
    generationPricingForPolicy(policy, "test").price(
      "video.cinematic",
      { durationSeconds: 15, resolution: "720p" },
      15,
      "ad_studio",
    ).credits,
  ).toBe(100);
});
const uri = process.env.ADMIN_TEST_MONGODB_URI;
describe.skipIf(!uri)(
  "order pricing snapshots on transactional MongoDB",
  () => {
    it("replays the original pending top-up after package and custom rates change", async () => {
      const database = createMongoDatabase({
        uri: uri ?? "mongodb://127.0.0.1:27029/",
        databaseName: `movprompt_pricing_test_${Date.now()}`,
      });
      await database.connect();
      try {
        await ensureMongoIndexes(database);
        const policy = defaultAdminPricingPolicy({});
        let version = "first";
        const payments = createMongoPaymentService(database);
        const topups = createTopUpService({
          payments,
          catalog: async () => ({
            packages: structuredClone(policy.packages),
            customTopUp: { ...policy.customTopUp },
            pricingVersion: version,
          }),
          config: {
            provider: {
              id: "synthetic",
              mode: "test",
              allowsCustomAmount: true,
              checkout: "hosted",
              createCheckout: async ({ order }) => ({
                kind: "redirect",
                providerReference: order.id,
                checkoutUrl: "https://example.test/payment",
              }),
            },
            successUrl: "http://localhost/success",
            cancelUrl: "http://localhost/cancel",
          },
        });
        const session = {
          user: {
            id: "0".repeat(23) + "1",
            name: "Synthetic",
            email: "test@example.test",
            emailVerified: true,
          },
          session: { id: "test" },
        };
        const first = await topups.createTopUp(
          session,
          { packageId: "credits-100" },
          "package-idempotency-key",
        );
        const custom = await topups.createTopUp(
          session,
          { customCredits: 20 },
          "custom-idempotency-key",
        );
        policy.packages[0]!.amountMinor = 6000;
        policy.packages[0]!.credits = 150;
        policy.customTopUp.amountMinorPerCredit = 75;
        version = "second";
        expect(
          (
            await topups.createTopUp(
              session,
              { packageId: "credits-100" },
              "package-idempotency-key",
            )
          ).order,
        ).toEqual(first.order);
        expect(
          (
            await topups.createTopUp(
              session,
              { customCredits: 20 },
              "custom-idempotency-key",
            )
          ).order,
        ).toEqual(custom.order);
        expect(
          (
            await topups.createTopUp(
              session,
              { packageId: "credits-100" },
              "new-package-key",
            )
          ).order,
        ).toMatchObject({ credits: 150, amountMinor: 6000 });
        expect(
          (
            await topups.createTopUp(
              session,
              { customCredits: 20 },
              "new-custom-key",
            )
          ).order.amountMinor,
        ).toBe(1500);
        expect(
          await database.db.collection("payment_orders").countDocuments({}),
        ).toBe(4);
        expect(
          await database.db.collection("credit_ledger").countDocuments({}),
        ).toBe(0);
      } finally {
        await database.db.dropDatabase();
        await database.close();
      }
    });
  },
);
