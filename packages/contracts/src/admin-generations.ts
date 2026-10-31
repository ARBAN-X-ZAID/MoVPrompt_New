import { z } from "zod";
import { AdminIdSchema } from "./admin.js";
const name = z.object({ en: z.string(), ar: z.string() });
export const AdminGenerationQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]).optional(),
  templateId: AdminIdSchema.optional(),
  userId: AdminIdSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const AdminGenerationSummarySchema = z.object({
  id: AdminIdSchema,
  campaign: z.object({ id: AdminIdSchema.nullable(), name: z.string() }),
  customer: z.object({ id: AdminIdSchema.nullable(), name: z.string(), email: z.string() }),
  template: z.object({ id: AdminIdSchema.nullable(), name }),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]),
  createdAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  elapsedSeconds: z.number().nonnegative().nullable(),
  timing: z.enum(["finished", "elapsed", "unavailable"]),
  mediaAvailable: z.boolean(),
  failure: name.nullable(),
});
export const AdminGenerationListSchema = z.object({
  items: z.array(AdminGenerationSummarySchema),
  total: z.number().int().nonnegative(),
  /** True when a broad search matched more customers or projects than one query covers. */
  totalCapped: z.boolean().optional(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  templates: z.array(z.object({ id: AdminIdSchema, name })),
});
export type AdminGenerationSummary = z.infer<typeof AdminGenerationSummarySchema>;
export type AdminGenerationQuery = z.infer<typeof AdminGenerationQuerySchema>;
