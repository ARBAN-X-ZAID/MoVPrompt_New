import { describe, expect, it } from "vitest";

import { prepareAuthenticatedAssetClaim } from "./authenticatedAssetClaim";
import { createDraftProject } from "./templates";

describe("authenticated asset claim preparation", () => {
  it("adds one stable pending intent when a signed-in draft still owns browser-only media", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product.images = [{
      id: "local-image",
      name: "product.jpg",
      url: "blob:local-product",
      source: "upload",
      assetKey: `${project.id}/local-image`,
      mimeType: "image/jpeg",
    }];

    const prepared = prepareAuthenticatedAssetClaim(project, () => "claim-intent");
    const replayed = prepareAuthenticatedAssetClaim(prepared, () => "different-intent");

    expect(prepared.pendingGenerationId).toBe("claim-intent");
    expect(replayed.pendingGenerationId).toBe("claim-intent");
    expect(project.pendingGenerationId).toBeUndefined();
  });

  it("does not create a claim intent for a project whose media is already private", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product.images = [{
      id: "saved-image",
      name: "product.jpg",
      url: "https://signed.example/product.jpg",
      source: "upload",
      storagePath: "users/user/projects/project/assets/product/image/checksum",
      mimeType: "image/jpeg",
    }];

    expect(prepareAuthenticatedAssetClaim(project, () => "unused")).toBe(project);
  });
});
