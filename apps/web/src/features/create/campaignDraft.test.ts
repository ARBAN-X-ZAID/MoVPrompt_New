import { describe, expect, it } from "vitest";

import { CampaignGoalSchema, TemplateCampaignPayloadSchema } from "@movprompt/contracts";
import { CreativeBriefSchema } from "@movprompt/creative-engine";

import { projectToCreationDraft } from "./contracts";
import {
  buildPortableGenerationConfiguration,
  portableCampaignRecipe,
  portableConfiguration,
  portableProductRecipe,
} from "./projectStore";
import { projectFromCloud } from "./portableProjectMapper";
import { createDraftProject } from "./templates";
import type { CreatorProject } from "./types";

const goals = [
  "whatsapp_orders",
  "bookings",
  "launch",
  "offer",
  "demonstration",
  "education",
  "announcement",
  "trust",
  "brand_story",
] as const;

function productProject(): CreatorProject {
  const project = createDraftProject("luxury-product-reveal");
  return {
    ...project,
    product: {
      sourceType: "product_link",
      sourceUrl: "",
      name: "Northfield No. 07",
      description: "Premium fragrance",
      price: "12.500",
      brand: "Northfield",
      images: [{ id: "asset-1", name: "bottle.jpg", url: "", storagePath: "creator-assets/u/p/a", mimeType: "image/jpeg", source: "upload" }],
    },
    source: {
      kind: "product_url",
      subject: "product",
      assetKeys: ["creator-assets/u/p/a"],
      facts: [
        { field: "name", value: "Northfield No. 07", provenance: "user_confirmed" },
        { field: "description", value: "Premium fragrance", provenance: "user_confirmed" },
        { field: "brand", value: "Northfield", provenance: "user_confirmed" },
        { field: "price", value: "12.500", provenance: "manual" },
        { field: "offer", value: "Free delivery", provenance: "manual" },
        { field: "whatsapp", value: "+96550000000", provenance: "manual" },
      ],
    },
    offer: "Free delivery",
    whatsapp: "+96550000000",
    cta: "Order on WhatsApp",
    goal: "whatsapp_orders",
  };
}

function serviceProject(): CreatorProject {
  const project = createDraftProject("salon-booking-offer");
  return {
    ...project,
    promotionKind: "business",
    product: { ...project.product, sourceType: "business_link", name: "Noura Salon", description: "Hair and beauty appointments" },
    source: {
      kind: "business_url",
      subject: "service",
      assetKeys: ["creator-assets/u/p/service-tour"],
      facts: [
        { field: "service_name", value: "Noura Salon", provenance: "user_confirmed" },
        { field: "description", value: "Hair and beauty appointments", provenance: "user_confirmed" },
        { field: "location", value: "Salmiya", provenance: "manual" },
        { field: "booking_url", value: "https://noura.example.test/book", provenance: "manual" },
      ],
    },
    location: "Salmiya",
    bookingUrl: "https://noura.example.test/book",
    cta: "Book now",
    goal: "bookings",
  };
}

