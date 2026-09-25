import {
  CapabilityAliasSchema,
  GenerationConfigurationSchema,
  TemplateCampaignPayloadSchema,
  TemplateGenerationConfigurationSchema,
  type CapabilityAlias,
  type CreateGenerationQuoteRequest,
  type GenerationConfiguration,
  type PublicRenderRun,
  type TemplateRequiredInput,
} from "@movprompt/contracts";
import {
  GenerationDomainError,
  hashGenerationConfiguration,
  type GenerationService,
  type JsonObject,
} from "@movprompt/db";
import {
  CapabilityResolutionError,
  type CapabilityRegistry,
} from "@movprompt/providers";
import { assertOwnedProjectKey } from "@movprompt/storage";
import { LAUNCH_TEMPLATE_IDS } from "@movprompt/creative-engine";

import {
  CampaignEligibilityError,
  createCampaignEligibilityService,
  type CampaignEligibilityService,
} from "./campaign-eligibility.js";

import type { AuthenticatedSession } from "./auth-gateway.js";
import type {
  GenerationRepository,
  OwnedProjectVersion,
  OwnedRenderRun,
  PublishedTemplateVersion,
} from "./generation-repository.js";
import {
  GenerationPricingUnavailableError,
  InvalidGenerationConfigurationError,
  type GenerationPricing,
} from "./generation-pricing.js";

export type PublicGenerationQuote = {
  quoteId: string | null;
  capability: CapabilityAlias;
  credits: number;
  entitlementEligible: boolean;
  configurationHash: string;
  pricingVersion: string;
  expiresAt: string;
  breakdown: Array<{ label: string; credits: number }>;
  estimateOnly: boolean;
};

export class GenerationApplicationError extends Error {
  constructor(
    readonly code:
      | "authentication_required"
      | "generation_service_unavailable"
      | "capability_unavailable"
      | "unapproved_capability"
      | "invalid_generation_configuration"
      | "invalid_campaign_configuration"
      | "invalid_generation_reference"
      | "project_version_not_found"
      | "template_version_not_found"
  | "template_configuration_ineligible"
      | "presenter_configuration_ineligible"
      | "quote_not_found"
      | "quote_expired"
      | "quote_configuration_mismatch"
      | "quote_price_changed"
      | "starter_entitlement_unavailable"
      | "insufficient_credits"
      | "project_render_active"
      | "user_render_limit_reached"
      | "idempotency_conflict"
      | "render_not_found"
      | "render_not_cancellable"
      | "render_output_not_recoverable"
      | "provider_acceptance_in_progress",
    message: string = code,
  ) {
    super(message);
    this.name = "GenerationApplicationError";
  }
}

export interface GenerationApiService {
  isAvailable(): boolean;
  createQuote(
    request: CreateGenerationQuoteRequest,
    session: AuthenticatedSession | null,
  ): Promise<PublicGenerationQuote>;
  startRender(input: {
    userId: string;
    projectId: string;
    projectVersionId: string;
    quoteId: string;
    idempotencyKey: string;
  }): Promise<PublicRenderRun>;
  getRender(userId: string, runId: string): Promise<PublicRenderRun>;
  listRenders(userId: string, projectId: string | undefined, limit: number): Promise<PublicRenderRun[]>;
  retryRenderOutput(userId: string, runId: string, idempotencyKey: string): Promise<PublicRenderRun>;
  cancelRender(userId: string, runId: string, idempotencyKey: string): Promise<PublicRenderRun>;
}

type GenerationApiServiceOptions = {
  repository: GenerationRepository;
  generation: Pick<GenerationService, "createQuote" | "startRender" | "releaseRenderReservation">;
  pricing: GenerationPricing;
  capabilities: CapabilityRegistry;
  now?: () => Date;
  starterOnly?: boolean;
  /** Signed-in accounts quote and render at zero credits until billing is on. */
  freeAccounts?: boolean;
  isGuestOwner?: (userId: string) => Promise<boolean>;
  starterEligibilityRequiresEmailVerification?: boolean;
  campaignEligibility?: CampaignEligibilityService;
};

function generationConfiguration(configuration: JsonObject): GenerationConfiguration {
  const nested = configuration.generation;
  const candidate =
    typeof nested === "object" && nested !== null && !Array.isArray(nested)
      ? nested
      : configuration;
  const parsed = GenerationConfigurationSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new GenerationApplicationError(
      "invalid_generation_configuration",
      "The saved project version does not contain a valid generation configuration.",
    );
  }
  return parsed.data as unknown as GenerationConfiguration;
}

const DIRECT_TEMPLATE_ESTIMATE_KEYS = new Set([
  "prompt",
  "durationSeconds",
  "aspectRatio",
  "resolution",
  "audio",
  "references",
  "templateQuoteContext",
  "creativeBrief",
  "templateCampaign",
]);

