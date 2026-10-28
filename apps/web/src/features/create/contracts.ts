import { displayCopyForProject } from "./displayCopyProject";
import type { DisplayCopy } from "@movprompt/contracts";
import type { NativeUgcSettings } from "@movprompt/contracts";
import type {
  CreatorAspectRatio,
  CreatorLanguage,
  CreatorMarket,
  CreatorProduct,
  CreatorProject,
  CreatorResolution,
} from "./types";
import type { BusinessVertical, CampaignGoal, CampaignPresenter, CampaignSource, PresenterMode } from "@movprompt/contracts";
import type { AdStudioBrandAdSettings, ProductModelAdSettings } from "@movprompt/contracts";
import { PRODUCT_MODEL_AD_ID } from "@movprompt/contracts";
import { modelAdSettingsForProject } from "./productModelAdProject";
import { brandAdSettingsForProject, isAdStudioBrandAd } from "./adStudioBrandAdProject";
import { campaignSourceForProject } from "./sourceFacts";
import { getCreativeTemplate } from "@movprompt/creative-engine";

export type CreationMode = "template" | "advanced";
export type DraftStatus =
  | "editing"
  | "ready"
  | "auth_required"
  | "claiming"
  | "credit_required"
  | "submitting"
  | "submitted"
  | "expired";

export type RightsAttestation = {
  confirmed: boolean;
  confirmedAt?: string;
  version: "2026-08-11";
};

export type CampaignSettings = {
  productModelAd?: ProductModelAdSettings;
  adStudioBrandAd?: AdStudioBrandAdSettings;
  nativeUgc?: NativeUgcSettings;
  displayCopy?: DisplayCopy;
  libraryReviewRequired?: true;
  market: CreatorMarket;
  language: CreatorLanguage;
  arabicDialect: "kuwaiti";
  dialectRegister: "polished" | "conversational";
  vertical: BusinessVertical;
  goal: CampaignGoal;
  presenterMode: PresenterMode;
  presenter?: CampaignPresenter;
  location: string;
  bookingUrl: string;
  whatsapp: string;
  offer: string;
  cta: string;
  brandColor: string;
  logoAssetKey?: string;
  aspectRatio: CreatorAspectRatio;
  resolution: CreatorResolution;
  subtitles: boolean;
  audio: boolean;
  durationSeconds?: number;
};

export type AdvancedSettings = {
  capability?: ApprovedCapability;
  prompt?: string;
  references?: string[];
  renderSettings?: Record<string, unknown>;
};

export interface CreationDraft {
  templateDefinition?: import("@movprompt/creative-engine").CreativeTemplateRecipe;
  pinnedTemplateVersionId?: string;
  templateCatalogSlug?: string;
  templateRecipeVersion?: number;
  durationVariant?: string;
  id: string;
  mode: CreationMode;
  status: DraftStatus;
  templateVersionId?: string;
  product: CreatorProduct;
  /** CampaignSource is the normalized fact/provenance anchor; product is legacy compatibility data. */
  source?: CampaignSource;
  assetKeys: string[];
  campaign: CampaignSettings;
  advanced?: AdvancedSettings;
  rightsAttestation?: RightsAttestation;
  pendingGenerationId?: string;
  acceptedQuote?: { quoteId: string; credits: number; expiresAt: string };
  returnPath: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

export type ApprovedCapability =
  | "video.cinematic"
  | "video.product_fidelity"
  | "image.product"
  | "presenter.ai_ugc"
  | "avatar.enroll"
  | "avatar.perform"
  | "voice.clone"
  | "speech.generate"
  | "speech.lip_sync"
  | "media.transcribe"
  | "media.moderate";

export interface GenerationQuote {
  quoteId: string | null;
  capability: ApprovedCapability;
  credits: number;
  entitlementEligible: boolean;
  expiresAt: string;
  breakdown: Array<{ label: string; credits: number }>;
  estimateOnly?: boolean;
}

export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function projectToCreationDraft(
  project: CreatorProject,
  rightsConfirmed: boolean,
  status: DraftStatus = "editing",
): CreationDraft {
  const now = new Date();
  const recipe = project.templateDefinition ?? getCreativeTemplate(project.templateId);
  return {
    ...(project.templateDefinition ? { templateDefinition: project.templateDefinition } : {}),
    ...(project.pinnedTemplateVersionId ? { pinnedTemplateVersionId: project.pinnedTemplateVersionId } : {}),
    ...(project.templateCatalogSlug ? { templateCatalogSlug: project.templateCatalogSlug } : {}),
    templateRecipeVersion: recipe.versionNumber,
    ...(recipe.durationRecipes?.[String(project.durationSeconds)] ? { durationVariant: recipe.durationRecipes[String(project.durationSeconds)]!.id } : {}),
    id: project.id,
    mode: "template",
    status,
    templateVersionId: project.templateId,
    product: project.product,
    source: campaignSourceForProject(project),
    assetKeys: project.product.images.flatMap((image) => image.assetKey ? [image.assetKey] : []),
    campaign: {
      ...(project.templateId === PRODUCT_MODEL_AD_ID ? { productModelAd: modelAdSettingsForProject(project) } : project.productModelAd ? { productModelAd: project.productModelAd } : {}),
      ...(isAdStudioBrandAd(project) ? { adStudioBrandAd: brandAdSettingsForProject(project) } : {}),
      ...(project.nativeUgc ? { nativeUgc: project.nativeUgc } : {}),
    displayCopy: displayCopyForProject(project),
    ...(project.libraryReviewRequired ? { libraryReviewRequired: true } : {}),
      market: project.market,
      language: project.language,
      arabicDialect: project.arabicDialect,
      dialectRegister: project.dialectRegister,
      vertical: project.vertical,
      goal: project.goal,
      presenterMode: project.presenterMode,
      presenter: project.presenter,
      location: project.location,
      bookingUrl: project.bookingUrl,
      whatsapp: project.whatsapp,
      offer: project.offer,
      cta: displayCopyForProject(project).closingMessage,
      brandColor: project.brandColor,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      subtitles: false,
      audio: project.audio,
      durationSeconds: project.durationSeconds,
    },
    rightsAttestation: { confirmed: rightsConfirmed, confirmedAt: rightsConfirmed ? now.toISOString() : undefined, version: "2026-08-11" },
    pendingGenerationId: project.pendingGenerationId ?? undefined,
    acceptedQuote: undefined,
    returnPath: `/create?draft=${encodeURIComponent(project.id)}`,
    createdAt: project.createdAt,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + GUEST_DRAFT_TTL_MS).toISOString(),
  };
}
