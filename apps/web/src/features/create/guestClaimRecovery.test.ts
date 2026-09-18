import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CreationDraft } from "./contracts";
import {
  createMemoryGuestDraftStorage,
  getGuestDraft,
  loadGuestDraft,
  markClaimCheckpoint,
  getGuestAsset,
  putGuestAsset,
  saveGuestDraft,
  setGuestDraftClockForTests,
  setGuestDraftStorageForTests,
} from "./guestDraftStore";
import {
  recoverFailedGuestClaim,
  getGuestClaimRecoveryCopy,
  persistBeforeVerifiedDraftCleanup,
  selectGuestClaimRecovery,
  verifyAndDeleteVerifiedDraft,
  verifyCanonicalReceipt,
  type CanonicalClaimReceipt,
} from "./guestClaimRecovery";

const DRAFT_ID = "11111111-1111-4111-8111-111111111111";
const INTENT_ID = "22222222-2222-4222-822222222222";
const ASSET_ID = "33333333-3333-4333-8333-333333333333";
const CHECKSUM = "a".repeat(64);

function draft(): CreationDraft {
  return {
    id: DRAFT_ID,
    mode: "template",
    status: "auth_required",
    product: { sourceType: "upload", sourceUrl: "", name: "Coffee", description: "Gift set", price: "12.500", brand: "Northfield", images: [] },
    assetKeys: [],
    campaign: { market: "KW", language: "en", arabicDialect: "kuwaiti", dialectRegister: "conversational", vertical: "ecommerce", goal: "launch", presenterMode: "none", location: "", bookingUrl: "", whatsapp: "", offer: "", cta: "Shop now", brandColor: "#d49737", aspectRatio: "9:16", resolution: "720p", subtitles: true, audio: true },
    pendingGenerationId: INTENT_ID,
    returnPath: "/create",
    createdAt: "2026-08-19T08:00:00.000Z",
    updatedAt: "2026-08-19T08:00:00.000Z",
    expiresAt: "2026-08-26T08:00:00.000Z",
  };
}

const manifest = [{ localAssetId: ASSET_ID, ordinal: 0, kind: "product" as const, mimeType: "image/png", sizeBytes: 12, checksumSha256: CHECKSUM }];
const configuration = { creatorProject: { title: "Coffee", campaign: { market: "KW", language: "en" } } };

function receipt(overrides: Partial<CanonicalClaimReceipt> = {}): CanonicalClaimReceipt {
  return {
    status: "ready",
    draftId: DRAFT_ID,
    pendingGenerationId: INTENT_ID,
    snapshotDigest: "b".repeat(64),
    project: {} as CanonicalClaimReceipt["project"],
    version: { configuration } as unknown as CanonicalClaimReceipt["version"],
    assetManifest: manifest,
    ...overrides,
  };
}

