import type { GuestClaimAssetManifest, GuestClaimReceipt } from "@movprompt/contracts";
import { ar } from "@/i18n/translations/ar";
import { en } from "@/i18n/translations/en";

import {
  deleteVerifiedGuestDraft,
  loadGuestDraft,
  markGuestDraftCleanupEligible,
  markGuestDraftSourcePersistence,
  type GuestClaimCheckpoint,
  type GuestSourcePersistence,
  type StoredGuestDraft,
} from "./guestDraftStore";
import type { CreationDraft } from "./contracts";

export type GuestClaimRecoveryState =
  | { state: "missing" | "expired" }
  | { state: "recoverable"; draft: StoredGuestDraft }
  | { state: "verified"; draft: StoredGuestDraft }
  | { state: "receipt_mismatch" | "configuration_mismatch" | "asset_mismatch" | "wrong_account"; draft: StoredGuestDraft };

export type CanonicalClaimReceipt = GuestClaimReceipt & {
  /** The authenticated claim boundary must return the server-confirmed manifest, never inferred from URLs. */
  assetManifest?: GuestClaimAssetManifest;
};

export type GuestClaimFailureReason = "claim_failed" | "offline" | "checksum_mismatch" | "configuration_mismatch" | "wrong_account";

export type GuestClaimRecoveryCode = "asset_claim_failed" | "import_failed" | "network_offline" | "session_mismatch" | "claim_failed";

export type GuestClaimRecoveryAction = "retry" | "retry_asset" | "replace_source" | "continue_editing" | "sign_out";

export type TypedGuestClaimRecovery = {
  state: "claim_failed" | "asset_failed" | "import_failed" | "offline" | "session_mismatch";
  action: GuestClaimRecoveryAction;
  draft: CreationDraft;
  localAssetId?: string;
};

export function getGuestClaimRecoveryCopy(
  locale: "en" | "ar",
  state: TypedGuestClaimRecovery["state"],
): { message: string; primaryAction: string; secondaryAction: string } {
  const translation = locale === "ar" ? ar : en;
  if (state === "asset_failed") {
    return {
      message: translation["creator.recovery.claimFailed"],
      primaryAction: translation["creator.recovery.retryAsset"],
      secondaryAction: translation["creator.recovery.replaceImage"],
    };
  }
  if (state === "claim_failed") {
    return {
      message: translation["creator.recovery.projectClaimFailed"],
      primaryAction: translation["creator.recovery.retry"],
      secondaryAction: translation["creator.recovery.continueEditing"],
    };
  }
  if (state === "import_failed") {
    return {
      message: translation["creator.recovery.importFailed"],
      primaryAction: translation["creator.recovery.retry"],
      secondaryAction: translation["creator.recovery.uploadInstead"],
    };
  }
  if (state === "offline") {
    return {
      message: translation["creator.recovery.offline"],
      primaryAction: translation["creator.recovery.retry"],
      secondaryAction: translation["creator.recovery.continueEditing"],
    };
  }
  return {
    message: translation["creator.recovery.sessionMismatch"],
    primaryAction: translation["creator.recovery.continueEditing"],
    secondaryAction: translation["creator.recovery.signOut"],
  };
}

/** Failure selection is pure: the caller retains every fact, local blob, and pending intent. */
export function selectGuestClaimRecovery(
  draft: CreationDraft,
  code: GuestClaimRecoveryCode,
  details: { localAssetId?: string } = {},
): TypedGuestClaimRecovery {
  if (code === "network_offline") return { state: "offline", action: "retry", draft };
  if (code === "session_mismatch") return { state: "session_mismatch", action: "continue_editing", draft };
  if (code === "import_failed") return { state: "import_failed", action: "replace_source", draft };
  if (code === "asset_claim_failed" && details.localAssetId) {
    return { state: "asset_failed", action: "retry_asset", localAssetId: details.localAssetId, draft };
  }
  return { state: "claim_failed", action: "retry", draft };
}

export function recoverFailedGuestClaim(draft: CreationDraft, reason: GuestClaimFailureReason): { state: GuestClaimFailureReason; draft: CreationDraft } {
  return { state: reason, draft };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  // Also accept checkpoints retained before JSON normalization was added.
  return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}

function sameManifest(expected: GuestClaimAssetManifest, actual: GuestClaimAssetManifest | undefined) {
  return Boolean(actual) && canonical(expected) === canonical(actual);
}