describe("campaign draft convergence", () => {
  it("carries the reviewed booking link into the immutable generation brief", () => {
    const project = serviceProject();
    const configuration = portableConfiguration(project);
    const generation = buildPortableGenerationConfiguration(project);
    expect(generation.creativeBrief.product.bookingUrl).toBe("https://noura.example.test/book");
    expect(TemplateCampaignPayloadSchema.safeParse({ configuration, productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) }).success).toBe(true);
    const changed = { ...configuration, generation: { ...generation, creativeBrief: { ...generation.creativeBrief, product: { ...generation.creativeBrief.product, bookingUrl: "https://wrong.example/book" } } } };
    expect(TemplateCampaignPayloadSchema.safeParse({ configuration: changed, productRecipe: portableProductRecipe(project), campaignRecipe: portableCampaignRecipe(project) }).success).toBe(false);
  });
  it("validates all nine campaign outcomes in public and creative contracts", () => {
    for (const goal of goals) {
      expect(CampaignGoalSchema.parse(goal)).toBe(goal);
      expect(CreativeBriefSchema.parse({
        engineVersion: "gcc-campaign-engine-2026.08",
        templateId: "luxury-product-reveal",
        market: "KW",
        language: "en",
        arabicDialect: null,
        dialectRegister: "conversational",
        tone: "premium",
        vertical: "ecommerce",
        goal,
        product: { name: "Northfield", callToAction: "Shop now" },
        scenes: createDraftProject("luxury-product-reveal").scenes.map((scene) => ({
          id: scene.id,
          title: { en: scene.title, ar: scene.titleAr ?? scene.title },
          purpose: { en: scene.purpose, ar: scene.purposeAr ?? scene.purpose },
          duration: scene.duration,
          headline: { en: scene.headline, ar: scene.headlineAr ?? scene.headline },
          voiceover: { en: scene.voiceover ?? scene.headline, ar: scene.voiceoverAr ?? scene.headlineAr ?? scene.headline },
          direction: scene.direction,
          shot: scene.shot ?? "Hero",
          camera: scene.camera ?? "Locked",
          lighting: scene.lighting ?? "Soft",
          continuityAnchor: scene.continuityAnchor ?? "Northfield",
        })),
        qualityPolicy: {
          tier: "premium",
          acceptanceScore: 80,
          internalRetryLimit: 1,
          hardGates: ["truth"],
          scoredDimensions: ["fidelity"],
        },
      }).goal).toBe(goal);
    }
  });

  it("keeps confirmed source facts authoritative through source-first and template-first mappings", () => {
    const sourceFirst = productProject();
    const templateFirst = { ...sourceFirst, templateId: "luxury-product-reveal" };

    expect(projectToCreationDraft(sourceFirst, true).source).toEqual(sourceFirst.source);
    expect(portableConfiguration(sourceFirst)).toEqual(portableConfiguration(templateFirst));
    expect(buildPortableGenerationConfiguration(sourceFirst).creativeBrief.product).toMatchObject({
      name: "Northfield No. 07",
      price: "12.500",
      offer: "Free delivery",
      whatsapp: "+96550000000",
    });
  });

  it("emits one bounded Kuwait campaign payload for both product and service golden paths", () => {
    for (const sourceProject of [productProject(), serviceProject()]) {
      sourceProject.product.images = sourceProject.product.images.map((image, index) => ({
        ...image,
        id: index === 0 ? "11111111-1111-4111-8111-111111111111" : image.id,
      }));
      const payload = {
        configuration: portableConfiguration(sourceProject),
        productRecipe: portableProductRecipe(sourceProject),
        campaignRecipe: portableCampaignRecipe(sourceProject),
      };
      expect(TemplateCampaignPayloadSchema.safeParse(payload).success).toBe(true);
      expect(TemplateCampaignPayloadSchema.safeParse({
        ...payload,
        campaignRecipe: { ...payload.campaignRecipe, cta: "Tampered hidden CTA" },
      }).success).toBe(false);
    }
  });

  it("round-trips product and service sources from a saved project version without URL-bearing truth", () => {
    for (const sourceProject of [productProject(), serviceProject()]) {
      const configuration = portableConfiguration(sourceProject);
      const hydrated = projectFromCloud({
        id: sourceProject.id,
        title: sourceProject.title,
        mode: "template",
        status: "ready",
        currentWorkingVersionId: "22222222-2222-4222-8222-222222222222",
        currentAcceptedVersionId: null,
        latestRenderRunId: null,
        latestRenderProjectVersionId: null,
        latestRenderRunStatus: null,
        deletedAt: null,
        createdAt: sourceProject.createdAt,
        updatedAt: sourceProject.updatedAt,
        currentVersion: {
          id: "22222222-2222-4222-8222-222222222222",
          projectId: sourceProject.id,
          parentVersionId: null,
          templateVersionId: null,
          mode: "template",
          versionNumber: 1,
          configuration,
          productRecipe: {},
          campaignRecipe: {},
          changeReason: null,
          createdAt: sourceProject.createdAt,
        },
        versionCount: 1,
        outputCount: 0,
      });

      expect(hydrated?.source).toEqual(sourceProject.source);
      expect(JSON.stringify(configuration)).not.toContain("blob:");
      expect(JSON.stringify(configuration)).not.toContain("X-Amz-Signature");
      expect(JSON.stringify(configuration)).not.toContain("blob:");
    }
  });
});
