import { z } from "zod";

/** Kuwaiti dinar amounts are integers in fils (1 KWD = 1000 fils) so money is never a float. */
export const PAYMENT_CURRENCY = "KWD" as const;

export const CreditPackageSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,40}$/),
    credits: z.number().int().positive(),
    amountMinor: z.number().int().positive(),
    currency: z.literal(PAYMENT_CURRENCY),
    popular: z.boolean(),
  })
  .strict();
export type CreditPackage = z.infer<typeof CreditPackageSchema>;

export const PaymentModeSchema = z.enum(["test", "live"]);

export const CreditPackagesResponseSchema = z
  .object({
    packages: z.array(CreditPackageSchema),
    payments: z
      .object({
        available: z.boolean(),
        mode: PaymentModeSchema,
        checkout: z.enum(["instant", "hosted"]),
        customAmount: z.object({ min: z.number().int().positive(), max: z.number().int().positive() }).strict().nullable(),
      })
      .strict(),
    requestId: z.string(),
  })
  .strict();
export type CreditPackagesResponse = z.infer<typeof CreditPackagesResponseSchema>;

export const CreateTopUpRequestSchema = z
  .object({
    packageId: z.string().regex(/^[a-z0-9-]{2,40}$/).optional(),
    customCredits: z.number().int().positive().max(1_000_000).optional(),
    /** Language of the gateway's payment page. */
    language: z.enum(["en", "ar"]).optional(),
  })
  .strict()
  .refine((value) => (value.packageId === undefined) !== (value.customCredits === undefined), {
    message: "Choose a credit package or a custom amount.",
  });
export type CreateTopUpRequest = z.infer<typeof CreateTopUpRequestSchema>;

export const TopUpOrderStatusSchema = z.enum(["pending", "credited", "failed", "cancelled", "expired"]);
export type TopUpOrderStatus = z.infer<typeof TopUpOrderStatusSchema>;

export const TopUpOrderSchema = z
  .object({
    id: z.string().min(1),
    status: TopUpOrderStatusSchema,
    credits: z.number().int().positive(),
    amountMinor: z.number().int().nonnegative(),
    currency: z.literal(PAYMENT_CURRENCY),
    provider: z.string().min(1),
    packageId: z.string().nullable(),
    createdAt: z.string().datetime(),
    creditedAt: z.string().datetime().nullable(),
  })
  .strict();
export type TopUpOrder = z.infer<typeof TopUpOrderSchema>;

export const CreateTopUpResponseSchema = z
  .object({
    order: TopUpOrderSchema,
    /** Present when the provider needs the customer on its hosted payment page. */
    checkoutUrl: z.string().url().nullable(),
    requestId: z.string(),
  })
  .strict();
export type CreateTopUpResponse = z.infer<typeof CreateTopUpResponseSchema>;

export const TopUpOrderResponseSchema = z.object({ order: TopUpOrderSchema, requestId: z.string() }).strict();
export type TopUpOrderResponse = z.infer<typeof TopUpOrderResponseSchema>;

export const TopUpOrderParametersSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/) }).strict();
