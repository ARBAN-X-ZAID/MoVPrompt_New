import { z } from "zod";

import { IdempotencyKeySchema, MongoObjectIdSchema, RequestIdSchema } from "./api.js";
import { CapabilityAliasSchema } from "./capabilities.js";
import { JsonValueSchema, RenderRunStatusSchema } from "./generation.js";

const EntityIdSchema = MongoObjectIdSchema.or(z.uuid());

export const CreationModeSchema = z.enum(["template", "advanced"]);
export type CreationMode = z.infer<typeof CreationModeSchema>;

export const CampaignSourceKindSchema = z.enum([
  "product_url",
  "business_url",
  "product_upload",
  "service_manual",
  "real_footage",
]);
export type CampaignSourceKind = z.infer<typeof CampaignSourceKindSchema>;

export const BusinessVerticalSchema = z.enum(["salon", "clinic", "retail", "ecommerce", "real_estate", "services"]);
export type BusinessVertical = z.infer<typeof BusinessVerticalSchema>;

export const CampaignGoalSchema = z.enum([
  "whatsapp_orders",
  "bookings",
  "launch",
  "offer",
  "demonstration",
  "education",
  "announcement",
  "trust",
  "brand_story",
]);
export type CampaignGoal = z.infer<typeof CampaignGoalSchema>;

const PersonMediaRightsSchema = z
  .object({
    version: z.literal("person-media-rights-v1"),
    assetId: EntityIdSchema,
    personMediaRightsAttested: z.literal(true),
  })
  .strict();

/**
 * Beginner presenter data is intentionally capability-level only. Digital Twin
 * and provider identity references stay in People Studio and never cross this
 * campaign contract.
 */
export const CampaignPresenterSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("none") }).strict(),
  z.object({ mode: z.literal("ai_ugc") }).strict(),
  z.object({
    mode: z.literal("uploaded_spokesperson"),
    assetId: EntityIdSchema,
    rights: PersonMediaRightsSchema,
  })
    .strict()
    .superRefine((presenter, context) => {
      if (presenter.rights.assetId !== presenter.assetId) {
        context.addIssue({
          code: "custom",
          path: ["rights", "assetId"],
          message: "Presenter rights must attest to the exact uploaded footage asset.",
        });
      }
    }),
]);
export type CampaignPresenter = z.infer<typeof CampaignPresenterSchema>;
export const PresenterModeSchema = z.enum(["none", "ai_ugc", "uploaded_spokesperson"]);
export type PresenterMode = z.infer<typeof PresenterModeSchema>;

export const CampaignLanguageSchema = z.enum(["ar", "en", "bilingual"]);
export type CampaignLanguage = z.infer<typeof CampaignLanguageSchema>;
export const CampaignRatioSchema = z.enum(["9:16", "1:1", "4:5", "16:9"]);
export const CampaignResolutionSchema = z.enum(["480p", "720p"]);
export type CampaignResolution = z.infer<typeof CampaignResolutionSchema>;
export const ProjectStatusSchema = z.enum([
  "draft",
  "ready",
  "generating",
  "review",
  "failed",
  "exporting",
  "completed",
  "trashed",
]);

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);

const KwdAmountSchema = z.union([
  z.literal(""),
  z.string().trim().regex(/^(?:0|[1-9]\d{0,6})\.\d{3}$/u, "Use a KWD amount with three decimal places."),
]);

