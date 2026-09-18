import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampaignReviewStep } from "./CampaignReviewStep";
import {
  GOLDEN_PRODUCT_PATH,
  GOLDEN_SERVICE_PATH,
  canonicalGoldenPathIntent,
  createGoldenPathProject,
} from "./__fixtures__/goldenPathFixtures";

describe("creator golden path fixtures", () => {
  it("keeps every product campaign value through the exact pending submission boundary", () => {
    const project = createGoldenPathProject(GOLDEN_PRODUCT_PATH);
    const intent = canonicalGoldenPathIntent(project, true);

    expect(intent).toMatchObject({
      source: GOLDEN_PRODUCT_PATH.source,
      goal: "whatsapp_orders",
      presenter: { mode: "none" },
      pendingGenerationId: GOLDEN_PRODUCT_PATH.pendingGenerationId,
      delivery: { aspectRatio: "4:5", resolution: "480p", subtitles: true, audio: false },
    });
    expect(intent.source.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "name", value: "Sadu Reserve Oud" }),
      expect.objectContaining({ field: "whatsapp", value: "+96550001234" }),
    ]));
  });

  it("keeps every service campaign value through the exact pending submission boundary", () => {
    const project = createGoldenPathProject(GOLDEN_SERVICE_PATH);
    const intent = canonicalGoldenPathIntent(project, true);

    expect(intent).toMatchObject({
      source: GOLDEN_SERVICE_PATH.source,
      goal: "bookings",
      presenter: { mode: "none" },
      pendingGenerationId: GOLDEN_SERVICE_PATH.pendingGenerationId,
      delivery: { aspectRatio: "9:16", resolution: "720p", subtitles: true, audio: true },
    });
    expect(intent.source.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "service_name", value: "Noura Salon" }),
      expect.objectContaining({ field: "booking_url", value: "https://noura.example.test/book" }),
    ]));
  });

  it("renders the exact product review as the final user-facing submission boundary", () => {
    const project = createGoldenPathProject(GOLDEN_PRODUCT_PATH);
    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={GOLDEN_PRODUCT_PATH.quote}
        quoteState="ready"
        onEdit={vi.fn()}
        onRetryQuote={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByText("Sadu Reserve Oud")).toBeVisible();
    expect(screen.getByText("Order on WhatsApp")).toBeVisible();
    expect(screen.getByRole("button", { name: "Generate campaign" })).toBeEnabled();
  });
});
