import type {
  CreatorProjectRecord,
  GuestClaimAssetManifest,
  GuestClaimSnapshot,
} from "@movprompt/contracts";

export class GuestClaimRepositoryError extends Error {
  constructor(
    readonly code:
      | "conflict"
      | "not_found"
      | "assets_pending"
      | "asset_invalid"
      | "cleanup_leased"
      | "invalid_campaign_configuration",
  ) {
    super(code);
    this.name = "GuestClaimRepositoryError";
  }
}

export type GuestClaimAssetCheckpoint = {
  id: string;
  localAssetId: string;
  ordinal: number;
  status: "pending" | "securing" | "verified" | "failed";
};

export type GuestClaimOperation = {
  id: string;
  projectId: string;
  draftId: string;
  pendingGenerationId: string;
  snapshotDigest: string;
  status: "pending" | "securing" | "ready" | "failed";
  nextAsset: GuestClaimAssetCheckpoint | null;
};

export interface GuestClaimRepository {
  start(input: { userId: string; snapshot: GuestClaimSnapshot }): Promise<GuestClaimOperation>;
  resume(input: { userId: string; pendingGenerationId: string }): Promise<GuestClaimOperation>;
  markAssetVerified(input: {
    userId: string;
    pendingGenerationId: string;
    localAssetId: string;
    bucket: string;
    objectKey: string;
    durationMs?: number;
  }): Promise<GuestClaimOperation>;
  markAssetFailed(input: {
    userId: string;
    pendingGenerationId: string;
    localAssetId: string;
    code: string;
  }): Promise<GuestClaimOperation>;
  finalize(input: {
    userId: string;
    pendingGenerationId: string;
  }): Promise<{
    operation: GuestClaimOperation;
    project: CreatorProjectRecord;
    assetManifest: GuestClaimAssetManifest;
  }>;
}
