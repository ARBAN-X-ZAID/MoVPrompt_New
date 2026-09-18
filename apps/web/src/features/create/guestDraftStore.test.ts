import { afterEach, describe, expect, it } from "vitest";

import type { CreationDraft } from "./contracts";
import {
  createMemoryGuestDraftStorage,
  getGuestAsset,
  getGuestDraft,
  loadGuestDraft,
  putGuestAsset,
  saveGuestDraft,
  setGuestDraftClockForTests,
  setGuestDraftStorageForTests,
} from "./guestDraftStore";
import { loadGuestClaimRecovery } from "./guestClaimRecovery";

const CREATED_AT = "2026-08-19T08:00:00.000Z";
const EXPIRES_AT = "2026-08-26T08:00:00.000Z";

function createDraft(overrides: Partial<CreationDraft> = {}): CreationDraft {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    mode: "template",
    status: "editing",
    templateVersionId: "22222222-2222-4222-8222-222222222222",
    product: {
      sourceType: "upload",
      sourceUrl: "",
      name: "Kuwait coffee set",
      description: "A complete gift set",
      price: "12.500",
      brand: "Northfield",
      images: [{
        id: "33333333-3333-4333-8333-333333333333",
        name: "coffee.png",
        url: "blob:local-preview",
        assetKey: "",
        source: "upload",
      }],
    },
    assetKeys: [],
    campaign: {
      market: "KW",
      language: "bilingual",
      arabicDialect: "kuwaiti",
      dialectRegister: "conversational",
      vertical: "ecommerce",
      goal: "whatsapp_orders",
      presenterMode: "none",
      location: "",
      bookingUrl: "",
      whatsapp: "+96550000000",
      offer: "Free delivery",
      cta: "Order on WhatsApp",
      brandColor: "#d49737",
      aspectRatio: "9:16",
      resolution: "720p",
      subtitles: true,
      audio: true,
    },
    advanced: { prompt: "Keep the product facts exact.", references: ["reference-key"] },
    rightsAttestation: { confirmed: true, confirmedAt: CREATED_AT, version: "2026-08-11" },
    returnPath: "/create?draft=11111111-1111-4111-8111-111111111111",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    expiresAt: EXPIRES_AT,
    ...overrides,
  };
}

describe("guest draft storage", () => {
  afterEach(() => {
    setGuestDraftStorageForTests();
    setGuestDraftClockForTests();
  });

  it("restores every local campaign field, blob key and stable Generate intent without renewing expiry", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    setGuestDraftClockForTests(() => new Date("2026-08-20T08:00:00.000Z"));
    const draft = createDraft();
    const assetKey = await putGuestAsset(draft.id, new File(["image bytes"], "coffee.png", { type: "image/png" }));
    const saved = await saveGuestDraft({
      ...draft,
      assetKeys: [assetKey],
      product: { ...draft.product, images: [{ ...draft.product.images[0]!, assetKey }] },
    });

    const resumed = await getGuestDraft(draft.id);
    expect(resumed).toEqual(saved);
    expect(await getGuestAsset(assetKey)).toMatchObject({ draftId: draft.id, name: "coffee.png", mimeType: "image/png" });

    const intent = "44444444-4444-4444-8444-444444444444";
    await saveGuestDraft({ ...resumed!, status: "auth_required", pendingGenerationId: intent, updatedAt: "2026-08-20T09:00:00.000Z" });
    const afterCancel = await getGuestDraft(draft.id);
    expect(afterCancel).toMatchObject({ pendingGenerationId: intent, expiresAt: EXPIRES_AT, assetKeys: [assetKey] });

    await expect(loadGuestClaimRecovery(draft.id)).resolves.toMatchObject({ state: "recoverable", draft: afterCancel });
  });

  it("keeps the complete JSON/blob set at day six and expires both together at the seven-day boundary", async () => {
    setGuestDraftStorageForTests(createMemoryGuestDraftStorage());
    const draft = createDraft();
    setGuestDraftClockForTests(() => new Date("2026-08-25T07:59:59.999Z"));
    const assetKey = await putGuestAsset(draft.id, new File(["image bytes"], "coffee.png", { type: "image/png" }));
    await saveGuestDraft({ ...draft, assetKeys: [assetKey] });

    expect(await loadGuestDraft(draft.id)).toMatchObject({ state: "available" });
    expect(await getGuestAsset(assetKey)).not.toBeNull();

    setGuestDraftClockForTests(() => new Date(EXPIRES_AT));
    await expect(loadGuestDraft(draft.id)).resolves.toEqual({ state: "expired" });
    await expect(getGuestAsset(assetKey)).resolves.toBeNull();
  });
});