function invalidCampaignConfiguration(): never {
  throw new GenerationApplicationError(
    "invalid_campaign_configuration",
    "The saved template campaign settings are incomplete, invalid, or inconsistent.",
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Template Mode persisted rows are never allowed to fall back to the broad
 * Advanced configuration parser. Legacy Template Mode records stay readable,
 * but cannot receive a quote or a charge until recreated from a valid draft.
 */
function persistedTemplateCampaign(input: OwnedProjectVersion): {
  configuration: GenerationConfiguration;
  root: JsonObject;
} {
  if (!input.templateVersionId || input.productRecipe === undefined || input.campaignRecipe === undefined) {
    invalidCampaignConfiguration();
  }
  const parsed = TemplateCampaignPayloadSchema.safeParse({
    configuration: input.configuration,
    productRecipe: input.productRecipe,
    campaignRecipe: input.campaignRecipe,
  });
  if (!parsed.success) invalidCampaignConfiguration();
  return {
    configuration: parsed.data.configuration.generation as unknown as GenerationConfiguration,
    root: parsed.data.configuration as unknown as JsonObject,
  };
}

/**
 * A guest Template Mode estimate carries the exact same campaign payload as a
 * persisted project. The generic configuration schema remains Advanced-only;
 * the outer duplicate is checked to reject hidden or mismatched values rather
 * than silently choosing one of two campaign descriptions.
 */
function directTemplateCampaign(input: GenerationConfiguration): {
  configuration: GenerationConfiguration;
  root: JsonObject;
} {
  const candidate = input as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !DIRECT_TEMPLATE_ESTIMATE_KEYS.has(key))) {
    invalidCampaignConfiguration();
  }
  const payload = TemplateCampaignPayloadSchema.safeParse(candidate.templateCampaign);
  if (!payload.success) invalidCampaignConfiguration();
  const outer = TemplateGenerationConfigurationSchema.safeParse({
    prompt: candidate.prompt,
    durationSeconds: candidate.durationSeconds,
    aspectRatio: candidate.aspectRatio,
    resolution: candidate.resolution,
    audio: candidate.audio,
    references: candidate.references,
    templateQuoteContext: candidate.templateQuoteContext,
    creativeBrief: candidate.creativeBrief,
  });
  if (!outer.success || !sameJson(outer.data, payload.data.configuration.generation)) {
    invalidCampaignConfiguration();
  }
  return {
    configuration: payload.data.configuration.generation as unknown as GenerationConfiguration,
    root: payload.data.configuration as unknown as JsonObject,
  };
}

