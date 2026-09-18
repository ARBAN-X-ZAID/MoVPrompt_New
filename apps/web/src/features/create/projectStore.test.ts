import { beforeEach, describe, expect, it } from "vitest";

import { createDraftProject } from "./templates";
import {
  buildPortableGenerationConfiguration,
  imageReferencesForAdvancedHandoff,
  listLocalCreatorProjects,
  portableProductRecipe,
  saveLocalCreatorProject,
} from "./projectStore";

describe("creator project local cache", () => {
  beforeEach(() => localStorage.clear());

  it("never persists a signed render URL", () => {
    const project = createDraftProject();
    const active = saveLocalCreatorProject({
      ...project,
      status: "review",
      renderRunId: "44444444-4444-4444-8444-444444444444",
      jobId: "44444444-4444-4444-8444-444444444444",
      videoUrl: "http://127.0.0.1:9000/creator-outputs/signed.mp4?expires=soon",
    }, "user-one");

    expect(active.videoUrl).toContain("signed.mp4");
    expect(listLocalCreatorProjects("user-one")[0]).toMatchObject({
      renderRunId: "44444444-4444-4444-8444-444444444444",
      videoUrl: null,
    });
  });

  it("never persists signed private image or logo URLs", () => {
    const project = createDraftProject();
    const privateImageUrl = "https://storage.example.test/private.jpg?X-Amz-Signature=short-lived";
    const privateLogoUrl = "https://storage.example.test/logo.png?token=short-lived";
    saveLocalCreatorProject({
      ...project,
      logoUrl: privateLogoUrl,
      product: {
        ...project.product,
        images: [{
          id: "33333333-3333-4333-8333-333333333333",
          name: "product.jpg",
          url: privateImageUrl,
          storagePath: "users/u/projects/p/assets/product/a/checksum",
          source: "upload",
        }],
      },
    }, "user-one");

    const serialized = localStorage.getItem("movprompt.creator-projects.v2:user-one")!;
    expect(serialized).not.toContain(privateImageUrl);
    expect(serialized).not.toContain(privateLogoUrl);
    expect(serialized).not.toContain("X-Amz-Signature");
    expect(serialized).not.toContain("token=short-lived");
    expect(listLocalCreatorProjects("user-one")[0]).toMatchObject({
      logoUrl: "",
      product: { images: [expect.objectContaining({ storagePath: "users/u/projects/p/assets/product/a/checksum", url: "" })] },
    });
  });

  it("uses the authoritative image MIME and keeps transient URLs out of the product recipe", () => {
    const project = createDraftProject();
    project.product.sourceUrl = "https://shop.example.test/product?token=private";
    project.product.images = [{
      id: "33333333-3333-4333-8333-333333333333",
      name: "product.webp",
      url: "http://127.0.0.1:9000/private?signature=short-lived",
      storagePath: `users/${"11111111-1111-4111-8111-111111111111"}/projects/${project.id}/assets/product/33333333-3333-4333-8333-333333333333/${"a".repeat(64)}`,
      mimeType: "image/webp",
      checksum: "a".repeat(64),
      source: "upload",
    }];

    expect(buildPortableGenerationConfiguration(project).references).toEqual([{
      objectKey: project.product.images[0]!.storagePath,
      mimeType: "image/webp",
    }]);
    const recipe = portableProductRecipe(project);
    expect(JSON.stringify(recipe)).not.toContain("http");
    expect(JSON.stringify(recipe)).not.toContain("signature");
    expect(recipe.images).toEqual([expect.objectContaining({
      objectKey: project.product.images[0]!.storagePath,
      mimeType: "image/webp",
    })]);
  });

  it("does not pass MOV footage into Advanced image references", () => {
    const project = createDraftProject();
    project.product.images = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "product.jpg",
        url: "blob:product",
        storagePath: "users/u/projects/p/assets/product/image/checksum",
        mimeType: "image/jpeg",
        source: "upload",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "spokesperson.mov",
        url: "blob:footage",
        storagePath: "users/u/projects/p/assets/footage/video/checksum",
        mimeType: "video/quicktime",
        source: "upload",
      },
    ];

    expect(imageReferencesForAdvancedHandoff(project)).toEqual([
      "users/u/projects/p/assets/product/image/checksum",
    ]);
  });

  it("fails closed for MIME-less legacy references in Advanced handoff and portable generation", () => {
    const project = createDraftProject();
    project.product.images = [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "legacy-upload.mov",
        url: "blob:legacy-upload",
        storagePath: "users/u/projects/p/assets/footage/legacy/checksum",
        source: "upload",
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "legacy-sample",
        url: "/create/legacy-sample",
        source: "sample",
      },
    ];

    expect(imageReferencesForAdvancedHandoff(project)).toEqual([]);
    expect(buildPortableGenerationConfiguration(project).references).toEqual([]);
  });

});
