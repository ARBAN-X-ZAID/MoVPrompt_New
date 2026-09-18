export interface CreateGenerationQuoteInput {
  userId?: string;
  templateVersionId?: string;
  capabilityAlias: string;
  credits: number;
  entitlementEligible: boolean;
  breakdown: Array<{ label: string; credits: number }>;
  configuration: unknown;
  expiresAt: Date;
  now?: Date;
}

export interface StartRenderInput {
  userId: string;
  projectId: string;
  projectVersionId: string;
  quoteId: string;
  idempotencyKey: string;
  capabilityAlias: string;
  configuration: unknown;
  now?: Date;
}

export interface FinalizeChargeInput {
  userId: string;
  runId: string;
  provider: string;
  providerRequestId: string;
  now?: Date;
}

export interface RecordProviderSubmissionInput {
  userId: string;
  runId: string;
  provider: string;
  providerRequestId: string;
  now?: Date;
}

export interface RefundRenderInput {
  userId: string;
  runId: string;
  reason: string;
  now?: Date;
}

export interface ReleaseRenderReservationInput {
  userId: string;
  runId: string;
  reason: string;
  terminalStatus?: "failed" | "cancelled";
  now?: Date;
}

export type GenerationQuoteRecord = {
  id: string;
  userId: string | null;
  templateVersionId: string | null;
  capabilityAlias: string;
  credits: number;
  entitlementEligible: boolean;
  breakdown: Array<{ label: string; credits: number }>;
  configurationHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type RenderRunRecord = {
  id: string;
  projectId: string;
  projectVersionId: string;
  userId: string;
  idempotencyKey: string;
  capabilityAlias: string;
  quoteId: string;
  quotedCredits: number;
  chargedCredits: number;
  starterEntitlementUsed: boolean;
  status: "submitting" | "queued" | "processing" | "completed" | "failed" | "cancelling" | "cancelled";
  processingStage: "preparing" | "rendering" | "securing_output" | "quality_review" | "ready" | "cancelling" | "failed" | "cancelled";
  refundStatus: string;
  qualityAttempt: number;
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

export interface GenerationService {
  createQuote(input: CreateGenerationQuoteInput): Promise<GenerationQuoteRecord>;
  startRender(input: StartRenderInput): Promise<RenderRunRecord>;
  recordProviderSubmission(input: RecordProviderSubmissionInput): Promise<RenderRunRecord>;
  finalizeProviderAccepted(input: FinalizeChargeInput): Promise<RenderRunRecord>;
  releaseRenderReservation(input: ReleaseRenderReservationInput): Promise<RenderRunRecord>;
  refundRender(input: RefundRenderInput): Promise<RenderRunRecord>;
}