const HttpUrlOrEmptySchema = z.union([
  z.literal(""),
  z.url().max(2_048).refine((value) => /^https?:\/\//iu.test(value), "Use a full HTTP or HTTPS URL."),
]);

const KuwaitPhoneOrEmptySchema = z.union([
  z.literal(""),
  z.string().trim().regex(/^\+965[2-9]\d{7}$/u, "Use a Kuwait phone number in +965XXXXXXXX format."),
]);

const BrandColorSchema = z.string().trim().regex(/^#[0-9a-fA-F]{6}$/u, "Use a six-digit brand colour.");

const StableAssetKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(1_024)
  .refine((value) => !/^(?:blob:|https?:\/\/|data:)/iu.test(value), "Campaign sources store stable asset keys only.");

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

/**
 * The complete business-facing campaign state. This is deliberately strict:
 * values hidden by progressive disclosure still affect the rendered campaign
 * and therefore must be validated by the server rather than trusted from UI.
 */
export const CampaignSettingsSchema = z
  .object({
    promotionKind: z.enum(["product", "business"]),
    vertical: BusinessVerticalSchema,
    goal: CampaignGoalSchema,
    presenterMode: PresenterModeSchema,
    presenter: CampaignPresenterSchema,
    market: z.literal("KW"),
    language: CampaignLanguageSchema,
    arabicDialect: z.literal("kuwaiti"),
    dialectRegister: z.enum(["polished", "conversational"]),
    location: z.string().trim().max(500),
    bookingUrl: HttpUrlOrEmptySchema,
    whatsapp: KuwaitPhoneOrEmptySchema,
    price: KwdAmountSchema,
    offer: z.string().trim().max(500),
    cta: z.string().trim().min(1).max(240),
    brand: z.string().trim().max(240),
    brandColor: BrandColorSchema,
    logoAssetKey: StableAssetKeySchema.optional(),
    aspectRatio: CampaignRatioSchema,
    resolution: CampaignResolutionSchema,
    subtitles: z.boolean(),
    audio: z.boolean(),
  })
  .strict()
  .superRefine((campaign, context) => {
    if (campaign.presenter.mode !== campaign.presenterMode) {
      context.addIssue({
        code: "custom",
        path: ["presenter"],
        message: "Presenter mode must match the selected presenter.",
      });
    }
    if (campaign.goal === "whatsapp_orders" && !campaign.whatsapp) {
      context.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "WhatsApp orders require a Kuwait WhatsApp number.",
      });
    }
    if (campaign.goal === "bookings" && !campaign.bookingUrl) {
      context.addIssue({
        code: "custom",
        path: ["bookingUrl"],
        message: "Bookings require a booking URL.",
      });
    }
  });
export type CampaignSettings = z.infer<typeof CampaignSettingsSchema>;

const LocalizedTextSchema = z
  .object({
    en: z.string().trim().min(1).max(240),
    ar: z.string().trim().min(1).max(240),
  })
  .strict();

export const TemplateDiscoveryCategorySchema = z.enum([
  "electronics",
  "food",
  "ecommerce",
  "advertising",
  "brand",
  "other",
]);
export type TemplateDiscoveryCategory = z.infer<typeof TemplateDiscoveryCategorySchema>;

export const PublicTemplateSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    slug: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(80),
    discoveryCategory: TemplateDiscoveryCategorySchema,
    versionId: EntityIdSchema,
    versionNumber: z.number().int().positive(),
    name: LocalizedTextSchema,
    description: LocalizedTextSchema,
    outcome: z.string().trim().min(1).max(240),
    verticals: z.array(BusinessVerticalSchema),
    goals: z.array(CampaignGoalSchema),
    durationSeconds: z.number().int().min(3).max(60),
    supportedLanguages: z.array(CampaignLanguageSchema),
    supportedRatios: z.array(CampaignRatioSchema),
    supportedMarkets: z.array(z.literal("KW")),
    requiredInputs: z.array(z.string().trim().min(1).max(80)),
    /** Server-projected presenter policy; it never exposes provider identities. */
    presenterModes: z.array(PresenterModeSchema).default([]),
    starterRenderEligible: z.boolean(),
    previewAvailable: z.boolean(),
    posterAvailable: z.boolean(),
    qualityStatus: z.enum(["development", "review", "approved"]),
    dialectPolicy: z
      .object({
        arabicDialect: z.literal("kuwaiti"),
        locale: z.literal("ar-KW"),
        register: z.enum(["polished", "conversational"]),
        crossDialectFallback: z.literal(false),
      })
      .strict(),
    qualityPolicy: z
      .object({
        tier: z.literal("premium"),
        acceptanceScore: z.number().int().min(1).max(100),
        internalRetryLimit: z.number().int().min(0).max(3),
        hardGates: z.array(z.string().trim().min(1)),
        scoredDimensions: z.array(z.string().trim().min(1)),
      })
      .strict(),
    capabilityPolicy: z.array(z.string().trim().min(1)),
    tags: z.array(z.string().trim().min(1)),
    scenes: z.array(
      z.object({
        id: z.string().trim().min(1).max(120),
        title: z.string().trim().min(1).max(160),
        purpose: z.string().trim().min(1).max(240),
        duration: z.number().int().min(1).max(60),
        headline: z.string().trim().max(240),
        direction: z.string().trim().min(1).max(2_000),
      }).strict(),
    ),
  })
  .strict();
export type PublicTemplate = z.infer<typeof PublicTemplateSchema>;

