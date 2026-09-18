import type {
  CreationMode,
  PresenterMode,
  TemplateQuoteEligibility,
} from "@movprompt/contracts";
import type { JsonObject } from "@movprompt/db";

export type OwnedProjectVersion = {
  storageOwnerId?: string;
  id: string;
  projectId: string;
  mode: CreationMode;
  templateVersionId: string | null;
  configuration: JsonObject;
  productRecipe?: JsonObject;
  campaignRecipe?: JsonObject;
};

export type PublishedTemplateVersion = {
  visualRecipe?: { versionNumber: number; promptVersion: string; visualSystem: string; scenes: Array<Record<string, unknown>> };
  id: string;
  durationSeconds: number;
  starterRenderEligible: boolean;
  eligibility: TemplateQuoteEligibility | null;
  supportedLanguages: string[];
  presenterModes: PresenterMode[];
};

export type OwnedPresenterFootageAsset = {
  id: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string | null;
  durationMs: number | null;
};

export type OwnedGenerationQuote = {
  id: string;
  templateVersionId: string | null;
  capabilityAlias: string;
  credits: number;
  entitlementEligible: boolean;
  configurationHash: string;
  expiresAt: Date;
};

export type OwnedReferenceAsset = {
  objectKey: string;
  bucket: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export type OwnedRenderRun = {
  id: string;
  projectId: string;
  projectVersionId: string;
  capabilityAlias: string;
  quoteId: string;
  quotedCredits: number;
  chargedCredits: number;
  starterEntitlementUsed: boolean;
  status: "submitting" | "queued" | "processing" | "completed" | "failed" | "cancelling" | "cancelled";
  processingStage: "preparing" | "rendering" | "securing_output" | "quality_review" | "ready" | "cancelling" | "failed" | "cancelled";
  provider: string | null;
  providerRequestId: string | null;
  outputBucket: string | null;
  outputObjectKey: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  chargedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface GenerationRepository {
  findOwnedProjectVersion(userId: string, projectVersionId: string): Promise<OwnedProjectVersion | null>;
  findOwnedReferenceAssets(userId: string, projectId: string, objectKeys: string[]): Promise<OwnedReferenceAsset[]>;
  findOwnedPresenterFootageAsset(userId: string, projectId: string, assetId: string): Promise<OwnedPresenterFootageAsset | null>;
  findPublishedTemplateVersion(templateVersionId: string): Promise<PublishedTemplateVersion | null>;
  hasAvailableStarterEntitlement(userId: string): Promise<boolean>;
  findOwnedQuote(userId: string, quoteId: string): Promise<OwnedGenerationQuote | null>;
  findOwnedRun(userId: string, runId: string): Promise<OwnedRenderRun | null>;
  listOwnedRuns(userId: string, projectId: string | undefined, limit: number): Promise<OwnedRenderRun[]>;
  requestOutputRecovery(userId: string, runId: string, idempotencyKey: string, now: Date): Promise<OwnedRenderRun | null>;
  requestProviderCancellation(userId: string, runId: string, now: Date): Promise<OwnedRenderRun | null>;
}
