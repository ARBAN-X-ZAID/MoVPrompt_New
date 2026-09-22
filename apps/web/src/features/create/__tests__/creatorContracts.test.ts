import { describe, expect, it } from "vitest";
import { projectToCreationDraft } from "../contracts";
import { createDraftProject, CREATOR_TEMPLATES } from "../templates";
import { GOLDEN_PRODUCT_PATH, GOLDEN_SERVICE_PATH, canonicalGoldenPathIntent, createGoldenPathProject } from "../__fixtures__/goldenPathFixtures";

describe("creator contracts", () => {
  it("keeps the twelve launch templates in seven distinct launch categories available", () => {
    expect(CREATOR_TEMPLATES).toHaveLength(12);
    expect(new Set(CREATOR_TEMPLATES.map((template) => template.id)).size).toBe(12);
    expect(new Set(CREATOR_TEMPLATES.map((template) => template.eyebrow)).size).toBe(7);
    expect(CREATOR_TEMPLATES.some((template) => template.id === "salon-booking-offer")).toBe(false);
    expect(CREATOR_TEMPLATES.some((template) => template.id === "premium-phone-reveal")).toBe(true);
    for (const template of CREATOR_TEMPLATES) {
      expect(template.languages).toEqual(expect.arrayContaining(["en", "ar", "bilingual"]));
      expect(template.aspectRatios).toEqual(expect.arrayContaining(["9:16", "1:1", "4:5", "16:9"]));
      expect(template.requiredInputs).toContain("primary_reference");
    }
  });

  it("preserves the pending generation intent in a seven-day guest draft", () => {
    const project = createDraftProject("food-delivery-ad");
    project.pendingGenerationId = "stable-generation-intent";
    project.pendingQuoteCredits = 180;
    const draft = projectToCreationDraft(project, true, "auth_required");
    expect(draft.pendingGenerationId).toBe("stable-generation-intent");
    expect(draft.acceptedQuote).toBeUndefined();
    expect(draft.campaign).toMatchObject({ vertical: "retail", goal: "whatsapp_orders", presenterMode: "none" });
    expect(draft.campaign).toMatchObject({ arabicDialect: "kuwaiti", dialectRegister: "conversational" });
    expect(new Date(draft.expiresAt).getTime() - new Date(draft.updatedAt).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("preserves a Kuwait service campaign through the authentication handoff", () => {
    const project = createDraftProject("business-service-promotion");
    project.location = "Salmiya";
    project.bookingUrl = "https://example.test/book";
    project.whatsapp = "+96550000000";
    const draft = projectToCreationDraft(project, true, "auth_required");
    expect(draft.product.sourceType).toBeNull();
    expect(draft.campaign).toMatchObject({
      vertical: "services",
      goal: "demonstration",
      presenterMode: "none",
      location: "Salmiya",
      bookingUrl: "https://example.test/book",
      whatsapp: "+96550000000",
    });
  });

  it("keeps imported product settings in IndexedDB without persisting any preview video", () => {
    const project = createDraftProject("premium-phone-reveal");
    project.product = {
      sourceType: "product_link",
      sourceUrl: "https://www.apple.com/airpods-max/",
      name: "AirPods Max",
      description: "Over-ear headphones",
      price: "199.900",
      brand: "Apple",
      images: [{ id: "airpods", name: "AirPods Max", url: "https://images.example.test/airpods-max.png", source: "url" }],
    };
    project.language = "bilingual";
    project.goal = "whatsapp_orders";
    project.cta = "Order on WhatsApp";
    project.offer = "Free delivery";
    project.aspectRatio = "4:5";
    project.resolution = "480p";
    project.audio = false;
    project.subtitles = true;
    project.videoUrl = "/presets/hero-shot.mp4";

    const draft = projectToCreationDraft(project, true);

    expect("videoUrl" in draft).toBe(false);
    expect(draft.product.images.map((image) => image.url)).toEqual(["https://images.example.test/airpods-max.png"]);
    expect(draft.campaign).toMatchObject({
      language: "bilingual",
      goal: "whatsapp_orders",
      cta: "Order on WhatsApp",
      offer: "Free delivery",
      aspectRatio: "4:5",
      resolution: "480p",
      audio: false,
      subtitles: true,
    });
  });

  it("serializes template-first and source-first golden paths into the same normalized submit intent", () => {
    const sourceFirst = createGoldenPathProject(GOLDEN_PRODUCT_PATH);
    const templateFirst = createGoldenPathProject({ ...GOLDEN_PRODUCT_PATH, entry: "template_first" });

    expect(canonicalGoldenPathIntent(sourceFirst, true)).toEqual(canonicalGoldenPathIntent(templateFirst, true));
  });

  it("retains a stable service pending intent through auth cancellation and callback replay", () => {
    const project = createGoldenPathProject(GOLDEN_SERVICE_PATH);
    const first = projectToCreationDraft(project, true, "auth_required");
    const replay = projectToCreationDraft({ ...project, pendingGenerationId: first.pendingGenerationId }, true, "auth_required");

    expect(replay.pendingGenerationId).toBe(first.pendingGenerationId);
    expect(replay.source).toEqual(first.source);
    expect(replay.campaign).toEqual(first.campaign);
  });
});