export async function loadGuestClaimRecovery(draftId: string): Promise<GuestClaimRecoveryState> {
  const loaded = await loadGuestDraft(draftId);
  if (!("draft" in loaded)) return loaded;
  return { state: "recoverable", draft: loaded.draft };
}

/** A receipt without exact configuration and ordered server digests cannot clear browser data. */
export function verifyCanonicalReceipt(draft: StoredGuestDraft, receipt: CanonicalClaimReceipt): GuestClaimRecoveryState {
  const checkpoint: GuestClaimCheckpoint | undefined = draft.claimCheckpoint;
  if (!checkpoint || receipt.status !== "ready" || receipt.draftId !== draft.id || receipt.pendingGenerationId !== draft.pendingGenerationId || receipt.snapshotDigest !== checkpoint.snapshotDigest) {
    return { state: "receipt_mismatch", draft };
  }
  if (canonical(checkpoint.configuration) !== canonical(receipt.version.configuration)) {
    return { state: "configuration_mismatch", draft };
  }
  if (!sameManifest(checkpoint.assetManifest, receipt.assetManifest)) {
    return { state: "asset_mismatch", draft };
  }
  return { state: "verified", draft };
}

export async function verifyAndDeleteVerifiedDraft(draftId: string, receipt: CanonicalClaimReceipt): Promise<GuestClaimRecoveryState> {
  const recovery = await loadGuestClaimRecovery(draftId);
  if (recovery.state !== "recoverable") return recovery;
  const verified = verifyCanonicalReceipt(recovery.draft, receipt);
  if (verified.state !== "verified") return verified;
  if (!await markGuestDraftCleanupEligible(draftId, receipt.pendingGenerationId)) return { state: "receipt_mismatch", draft: recovery.draft };
  await deleteVerifiedGuestDraft(draftId, receipt.pendingGenerationId);
  return verified;
}

/**
 * A canonical claim receipt proves the original browser snapshot, not later
 * remote-image mirroring. Link imports therefore retain IndexedDB until the
 * mirrored object keys are saved in their own immutable project version.
 */
export async function persistBeforeVerifiedDraftCleanup<T>(input: {
  draftId: string;
  receipt: CanonicalClaimReceipt;
  persist: () => Promise<T>;
  sourcePersistence?: {
    fromResult: (result: T) => Omit<GuestSourcePersistence, "completedAt">;
    reuse: (completion: GuestSourcePersistence) => Promise<T>;
  };
}): Promise<T> {
  const recovery = await loadGuestClaimRecovery(input.draftId);
  if (recovery.state !== "recoverable") {
    throw new Error("The local campaign is no longer available for secure recovery.");
  }
  const verified = verifyCanonicalReceipt(recovery.draft, input.receipt);
  if (verified.state !== "verified") {
    throw new Error("MovPrompt could not verify the saved campaign. Your local draft is unchanged.");
  }

  const completedSource = recovery.draft.claimCheckpoint?.sourcePersistence;
  let result: T;
  if (input.sourcePersistence && completedSource) {
    const matchesClaim = completedSource.pendingGenerationId === input.receipt.pendingGenerationId
      && completedSource.snapshotDigest === input.receipt.snapshotDigest;
    if (!matchesClaim) {
      throw new Error("MovPrompt could not verify the saved campaign. Your local draft is unchanged.");
    }
    // The immutable source version already exists. A retry after local cleanup
    // failed must resolve that exact version, not invoke source replacement
    // against the now-advanced working version.
    result = await input.sourcePersistence.reuse(completedSource);
  } else {
    // Deliberately await persistence before the only destructive step. A retry
    // can safely replay a completed server claim, while the original link and
    // local checkpoint remain available if mirroring or version creation fails.
    result = await input.persist();
    if (input.sourcePersistence) {
      const marked = await markGuestDraftSourcePersistence(
        input.draftId,
        input.sourcePersistence.fromResult(result),
      );
      if (!marked) {
        throw new Error("MovPrompt could not record the saved campaign. Your local draft is unchanged.");
      }
    }
  }
  const cleaned = await verifyAndDeleteVerifiedDraft(input.draftId, input.receipt);
  if (cleaned.state !== "verified") {
    throw new Error("MovPrompt could not verify the saved campaign. Your local draft is unchanged.");
  }
  return result;
}
