import { CampaignPresenterSchema, type CreatorProjectRecord } from "@movprompt/contracts";

import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { sanitizeCreatorProjectOutput } from "./creatorProjectOutput";
import { campaignFactValue, campaignSourceForProject, projectWithCampaignSource } from "./sourceFacts";
import { getCreatorTemplate } from "./templates";
import { normalizeCreatorResolution, type CreatorProject } from "./types";

function isDurableCreatorObjectKey(value: string): boolean {
  // Guest draft IDs share the CampaignSource assetKeys shape, but only a
  // private storage namespace may cross the cloud persistence boundary.
  return value.startsWith("creator-assets/") || value.startsWith("users/");
}

function persistedProductSourceType(source: ReturnType<typeof campaignSourceForProject>): CreatorProject["product"]["sourceType"] {
  if (source.kind === "product_url") return "product_link";
  if (source.kind === "business_url") return "business_link";
  if (source.kind === "product_upload" || source.kind === "real_footage") return "upload";
  return "sample";
}

function recoveredProjectStatus(input: CreatorProjectRecord): CreatorProject["status"] {
  if (input.status === "trashed") return "draft";
  if (input.latestRenderProjectVersionId !== input.currentWorkingVersionId) return input.status;
  if (["submitting", "queued", "processing", "cancelling"].includes(input.latestRenderRunStatus ?? "")) {
    return "generating";
  }
  if (input.latestRenderRunStatus === "completed") return "completed";
  if (input.latestRenderRunStatus === "failed" || input.latestRenderRunStatus === "cancelled") return "failed";
  return input.status;
}

export function stableProjectConfiguration(project: CreatorProject): CreatorProject {
  const source = campaignSourceForProject(project);
  const durableSourceAssetKeys = new Set([
    ...source.assetKeys.filter(isDurableCreatorObjectKey),
    ...project.product.images.flatMap((image) => image.storagePath ? [image.storagePath] : []),
  ]);
  const persistedSource = {
    ...source,
    // A cloud configuration may only contain verified private object keys.
    // Guest-local IndexedDB IDs are claim transport metadata, not durable facts.
    assetKeys: [...durableSourceAssetKeys],
  };
  const sourceName = campaignFactValue(source, source.subject === "service" ? "service_name" : "name");
  // Source facts are the canonical business truth once a project has a
  // source. The legacy display fields are rewritten only in the persisted
  // snapshot so a stale form field can never silently override it downstream.
  const sourceFirstProject: CreatorProject = {
    ...project,
    location: campaignFactValue(source, "location"),
    bookingUrl: campaignFactValue(source, "booking_url"),
    whatsapp: campaignFactValue(source, "whatsapp"),
    offer: campaignFactValue(source, "offer"),
    product: {
      ...project.product,
      name: sourceName,
      description: campaignFactValue(source, "description"),
      price: campaignFactValue(source, "price"),
      brand: campaignFactValue(source, "brand"),
    },
  };
  // Ownership/output flags come from the API; they are not editable recipe fields.
  const { versionId: _versionId, versionNumber: _versionNumber, hasGeneratedVideo: _hasGeneratedVideo, hasActiveGeneration: _hasActiveGeneration, presenter: persistedPresenter, ...stableProject } = projectWithCampaignSource({
    ...sourceFirstProject,
    source: persistedSource,
  });
  return {
    ...stableProject,
    // The persisted contract defaults an absent presenter to presenterMode.
    // Hydration adding {mode:"none"} must not produce a new immutable version.
    ...(project.presenterMode === "none" ? {} : { presenter: persistedPresenter }),
    status: "ready",
    logoUrl: "",
    product: {
      ...sourceFirstProject.product,
      sourceType: persistedProductSourceType(source),
      sourceUrl: "",
      images: project.product.images.map((image) => ({
        ...image,
        url: "",
        assetKey: undefined,
      })),
    },
    videoUrl: null,
    jobId: null,
    renderRunId: null,
    lastError: null,
    pendingGenerationId: null,
    pendingQuoteCredits: null,
    updatedAt: project.createdAt,
  };
}

export function projectFromCloud(input: CreatorProjectRecord): CreatorProject | null {
  const configured = input.currentVersion?.configuration.creatorProject;
  if (!configured || typeof configured !== "object" || Array.isArray(configured)) return null;
  const candidate = configured as unknown as CreatorProject;
  if (!candidate.product || !Array.isArray(candidate.scenes)) return null;
  const currentRenderRunId = input.latestRenderProjectVersionId === input.currentWorkingVersionId
    ? input.latestRenderRunId
    : null;
  const presenter = CampaignPresenterSchema.safeParse(candidate.presenter).success
    ? CampaignPresenterSchema.parse(candidate.presenter)
    : candidate.presenterMode === "ai_ugc" ? { mode: "ai_ugc" as const } : { mode: "none" as const };
  return sanitizeCreatorProjectOutput(projectWithCampaignSource({
    ...candidate,
    id: input.id,
    versionId: input.currentVersion?.id,
    versionNumber: input.currentVersion?.versionNumber,
    title: input.title,
    hasGeneratedVideo: Boolean(input.hasGeneratedVideo || input.currentAcceptedVersionId || input.outputCount > 0),
    hasActiveGeneration: input.hasActiveGeneration === true,
    status: recoveredProjectStatus(input),
    renderRunId: currentRenderRunId,
    jobId: currentRenderRunId,
    resolution: normalizeCreatorResolution((candidate as CreatorProject & { resolution?: unknown }).resolution),
    durationSeconds: getCreatorTemplate(candidate.templateId).duration,
    promotionKind: candidate.promotionKind ?? "product",
    vertical: candidate.vertical ?? "ecommerce",
    goal: candidate.goal ?? "launch",
    presenterMode: presenter.mode,
    presenter,
    arabicDialect: "kuwaiti",
    dialectRegister: candidate.dialectRegister ?? "conversational",
    location: candidate.location ?? "",
    bookingUrl: candidate.bookingUrl ?? "",
    whatsapp: candidate.whatsapp ?? "",
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }));
}

export async function hydrateCloudProject(input: CreatorProjectRecord): Promise<CreatorProject | null> {
  const project = projectFromCloud(input);
  if (!project) return null;
  const images = await Promise.all(project.product.images.map(async (image) => {
    if (!image.storagePath || !image.id) return image;
    try {
      return { ...image, url: await portableCreatorApi.assetDownload(project.id, image.id) };
    } catch {
      return image;
    }
  }));
  return { ...project, product: { ...project.product, images } };
}
