import { randomUUID } from "node:crypto";

import type { GuestClaimSnapshot } from "@movprompt/contracts";
import { describe, expect, it, vi } from "vitest";

import type { CampaignEligibilityService } from "./campaign-eligibility.js";
import type { GuestClaimRepository } from "./guest-claim-repository.js";
import { createGuestClaimService } from "./guest-claim-service.js";
import { validTemplateClaim } from "./campaign-contract.test-fixture.js";

function templateSnapshot(): GuestClaimSnapshot {
  const claim = validTemplateClaim({ draftId: randomUUID() });
  return {
    ...claim,
    pendingGenerationId: randomUUID(),
    snapshotDigest: "a".repeat(64),
    assetManifest: [],
  };
}

function repository(): GuestClaimRepository {
  return {
    start: vi.fn(async ({ snapshot }) => ({
      id: randomUUID(),
      projectId: randomUUID(),
      draftId: snapshot.draftId,
      pendingGenerationId: snapshot.pendingGenerationId,
      snapshotDigest: snapshot.snapshotDigest,
      status: "pending" as const,
      nextAsset: null,
    })),
    resume: vi.fn(),
    markAssetVerified: vi.fn(),
    markAssetFailed: vi.fn(),
    finalize: vi.fn(),
  };
}

function eligibility(): CampaignEligibilityService {
  return {
    assertGuestClaim: vi.fn(async () => undefined),
    assertProjectPresenter: vi.fn(async () => undefined),
    presenterFromConfiguration: vi.fn(() => ({ mode: "none" })),
  };
}

describe("guest claim strict service boundary", () => {
  it("rejects malformed Template Mode snapshots before repository, quote, reservation, or provider-adjacent work", async () => {
    const userId = randomUUID();
    const snapshots = [
      (() => {
        const { templateVersionId: _templateVersionId, ...missingTemplateVersion } = templateSnapshot();
        return missingTemplateVersion;
      })(),
      (() => {
        const snapshot = templateSnapshot();
        return {
          ...snapshot,
          campaignRecipe: { ...snapshot.campaignRecipe, hiddenProviderModel: "unapproved-provider-model" },
        };
      })(),
      (() => {
        const snapshot = templateSnapshot();
        return {
          ...snapshot,
          campaignRecipe: { ...snapshot.campaignRecipe, offer: "x".repeat(401) },
        };
      })(),
    ];

    for (const malformed of snapshots) {
      const repo = repository();
      const campaignEligibility = eligibility();
      const service = createGuestClaimService({ repository: repo, campaignEligibility });

      await expect(service.startClaim({ userId, snapshot: malformed as GuestClaimSnapshot })).rejects.toMatchObject({
        code: "invalid_campaign_configuration",
        retryable: false,
      });
      expect(repo.start).not.toHaveBeenCalled();
      expect(repo.finalize).not.toHaveBeenCalled();
      expect(campaignEligibility.assertGuestClaim).not.toHaveBeenCalled();

      await expect(service.claimGuestDraft({ userId, snapshot: malformed as GuestClaimSnapshot })).rejects.toMatchObject({
        code: "invalid_campaign_configuration",
        retryable: false,
      });
      expect(repo.start).not.toHaveBeenCalled();
      expect(repo.finalize).not.toHaveBeenCalled();
      expect(campaignEligibility.assertGuestClaim).not.toHaveBeenCalled();
    }
  });

  it("passes a complete Template Mode snapshot through unchanged for replay-safe claim handling", async () => {
    const userId = randomUUID();
    const snapshot = templateSnapshot();
    const repo = repository();
    const service = createGuestClaimService({ repository: repo });

    await expect(service.startClaim({ userId, snapshot })).resolves.toMatchObject({
      draftId: snapshot.draftId,
      pendingGenerationId: snapshot.pendingGenerationId,
    });
    expect(repo.start).toHaveBeenCalledWith({ userId, snapshot });
  });
});
