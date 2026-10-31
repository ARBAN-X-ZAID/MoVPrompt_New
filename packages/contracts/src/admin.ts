import { z } from "zod";

export const AdminIdSchema = z.string().regex(/^[a-f0-9]{24}$/i);
export const AdminReasonSchema = z.string().trim().min(8).max(1000);
export const AdminResourceSchema = z.enum([
  "customers",
  "campaigns",
  "generations",
  "business-renders",
  "templates",
  "assets",
  "owned-media",
  "payments",
  "credits",
  "financial-requests",
  "support",
  "moderation",
  "content",
  "reports",
  "operations",
  "audit",
]);
export type AdminResource = z.infer<typeof AdminResourceSchema>;
export const AdminListQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z.string().max(60).optional(),
  userId: AdminIdSchema.optional(),
  projectId: AdminIdSchema.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  direction: z.enum(["asc", "desc"]).default("desc"),
});
export type AdminListQuery = z.infer<typeof AdminListQuerySchema>;
export const AdminIdentitySchema = z.object({
  userId: AdminIdSchema,
  name: z.string(),
  email: z.email(),
  role: z.literal("owner"),
  emailVerified: z.boolean(),
  readOnly: z.boolean().optional(),
  capabilities: z.object({
    walletManagement: z.boolean().default(false),
    customerProfile: z.boolean(),
    customerStatus: z.boolean(),
    templateAvailability: z.boolean(),
  }).optional(),
  authenticationPolicy: z.enum(["password", "mfa"]).default("mfa"),
  mfaEnabled: z.boolean(),
  recoveryReady: z.boolean(),
  assuredUntil: z.string().nullable(),
  recentUntil: z.string().nullable(),
});
export type AdminIdentity = z.infer<typeof AdminIdentitySchema>;
export const AdminAssuranceSchema = z
  .object({
    mode: z.enum(["totp", "backup"]).default("totp"),
    code: z.string().min(6).max(40),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.mode === "totp"
        ? !/^\d{6}$/.test(value.code)
        : !/^[a-zA-Z0-9-]{8,40}$/.test(value.code)
    )
      context.addIssue({
        code: "custom",
        message: "Use a valid authenticator or unused recovery code.",
      });
  });
export const AdminCustomerMutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("profile"),
    name: z.string().trim().min(1).max(100),
    locale: z.enum(["en", "ar"]),
    reason: AdminReasonSchema,
  }),
  z.object({
    action: z.enum([
      "suspend",
      "restore",
      "revoke-sessions",
      "password-reset",
      "verify-email",
      "export",
      "delete-request",
      "reconcile-credits",
    ]),
    reason: AdminReasonSchema,
  }),
]);
export const AdminFinancialRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("credit-adjustment"),
    userId: AdminIdSchema,
    delta: z
      .number()
      .int()
      .min(-100000)
      .max(100000)
      .refine((value) => value !== 0),
    reason: AdminReasonSchema,
    caseId: AdminIdSchema.optional(),
  }),
  z.object({
    kind: z.literal("cash-refund"),
    userId: AdminIdSchema,
    orderId: AdminIdSchema,
    amountMinor: z.number().int().min(1).max(10000000),
    exception: z.boolean().default(false),
    reason: AdminReasonSchema,
    caseId: AdminIdSchema.optional(),
  }),
  z.object({
    kind: z.literal("generation-restoration"),
    userId: AdminIdSchema,
    runId: AdminIdSchema,
    reason: AdminReasonSchema,
    caseId: AdminIdSchema.optional(),
  }),
  z.object({
    kind: z.literal("recovery-render"),
    userId: AdminIdSchema,
    runId: AdminIdSchema,
    budgetMinor: z.number().int().min(1).max(100000),
    reason: AdminReasonSchema,
    caseId: AdminIdSchema.optional(),
  }),
]);
export type AdminFinancialRequest = z.infer<typeof AdminFinancialRequestSchema>;
export const AdminReviewSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    decision: z.enum(["approve", "reject"]),
    reason: AdminReasonSchema,
  })
  .strict();
export const AdminRunActionSchema = z
  .object({
    action: z.enum(["reconcile", "cancel", "recover"]),
    reason: AdminReasonSchema,
  })
  .strict();
export const AdminCaseSchema = z.object({
  subject: z.string().trim().min(3).max(160),
  category: z.enum([
    "payment",
    "credits",
    "generation",
    "assets",
    "account",
    "content",
  ]),
  message: z.string().trim().min(1).max(10000),
  userId: AdminIdSchema.optional(),
  projectId: AdminIdSchema.optional(),
  runId: AdminIdSchema.optional(),
  paymentId: AdminIdSchema.optional(),
  requestId: z.string().max(120).optional(),
});
export const AdminCaseUpdateSchema = z
  .object({
    expectedRevision: z.number().int().min(1),
    status: z
      .enum(["open", "in-progress", "waiting-customer", "resolved", "closed"])
      .optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
    message: z.string().trim().min(1).max(10000).optional(),
    attachmentIds: z.array(AdminIdSchema).max(3).default([]),
    notifyEmail: z.boolean().default(false),
    visibility: z.enum(["customer", "private"]).default("private"),
    reason: AdminReasonSchema,
  })
  .strict();
export const SupportReplySchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    message: z.string().trim().min(1).max(10000),
    attachmentIds: z.array(AdminIdSchema).max(3).default([]),
  })
  .strict();
export const AdminAssetActionSchema = z
  .object({
    action: z.enum([
      "quarantine",
      "release-quarantine",
      "withdraw-permission",
      "trash",
      "restore",
    ]),
    expectedRevision: z.number().int().min(1),
    reason: AdminReasonSchema,
  })
  .strict();
