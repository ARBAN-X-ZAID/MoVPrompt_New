import { describe, expect, it } from "vitest";

import { buildGuestClaimSnapshot } from "./guestClaimSnapshot";

describe("guest claim snapshot", () => {
  it("returns exactly the JSON payload used by the server and recovery checkpoint", async () => {
    const snapshot = await buildGuestClaimSnapshot({
      draftId: "11111111-1111-4111-8111-111111111111",
      pendingGenerationId: "22222222-2222-4222-8222-222222222222",
      assetManifest: [], title: "Uploaded image", mode: "advanced",
      configuration: { images: [{ id: "33333333-3333-4333-8333-333333333333", assetKey: undefined }] }, productRecipe: {}, campaignRecipe: {},
    });
    expect(snapshot).toStrictEqual(JSON.parse(JSON.stringify(snapshot)));
  });
  it("creates a stable digest and an ordered asset manifest for the authenticated claim", async () => {
    const base = {
      draftId: "11111111-1111-4111-8111-111111111111",
      pendingGenerationId: "22222222-2222-4222-8222-222222222222",
      assetManifest: [
        { localAssetId: "44444444-4444-4444-8444-444444444444", ordinal: 1, kind: "product" as const, mimeType: "image/png", sizeBytes: 4, checksumSha256: "b".repeat(64) },
        { localAssetId: "33333333-3333-4333-8333-333333333333", ordinal: 0, kind: "product" as const, mimeType: "image/jpeg", sizeBytes: 4, checksumSha256: "a".repeat(64) },
      ],
      title: "Coffee campaign",
      mode: "template" as const,
      templateVersionId: "55555555-5555-4555-8555-555555555555",
      configuration: { creatorProject: { title: "Coffee campaign" } },
      productRecipe: { name: "Coffee" },
      campaignRecipe: { market: "KW", language: "en" },
    };

    const [first, reordered] = await Promise.all([
      buildGuestClaimSnapshot(base),
      buildGuestClaimSnapshot({ ...base, assetManifest: [...base.assetManifest].reverse() }),
    ]);

    expect(first.assetManifest.map((asset) => asset.ordinal)).toEqual([0, 1]);
    expect(reordered.assetManifest.map((asset) => asset.ordinal)).toEqual([0, 1]);
    expect(first.snapshotDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered.snapshotDigest).toBe(first.snapshotDigest);
  });
});
