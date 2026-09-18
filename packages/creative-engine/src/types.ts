import { z } from "zod";
import { CampaignGoalSchema } from "@movprompt/contracts";

const TemplateDiscoveryCategorySchema = z.enum([
  "electronics",
  "food",
  "ecommerce",
  "advertising",
  "other",
]);

export const ENGINE_VERSION = "gcc-campaign-engine-2026.09-r2" as const;

export const StoryArcSchema = z.enum([
  "hero",
  "demo",
  "offer",
  "ugc",
  "service",
  "trust",
  "seasonal",
  "education",
  "story",
  "transformation",
]);
export type StoryArc = z.infer<typeof StoryArcSchema>;

export const CampaignToneSchema = z.enum([
  "premium",
  "friendly",
  "clinical",
  "energetic",
  "informative",
  "warm",
]);
export type CampaignTone = z.infer<typeof CampaignToneSchema>;

export const DialectRegisterSchema = z.enum(["polished", "conversational"]);
export type DialectRegister = z.infer<typeof DialectRegisterSchema>;

export const LocalizedCopySchema = z.object({ en: z.string().min(1), ar: z.string().min(1) }).strict();
export type LocalizedCopy = z.infer<typeof LocalizedCopySchema>;

export const TemplateSceneRecipeSchema = z
  .object({
    id: z.string().min(1),
    title: LocalizedCopySchema,
    purpose: LocalizedCopySchema,
    duration: z.number().int().min(1).max(20),
    headline: LocalizedCopySchema,
    voiceover: LocalizedCopySchema,
    direction: z.string().min(1).max(2_000),
    shot: z.string().min(1).max(240),
    camera: z.string().min(1).max(240),
    lighting: z.string().min(1).max(240),
    continuityAnchor: z.string().min(1).max(400),
  })
  .strict();
export type TemplateSceneRecipe = z.infer<typeof TemplateSceneRecipeSchema>;

export const TemplateQualityPolicySchema = z
  .object({
    tier: z.literal("premium"),
    acceptanceScore: z.number().int().min(1).max(100),
    internalRetryLimit: z.number().int().min(0).max(3),
    hardGates: z.array(z.string().min(1)),
    scoredDimensions: z.array(z.string().min(1)),
  })
  .strict();
export type TemplateQualityPolicy = z.infer<typeof TemplateQualityPolicySchema>;

export const CreativeTemplateRecipeSchema = z
  .object({
    id: z.string().min(1).max(120),
    slug: z.string().min(1).max(120),
    versionNumber: z.number().int().positive(),
    category: z.string().min(1).max(80),
    discoveryCategory: TemplateDiscoveryCategorySchema,
    localizedName: LocalizedCopySchema,
    localizedDescription: LocalizedCopySchema,
    outcome: z.string().min(1).max(240),
    verticals: z.array(z.enum(["salon", "clinic", "retail", "ecommerce", "real_estate", "services"])).min(1),
    goals: z.array(CampaignGoalSchema).min(1),
    durationSeconds: z.number().int().min(3).max(60),
    supportedLanguages: z.array(z.enum(["ar", "en", "bilingual"])).min(1),
    supportedRatios: z.array(z.enum(["9:16", "1:1", "4:5", "16:9"])).min(1),
    supportedMarkets: z.tuple([z.literal("KW")]),
    requiredInputs: z.array(z.string().min(1)).min(1),
    starterRenderEligible: z.boolean(),
    qualityStatus: z.enum(["development", "review", "approved"]),
    storyArc: StoryArcSchema,
    tone: CampaignToneSchema,
    dialectRegister: DialectRegisterSchema,
    visualSystem: z.string().min(1).max(1_000),
    soundDirection: z.string().min(1).max(600),
    capabilityPolicy: z.array(z.enum(["video.cinematic", "video.product_fidelity", "presenter.ai_ugc", "speech.generate", "speech.lip_sync"])).min(1),
    protectedLayers: z.array(z.string().min(1)),
    complianceRules: z.array(z.string().min(1)),
    qualityPolicy: TemplateQualityPolicySchema,
    tags: z.array(z.string().min(1)),
    scenes: z.array(TemplateSceneRecipeSchema).min(3).max(6),
  })
  .strict();
export type CreativeTemplateRecipe = z.infer<typeof CreativeTemplateRecipeSchema>;

export const CreativeBriefSchema = z
  .object({
    engineVersion: z.enum(["gcc-campaign-engine-2026.08", ENGINE_VERSION]),
    templateId: z.string().min(1).max(120),
    templateRecipeVersion: z.number().int().positive().optional(),
    templatePromptVersion: z.string().min(1).max(120).optional(),
    templateVisualSystem: z.string().max(1_000).optional(),
    market: z.literal("KW"),
    language: z.enum(["ar", "en", "bilingual"]),
    arabicDialect: z.literal("kuwaiti").nullable(),
    dialectRegister: DialectRegisterSchema,
    tone: CampaignToneSchema,
    vertical: z.enum(["salon", "clinic", "retail", "ecommerce", "real_estate", "services"]),
    goal: CampaignGoalSchema,
    product: z
      .object({
        name: z.string().min(1).max(240),
        brand: z.string().max(240).default(""),
        description: z.string().max(2_000).default(""),
        price: z.string().max(120).default(""),
        offer: z.string().max(500).default(""),
        callToAction: z.string().min(1).max(240),
        whatsapp: z.string().max(80).default(""),
        bookingUrl: z.string().max(2_048).optional(),
        location: z.string().max(500).default(""),
      })
      .strict(),
    scenes: z.array(TemplateSceneRecipeSchema).min(3).max(6),
    qualityPolicy: TemplateQualityPolicySchema,
  })
  .strict();
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

export type CompiledCreativeDirection = {
  prompt: string;
  negativePrompt: string;
  spokenLocale: "ar-KW" | "en-US" | "mixed";
  dialectScore: number;
  dialectWarnings: string[];
  dialectPolicyVersion: string;
  qualityPolicy: TemplateQualityPolicy;
};
