import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreatorProject } from "./types";

const mocks = vi.hoisted(() => ({
  mirrorProductImages: vi.fn(),
  syncCreatorProject: vi.fn(),
  replaceCreatorProjectSource: vi.fn(),
}));

vi.mock("./creatorAssets", () => ({ mirrorProductImages: mocks.mirrorProductImages }));
vi.mock("./projectStore", () => ({
  syncCreatorProject: mocks.syncCreatorProject,
  replaceCreatorProjectSource: mocks.replaceCreatorProjectSource,
}));

import {
  hasUnclaimedCreatorAssets,
  mergeClaimedCreatorProject,
  persistGuestClaimedCreatorProject,
  syncCreatorProjectWithOwnedRemoteImages,
} from "./creatorProjectAssets";
import { createDraftProject } from "./templates";

function importedProject(): CreatorProject {
  const project = createDraftProject("luxury-product-reveal");
  return {
    ...project,
    title: "AirPods Max — Luxury product reveal",
    product: {
      ...project.product,
      sourceType: "product_link",
      sourceUrl: "https://www.apple.com/airpods-max/",
      name: "AirPods Max",
      images: [{
        id: "remote-airpods",
        name: "AirPods Max 1",
        url: "https://www.apple.com/example/airpods-max.jpg",
        source: "url",
      }],
    },
  };
}