function boundConfiguration(input: {
  capability: CapabilityAlias;
  pricingVersion: string;
  templateVersionId: string | null;
  configuration: GenerationConfiguration;
}): JsonObject {
  return {
    capability: input.capability,
    pricingVersion: input.pricingVersion,
    templateVersionId: input.templateVersionId,
    generation: input.configuration,
  } as JsonObject;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function httpDestination(value: unknown): string {
  const candidate = stringValue(value);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

/**
 * These recipes make compliance, consent, or factual-verification promises
 * that the current immutable project-version contract cannot prove. A product
 * name, arbitrary image, or caller-authored JSON is never a substitute for a
 * verified clinic record, qualification, transcript, or person-media consent.
 * Keep the affected template versions fail-closed until dedicated server-owned
 * provenance and consent records are introduced.
 */
const UNSUPPORTED_PROTECTED_TEMPLATE_INPUTS = new Set<TemplateRequiredInput>([
  "verified_clinic_identity",
  "confirmed_service",
  "approved_claims",
  "verified_qualification",
  "approved_transcript",
  "consented_before_video",
  "consented_after_video",
  "consented_customer_video",
  "consented_founder_reference",
  "consented_person_reference",
]);

function eligibilityContext(configuration: GenerationConfiguration, root: JsonObject) {
  const creativeBrief = objectValue(configuration.creativeBrief);
  const product = objectValue(creativeBrief?.product);
  const quoteContext = objectValue(configuration.templateQuoteContext);
  const creatorProject = objectValue(root.creatorProject);
  const creatorProduct = objectValue(creatorProject?.product);
  const declaredLocalImages = Array.isArray(creatorProduct?.images)
    ? creatorProduct.images.filter((candidate) => {
        const image = objectValue(candidate);
        return Boolean(
          image
            && stringValue(image.id)
            && ["image/jpeg", "image/png", "image/webp"].includes(stringValue(image.mimeType).toLowerCase()),
        );
      }).length
    : 0;
  return {
    goal: stringValue(creativeBrief?.goal),
    language: stringValue(creativeBrief?.language),
    market: stringValue(creativeBrief?.market),
    ratio: configuration.aspectRatio ?? "",
    // A guest upload has a stable local asset identity before authentication,
    // but it cannot have a private object key yet. It may satisfy an estimate's
    // input disclosure only. Authenticated quote/start paths still call
    // assertOwnedGenerationReferences first and require the verified private
    // asset row, checksum, MIME, size and project namespace.
    references: Math.max(configuration.references.length, declaredLocalImages),
    subjectName: stringValue(product?.name),
    brand: stringValue(product?.brand),
    callToAction: stringValue(product?.callToAction),
    price: stringValue(product?.price),
    location: stringValue(product?.location),
    whatsapp: stringValue(product?.whatsapp),
    // A booking requirement means a real booking URL. WhatsApp ordering is a
    // distinct outcome and must never silently satisfy a booking-only recipe.
    bookingDestination: httpDestination(creatorProject?.bookingUrl)
      || httpDestination(quoteContext?.bookingUrl)
      || httpDestination(product?.bookingUrl),
    orderOrBookingDestination: httpDestination(creatorProject?.bookingUrl)
      || httpDestination(quoteContext?.bookingUrl)
      || httpDestination(product?.bookingUrl)
      || stringValue(creatorProject?.whatsapp)
      || stringValue(quoteContext?.whatsapp)
      || stringValue(product?.whatsapp),
    deliveryDestination: httpDestination(creatorProject?.bookingUrl)
      || httpDestination(quoteContext?.bookingUrl)
      || httpDestination(product?.bookingUrl)
      || stringValue(creatorProject?.whatsapp)
      || stringValue(quoteContext?.whatsapp)
      || stringValue(product?.whatsapp),
  };
}

function hasRequiredInput(required: TemplateRequiredInput, context: ReturnType<typeof eligibilityContext>): boolean {
  if (UNSUPPORTED_PROTECTED_TEMPLATE_INPUTS.has(required)) return false;
  const hasReference = context.references > 0;
  const hasSubject = Boolean(context.subjectName);
  switch (required) {
    case "product_image":
    case "primary_reference":
    case "product_reference":
    case "real_work_reference":
    case "real_room_reference":
    case "real_shade_reference":
    case "real_dish_media":
    case "real_facility_media":
    case "all_box_item_references":
    case "all_bundle_item_references":
    case "consented_before_video":
    case "consented_after_video":
    case "consented_customer_video":
    case "consented_founder_reference":
    case "consented_person_reference":
      return hasReference;
    case "product_name":
    case "subject_name":
    case "business_name":
    case "service_name":
    case "business_identity":
    case "restaurant_identity":
    case "verified_clinic_identity":
    case "confirmed_service":
    case "service_details":
    case "approved_claims":
    case "verified_qualification":
    case "approved_transcript":
    case "confirmed_origin_facts":
    case "confirmed_contents":
    case "confirmed_quantities":
    case "confirmed_shade_names":
    case "dimensions_if_relevant":
      return hasSubject;
    case "logo_or_brand_name":
      return Boolean(context.brand);
    case "call_to_action":
      return Boolean(context.callToAction);
    case "location":
    case "salon_location":
      return Boolean(context.location);
    case "booking_destination":
      return Boolean(context.bookingDestination);
    case "order_or_booking_destination":
      return Boolean(context.orderOrBookingDestination);
    case "delivery_destination":
      return Boolean(context.deliveryDestination);
    case "whatsapp":
      return Boolean(context.whatsapp);
    case "confirmed_price":
    case "approved_price":
      return Boolean(context.price);
  }
}

const IMAGE_REFERENCE_REQUIRED_INPUTS = new Set<TemplateRequiredInput>([
  "product_image",
  "primary_reference",
  "product_reference",
  "real_work_reference",
  "real_room_reference",
  "real_shade_reference",
  "real_dish_media",
  "real_facility_media",
  "all_box_item_references",
  "all_bundle_item_references",
  "consented_before_video",
  "consented_after_video",
  "consented_customer_video",
  "consented_founder_reference",
  "consented_person_reference",
]);

/**
 * A template is the authority for beginner capability selection. Browser
 * requests intentionally cannot turn a service campaign into product-fidelity
 * or select a provider through a different semantic capability.
 */
function resolveTemplateCapability(input: {
  template: PublishedTemplateVersion | null;
  requestedCapability?: CapabilityAlias;
  configuration: GenerationConfiguration;
}): CapabilityAlias {
  if (!input.template) {
    if (!input.requestedCapability) {
      throw new GenerationApplicationError(
        "invalid_generation_configuration",
        "Advanced generation requires an approved creative capability.",
      );
    }
    return input.requestedCapability;
  }

  const eligibility = input.template.eligibility;
  if (!eligibility) {
    throw new GenerationApplicationError(
      "template_configuration_ineligible",
      "This template is not available for the current campaign configuration.",
    );
  }
  const requiresImage = eligibility.requiredInputs.some((required) =>
    IMAGE_REFERENCE_REQUIRED_INPUTS.has(required),
  );
  const allowsProductFidelity = eligibility.capabilityPolicy.includes("video.product_fidelity");
  const allowsCinematic = eligibility.capabilityPolicy.includes("video.cinematic");

  if (requiresImage) {
    if (allowsProductFidelity) return "video.product_fidelity";
    if (allowsCinematic) return "video.cinematic";
  } else if (allowsCinematic) {
    // A manual/service campaign has no image reference. It must use a
    // non-image capability explicitly allowed by its published template.
    return "video.cinematic";
  } else if (input.configuration.references.length > 0 && allowsProductFidelity) {
    return "video.product_fidelity";
  }

  throw new GenerationApplicationError(
    "template_configuration_ineligible",
    requiresImage
      ? "This template requires a confirmed product or reference image."
      : "This template has no supported capability for the selected campaign inputs.",
  );
}

function publicErrorMessage(code: string): string {
  if (code === "generation_database_error") {
    return "We could not record the video generation. Your campaign is saved. If it does not recover, try again from Projects.";
  }
  if (code === "provider_output_host_not_allowed" || code === "provider_output_unavailable") {
    return "We could not finish saving this video. Your project is safe; try again from Projects.";
  }
  if (code.startsWith("quality_gate_") || code === "output_quality_reviewer_unavailable") {
    return "This video needs another review before it can be used. Your previous version is unchanged.";
  }
  if (code === "provider_cancelled") {
    return "This video creation was cancelled. Your campaign details are still saved.";
  }
  return "Video creation needs attention. Your project is saved and you can try again.";
}

function publicRun(run: OwnedRenderRun): PublicRenderRun {
  const capability = CapabilityAliasSchema.safeParse(run.capabilityAlias);
  if (!capability.success) {
    throw new GenerationApplicationError(
      "generation_service_unavailable",
      "A render contains an unsupported capability alias.",
    );
  }
  return {
    id: run.id,
    projectId: run.projectId,
    projectVersionId: run.projectVersionId,
    capability: capability.data,
    quoteId: run.quoteId,
    quotedCredits: run.quotedCredits,
    chargedCredits: run.chargedCredits,
    starterEntitlementUsed: run.starterEntitlementUsed,
    status: run.status,
    processingStage: run.processingStage,
    outputAvailable: Boolean(run.outputBucket && run.outputObjectKey),
    error: run.errorCode
      ? {
          code: run.errorCode,
          // Provider messages can contain operation identifiers, signed URLs,
          // model details, or transient infrastructure text. Product clients
          // receive only stable code-specific recovery guidance.
          message: publicErrorMessage(run.errorCode),
        }
      : null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

function mapCapabilityError(error: unknown): never {
  if (error instanceof CapabilityResolutionError) {
    if (error.code === "unapproved_capability") {
      throw new GenerationApplicationError("unapproved_capability", "The capability is not approved.");
    }
    throw new GenerationApplicationError(
      "capability_unavailable",
      "The approved capability is not configured in this environment.",
    );
  }
  throw error;
}

function mapDomainError(error: unknown): never {
  if (error instanceof GenerationDomainError) {
    const directCodes = new Set([
      "quote_not_found",
      "quote_expired",
      "quote_configuration_mismatch",
      "starter_entitlement_unavailable",
      "insufficient_credits",
      "project_render_active",
      "user_render_limit_reached",
      "idempotency_conflict",
      "render_not_found",
    ]);
    if (directCodes.has(error.code)) {
      throw new GenerationApplicationError(
        error.code as
          | "quote_not_found"
          | "quote_expired"
          | "quote_configuration_mismatch"
          | "starter_entitlement_unavailable"
          | "insufficient_credits"
          | "project_render_active"
          | "user_render_limit_reached"
          | "idempotency_conflict"
          | "render_not_found",
        error.message,
      );
    }
    if (error.code === "project_version_not_found") {
      throw new GenerationApplicationError("project_version_not_found");
    }
    if (error.code === "render_not_releasable") {
      throw new GenerationApplicationError("provider_acceptance_in_progress");
    }
  }
  throw error;
}

async function publishedTemplate(
  repository: GenerationRepository,
  templateVersionId: string | null | undefined,
): Promise<PublishedTemplateVersion | null> {
  if (!templateVersionId) return null;
  const template = await repository.findPublishedTemplateVersion(templateVersionId);
  if (!template) throw new GenerationApplicationError("template_version_not_found");
  return template;
}

async function persistedTemplateContext(
  repository: GenerationRepository,
  version: OwnedProjectVersion,
): Promise<{
  template: PublishedTemplateVersion;
  configuration: GenerationConfiguration;
  root: JsonObject;
} | null> {
  if (version.mode === "advanced") return null;
  if (version.mode !== "template") {
    throw new GenerationApplicationError(
      "invalid_generation_configuration",
      "The saved project version has an unsupported creation mode.",
    );
  }
  // Parse before any catalog, quote, asset, reservation, or provider work.
  const campaign = persistedTemplateCampaign(version);
  const template = await publishedTemplate(repository, version.templateVersionId);
  if (!template) invalidCampaignConfiguration();
  return { template, ...campaign };
}

async function eligibleForStarter(input: {
  repository: GenerationRepository;
  session: AuthenticatedSession | null;
  template: PublishedTemplateVersion | null;
  requireEmailVerification: boolean;
}): Promise<boolean> {
  return Boolean(
    input.session &&
      (!input.requireEmailVerification || input.session.user.emailVerified) &&
      input.template?.starterRenderEligible &&
      (await input.repository.hasAvailableStarterEntitlement(input.session.user.id)),
  );
}

export function createGenerationApiService(options: GenerationApiServiceOptions): GenerationApiService {
  const now = options.now ?? (() => new Date());
  const campaignEligibility = options.campaignEligibility ?? createCampaignEligibilityService();

  function assertCapability(capability: CapabilityAlias): void {
    try {
      options.capabilities.resolve(capability);
    } catch (error) {
      mapCapabilityError(error);
    }
    if (!options.pricing.isAvailable(capability)) {
      throw new GenerationApplicationError(
        "generation_service_unavailable",
        "Authoritative pricing is not configured for this capability.",
      );
    }
  }

  function assertTemplateEligibility(input: {
    template: PublishedTemplateVersion | null;
    capability: CapabilityAlias;
    configuration: GenerationConfiguration;
    root: JsonObject;
  }): void {
    if (!input.template) return;
    const eligibility = input.template.eligibility;
    if (!eligibility) {
      throw new GenerationApplicationError(
        "template_configuration_ineligible",
        "This template is not available for the current campaign configuration.",
      );
    }
    if (eligibility.requiredInputs.some((required) => UNSUPPORTED_PROTECTED_TEMPLATE_INPUTS.has(required))) {
      throw new GenerationApplicationError(
        "template_configuration_ineligible",
        "This template is temporarily unavailable until its required verification records are supported.",
      );
    }
    const context = eligibilityContext(input.configuration, input.root);
    const visualRecipe = input.template.visualRecipe;
    if (visualRecipe) {
      const brief = objectValue(input.configuration.creativeBrief);
      const scenes = Array.isArray(brief?.scenes) ? brief.scenes : [];
      const visualKeys = ["id", "direction", "shot", "camera", "lighting", "continuityAnchor", "duration"];
      const matchesRecipe = brief?.templateRecipeVersion === visualRecipe.versionNumber &&
        brief.templatePromptVersion === visualRecipe.promptVersion &&
        brief.templateVisualSystem === visualRecipe.visualSystem &&
        input.configuration.durationSeconds === input.template.durationSeconds &&
        scenes.length === visualRecipe.scenes.length &&
        visualRecipe.scenes.every((scene, index) => visualKeys.every(key => scene[key] === objectValue(scenes[index])?.[key]));
      if (!matchesRecipe) throw new GenerationApplicationError("template_configuration_ineligible", "This campaign uses an older template recipe. Select the template again to use its current preview style; your images and confirmed facts remain saved.");
    }
    const missingInputs = eligibility.requiredInputs.filter(required => !hasRequiredInput(required, context));
    const matches =
      eligibility.goals.includes(context.goal as never) &&
      eligibility.supportedLanguages.includes(context.language as never) &&
      eligibility.supportedRatios.includes(context.ratio as never) &&
      eligibility.supportedMarkets.includes(context.market as "KW") &&
      eligibility.capabilityPolicy.includes(input.capability) &&
      missingInputs.length === 0;
    if (!matches) {
      throw new GenerationApplicationError(
        "template_configuration_ineligible",
        missingInputs.length
          ? `This template needs: ${missingInputs.map(required => ({ subject_name: "a product or service name", primary_reference: "a saved reference image", logo_or_brand_name: "a brand name", call_to_action: "a call to action" } as Record<string, string>)[required] ?? required.replaceAll("_", " ")).join(", ")}.`
          : "Choose a campaign purpose, language and format supported by this template.",
      );
    }
  }

  async function loadOwnedVersion(userId: string, projectVersionId: string): Promise<OwnedProjectVersion> {
    const version = await options.repository.findOwnedProjectVersion(userId, projectVersionId);
    if (!version) throw new GenerationApplicationError("project_version_not_found");
    return version;
  }

  async function getOwnedRender(userId: string, runId: string): Promise<OwnedRenderRun> {
    const run = await options.repository.findOwnedRun(userId, runId);
    if (!run) throw new GenerationApplicationError("render_not_found");
    return run;
  }

  async function assertOwnedGenerationReferences(
    userId: string,
    version: OwnedProjectVersion,
    capability: CapabilityAlias,
    configuration: GenerationConfiguration,
  ): Promise<void> {
    if (capability === "video.product_fidelity" && configuration.references.length === 0) {
      throw new GenerationApplicationError(
        "invalid_generation_reference",
        "Product-fidelity generation requires at least one saved product or reference image.",
      );
    }
    if (!configuration.references.length) return;

    const supportedMimes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const keys = [...new Set(configuration.references.map((reference) => reference.objectKey))];
    for (const reference of configuration.references) {
      try {
        assertOwnedProjectKey(reference.objectKey, reference.objectKey.split("/")[1] === userId ? userId : version.storageOwnerId ?? userId, version.projectId);
      } catch {
        throw new GenerationApplicationError(
          "invalid_generation_reference",
          "A generation reference is outside this project’s private asset namespace.",
        );
      }
      if (!supportedMimes.has(reference.mimeType.toLowerCase())) {
        throw new GenerationApplicationError(
          "invalid_generation_reference",
          "A generation reference has an unsupported image type.",
        );
      }
    }

    const assets = await options.repository.findOwnedReferenceAssets(
      userId,
      version.projectId,
      keys,
    );
    const byKey = new Map(assets.map((asset) => [asset.objectKey, asset]));
    for (const reference of configuration.references) {
      const asset = byKey.get(reference.objectKey);
      if (
        !asset ||
        !asset.checksumSha256 ||
        asset.sizeBytes < 1 ||
        asset.mimeType.toLowerCase() !== reference.mimeType.toLowerCase()
      ) {
        throw new GenerationApplicationError(
          "invalid_generation_reference",
          "A generation reference is not an available asset owned by this project.",
        );
      }
    }
  }

  async function assertOwnedPresenterEligibility(
    userId: string,
    version: OwnedProjectVersion,
  ): Promise<void> {
    try {
      const selected = campaignEligibility.presenterFromConfiguration({
        configuration: version.configuration,
        ...(version.campaignRecipe ? { campaignRecipe: version.campaignRecipe } : {}),
      });
      const footage = selected.mode === "uploaded_spokesperson"
        ? await options.repository.findOwnedPresenterFootageAsset(userId, version.projectId, selected.assetId)
        : null;
      await campaignEligibility.assertProjectPresenter({
        configuration: version.configuration,
        ...(version.campaignRecipe ? { campaignRecipe: version.campaignRecipe } : {}),
        templateVersionId: version.templateVersionId,
        footage,
      });
    } catch (error) {
      if (error instanceof CampaignEligibilityError) {
        throw new GenerationApplicationError(
          "presenter_configuration_ineligible",
          error.message,
        );
      }
      throw error;
    }
  }

  function starterUnavailableMessage(): string {
    return options.starterEligibilityRequiresEmailVerification === false
      ? "Generation is currently limited to accounts with an unused starter render."
      : "Generation is currently limited to verified accounts with an unused starter render.";
  }

  function assertStarterAvailable(waived: boolean, entitlementEligible: boolean): void {
    if (options.starterOnly && !waived && !entitlementEligible) {
      throw new GenerationApplicationError("starter_entitlement_unavailable", starterUnavailableMessage());
    }
  }

  return {
    isAvailable() {
      return options.capabilities
        .listPublic()
        .some((capability) => capability.available && options.pricing.isAvailable(capability.alias));
    },

    async createQuote(request, session) {
      const guestOwner = session?.session.guest === true;
      const developmentFree = options.pricing.mode === "development-free" || guestOwner;
      const accountFree = options.freeAccounts === true && Boolean(session) && !guestOwner;
      const waived = developmentFree || accountFree;
      const pricingVersion = options.pricing.version;
      const quotedAt = now();
      const expiresAt = new Date(quotedAt.getTime() + options.pricing.quoteTtlSeconds * 1_000);

      if (request.projectVersionId) {
        if (!session) throw new GenerationApplicationError("authentication_required");
        const version = await loadOwnedVersion(session.user.id, request.projectVersionId);
        const persistedTemplate = await persistedTemplateContext(options.repository, version);
        // Advanced has its own bounded configuration contract. Template Mode
        // never reaches this fallback, including historical malformed rows.
        const template = persistedTemplate?.template
          ?? await publishedTemplate(options.repository, version.templateVersionId);
        const configuration = persistedTemplate?.configuration ?? generationConfiguration(version.configuration);
        const capability = resolveTemplateCapability({
          template,
          ...(request.capability ? { requestedCapability: request.capability } : {}),
          configuration,
        });
        assertCapability(capability);
        await assertOwnedPresenterEligibility(session.user.id, version);
        await assertOwnedGenerationReferences(session.user.id, version, capability, configuration);
        assertTemplateEligibility({
          template,
          capability,
          configuration,
          root: persistedTemplate?.root ?? version.configuration,
        });
        const price = options.pricing.price(
          capability,
          configuration,
          template?.durationSeconds,
        );
        const entitlementEligible = waived ? false : await eligibleForStarter({
          repository: options.repository,
          session,
          template,
          requireEmailVerification: options.starterEligibilityRequiresEmailVerification !== false,
        });
        assertStarterAvailable(waived, entitlementEligible);
        const binding = boundConfiguration({
          capability,
          pricingVersion,
          templateVersionId: version.templateVersionId,
          configuration,
        });
        try {
          const quote = await options.generation.createQuote({
            userId: session.user.id,
            ...(version.templateVersionId ? { templateVersionId: version.templateVersionId } : {}),
            capabilityAlias: capability,
            credits: accountFree || guestOwner ? 0 : price.credits,
            entitlementEligible,
            breakdown: price.breakdown,
            configuration: binding,
            expiresAt,
            now: quotedAt,
          });
          return {
            quoteId: quote.id,
            capability,
            credits: quote.credits,
            entitlementEligible: quote.entitlementEligible,
            configurationHash: quote.configurationHash,
            pricingVersion,
            expiresAt: quote.expiresAt.toISOString(),
            breakdown: quote.breakdown,
            estimateOnly: false,
          };
        } catch (error) {
          mapDomainError(error);
        }
      }

      const directTemplate = request.templateVersionId
        ? directTemplateCampaign(request.configuration!)
        : null;
      const template = await publishedTemplate(options.repository, request.templateVersionId);
      const configuration = directTemplate?.configuration ?? request.configuration!;
      const capability = resolveTemplateCapability({
        template,
        ...(request.capability ? { requestedCapability: request.capability } : {}),
        configuration,
      });
      assertCapability(capability);
      // Local development may create an estimate before a browser-only image
      // has been claimed into private storage. The authenticated submission
      // path below still requires an owned, checksum-verified reference.
      if (!developmentFree) {
        assertTemplateEligibility({
          template,
          capability,
          configuration,
          root: directTemplate?.root ?? configuration as JsonObject,
        });
      }
      const price = options.pricing.price(
        capability,
        configuration,
        template?.durationSeconds,
      );
      const entitlementEligible = waived ? false : await eligibleForStarter({
        repository: options.repository,
        session,
        template,
        requireEmailVerification: options.starterEligibilityRequiresEmailVerification !== false,
      });
      assertStarterAvailable(waived, entitlementEligible);
      const binding = boundConfiguration({
        capability,
        pricingVersion,
        templateVersionId: request.templateVersionId ?? null,
        configuration,
      });
      return {
        quoteId: null,
        capability,
        credits: accountFree || guestOwner ? 0 : price.credits,
        entitlementEligible,
        configurationHash: hashGenerationConfiguration(binding),
        pricingVersion,
        expiresAt: expiresAt.toISOString(),
        breakdown: price.breakdown,
        estimateOnly: true,
      };
    },

    async startRender(input) {
      const guestOwner = await options.isGuestOwner?.(input.userId) ?? false;
      const developmentFree = options.pricing.mode === "development-free" || guestOwner;
      const accountFree = options.freeAccounts === true && !guestOwner;
      const waived = developmentFree || accountFree;
      const version = await loadOwnedVersion(input.userId, input.projectVersionId);
      if (version.projectId !== input.projectId) {
        throw new GenerationApplicationError("project_version_not_found");
      }
      // Validate the immutable Template Mode payload before even reading a
      // quote. A poisoned historical row must not progress into quote,
      // reservation, or provider-related work.
      const persistedTemplate = await persistedTemplateContext(options.repository, version);
      const template = persistedTemplate?.template
        ?? await publishedTemplate(options.repository, version.templateVersionId);
      if (guestOwner) {
        const brief = objectValue(objectValue(version.configuration.generation)?.creativeBrief);
        if (version.mode !== "template" || !LAUNCH_TEMPLATE_IDS.includes(stringValue(brief?.templateId) as (typeof LAUNCH_TEMPLATE_IDS)[number])) {
          throw new GenerationApplicationError("unapproved_capability", "Guests can generate only published launch templates.");
        }
      }
      const quote = await options.repository.findOwnedQuote(input.userId, input.quoteId);
      if (!quote) throw new GenerationApplicationError("quote_not_found");
      assertStarterAvailable(waived, quote.entitlementEligible);
      const capability = CapabilityAliasSchema.safeParse(quote.capabilityAlias);
      if (!capability.success) throw new GenerationApplicationError("unapproved_capability");
      assertCapability(capability.data);
      const configuration = persistedTemplate?.configuration ?? generationConfiguration(version.configuration);
      await assertOwnedPresenterEligibility(input.userId, version);
      await assertOwnedGenerationReferences(input.userId, version, capability.data, configuration);
      assertTemplateEligibility({
        template,
        capability: capability.data,
        configuration,
        root: persistedTemplate?.root ?? version.configuration,
      });
      const binding = boundConfiguration({
        capability: capability.data,
        pricingVersion: options.pricing.version,
        templateVersionId: version.templateVersionId,
        configuration,
      });
      if (quote.templateVersionId !== version.templateVersionId) {
        throw new GenerationApplicationError("quote_configuration_mismatch");
      }
      if (quote.configurationHash !== hashGenerationConfiguration(binding)) {
        throw new GenerationApplicationError("quote_configuration_mismatch");
      }
      const currentPrice = options.pricing.price(
        capability.data,
        configuration,
        template?.durationSeconds,
      );
      if (quote.credits !== (accountFree || guestOwner ? 0 : currentPrice.credits)) {
        throw new GenerationApplicationError("quote_price_changed");
      }
      try {
        const run = await options.generation.startRender({
          userId: input.userId,
          projectId: input.projectId,
          projectVersionId: input.projectVersionId,
          quoteId: input.quoteId,
          idempotencyKey: input.idempotencyKey,
          capabilityAlias: capability.data,
          configuration: binding,
          now: now(),
        });
        return publicRun({
          ...run,
          providerRequestId: run.providerRequestId,
        });
      } catch (error) {
        mapDomainError(error);
      }
    },

    async getRender(userId, runId) {
      return publicRun(await getOwnedRender(userId, runId));
    },

    async listRenders(userId, projectId, limit) {
      return (await options.repository.listOwnedRuns(userId, projectId, limit)).map(publicRun);
    },

    async retryRenderOutput(userId, runId, idempotencyKey) {
      const run = await getOwnedRender(userId, runId);
      if (run.status === "completed") return publicRun(run);
      const message = run.errorMessage ?? "";
      const recoverableFailure = run.status === "failed" && Boolean(
        run.providerRequestId &&
        !run.outputObjectKey &&
        (
          run.errorCode === "provider_output_host_not_allowed" ||
          run.errorCode === "provider_output_unavailable" ||
          (run.errorCode === "provider_operation_failed" && (
            message.startsWith("provider_output_host_not_allowed:") ||
            message === "fetch failed"
          ))
        ),
      );
      const retryableProcessing = run.status === "processing" && Boolean(run.providerRequestId && !run.outputObjectKey);
      if (!recoverableFailure && !retryableProcessing) {
        throw new GenerationApplicationError(
          "render_output_not_recoverable",
          "This render cannot be recovered from its existing provider operation.",
        );
      }
      const recovered = await options.repository.requestOutputRecovery(
        userId,
        runId,
        idempotencyKey,
        now(),
      );
      if (!recovered) throw new GenerationApplicationError("render_not_found");
      return publicRun(recovered);
    },

    async cancelRender(userId, runId, _idempotencyKey) {
      const run = await getOwnedRender(userId, runId);
      if (run.status === "cancelled" || run.status === "cancelling") return publicRun(run);
      if (run.status === "completed" || run.status === "failed") {
        throw new GenerationApplicationError("render_not_cancellable");
      }
      if (run.status === "submitting") {
        // The worker records the provider identity before issuing the billable
        // start call. Even without a request ID yet, that marker means a
        // provider acceptance may be in flight; releasing the hold here could
        // refund a render that the provider has already accepted.
        if (run.provider || run.providerRequestId || run.chargedAt) {
          throw new GenerationApplicationError(
            "provider_acceptance_in_progress",
            "Provider acceptance is in progress. Refresh the run before trying cancellation again.",
          );
        }
        try {
          await options.generation.releaseRenderReservation({
            userId,
            runId,
            reason: "user_cancelled_before_provider_acceptance",
            terminalStatus: "cancelled",
            now: now(),
          });
          return publicRun(await getOwnedRender(userId, runId));
        } catch (error) {
          mapDomainError(error);
        }
      }

      const cancelling = await options.repository.requestProviderCancellation(userId, runId, now());
      if (cancelling) return publicRun(cancelling);
      const latest = await getOwnedRender(userId, runId);
      if (latest.status === "cancelling" || latest.status === "cancelled") return publicRun(latest);
      throw new GenerationApplicationError(
        "render_not_cancellable",
        "The render cannot be cancelled in its current state.",
      );
    },
  };
}

export function generationDependencyUnavailable(error: unknown): boolean {
  return (
    error instanceof GenerationPricingUnavailableError ||
    error instanceof InvalidGenerationConfigurationError
  );
}
