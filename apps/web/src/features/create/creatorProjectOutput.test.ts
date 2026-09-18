import { beforeEach, describe, expect, it } from "vitest";

import { createDraftProject } from "./templates";
import {
  completeLocalProductPreview,
  hasRealCreatorVideo,
  invalidateCreatorProjectOutput,
  sanitizeCreatorProjectOutput,
} from "./creatorProjectOutput";
import { listLocalCreatorProjects } from "./projectStore";

function airPodsProject() {
  const project = createDraftProject("luxury-product-reveal");
  return {
    ...project,
    title: "AirPods Max — Luxury Product Reveal",
    status: "review" as const,
    product: {
      sourceType: "product_link" as const,
      sourceUrl: "https://www.apple.com/airpods-max/",
      name: "AirPods Max",
      description: "Over-ear headphones",
      price: "199.900",
      brand: "Apple",
      images: [{ id: "airpods", name: "AirPods Max", url: "https://images.example.test/airpods-max.png", source: "url" as const }],
    },
    language: "bilingual" as const,
    goal: "whatsapp_orders" as const,
    cta: "Order on WhatsApp",
    offer: "Free delivery",
    aspectRatio: "4:5" as const,
    resolution: "480p" as const,
    audio: false,
    subtitles: true,
    videoUrl: "/presets/hero-shot.mp4",
    jobId: "demo-job",
    renderRunId: "demo-run",
    pendingGenerationId: "demo-intent",
    pendingQuoteCredits: 120,
  };
}

describe("creator project output truth", () => {
  beforeEach(() => localStorage.clear());

  it("repairs a saved AirPods project that points at bundled demo media without changing its campaign", () => {
    const repaired = sanitizeCreatorProjectOutput(airPodsProject());

    expect(repaired).toMatchObject({
      status: "ready",
      videoUrl: null,
      jobId: null,
      renderRunId: null,
      pendingGenerationId: null,
      pendingQuoteCredits: null,
      language: "bilingual",
      goal: "whatsapp_orders",
      cta: "Order on WhatsApp",
      offer: "Free delivery",
      aspectRatio: "4:5",
      resolution: "480p",
      audio: false,
      subtitles: true,
      product: {
        name: "AirPods Max",
        price: "199.900",
        images: [{ url: "https://images.example.test/airpods-max.png" }],
      },
    });
    expect(JSON.stringify(repaired)).not.toContain("Kinza");
    expect(hasRealCreatorVideo(repaired)).toBe(false);
  });

  it("keeps a real provider output available", () => {
    const project = { ...airPodsProject(), videoUrl: "https://objects.example.test/projects/airpods/output.mp4?signature=valid" };
    const repaired = sanitizeCreatorProjectOutput(project);

    expect(repaired.videoUrl).toBe(project.videoUrl);
    expect(repaired.status).toBe("review");
    expect(hasRealCreatorVideo(repaired)).toBe(true);
  });

  it("does not project a previous source output as current after replacement or reload", () => {
    const replaced = sanitizeCreatorProjectOutput({
      ...airPodsProject(),
      videoUrl: "https://objects.example.test/projects/airpods/previous-output.mp4",
      sourceFingerprint: "new-source-fingerprint",
      outputSourceFingerprint: "previous-source-fingerprint",
    });

    expect(replaced.videoUrl).toBeNull();
    expect(replaced.renderRunId).toBeNull();
    expect(replaced.status).toBe("ready");
    expect(replaced.product.name).toBe("AirPods Max");
  });

  it("invalidates the old render binding while preserving every user-controlled campaign field", () => {
    const project = { ...airPodsProject(), videoUrl: "https://objects.example.test/projects/old/output.mp4" };
    const invalidated = invalidateCreatorProjectOutput(project);

    expect(invalidated.videoUrl).toBeNull();
    expect(invalidated).toMatchObject({
      language: project.language,
      goal: project.goal,
      cta: project.cta,
      product: { price: project.product.price },
      offer: project.offer,
      aspectRatio: project.aspectRatio,
      resolution: project.resolution,
      audio: project.audio,
      subtitles: project.subtitles,
    });
  });

  it("finishes local preparation with an honest product-only preview", () => {
    const completed = completeLocalProductPreview(airPodsProject());

    expect(completed.status).toBe("ready");
    expect(completed.videoUrl).toBeNull();
    expect(completed.product.images.map((image) => image.url)).toEqual(["https://images.example.test/airpods-max.png"]);
  });

  it("sanitizes legacy demo output while reading the local project store", () => {
    localStorage.setItem("movprompt.creator-projects.v2:signed-out", JSON.stringify([airPodsProject()]));

    const [stored] = listLocalCreatorProjects();
    expect(stored.videoUrl).toBeNull();
    expect(stored.status).toBe("ready");
    expect(stored.product.name).toBe("AirPods Max");
    expect(stored.product.images[0]?.url).toBe("https://images.example.test/airpods-max.png");
  });
});