/**
 * Immutable catalog metadata that answers only whether a configuration fits a
 * published template. Pricing deliberately lives outside this contract.
 */
export const TemplateRequiredInputSchema = z.enum([
  "product_image",
  "product_name",
  "subject_name",
  "primary_reference",
  "product_reference",
  "logo_or_brand_name",
  "call_to_action",
  "business_name",
  "service_name",
  "location",
  "salon_location",
  "booking_destination",
  "order_or_booking_destination",
  "delivery_destination",
  "whatsapp",
  "business_identity",
  "restaurant_identity",
  "verified_clinic_identity",
  "confirmed_service",
  "service_details",
  "approved_claims",
  "verified_qualification",
  "confirmed_price",
  "approved_price",
  "real_work_reference",
  "real_room_reference",
  "real_shade_reference",
  "real_dish_media",
  "real_facility_media",
  "all_box_item_references",
  "all_bundle_item_references",
  "confirmed_contents",
  "confirmed_quantities",
  "confirmed_shade_names",
  "dimensions_if_relevant",
  "consented_before_video",
  "consented_after_video",
  "consented_customer_video",
  "approved_transcript",
  "consented_founder_reference",
  "confirmed_origin_facts",
  "consented_person_reference",
]);
export type TemplateRequiredInput = z.infer<typeof TemplateRequiredInputSchema>;

export const TemplateQuoteEligibilitySchema = z
  .object({
    goals: z.array(CampaignGoalSchema).min(1).max(12),
    supportedLanguages: z.array(CampaignLanguageSchema).min(1).max(3),
    supportedRatios: z.array(CampaignRatioSchema).min(1).max(4),
    supportedMarkets: z.array(z.literal("KW")).min(1).max(1),
    requiredInputs: z.array(TemplateRequiredInputSchema).max(16),
    capabilityPolicy: z.array(CapabilityAliasSchema).min(1).max(12),
  })
  .strict();
export type TemplateQuoteEligibility = z.infer<typeof TemplateQuoteEligibilitySchema>;

export const TemplateListQuerySchema = z
  .object({
    vertical: BusinessVerticalSchema.optional(),
    goal: CampaignGoalSchema.optional(),
    language: CampaignLanguageSchema.optional(),
  })
  .strict();

export const TemplateListResponseSchema = z
  .object({ templates: z.array(PublicTemplateSchema), requestId: RequestIdSchema })
  .strict();
export type TemplateListResponse = z.infer<typeof TemplateListResponseSchema>;

export const TemplateResponseSchema = z
  .object({ template: PublicTemplateSchema, requestId: RequestIdSchema })
  .strict();
export type TemplateResponse = z.infer<typeof TemplateResponseSchema>;

export const ProjectVersionSchema = z
  .object({
    id: EntityIdSchema,
    projectId: EntityIdSchema,
    parentVersionId: EntityIdSchema.nullable(),
    templateVersionId: EntityIdSchema.nullable(),
    mode: CreationModeSchema,
    versionNumber: z.number().int().positive(),
    configuration: JsonObjectSchema,
    productRecipe: JsonObjectSchema,
    campaignRecipe: JsonObjectSchema,
    changeReason: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type ProjectVersion = z.infer<typeof ProjectVersionSchema>;

export const CreatorProjectSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().trim().min(1).max(160),
    mode: CreationModeSchema,
    status: ProjectStatusSchema,
    currentWorkingVersionId: EntityIdSchema.nullable(),
    currentAcceptedVersionId: EntityIdSchema.nullable(),
    latestRenderRunId: EntityIdSchema.nullable(),
    latestRenderProjectVersionId: EntityIdSchema.nullable(),
    latestRenderRunStatus: RenderRunStatusSchema.nullable(),
    deletedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    currentVersion: ProjectVersionSchema.nullable(),
    versionCount: z.number().int().nonnegative(),
    outputCount: z.number().int().nonnegative(),
    hasGeneratedVideo: z.boolean().optional(),
    hasActiveGeneration: z.boolean().optional(),
  })
  .strict();
export type CreatorProjectRecord = z.infer<typeof CreatorProjectSchema>;

export const ProjectListQuerySchema = z
  .object({
    status: ProjectStatusSchema.optional(),
    includeTrashed: z.enum(["true", "false"]).optional(),
    search: z.string().trim().max(120).optional(),
  })
  .strict();