export const AdminSettingsSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    reason: AdminReasonSchema,
    pauseGeneration: z.boolean(),
    pausedCapabilities: z
      .array(
        z.enum([
          "video.cinematic",
          "video.product_fidelity",
          "presenter.ai_ugc",
        ]),
      )
      .max(3),
    maintenanceMessage: z.object({
      en: z.string().max(500),
      ar: z.string().max(500),
    }),
    dailyRecoveryBudgetMinor: z.number().int().min(0).max(1000000),
  })
  .strict();
export const AdminContentSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    kind: z.enum([
      "announcement",
      "welcome",
      "maintenance",
      "notification",
      "transactional-email",
      "promotional-email",
    ]),
    emailPurpose: z.enum(["verify-email", "reset-password"]).optional(),
    title: z.object({
      en: z.string().trim().min(1).max(160),
      ar: z.string().trim().min(1).max(160),
    }),
    body: z.object({ en: z.string().max(10000), ar: z.string().max(10000) }),
    audience: z.enum(["all", "verified", "active"]),
    status: z.enum(["draft", "scheduled", "published", "archived"]),
    scheduledAt: z.iso.datetime().optional(),
    reason: AdminReasonSchema,
  })
  .strict();
export const AdminExportSchema = z
  .object({
    report: z.enum([
      "customers",
      "generations",
      "payments",
      "credits",
      "assets",
      "support",
      "audit",
    ]),
    from: z.iso.datetime(),
    to: z.iso.datetime(),
    reason: AdminReasonSchema,
  })
  .strict()
  .refine(
    (value) =>
      Date.parse(value.to) > Date.parse(value.from) &&
      Date.parse(value.to) - Date.parse(value.from) <= 366 * 86400000,
    "Choose a range of up to one year.",
  );
export const AdminModerationSchema = z
  .object({
    category: z.enum([
      "reported-media",
      "permission-dispute",
      "abuse",
      "suspicious-payment",
      "clinic-review",
    ]),
    userId: AdminIdSchema,
    projectId: AdminIdSchema.optional(),
    assetId: AdminIdSchema.optional(),
    reason: AdminReasonSchema,
  })
  .strict();
export const AdminModerationDecisionSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    action: z.enum([
      "dismiss",
      "quarantine-asset",
      "withdraw-permission",
      "suspend-account",
      "request-cancellation",
    ]),
    assetRevision: z.number().int().positive().optional(),
    runId: AdminIdSchema.optional(),
    reason: AdminReasonSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (
      ["quarantine-asset", "withdraw-permission"].includes(input.action) &&
      !input.assetRevision
    )
      context.addIssue({
        code: "custom",
        message: "Review the current asset revision first.",
      });
    if (input.action === "request-cancellation" && !input.runId)
      context.addIssue({
        code: "custom",
        message: "Choose the exact generation to request cancellation.",
      });
  });
export const AdminRecordSchema = z.record(z.string(), z.unknown());
export const AdminListResponseSchema = z.object({
  items: z.array(AdminRecordSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int(),
  limit: z.number().int(),
  source: z.string(),
  evaluatedAt: z.string(),
});

export const AdminPrivacyReviewSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    action: z.enum(["refresh-manifest", "cancel-request", "approve-erasure"]),
    manifestHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
    policyVersion: z.string().min(1).max(120).optional(),
    confirmCustomerId: AdminIdSchema.optional(),
    reason: AdminReasonSchema,
  })
  .strict();

export const AdminOwnedMediaSourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("library"),
      entryId: AdminIdSchema,
      photoId: AdminIdSchema,
      revision: z.number().int().positive(),
    })
    .strict(),
  z.object({ type: z.literal("generation"), runId: AdminIdSchema }).strict(),
]);
export const AdminTemplateMediaReferenceSchema = z
  .object({
    mediaId: AdminIdSchema,
    revision: z.number().int().positive(),
  })
  .strict();
export const AdminTemplateMediaSchema = z
  .object({
    poster: AdminTemplateMediaReferenceSchema.optional(),
    preview: AdminTemplateMediaReferenceSchema.optional(),
    productSamples: z
      .array(AdminTemplateMediaReferenceSchema)
      .max(3)
      .default([]),
    presenterSamples: z
      .array(AdminTemplateMediaReferenceSchema)
      .max(3)
      .default([]),
  })
  .strict();
export type AdminTemplateMedia = z.infer<typeof AdminTemplateMediaSchema>;
export const AdminOwnedMediaImportSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    expectedStateRevision: z.number().int().nonnegative().default(0),
    name: z.string().trim().min(1).max(160),
    kind: z.enum([
      "product-sample",
      "presenter-sample",
      "poster",
      "video-preview",
    ]),
    source: AdminOwnedMediaSourceSchema,
    rightsConfirmed: z.literal(true),
    adultLikenessConfirmed: z.boolean(),
    reason: AdminReasonSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.kind === "presenter-sample" && !value.adultLikenessConfirmed)
      context.addIssue({
        code: "custom",
        message: "Confirm adult identity and permission for presenter samples.",
      });
    if (
      (value.kind === "video-preview") !==
      (value.source.type === "generation")
    )
      context.addIssue({
        code: "custom",
        message:
          "Choose completed owner footage for previews and an approved owner photo for samples.",
      });
  });
export const AdminOwnedMediaActionSchema = z
  .object({
    action: z.enum([
      "approve",
      "withdraw-approval",
      "trash",
      "restore",
      "retry-copy",
    ]),
    expectedRevision: z.number().int().positive(),
    expectedStateRevision: z.number().int().nonnegative(),
    reason: AdminReasonSchema,
  })
  .strict();
