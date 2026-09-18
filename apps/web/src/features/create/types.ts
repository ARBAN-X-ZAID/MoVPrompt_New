import type { BusinessVertical, CampaignGoal, CampaignPresenter, CampaignSource, PresenterMode, TemplateDiscoveryCategory } from "@movprompt/contracts";

export type CreatorLanguage = "en" | "ar" | "bilingual";
export type CreatorMarket = "KW" | "SA" | "AE" | "QA" | "BH" | "OM";
export type CreatorAspectRatio = "9:16" | "1:1" | "4:5" | "16:9";
export type CreatorResolution = "480p" | "720p";

export function normalizeCreatorResolution(value: unknown): CreatorResolution {
  return value === "480p" ? "480p" : "720p";
}
export type CreatorProjectStatus =
  | "draft"
  | "ready"
  | "generating"
  | "review"
  | "failed"
  | "exporting"
  | "completed";

export type CreatorAsset = {
  id: string;
  name: string;
  url: string;
  mimeType?: string;
  assetKey?: string;
  checksum?: string;
  /** Verified local/video metadata is retained until guest claim completes. */
  durationMs?: number;
  storagePath?: string;
  source: "upload" | "url" | "sample";
};

export type CreatorScene = {
  id: string;
  title: string;
  titleAr?: string;
  purpose: string;
  purposeAr?: string;
  duration: number;
  headline: string;
  headlineAr?: string;
  voiceover?: string;
  voiceoverAr?: string;
  direction: string;
  shot?: string;
  camera?: string;
  lighting?: string;
  continuityAnchor?: string;
  locked?: boolean;
};

export type CreatorTemplate = {
  id: string;
  name: string;
  nameAr: string;
  eyebrow: string;
  discoveryCategory: TemplateDiscoveryCategory;
  description: string;
  descriptionAr: string;
  bestFor: string;
  duration: number;
  previewVideo: string | null;
  poster: string;
  posterPosition: string;
  mediaCode: string;
  mediaTone: "warm" | "cool" | "soft" | "vivid" | "neutral";
  languages: CreatorLanguage[];
  aspectRatios: CreatorAspectRatio[];
  accent: string;
  tags: string[];
  verticals: BusinessVertical[];
  goals: CampaignGoal[];
  /** Inputs the immutable template recipe requires before a render can start. */
  requiredInputs: string[];
  dialectRegister: "polished" | "conversational";
  qualityStatus: "development" | "review" | "approved";
  scenes: CreatorScene[];
};

export type CreatorProduct = {
  sourceType: "product_link" | "business_link" | "upload" | "sample" | null;
  sourceUrl: string;
  name: string;
  description: string;
  price: string;
  brand: string;
  images: CreatorAsset[];
};

export type CreatorProject = {
  id: string;
  versionId?: string;
  versionNumber?: number;
  /** Server-computed identity of the product/business facts and owned source assets. */
  sourceFingerprint?: string;
  /** The fingerprint attached to the render that produced the current output. */
  outputSourceFingerprint?: string;
  title: string;
  templateId: string;
  status: CreatorProjectStatus;
  promotionKind: "product" | "business";
  vertical: BusinessVertical;
  goal: CampaignGoal;
  presenterMode: PresenterMode;
  /** Exact presenter/footage rights payload; omitted only for legacy draft compatibility. */
  presenter?: CampaignPresenter;
  location: string;
  bookingUrl: string;
  whatsapp: string;
  product: CreatorProduct;
  /** Normalized campaign truth. Legacy product fields remain a compatibility view during migration. */
  source?: CampaignSource;
  language: CreatorLanguage;
  arabicDialect: "kuwaiti";
  dialectRegister: "polished" | "conversational";
  market: CreatorMarket;
  offer: string;
  cta: string;
  brandColor: string;
  logoUrl: string;
  aspectRatio: CreatorAspectRatio;
  resolution: CreatorResolution;
  /** Template recipe duration in seconds. Template Mode always uses the catalog default. */
  durationSeconds: number;
  subtitles: boolean;
  audio: boolean;
  scenes: CreatorScene[];
  hasGeneratedVideo?: boolean;
  hasActiveGeneration?: boolean;
  videoUrl: string | null;
  jobId: string | null;
  renderRunId?: string | null;
  lastError: string | null;
  pendingGenerationId?: string | null;
  pendingQuoteCredits?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatorStep = "template" | "source" | "facts" | "details" | "generating" | "editor";

export const MARKET_META: Record<CreatorMarket, { label: string; currency: string }> = {
  KW: { label: "Kuwait", currency: "KWD" },
  SA: { label: "Saudi Arabia", currency: "SAR" },
  AE: { label: "United Arab Emirates", currency: "AED" },
  QA: { label: "Qatar", currency: "QAR" },
  BH: { label: "Bahrain", currency: "BHD" },
  OM: { label: "Oman", currency: "OMR" },
};

/**
 * The value is what is persisted in a campaign recipe. Labels are deliberately
 * separate so changing the interface language never changes a confirmed CTA.
 */
export const CTA_OPTIONS = ["Shop now", "Order on WhatsApp", "Book now", "Learn more", "Visit store"] as const;

export type CampaignCta = (typeof CTA_OPTIONS)[number];

export const CAMPAIGN_CTA_LABELS: Record<CampaignCta, { en: string; ar: string }> = {
  "Shop now": { en: "Shop now", ar: "تسوّق الآن" },
  "Order on WhatsApp": { en: "Order on WhatsApp", ar: "اطلب عبر واتساب" },
  "Book now": { en: "Book now", ar: "احجز الآن" },
  "Learn more": { en: "Learn more", ar: "اعرف المزيد" },
  "Visit store": { en: "Visit store", ar: "زيارة المتجر" },
};

export function campaignCtaLabel(value: string, arabic = false): string {
  const label = CAMPAIGN_CTA_LABELS[value as CampaignCta];
  return label ? label[arabic ? "ar" : "en"] : value;
}

export const CAMPAIGN_GOAL_OPTIONS: Array<{
  value: CampaignGoal;
  label: string;
  defaultCta: (typeof CTA_OPTIONS)[number];
}> = [
  { value: "whatsapp_orders", label: "Get WhatsApp orders", defaultCta: "Order on WhatsApp" },
  { value: "bookings", label: "Get bookings", defaultCta: "Book now" },
  { value: "launch", label: "Launch something new", defaultCta: "Shop now" },
  { value: "offer", label: "Promote an offer", defaultCta: "Shop now" },
  { value: "demonstration", label: "Explain how it works", defaultCta: "Learn more" },
  { value: "education", label: "Educate your audience", defaultCta: "Learn more" },
  { value: "announcement", label: "Make an announcement", defaultCta: "Learn more" },
  { value: "trust", label: "Build trust", defaultCta: "Learn more" },
  { value: "brand_story", label: "Tell your brand story", defaultCta: "Visit store" },
];

export function getCampaignGoalOption(goal: CampaignGoal) {
  return CAMPAIGN_GOAL_OPTIONS.find((option) => option.value === goal) ?? CAMPAIGN_GOAL_OPTIONS[2]!;
}