export const ProjectListResponseSchema = z
  .object({ projects: z.array(CreatorProjectSchema), requestId: RequestIdSchema })
  .strict();
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

export const ProjectResponseSchema = z
  .object({ project: CreatorProjectSchema, requestId: RequestIdSchema })
  .strict();
export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

export const ProjectVersionListResponseSchema = z
  .object({ versions: z.array(ProjectVersionSchema), requestId: RequestIdSchema })
  .strict();
export type ProjectVersionListResponse = z.infer<typeof ProjectVersionListResponseSchema>;

export const ProjectVersionResponseSchema = z
  .object({ version: ProjectVersionSchema, requestId: RequestIdSchema })
  .strict();
export type ProjectVersionResponse = z.infer<typeof ProjectVersionResponseSchema>;

const ProjectConfigurationInput = {
  title: z.string().trim().min(1).max(160),
  mode: CreationModeSchema,
  templateVersionId: EntityIdSchema.optional(),
  configuration: JsonObjectSchema,
  productRecipe: JsonObjectSchema.default({}),
  campaignRecipe: JsonObjectSchema.default({}),
} as const;

function enforceTemplateCampaignPayload(
  input: {
    mode: CreationMode;
    templateVersionId?: string | null | undefined;
    configuration: unknown;
    productRecipe: unknown;
    campaignRecipe: unknown;
  },
  context: z.RefinementCtx,
): void {
  const result = validateTemplateCampaignPayload(input);
  if (!result || result.success) return;
  for (const issue of result.error.issues) {
    context.addIssue({
      code: "custom",
      path: issue.path,
      message: issue.message,
    });
  }
}

export const ClaimDraftRequestSchema = z
  .object({
    draftId: EntityIdSchema,
    ...ProjectConfigurationInput,
  })
  .strict()
  .superRefine(enforceTemplateCampaignPayload);
export type ClaimDraftRequest = z.infer<typeof ClaimDraftRequestSchema>;

export const CreateProjectVersionRequestSchema = z
  .object({
    parentVersionId: EntityIdSchema.nullable().optional(),
    templateVersionId: EntityIdSchema.optional(),
    mode: CreationModeSchema,
    configuration: JsonObjectSchema,
    productRecipe: JsonObjectSchema.default({}),
    campaignRecipe: JsonObjectSchema.default({}),
    changeReason: z.string().trim().min(1).max(240).optional(),
  })
  .strict()
  .superRefine(enforceTemplateCampaignPayload);
export type CreateProjectVersionRequest = z.infer<typeof CreateProjectVersionRequestSchema>;

const SourceReplacementFactsSchema = z
  .object({
    type: z.enum(["product_link", "business_link", "upload"]),
    name: z.string().trim().max(240),
    description: z.string().trim().max(4_000),
    price: z.string().trim().max(120),
    brand: z.string().trim().max(240),
    assetIds: z.array(EntityIdSchema).min(1).max(5),
  })
  .strict();

/** A source replacement is distinct from an ordinary campaign edit: it invalidates current output. */
export const ReplaceProjectSourceRequestSchema = z
  .object({
    parentVersionId: EntityIdSchema,
    templateVersionId: EntityIdSchema.optional(),
    mode: CreationModeSchema,
    configuration: JsonObjectSchema,
    productRecipe: JsonObjectSchema.default({}),
    campaignRecipe: JsonObjectSchema.default({}),
    source: SourceReplacementFactsSchema,
  })
  .strict()
  .superRefine(enforceTemplateCampaignPayload);
export type ReplaceProjectSourceRequest = z.infer<typeof ReplaceProjectSourceRequestSchema>;

export const ReplaceProjectSourceResponseSchema = z
  .object({ version: ProjectVersionSchema, sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/), requestId: RequestIdSchema })
  .strict();
export type ReplaceProjectSourceResponse = z.infer<typeof ReplaceProjectSourceResponseSchema>;

export const AcceptProjectVersionRequestSchema = z
  .object({ versionId: EntityIdSchema })
  .strict();

export const ProjectRouteParametersSchema = z
  .object({ projectId: EntityIdSchema, versionId: EntityIdSchema.optional(), runId: EntityIdSchema.optional() })
  .strict();

export const EmptyMutationRequestSchema = z.object({}).strict();

