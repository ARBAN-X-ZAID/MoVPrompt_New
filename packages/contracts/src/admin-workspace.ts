import { z } from "zod";
import { AdminIdSchema } from "./admin.js";

export const AdminCustomerSummarySchema = z.object({
  id: AdminIdSchema,
  name: z.string(),
  email: z.string(),
  locale: z.string(),
  createdAt: z.string(),
  inactive: z.boolean(),
  emailDeliveryAvailable: z.boolean(),
  wallet: z.object({
    balance: z.number(),
    reserved: z.number(),
    available: z.number(),
  }),
  counts: z.object({
    projects: z.number(),
    generations: z.number(),
    assets: z.number(),
    support: z.number(),
  }),
});
export const AdminPaymentQuerySchema = z.object({
  period: z.enum(["today", "week", "month", "custom"]).default("week"),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  search: z.string().trim().max(120).default(""),
  status: z.string().max(40).default(""),
  userId: AdminIdSchema.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const AdminDurationAvailabilitySchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    enabledDurations: z.array(z.number().int()).min(1).max(20),
  })
  .strict();

export const AdminCustomerTabSchema = z.enum([
  "campaigns",
  "generations",
  "assets",
  "support",
  "credits",
  "payments",
  "financial-requests",
]);
// Only presentation fields cross the dedicated customer-tab boundary.
export const AdminCustomerRecordSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  subject: z.string().optional(),
  status: z.string().optional(),
  kind: z.string().optional(),
  reason: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deleted: z.boolean().optional(),
  amountMinor: z.number().optional(),
  credits: z.number().optional(),
  delta: z.number().optional(),
  balanceAfter: z.number().optional(),
  refundStatus: z.string().nullable().optional(),
  acceptedRunId: z.string().optional(),
  latestRunId: z.string().optional(),
  templateName: z.object({ en: z.string(), ar: z.string() }).optional(),
  referenceId: z.string().nullable().optional(),
  referenceType: z.string().nullable().optional(),
  value: z
    .object({
      name: z.string(),
      kind: z.string().optional(),
      photos: z
        .array(z.object({ id: z.string(), name: z.string().optional() }))
        .default([]),
    })
    .optional(),
});
export const AdminCustomerRecordsSchema = z.object({
  items: z.array(AdminCustomerRecordSchema),
  total: z.number(),
  totalCapped: z.boolean().optional(),
  page: z.number(),
  limit: z.number(),
  evaluatedAt: z.string(),
});
// Curated on purpose: configuration, prompts, version ids and checksums stay server-side.
export const AdminCampaignDetailSchema = z
  .object({
    record: z
      .object({
        id: AdminIdSchema,
        title: z.string(),
        status: z.string(),
        userId: AdminIdSchema.nullable(),
        customerName: z.string(),
        customerEmail: z.string(),
        customer: z
          .object({
            id: AdminIdSchema.nullable(),
            name: z.string(),
            email: z.string(),
          })
          .strict(),
        templateName: z.object({ en: z.string(), ar: z.string() }).nullable(),
        durationSeconds: z.number().nullable(),
        language: z.string().nullable(),
        createdAt: z.string().nullable(),
        updatedAt: z.string().nullable(),
        generation: z
          .object({
            latestRunId: AdminIdSchema.nullable(),
            acceptedRunId: AdminIdSchema.nullable(),
            status: z.string().nullable(),
            creditsUsed: z.number(),
          })
          .strict(),
      })
      .strict(),
    related: z
      .object({
        media: z.array(
          z
            .object({
              id: AdminIdSchema,
              filename: z.string(),
              kind: z.string(),
              mimeType: z.string(),
            })
            .strict(),
        ),
      })
      .strict(),
  })
  .strict();
export type AdminCampaignDetail = z.infer<typeof AdminCampaignDetailSchema>;
export const AdminPaymentHistorySchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      amountMinor: z.number(),
      credits: z.number(),
      currency: z.string(),
      status: z.string(),
      createdAt: z.string(),
      providerReference: z.string().nullable().optional(),
      customerName: z.string().optional(),
      customerEmail: z.string().optional(),
    }),
  ),
  total: z.number(),
  /** True when a broad search matched more customers than one query covers. */
  totalCapped: z.boolean().optional(),
  page: z.number(),
  limit: z.number(),
  from: z.string(),
  to: z.string(),
  evaluatedAt: z.string(),
  totals: z.object({
    collected: z.number(),
    refunded: z.number(),
    net: z.number(),
  }),
});