describe("authenticated creator image persistence", () => {
  beforeEach(() => {
    mocks.mirrorProductImages.mockReset();
    mocks.syncCreatorProject.mockReset();
    mocks.replaceCreatorProjectSource.mockReset();
  });

  it("keeps every local campaign field while attaching verified cloud assets", () => {
    const local = importedProject();
    local.language = "bilingual";
    local.cta = "Order on WhatsApp";
    local.offer = "Free delivery today";
    local.whatsapp = "+96550000000";
    local.product.images[0] = {
      ...local.product.images[0]!,
      assetKey: `${local.id}/local-image`,
    };
    const cloudShell = {
      ...local,
      id: "22222222-2222-4222-8222-222222222222",
      versionId: "33333333-3333-4333-8333-333333333333",
      versionNumber: 1,
      product: { ...local.product, name: "", images: [] },
    };
    const verifiedImages = [{
      ...local.product.images[0]!,
      id: "44444444-4444-4444-8444-444444444444",
      assetKey: undefined,
      storagePath: "users/u/projects/p/assets/product/a/checksum",
      mimeType: "image/jpeg" as const,
      checksum: "a".repeat(64),
    }];

    const merged = mergeClaimedCreatorProject(local, cloudShell, verifiedImages);

    expect(merged).toMatchObject({
      id: cloudShell.id,
      versionId: cloudShell.versionId,
      language: "bilingual",
      cta: "Order on WhatsApp",
      offer: "Free delivery today",
      whatsapp: "+96550000000",
      product: {
        name: "AirPods Max",
        sourceUrl: "https://www.apple.com/airpods-max/",
        images: [{ storagePath: verifiedImages[0]!.storagePath }],
      },
      source: { assetKeys: [verifiedImages[0]!.storagePath] },
    });
    expect(hasUnclaimedCreatorAssets(local)).toBe(true);
    expect(hasUnclaimedCreatorAssets(merged)).toBe(false);
  });

  it("creates the owned project, mirrors remote images, then saves only stable asset metadata", async () => {
    const imported = importedProject();
    const firstCloudSave = {
      ...imported,
      id: "22222222-2222-4222-8222-222222222222",
      versionId: "33333333-3333-4333-8333-333333333333",
      versionNumber: 1,
      product: { ...imported.product, images: [] },
    };
    const mirroredImages = [{
      ...imported.product.images[0]!,
      id: "44444444-4444-4444-8444-444444444444",
      url: "https://storage.example.test/private.jpg?signature=short-lived",
      storagePath: "users/u/projects/p/assets/product/a/checksum",
      mimeType: "image/jpeg" as const,
      checksum: "a".repeat(64),
    }];
    const finalCloudSave = {
      ...firstCloudSave,
      versionId: "55555555-5555-4555-8555-555555555555",
      versionNumber: 2,
      product: { ...imported.product, images: mirroredImages },
    };
    mocks.syncCreatorProject.mockResolvedValueOnce(firstCloudSave);
    mocks.replaceCreatorProjectSource.mockResolvedValueOnce(finalCloudSave);
    mocks.mirrorProductImages.mockResolvedValue(mirroredImages);

    const result = await syncCreatorProjectWithOwnedRemoteImages(imported, "user-one");

    expect(mocks.syncCreatorProject).toHaveBeenCalledTimes(1);
    expect(mocks.syncCreatorProject).toHaveBeenNthCalledWith(1, imported, "user-one");
    expect(mocks.mirrorProductImages).toHaveBeenCalledWith(firstCloudSave.id, imported.product.images);
    const securedSave = mocks.replaceCreatorProjectSource.mock.calls[0]![0] as CreatorProject;
    expect(securedSave).toMatchObject({
      id: firstCloudSave.id,
      versionId: firstCloudSave.versionId,
      versionNumber: firstCloudSave.versionNumber,
      product: {
        name: "AirPods Max",
        images: [{
          id: mirroredImages[0]!.id,
          storagePath: mirroredImages[0]!.storagePath,
          checksum: mirroredImages[0]!.checksum,
        }],
      },
    });
    expect(mocks.replaceCreatorProjectSource).toHaveBeenCalledWith(securedSave, "user-one");
    expect(result).toEqual(finalCloudSave);
  });

  it("does not mirror or create an extra version when all images are already owned", async () => {
    const imported = importedProject();
    imported.product.images[0] = {
      ...imported.product.images[0]!,
      storagePath: "users/u/projects/p/assets/product/a/checksum",
      mimeType: "image/jpeg",
      checksum: "a".repeat(64),
    };
    mocks.syncCreatorProject.mockResolvedValue(imported);

    const result = await syncCreatorProjectWithOwnedRemoteImages(imported, "user-one");

    expect(mocks.syncCreatorProject).toHaveBeenCalledTimes(1);
    expect(mocks.mirrorProductImages).not.toHaveBeenCalled();
    expect(result).toEqual(imported);
  });

  it("does not create a replacement version when a claimed link image cannot be mirrored", async () => {
    const claimed = importedProject();
    claimed.id = "22222222-2222-4222-8222-222222222222";
    claimed.versionId = "33333333-3333-4333-8333-333333333333";
    claimed.versionNumber = 1;
    const originalUrl = claimed.product.images[0]!.url;
    mocks.mirrorProductImages.mockRejectedValue(new Error("temporary mirror outage"));

    await expect(persistGuestClaimedCreatorProject(claimed, "user-one"))
      .rejects.toThrow("MovPrompt could not secure the imported images yet");

    expect(mocks.replaceCreatorProjectSource).not.toHaveBeenCalled();
    expect(mocks.syncCreatorProject).not.toHaveBeenCalled();
    expect(claimed.product.images[0]?.url).toBe(originalUrl);
    expect(claimed.product.images[0]?.storagePath).toBeUndefined();
  });

  it("mirrors guest link images and persists their stable keys in an immutable source version", async () => {
    const claimed = importedProject();
    claimed.id = "22222222-2222-4222-8222-222222222222";
    claimed.versionId = "33333333-3333-4333-8333-333333333333";
    claimed.versionNumber = 1;
    const mirroredImages = [{
      ...claimed.product.images[0]!,
      id: "44444444-4444-4444-8444-444444444444",
      url: "https://storage.example.test/private.jpg?signature=short-lived",
      storagePath: "users/u/projects/p/assets/product/a/checksum",
      mimeType: "image/jpeg" as const,
      checksum: "a".repeat(64),
    }];
    const persisted = {
      ...claimed,
      versionId: "55555555-5555-4555-8555-555555555555",
      versionNumber: 2,
      product: { ...claimed.product, images: mirroredImages },
    };
    mocks.mirrorProductImages.mockResolvedValue(mirroredImages);
    mocks.replaceCreatorProjectSource.mockResolvedValue(persisted);

    const result = await persistGuestClaimedCreatorProject(claimed, "user-one");

    expect(mocks.mirrorProductImages).toHaveBeenCalledWith(claimed.id, claimed.product.images);
    expect(mocks.replaceCreatorProjectSource).toHaveBeenCalledWith(expect.objectContaining({
      id: claimed.id,
      versionId: claimed.versionId,
      product: expect.objectContaining({ images: expect.arrayContaining([expect.objectContaining({ storagePath: mirroredImages[0]!.storagePath })]) }),
    }), "user-one");
    expect(result).toEqual(persisted);
  });
});