export const CreditLedgerEntrySchema = z
  .object({
    id: EntityIdSchema,
    kind: z.enum(["purchase", "grant", "charge", "refund", "adjustment"]),
    delta: z.number().int(),
    balanceAfter: z.number().int().nonnegative(),
    reason: z.string(),
    referenceType: z.string().nullable(),
    referenceId: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const CreditSummaryResponseSchema = z
  .object({
    balance: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    starterRenderAvailable: z.boolean(),
    ledger: z.array(CreditLedgerEntrySchema),
    requestId: RequestIdSchema,
  })
  .strict();
export type CreditSummaryResponse = z.infer<typeof CreditSummaryResponseSchema>;

export const SourceScanRequestSchema = z
  .object({ url: z.url().max(2_048) })
  .strict();

export const CampaignFactFieldSchema = z.enum([
  "name",
  "description",
  "brand",
  "price",
  "offer",
  "location",
  "booking_url",
  "whatsapp",
  "logo",
  "brand_color",
  "service_name",
  "service_details",
  "media",
]);
export type CampaignFactField = z.infer<typeof CampaignFactFieldSchema>;

export const FactProvenanceSchema = z.enum(["imported", "user_confirmed", "manual"]);
export type FactProvenance = z.infer<typeof FactProvenanceSchema>;

export const ConfirmedFactSchema = z
  .object({
    field: CampaignFactFieldSchema,
    value: z.string().trim().min(1).max(2_000),
    provenance: FactProvenanceSchema,
  })
  .strict();
export type ConfirmedFact = z.infer<typeof ConfirmedFactSchema>;

/**
 * The browser, claim, version, and quote boundaries share this source anchor.
 * It intentionally contains only facts plus durable object identifiers: expiring
 * source, preview, blob, and signed URLs never become campaign truth.
 */
export const CampaignSourceSchema = z
  .object({
    kind: CampaignSourceKindSchema,
    subject: z.enum(["product", "service"]),
    assetKeys: z.array(StableAssetKeySchema).max(16),
    facts: z.array(ConfirmedFactSchema).max(24),
  })
  .strict()
  .superRefine((source, context) => {
    const seen = new Set<CampaignFactField>();
    for (const [index, fact] of source.facts.entries()) {
      if (seen.has(fact.field)) {
        context.addIssue({
          code: "custom",
          path: ["facts", index, "field"],
          message: "Each campaign fact may appear once.",
        });
      }
      seen.add(fact.field);
    }
  });
export type CampaignSource = z.infer<typeof CampaignSourceSchema>;

const PersistedCreatorAssetSchema = z
  .object({
    id: EntityIdSchema,
    name: z.string().trim().min(1).max(240),
    url: z.literal(""),
    mimeType: z.string().trim().min(1).max(255).optional(),
    assetKey: StableAssetKeySchema.optional(),
    checksum: Sha256Schema.optional(),
    durationMs: z.number().int().positive().max(10 * 60 * 1_000).optional(),
    storagePath: StableAssetKeySchema.optional(),
    source: z.enum(["upload", "url", "sample"]),
  })
  .strict();

const PersistedCreatorProductSchema = z
  .object({
    sourceType: z.enum(["product_link", "business_link", "upload", "sample"]).nullable(),
    sourceUrl: z.literal(""),
    name: z.string().trim().max(240),
    description: z.string().trim().max(4_000),
    price: KwdAmountSchema,
    brand: z.string().trim().max(240),
    images: z.array(PersistedCreatorAssetSchema).max(16),
  })
  .strict();

const PersistedCreatorSceneSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(160),
    titleAr: z.string().trim().min(1).max(160).optional(),
    purpose: z.string().trim().min(1).max(240),
    purposeAr: z.string().trim().min(1).max(240).optional(),
    duration: z.number().int().min(1).max(60),
    headline: z.string().trim().max(240),
    headlineAr: z.string().trim().max(240).optional(),
    voiceover: z.string().trim().max(1_000).optional(),
    voiceoverAr: z.string().trim().max(1_000).optional(),
    direction: z.string().trim().min(1).max(2_000),
    shot: z.string().trim().min(1).max(240).optional(),
    camera: z.string().trim().min(1).max(240).optional(),
    lighting: z.string().trim().min(1).max(240).optional(),
    continuityAnchor: z.string().trim().min(1).max(400).optional(),
    locked: z.boolean().optional(),
  })
  .strict();

