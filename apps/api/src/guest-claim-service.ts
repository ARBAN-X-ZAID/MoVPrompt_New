import {
  GuestClaimReceiptSchema,
  GuestClaimSnapshotSchema,
  type GuestClaimReceipt,
  type GuestClaimSnapshot,
} from "@movprompt/contracts";

import {
  GuestClaimRepositoryError,
  type GuestClaimOperation,
  type GuestClaimRepository,
} from "./guest-claim-repository.js";
import { CampaignEligibilityError, type CampaignEligibilityService } from "./campaign-eligibility.js";

export class GuestClaimServiceError extends Error {
  constructor(
    readonly code:
      | "conflict"
      | "assets_pending"
      | "not_found"
      | "presenter_configuration_ineligible"
      | "invalid_campaign_configuration",
    readonly retryable: boolean,
    message: string = code,
  ) {
    super(message);
    this.name = "GuestClaimServiceError";
  }
}

export interface GuestClaimService {
  claimGuestDraft(input: { userId: string; snapshot: GuestClaimSnapshot }): Promise<GuestClaimReceipt>;
  startClaim(input: { userId: string; snapshot: GuestClaimSnapshot }): Promise<GuestClaimOperation>;
  resumeClaim(input: { userId: string; pendingGenerationId: string }): Promise<GuestClaimOperation>;
  markAssetVerified(input: { userId: string; pendingGenerationId: string; localAssetId: string; bucket: string; objectKey: string; durationMs?: number }): Promise<GuestClaimOperation>;
  markAssetFailed(input: { userId: string; pendingGenerationId: string; localAssetId: string; code: string }): Promise<GuestClaimOperation>;
  finalizeClaim(input: { userId: string; pendingGenerationId: string }): Promise<GuestClaimReceipt>;
}

function mapError(error: unknown): never {
  if (error instanceof GuestClaimRepositoryError) {
    if (error.code === "invalid_campaign_configuration") {
      throw new GuestClaimServiceError(
        "invalid_campaign_configuration",
        false,
        "The campaign settings are incomplete, invalid, or inconsistent.",
      );
    }
    if (error.code === "assets_pending") throw new GuestClaimServiceError("assets_pending", true);
    if (error.code === "cleanup_leased") throw new GuestClaimServiceError("assets_pending", true);
    if (error.code === "not_found") throw new GuestClaimServiceError("not_found", false);
    throw new GuestClaimServiceError("conflict", false);
  }
  if (error instanceof CampaignEligibilityError) {
    throw new GuestClaimServiceError("presenter_configuration_ineligible", false, error.message);
  }
  throw error;
}

/**
 * Route parsing is not an authorization boundary: internal callers can invoke
 * this service directly. Re-parse every guest snapshot before presenter
 * eligibility, repository writes, or replay matching can observe it.
 */
function parseGuestClaimSnapshot(snapshot: unknown): GuestClaimSnapshot {
  const parsed = GuestClaimSnapshotSchema.safeParse(snapshot);
  if (parsed.success) return parsed.data;
  throw new GuestClaimServiceError(
    "invalid_campaign_configuration",
    false,
    "The campaign settings are incomplete, invalid, or inconsistent.",
  );
}

export function createGuestClaimService(dependencies: {
  repository: GuestClaimRepository;
  campaignEligibility?: CampaignEligibilityService;
}): GuestClaimService {
  const { repository, campaignEligibility } = dependencies;
  async function assertEligibility(snapshot: GuestClaimSnapshot): Promise<void> {
    await campaignEligibility?.assertGuestClaim({ snapshot });
  }
  return {
    async startClaim(input) {
      try {
        const snapshot = parseGuestClaimSnapshot(input.snapshot);
        await assertEligibility(snapshot);
        return await repository.start({ userId: input.userId, snapshot });
      } catch (error) {
        return mapError(error);
      }
    },

    async resumeClaim(input) {
      try {
        return await repository.resume(input);
      } catch (error) {
        return mapError(error);
      }
    },

    async markAssetVerified(input) {
      try {
        return await repository.markAssetVerified(input);
      } catch (error) {
        return mapError(error);
      }
    },

    async markAssetFailed(input) {
      try {
        return await repository.markAssetFailed(input);
      } catch (error) {
        return mapError(error);
      }
    },

    async finalizeClaim(input) {
      try {
        const { operation, project, assetManifest } = await repository.finalize(input);
        const version = project.currentVersion;
        if (!version) throw new Error("guest_claim_version_missing");
        return GuestClaimReceiptSchema.parse({
          status: operation.status,
          draftId: operation.draftId,
          pendingGenerationId: operation.pendingGenerationId,
          snapshotDigest: operation.snapshotDigest,
          assetManifest,
          project,
          version,
        });
      } catch (error) {
        return mapError(error);
      }
    },

    async claimGuestDraft({ userId, snapshot }) {
      try {
        const parsedSnapshot = parseGuestClaimSnapshot(snapshot);
        await assertEligibility(parsedSnapshot);
        await repository.start({ userId, snapshot: parsedSnapshot });
        return await this.finalizeClaim({ userId, pendingGenerationId: parsedSnapshot.pendingGenerationId });
      } catch (error) {
        return mapError(error);
      }
    },
  };
}
