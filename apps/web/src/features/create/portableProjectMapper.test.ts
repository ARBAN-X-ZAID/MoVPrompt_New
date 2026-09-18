import { describe, expect, it } from "vitest";

import type { CreatorProject } from "./types";
import { projectFromCloud, stableProjectConfiguration } from "./portableProjectMapper";

const project: CreatorProject = {
  id: "11111111-1111-4111-8111-111111111111",
  versionId: "22222222-2222-4222-8222-222222222222",
  versionNumber: 1,
  title: "Northfield campaign",
  templateId: "luxury-product-reveal",
  status: "ready",
  promotionKind: "product",
  vertical: "ecommerce",
  goal: "launch",
  presenterMode: "none",
  location: "",
  bookingUrl: "",
  whatsapp: "",
  product: {
    sourceType: "upload",
    sourceUrl: "https://shop.example.test/product?token=private",
    name: "Northfield No. 07",
    description: "Premium fragrance",
    price: "12.500",
    brand: "Northfield",
    images: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "bottle.jpg",
        url: "https://signed.example.test/private?expires=soon",
        storagePath: "users/owner/projects/project/assets/product/image/hash",
        mimeType: "image/jpeg",
        source: "upload",
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        name: "remote.png",
        url: "https://cdn.example.test/product.png?signature=short-lived",
        source: "url",
      },
    ],
  },
  language: "en",
  arabicDialect: "kuwaiti",
  dialectRegister: "conversational",
  market: "KW",
  offer: "",
  cta: "Order on WhatsApp",
  brandColor: "#d49737",
  logoUrl: "",
  aspectRatio: "9:16",
  resolution: "720p",
  durationSeconds: 8,
  subtitles: true,
  audio: true,
  scenes: [{ id: "scene-1", title: "Reveal", purpose: "Hook", duration: 3, headline: "New", direction: "Reveal the product." }],
  videoUrl: "https://signed.example.test/output.mp4",
  jobId: null,
  renderRunId: null,
  lastError: null,
  createdAt: "2026-08-12T08:00:00.000Z",
  updatedAt: "2026-08-12T08:10:00.000Z",
};

describe("portable project mapping", () => {
  it("excludes server-derived generation flags from the strict saved configuration", () => {
    const stable = stableProjectConfiguration({ ...project, hasGeneratedVideo: true, hasActiveGeneration: true });
    expect(stable).not.toHaveProperty("hasGeneratedVideo");
    expect(stable).not.toHaveProperty("hasActiveGeneration");
  });
  it("does not create a recipe change when hydration supplies the default no-presenter value", () => {
    expect(stableProjectConfiguration({ ...project, presenter: { mode: "none" } }))
      .toEqual(stableProjectConfiguration(project));
  });
  it("never persists a short-lived asset or output URL", () => {
    const stable = stableProjectConfiguration(project);
    expect(stable.product.images[0].storagePath).toBe(project.product.images[0].storagePath);
    expect(stable.product.images[0].url).toBe("");
    expect(stable.product.images[1].url).toBe("");
    expect(stable.product.sourceUrl).toBe("");
    expect(stable.jobId).toBeNull();
    expect(stable.renderRunId).toBeNull();
    expect(stable.videoUrl).toBeNull();
  });

  it("replaces guest-local source keys with verified private object keys at the cloud boundary", () => {
    const withGuestKey = {
      ...project,
      source: {
        kind: "product_upload" as const,
        subject: "product" as const,
        assetKeys: ["guest-draft/local-image"],
        facts: [{ field: "name" as const, value: "Northfield No. 07", provenance: "manual" as const }],
      },
    };
    const stable = stableProjectConfiguration(withGuestKey);

    expect(stable.source?.assetKeys).toEqual([project.product.images[0]!.storagePath]);
    expect(stable.source?.assetKeys).not.toContain("guest-draft/local-image");
  });

  it("keeps a legacy manual product source aligned with its normalized campaign source", () => {
    const stable = stableProjectConfiguration({
      ...project,
      product: { ...project.product, sourceType: null, images: [] },
      source: undefined,
    });

    expect(stable.source?.kind).toBe("product_upload");
    expect(stable.product.sourceType).toBe("upload");
  });

  it("uses the server project and version IDs as canonical cloud identity", () => {
    const cloud = projectFromCloud({
      id: "44444444-4444-4444-8444-444444444444",
      title: "Cloud title",
      mode: "template",
      status: "ready",
      currentWorkingVersionId: "55555555-5555-4555-8555-555555555555",
      currentAcceptedVersionId: "77777777-7777-4777-8777-777777777777",
      latestRenderRunId: "66666666-6666-4666-8666-666666666666",
      latestRenderProjectVersionId: "55555555-5555-4555-8555-555555555555",
      latestRenderRunStatus: "processing",
      deletedAt: null,
      createdAt: "2026-08-12T09:00:00.000Z",
      updatedAt: "2026-08-12T09:10:00.000Z",
      currentVersion: {
        id: "55555555-5555-4555-8555-555555555555",
        projectId: "44444444-4444-4444-8444-444444444444",
        parentVersionId: null,
        templateVersionId: null,
        mode: "template",
        versionNumber: 3,
        configuration: { creatorProject: project },
        productRecipe: {},
        campaignRecipe: {},
        changeReason: null,
        createdAt: "2026-08-12T09:10:00.000Z",
      },
      versionCount: 3,
      outputCount: 1,
    });
    expect(cloud).toMatchObject({
      id: "44444444-4444-4444-8444-444444444444",
      versionId: "55555555-5555-4555-8555-555555555555",
      versionNumber: 3,
      title: "Cloud title",
      status: "generating",
      renderRunId: "66666666-6666-4666-8666-666666666666",
      jobId: "66666666-6666-4666-8666-666666666666",
    });
  });
});
