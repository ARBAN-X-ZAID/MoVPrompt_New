import { z } from "zod";
const credits = z.number().int().min(1).max(1_000_000);
const fils = z.number().int().min(1).max(10_000_000);
const video = z
  .object({
    eightSeconds: credits,
    fifteenSeconds: credits,
    twentySeconds: credits,
    hdSurcharge: z.number().int().min(0).max(1_000_000),
  })
  .strict();
export const AdminPricingPolicySchema = z
  .object({
    version: z.literal(1),
    packages: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]{1,39}$/),
            credits,
            amountMinor: fils,
            currency: z.literal("KWD"),
            popular: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    customTopUp: z
      .object({ min: credits, max: credits, amountMinorPerCredit: fils })
      .strict(),
    video: z
      .object({ template: video, ad_studio: video, advanced: video })
      .strict(),
    quoteTtlSeconds: z.number().int().min(60).max(3600),
    entitlements: z
      .object({
        starterOnly: z.boolean(),
        starterRenders: z.boolean(),
        freeAccounts: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((policy, context) => {
    if (
      new Set(policy.packages.map((item) => item.id)).size !==
      policy.packages.length
    )
      context.addIssue({
        code: "custom",
        message: "Credit package IDs must be unique.",
      });
    if (
      policy.customTopUp.min > policy.customTopUp.max ||
      !Number.isSafeInteger(
        policy.customTopUp.max * policy.customTopUp.amountMinorPerCredit,
      ) ||
      policy.customTopUp.max * policy.customTopUp.amountMinorPerCredit >
        10_000_000
    )
      context.addIssue({
        code: "custom",
        message: "Custom top-up limits are invalid.",
      });
    for (const price of Object.values(policy.video))
      if (
        price.eightSeconds > price.fifteenSeconds ||
        price.fifteenSeconds > price.twentySeconds
      )
        context.addIssue({
          code: "custom",
          message: "Longer videos cannot cost less than shorter videos.",
        });
  });
export type AdminPricingPolicy = z.infer<typeof AdminPricingPolicySchema>;

export const PublicPricingSnapshotSchema = z
  .object({
    pricingVersion: z.string().nullable(),
    updatedAt: z.iso.datetime(),
    packages: AdminPricingPolicySchema.shape.packages,
    customTopUp: AdminPricingPolicySchema.shape.customTopUp,
    video: z.array(
      z
        .object({
          product: z.enum(["template", "ad_studio", "advanced"]),
          durationSeconds: z.number().int(),
          resolution: z.enum(["480p", "720p"]),
          credits: z.number().int().nonnegative().nullable(),
        })
        .strict(),
    ),
    requestId: z.string(),
  })
  .strict();
export type PublicPricingSnapshot = z.infer<typeof PublicPricingSnapshotSchema>;
