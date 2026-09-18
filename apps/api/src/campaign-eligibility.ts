import {
  CampaignPresenterSchema,
  type CampaignPresenter,
  type GuestClaimSnapshot,
} from "@movprompt/contracts";
import type { JsonObject } from "@movprompt/db";

import type { OwnedPresenterFootageAsset } from "./generation-repository.js";

export const PRESENTER_RENDERING_UNAVAILABLE_MESSAGE = "Selected presenters are not available for rendering yet. Choose No presenter to continue.";
const PRESENTER_CONFIGURATION_INVALID_MESSAGE = "The selected presenter setup is invalid. Choose No presenter to continue.";

export class CampaignEligibilityError extends Error {
  constructor(message = "presenter_configuration_ineligible") {
    super(message);
    this.name = "CampaignEligibilityError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function campaignValue(configuration: JsonObject, campaignRecipe?: JsonObject): unknown {
  const creatorProject = record(configuration.creatorProject);
  const generation = record(configuration.generation);
  const quoteContext = record(generation?.templateQuoteContext);
  return creatorProject?.presenter
    ?? quoteContext?.presenter
    ?? campaignRecipe?.presenter
    ?? creatorProject?.presenterMode
    ?? quoteContext?.presenterMode
    ?? campaignRecipe?.presenterMode
    ?? "none";
}

function presenter(configuration: JsonObject, campaignRecipe?: JsonObject): CampaignPresenter {
  const value = campaignValue(configuration, campaignRecipe);
  const candidate = typeof value === "string" ? { mode: value } : value;
  const parsed = CampaignPresenterSchema.safeParse(candidate);
  if (!parsed.success) throw new CampaignEligibilityError(PRESENTER_CONFIGURATION_INVALID_MESSAGE);
  return parsed.data;
}

export type CampaignEligibilityService = {
  assertGuestClaim(input: { snapshot: GuestClaimSnapshot }): Promise<void>;
  assertProjectPresenter(input: {
    configuration: JsonObject;
    campaignRecipe?: JsonObject;
    templateVersionId: string | null;
    footage?: OwnedPresenterFootageAsset | null;
  }): Promise<void>;
  presenterFromConfiguration(input: { configuration: JsonObject; campaignRecipe?: JsonObject }): CampaignPresenter;
};

/**
 * The current Seedance adapters accept only prompt, image references and
 * video settings. They have no contract for an AI cast or a footage-driven
 * spokesperson, so non-none presenter modes must fail before a quote, claim
 * or reservation can create a paid operation. Adding a public capability flag
 * alone is deliberately insufficient to re-enable this pathway.
 */
export function createCampaignEligibilityService(): CampaignEligibilityService {
  async function assertPresenter(input: {
    configuration: JsonObject;
    campaignRecipe?: JsonObject;
    templateVersionId: string | null;
    footage?: OwnedPresenterFootageAsset | null;
  }): Promise<void> {
    const selected = presenter(input.configuration, input.campaignRecipe);
    if (selected.mode === "none") return;
    throw new CampaignEligibilityError(PRESENTER_RENDERING_UNAVAILABLE_MESSAGE);
  }

  return {
    assertGuestClaim: async ({ snapshot }) => {
      const selected = presenter(snapshot.configuration, snapshot.campaignRecipe);
      if (selected.mode === "none") return;
      if (selected.mode !== "uploaded_spokesperson") {
        await assertPresenter({
          configuration: snapshot.configuration,
          campaignRecipe: snapshot.campaignRecipe,
          templateVersionId: snapshot.templateVersionId ?? null,
        });
        return;
      }
      const asset = snapshot.assetManifest.find((entry) => entry.localAssetId === selected.assetId);
      const footage = asset && asset.kind === "footage"
        ? {
            id: asset.localAssetId,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            checksumSha256: asset.checksumSha256,
            durationMs: asset.durationMs ?? null,
          }
        : null;
      await assertPresenter({
        configuration: snapshot.configuration,
        campaignRecipe: snapshot.campaignRecipe,
        templateVersionId: snapshot.templateVersionId ?? null,
        footage,
      });
    },
    assertProjectPresenter: assertPresenter,
    presenterFromConfiguration: ({ configuration, campaignRecipe }) => presenter(configuration, campaignRecipe),
  };
}