const PersistedTemplateCreatorProjectSchema = z
  .object({
    id: EntityIdSchema,
    title: z.string().trim().min(1).max(160),
    templateId: z.string().trim().min(1).max(120),
    status: z.literal("ready"),
    promotionKind: z.enum(["product", "business"]),
    vertical: BusinessVerticalSchema,
    goal: CampaignGoalSchema,
    presenterMode: PresenterModeSchema,
    presenter: CampaignPresenterSchema.optional(),
    location: z.string().trim().max(500),
    bookingUrl: HttpUrlOrEmptySchema,
    whatsapp: KuwaitPhoneOrEmptySchema,
    product: PersistedCreatorProductSchema,
    source: CampaignSourceSchema,
    language: CampaignLanguageSchema,
    arabicDialect: z.literal("kuwaiti"),
    dialectRegister: z.enum(["polished", "conversational"]),
    market: z.literal("KW"),
    offer: z.string().trim().max(500),
    cta: z.string().trim().min(1).max(240),
    brandColor: BrandColorSchema,
    logoUrl: z.literal(""),
    aspectRatio: CampaignRatioSchema,
    resolution: CampaignResolutionSchema,
    durationSeconds: z.number().int().min(3).max(60),
    subtitles: z.boolean(),
    audio: z.boolean(),
    scenes: z.array(PersistedCreatorSceneSchema).min(1).max(12),
    videoUrl: z.null(),
    jobId: z.null(),
    renderRunId: z.null(),
    lastError: z.null(),
    pendingGenerationId: z.null(),
    pendingQuoteCredits: z.null(),
    sourceFingerprint: Sha256Schema.optional(),
    outputSourceFingerprint: Sha256Schema.optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((project, context) => {
    const presenter = project.presenter ?? { mode: project.presenterMode };
    const parsed = CampaignPresenterSchema.safeParse(presenter);
    if (!parsed.success || parsed.data.mode !== project.presenterMode) {
      context.addIssue({
        code: "custom",
        path: ["presenter"],
        message: "The stored project presenter must match its presenter mode.",
      });
    }
  });

const TemplateGenerationSceneSchema = z
  .object({
    id: z.string().trim().min(1).max(120),
    title: LocalizedTextSchema,
    purpose: LocalizedTextSchema,
    duration: z.number().int().min(1).max(20),
    headline: LocalizedTextSchema,
    voiceover: LocalizedTextSchema,
    direction: z.string().trim().min(1).max(2_000),
    shot: z.string().trim().min(1).max(240),
    camera: z.string().trim().min(1).max(240),
    lighting: z.string().trim().min(1).max(240),
    continuityAnchor: z.string().trim().min(1).max(400),
  })
  .strict();

const TemplateGenerationQualityPolicySchema = z
  .object({
    tier: z.literal("premium"),
    acceptanceScore: z.number().int().min(1).max(100),
    internalRetryLimit: z.number().int().min(0).max(3),
    hardGates: z.array(z.string().trim().min(1).max(240)).max(24),
    scoredDimensions: z.array(z.string().trim().min(1).max(240)).max(24),
  })
  .strict();

const TemplateCreativeBriefSchema = z
  .object({
    engineVersion: z.string().trim().min(1).max(120),
    templateId: z.string().trim().min(1).max(120),
    templateRecipeVersion: z.number().int().positive().optional(),
    templatePromptVersion: z.string().min(1).max(120).optional(),
    templateVisualSystem: z.string().max(1_000).optional(),
    market: z.literal("KW"),
    language: CampaignLanguageSchema,
    arabicDialect: z.union([z.literal("kuwaiti"), z.null()]),
    dialectRegister: z.enum(["polished", "conversational"]),
    tone: z.enum(["premium", "friendly", "clinical", "energetic", "informative", "warm"]),
    vertical: BusinessVerticalSchema,
    goal: CampaignGoalSchema,
    product: z
      .object({
        name: z.string().trim().min(1).max(240),
        brand: z.string().trim().max(240),
        description: z.string().trim().max(2_000),
        price: KwdAmountSchema,
        offer: z.string().trim().max(500),
        callToAction: z.string().trim().min(1).max(240),
        whatsapp: KuwaitPhoneOrEmptySchema,
        location: z.string().trim().max(500),
        bookingUrl: HttpUrlOrEmptySchema.optional(),
      })
      .strict(),
    scenes: z.array(TemplateGenerationSceneSchema).min(3).max(6),
    qualityPolicy: TemplateGenerationQualityPolicySchema,
  })
  .strict();

/** A strict template-generation variant; Advanced configuration remains a distinct bounded surface. */
export const TemplateGenerationConfigurationSchema = z
  .object({
    prompt: z.string().trim().min(1).max(8_000),
    durationSeconds: z.number().int().min(1).max(60),
    aspectRatio: CampaignRatioSchema,
    resolution: CampaignResolutionSchema,
    audio: z.boolean(),
    references: z
      .array(
        z
          .object({
            objectKey: StableAssetKeySchema,
            mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
          })
          .strict(),
      )
      .max(12),
    templateQuoteContext: CampaignSettingsSchema,
    creativeBrief: TemplateCreativeBriefSchema,
  })
  .strict();
export type TemplateGenerationConfiguration = z.infer<typeof TemplateGenerationConfigurationSchema>;

const TemplateProductRecipeSchema = z
  .object({
    sourceType: CampaignSourceKindSchema,
    subject: z.enum(["product", "service"]),
    name: z.string().trim().max(240),
    description: z.string().trim().max(4_000),
    price: KwdAmountSchema,
    brand: z.string().trim().max(240),
    images: z
      .array(
        z
          .object({
            assetId: EntityIdSchema,
            name: z.string().trim().min(1).max(240),
            objectKey: StableAssetKeySchema,
            mimeType: z.string().trim().min(1).max(255).optional(),
            checksumSha256: Sha256Schema.optional(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();

const TemplateProjectConfigurationSchema = z
  .object({
    creatorProject: PersistedTemplateCreatorProjectSchema,
    generation: TemplateGenerationConfigurationSchema,
    sourceFingerprint: Sha256Schema.optional(),
    duplicateOfProjectId: EntityIdSchema.optional(),
    duplicateOperationKey: z.string().trim().min(1).max(256).optional(),
  })
  .strict();

/**
 * The only persisted template payload accepted after Phase 3. It makes all
 * business facts and delivery values agree across the UI snapshot, campaign
 * recipe, and generation input before a database write or charge is possible.
 */
export const TemplateCampaignPayloadSchema = z
  .object({
    configuration: TemplateProjectConfigurationSchema,
    productRecipe: TemplateProductRecipeSchema,
    campaignRecipe: CampaignSettingsSchema,
  })
  .strict()
  .superRefine((payload, context) => {
    const project = payload.configuration.creatorProject;
    const generation = payload.configuration.generation;
    const campaign = payload.campaignRecipe;
    const projectPresenter = project.presenter ?? { mode: project.presenterMode };
    const sameJson = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
    const settingsMatch = [
      project.promotionKind === campaign.promotionKind,
      project.vertical === campaign.vertical,
      project.goal === campaign.goal,
      project.presenterMode === campaign.presenterMode,
      sameJson(projectPresenter, campaign.presenter),
      project.language === campaign.language,
      project.arabicDialect === campaign.arabicDialect,
      project.dialectRegister === campaign.dialectRegister,
      project.market === campaign.market,
      project.location === campaign.location,
      project.bookingUrl === campaign.bookingUrl,
      project.whatsapp === campaign.whatsapp,
      project.offer === campaign.offer,
      project.cta === campaign.cta,
      project.brandColor === campaign.brandColor,
      project.aspectRatio === campaign.aspectRatio,
      project.resolution === campaign.resolution,
      project.subtitles === campaign.subtitles,
      project.audio === campaign.audio,
      project.product.price === campaign.price,
      project.product.brand === campaign.brand,
      generation.templateQuoteContext.market === campaign.market,
      generation.templateQuoteContext.promotionKind === campaign.promotionKind,
      generation.templateQuoteContext.vertical === campaign.vertical,
      generation.templateQuoteContext.language === campaign.language,
      generation.templateQuoteContext.goal === campaign.goal,
      generation.templateQuoteContext.presenterMode === campaign.presenterMode,
      sameJson(generation.templateQuoteContext.presenter, campaign.presenter),
      generation.templateQuoteContext.arabicDialect === campaign.arabicDialect,
      generation.templateQuoteContext.dialectRegister === campaign.dialectRegister,
      generation.templateQuoteContext.location === campaign.location,
      generation.templateQuoteContext.bookingUrl === campaign.bookingUrl,
      generation.templateQuoteContext.whatsapp === campaign.whatsapp,
      generation.templateQuoteContext.price === campaign.price,
      generation.templateQuoteContext.offer === campaign.offer,
      generation.templateQuoteContext.cta === campaign.cta,
      generation.templateQuoteContext.brand === campaign.brand,
      generation.templateQuoteContext.brandColor === campaign.brandColor,
      generation.templateQuoteContext.aspectRatio === campaign.aspectRatio,
      generation.templateQuoteContext.resolution === campaign.resolution,
      generation.templateQuoteContext.subtitles === campaign.subtitles,
      generation.templateQuoteContext.audio === campaign.audio,
      generation.aspectRatio === campaign.aspectRatio,
      generation.resolution === campaign.resolution,
      generation.audio === campaign.audio,
      generation.creativeBrief.market === campaign.market,
      generation.creativeBrief.language === campaign.language,
      generation.creativeBrief.arabicDialect === (campaign.language === "en" ? null : campaign.arabicDialect),
      generation.creativeBrief.dialectRegister === campaign.dialectRegister,
      generation.creativeBrief.vertical === campaign.vertical,
      generation.creativeBrief.goal === campaign.goal,
      generation.creativeBrief.templateId === project.templateId,
      generation.creativeBrief.product.name === payload.productRecipe.name,
      generation.creativeBrief.product.description === payload.productRecipe.description,
      generation.creativeBrief.product.price === campaign.price,
      generation.creativeBrief.product.offer === campaign.offer,
      generation.creativeBrief.product.callToAction === campaign.cta,
      generation.creativeBrief.product.brand === campaign.brand,
      generation.creativeBrief.product.whatsapp === campaign.whatsapp,
      generation.creativeBrief.product.location === campaign.location,
      generation.creativeBrief.product.bookingUrl === undefined || generation.creativeBrief.product.bookingUrl === campaign.bookingUrl,
      payload.productRecipe.price === campaign.price,
      payload.productRecipe.brand === campaign.brand,
      project.product.sourceType === (payload.productRecipe.sourceType === "product_url"
        ? "product_link"
        : payload.productRecipe.sourceType === "business_url"
          ? "business_link"
          : payload.productRecipe.sourceType === "product_upload"
            ? "upload"
            : "sample"),
      project.source.kind === payload.productRecipe.sourceType,
      project.source.subject === payload.productRecipe.subject,
    ];
    if (settingsMatch.every(Boolean)) return;
    context.addIssue({
      code: "custom",
      path: ["campaignRecipe"],
      message: "Campaign settings must agree with the saved project and generation configuration.",
    });
  });
export type TemplateCampaignPayload = z.infer<typeof TemplateCampaignPayloadSchema>;

/**
 * Template Mode must be attached to the exact immutable version that supplied
 * its recipe. A mutable template slug or an absent version can never be used
 * to make a Template Mode write, quote, or render eligible.
 */
export const TemplateCampaignWriteSchema = TemplateCampaignPayloadSchema.extend({
  templateVersionId: EntityIdSchema,
}).strict();
export type TemplateCampaignWrite = z.infer<typeof TemplateCampaignWriteSchema>;

export function validateTemplateCampaignPayload(input: {
  mode: CreationMode;
  templateVersionId?: string | null | undefined;
  configuration: unknown;
  productRecipe: unknown;
  campaignRecipe: unknown;
}): z.ZodSafeParseResult<TemplateCampaignWrite> | null {
  if (input.mode !== "template") return null;
  return TemplateCampaignWriteSchema.safeParse({
    templateVersionId: input.templateVersionId,
    configuration: input.configuration,
    productRecipe: input.productRecipe,
    campaignRecipe: input.campaignRecipe,
  });
}

export const SourceScanResponseSchema = z
  .object({
    kind: z.enum(["product", "business"]),
    canonicalUrl: z.url(),
    facts: z.array(ConfirmedFactSchema),
    imageCandidates: z.array(z.url()).max(8),
    warnings: z.array(z.string()),
    scannedAt: z.iso.datetime(),
    requestId: RequestIdSchema,
  })
  .strict();
export type SourceScanResponse = z.infer<typeof SourceScanResponseSchema>;

export const OutputDownloadResponseSchema = z
  .object({
    runId: EntityIdSchema,
    projectId: EntityIdSchema,
    download: z
      .object({ method: z.literal("GET"), url: z.url(), expiresInSeconds: z.number().int().positive() })
      .strict(),
    requestId: RequestIdSchema,
  })
  .strict();
export type OutputDownloadResponse = z.infer<typeof OutputDownloadResponseSchema>;

// Keep the shared idempotency contract discoverable from the creator module.
export const CreatorIdempotencyKeySchema = IdempotencyKeySchema;