describe("guest claim recovery", () => {
  beforeEach(() => setGuestDraftClockForTests(() => new Date("2026-08-20T08:00:00.000Z")));

  it("verifies the saved JSON receipt when optional browser fields are undefined", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    await saveGuestDraft(draft());
    const browserConfiguration = { ...configuration, optional: undefined, images: [{ id: ASSET_ID, assetKey: undefined }] };
    const checkpoint = await markClaimCheckpoint(DRAFT_ID, { pendingGenerationId: INTENT_ID, snapshotDigest: "b".repeat(64), configuration: browserConfiguration, assetManifest: manifest });
    const transferredConfiguration = JSON.parse(JSON.stringify(browserConfiguration));
    expect(verifyCanonicalReceipt(checkpoint!, receipt({ version: { configuration: transferredConfiguration } as CanonicalClaimReceipt["version"] }))).toMatchObject({ state: "verified" });
  });

  afterEach(() => {
    setGuestDraftStorageForTests();
    setGuestDraftClockForTests();
  });

  it("retains the exact local draft when the canonical receipt has a missing configuration field or checksum mismatch", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    await saveGuestDraft(draft());
    const checkpoint = await markClaimCheckpoint(DRAFT_ID, { pendingGenerationId: INTENT_ID, snapshotDigest: "b".repeat(64), configuration, assetManifest: manifest });

    expect(verifyCanonicalReceipt(checkpoint!, receipt({ version: { configuration: {} } as unknown as CanonicalClaimReceipt["version"] }))).toMatchObject({ state: "configuration_mismatch" });
    expect(await verifyAndDeleteVerifiedDraft(DRAFT_ID, receipt({ assetManifest: [{ ...manifest[0]!, checksumSha256: "c".repeat(64) }] }))).toMatchObject({ state: "asset_mismatch" });
    expect(await getGuestDraft(DRAFT_ID)).toMatchObject({ pendingGenerationId: INTENT_ID });
  });

  it("deletes a matching draft once and treats replay as harmless", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    const localBlobKey = await putGuestAsset(DRAFT_ID, new File(["image bytes"], "coffee.png", { type: "image/png" }));
    await saveGuestDraft({ ...draft(), assetKeys: [localBlobKey] });
    await markClaimCheckpoint(DRAFT_ID, { pendingGenerationId: INTENT_ID, snapshotDigest: "b".repeat(64), configuration, assetManifest: manifest });

    await expect(verifyAndDeleteVerifiedDraft(DRAFT_ID, receipt())).resolves.toMatchObject({ state: "verified" });
    await expect(getGuestAsset(localBlobKey)).resolves.toBeNull();
    await expect(verifyAndDeleteVerifiedDraft(DRAFT_ID, receipt())).resolves.toEqual({ state: "missing" });
  });

  it("keeps a guest link draft and its local asset checkpoint through a mirror failure, then clears it only after retry persistence", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    const localBlobKey = await putGuestAsset(DRAFT_ID, new File(["brand mark"], "mark.png", { type: "image/png" }));
    const linkDraft = {
      ...draft(),
      product: {
        ...draft().product,
        sourceType: "product_link" as const,
        sourceUrl: "https://shop.example.test/coffee",
        images: [{ id: "remote-image", name: "Coffee product", url: "https://cdn.example.test/coffee.jpg", source: "url" as const }],
      },
      assetKeys: [localBlobKey],
    };
    await saveGuestDraft(linkDraft);
    await markClaimCheckpoint(DRAFT_ID, {
      pendingGenerationId: INTENT_ID,
      snapshotDigest: "b".repeat(64),
      configuration,
      assetManifest: [],
    });
    const mirror = vi.fn().mockRejectedValue(new Error("temporary mirror outage"));

    await expect(persistBeforeVerifiedDraftCleanup({
      draftId: DRAFT_ID,
      receipt: receipt({ assetManifest: [] }),
      persist: mirror,
    })).rejects.toThrow("temporary mirror outage");

    const afterFailure = await getGuestDraft(DRAFT_ID);
    const storedAfterFailure = await loadGuestDraft(DRAFT_ID);
    expect(mirror).toHaveBeenCalledTimes(1);
    expect(afterFailure).toMatchObject({
      pendingGenerationId: INTENT_ID,
      product: { sourceUrl: "https://shop.example.test/coffee", images: [{ url: "https://cdn.example.test/coffee.jpg" }] },
    });
    expect(storedAfterFailure).toMatchObject({ draft: { claimCheckpoint: { snapshotDigest: "b".repeat(64) } } });
    await expect(getGuestAsset(localBlobKey)).resolves.toMatchObject({ key: localBlobKey });

    const retry = vi.fn().mockResolvedValue({ versionId: "99999999-9999-4999-8999-999999999999" });
    await expect(persistBeforeVerifiedDraftCleanup({
      draftId: DRAFT_ID,
      receipt: receipt({ assetManifest: [] }),
      persist: retry,
    })).resolves.toEqual({ versionId: "99999999-9999-4999-8999-999999999999" });
    expect(retry).toHaveBeenCalledTimes(1);
    await expect(getGuestDraft(DRAFT_ID)).resolves.toBeNull();
    await expect(getGuestAsset(localBlobKey)).resolves.toBeNull();
  });

  it("reuses one completed source version when IndexedDB cleanup fails after persistence", async () => {
    const base = createMemoryGuestDraftStorage();
    let failCleanupOnce = true;
    const deleteDraftAndAssets = vi.fn(async (id: string) => {
      if (failCleanupOnce) {
        failCleanupOnce = false;
        throw new Error("indexeddb cleanup interrupted");
      }
      await base.deleteDraftAndAssets(id);
    });
    setGuestDraftStorageForTests({ ...base, deleteDraftAndAssets });
    await saveGuestDraft(draft());
    await markClaimCheckpoint(DRAFT_ID, {
      pendingGenerationId: INTENT_ID,
      snapshotDigest: "b".repeat(64),
      configuration,
      assetManifest: manifest,
    });

    const persisted = {
      id: "44444444-4444-4444-8444-444444444444",
      versionId: "55555555-5555-4555-8555-555555555555",
      versionNumber: 2,
      sourceFingerprint: "c".repeat(64),
    };
    let sourceVersions = 0;
    let workingVersionTransitions = 0;
    const sourcePersistence = {
      fromResult: (result: typeof persisted) => ({
        pendingGenerationId: INTENT_ID,
        snapshotDigest: "b".repeat(64),
        projectId: result.id,
        versionId: result.versionId,
        versionNumber: result.versionNumber,
        sourceFingerprint: result.sourceFingerprint,
      }),
      reuse: vi.fn().mockResolvedValue(persisted),
    };
    const persist = vi.fn(async () => {
      sourceVersions += 1;
      workingVersionTransitions += 1;
      return persisted;
    });

    await expect(persistBeforeVerifiedDraftCleanup({
      draftId: DRAFT_ID,
      receipt: receipt(),
      persist,
      sourcePersistence,
    })).rejects.toThrow("indexeddb cleanup interrupted");
    expect(sourceVersions).toBe(1);
    expect(workingVersionTransitions).toBe(1);
    await expect(loadGuestDraft(DRAFT_ID)).resolves.toMatchObject({
      draft: {
        claimCheckpoint: {
          sourcePersistence: {
            projectId: persisted.id,
            versionId: persisted.versionId,
            versionNumber: 2,
          },
        },
      },
    });

    const replayPersist = vi.fn(async () => {
      sourceVersions += 1;
      workingVersionTransitions += 1;
      return persisted;
    });
    await expect(persistBeforeVerifiedDraftCleanup({
      draftId: DRAFT_ID,
      receipt: receipt(),
      persist: replayPersist,
      sourcePersistence,
    })).resolves.toEqual(persisted);

    expect(replayPersist).not.toHaveBeenCalled();
    expect(sourcePersistence.reuse).toHaveBeenCalledWith(expect.objectContaining({
      projectId: persisted.id,
      versionId: persisted.versionId,
    }));
    expect(sourceVersions).toBe(1);
    expect(workingVersionTransitions).toBe(1);
    await expect(getGuestDraft(DRAFT_ID)).resolves.toBeNull();
  });

  it("retains local data and gives the later UI a generic wrong-account recovery state", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    await saveGuestDraft(draft());

    expect(recoverFailedGuestClaim((await getGuestDraft(DRAFT_ID))!, "wrong_account")).toMatchObject({ state: "wrong_account" });
    expect(await getGuestDraft(DRAFT_ID)).toMatchObject({ pendingGenerationId: INTENT_ID });
  });

  it("maps failures to a single explicit recovery action without changing the draft", () => {
    const original = draft();
    const offline = selectGuestClaimRecovery(original, "network_offline");
    const failedAsset = selectGuestClaimRecovery(original, "asset_claim_failed", { localAssetId: ASSET_ID });

    expect(offline).toEqual({ state: "offline", action: "retry", draft: original });
    expect(failedAsset).toEqual({ state: "asset_failed", action: "retry_asset", localAssetId: ASSET_ID, draft: original });
    expect(offline.draft).toBe(original);
    expect(failedAsset.draft).toBe(original);
  });

  it("uses the exact bilingual recovery copy without exposing storage details", () => {
    expect(getGuestClaimRecoveryCopy("en", "asset_failed")).toEqual({
      message: "We couldn’t secure this image. Your campaign is still saved here.",
      primaryAction: "Retry securing image",
      secondaryAction: "Replace image",
    });
    expect(getGuestClaimRecoveryCopy("en", "claim_failed")).toEqual({
      message: "We couldn’t save this campaign to your account. It is still saved in this browser. Try again.",
      primaryAction: "Try again",
      secondaryAction: "Continue editing",
    });
    expect(getGuestClaimRecoveryCopy("ar", "import_failed")).toEqual({
      message: "لم نتمكن من استيراد هذا المصدر. حملتك لم تتغيّر. حاول مرة أخرى أو ارفع صوراً بدلاً من ذلك.",
      primaryAction: "حاول مرة أخرى",
      secondaryAction: "ارفع صوراً بدلاً من ذلك",
    });
  });
});
