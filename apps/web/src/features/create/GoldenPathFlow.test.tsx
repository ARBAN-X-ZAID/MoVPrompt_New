import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ live: true, templateReady: true, active: { durations: [8, 15, 20] } }) }));

import { CreateScreen } from "./CreateScreen";
import { getCreatorTemplate } from "./templates";
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

  it("renders the create screen as the final user-facing submission boundary", () => {
    const project = createGoldenPathProject(GOLDEN_PRODUCT_PATH);
    const onGenerate = vi.fn();
    render(
      <CreateScreen
        project={project}
        template={getCreatorTemplate(project.templateId)}
        durationSeconds={project.durationSeconds}
        linkUrl=""
        quote={GOLDEN_PRODUCT_PATH.quote}
        quoteState="ready"
        onFiles={vi.fn()}
        onLinkChange={vi.fn()}
        onImportLink={vi.fn()}
        onCancelImport={vi.fn()}
        onDurationChange={vi.fn()}
        onMessageChange={vi.fn()}
        onChangeTemplate={vi.fn()}
        onGenerate={onGenerate}
      />,
    );

    const generate = screen.getByRole("button", { name: /Generate video/ });
    expect(generate).toBeEnabled();
    generate.click();
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("lets the buyer unselect a saved photo without deleting it", () => {
    const project = createGoldenPathProject(GOLDEN_PRODUCT_PATH);
    const front = project.product.images[0]!;
    project.product = {
      ...project.product,
      images: [front, { ...front, id: "side-photo", name: "side" }],
    };
    const onRemoveImage = vi.fn();
    const onMakeOpeningImage = vi.fn();
    const onPhotoChange = vi.fn();
    render(
      <CreateScreen
        project={project}
        template={getCreatorTemplate(project.templateId)}
        durationSeconds={project.durationSeconds}
        linkUrl=""
        quote={GOLDEN_PRODUCT_PATH.quote}
        quoteState="ready"
        onFiles={vi.fn()}
        onRemoveImage={onRemoveImage}
        onMakeOpeningImage={onMakeOpeningImage}
        onPhotoChange={onPhotoChange}
        onLinkChange={vi.fn()}
        onImportLink={vi.fn()}
        onCancelImport={vi.fn()}
        onDurationChange={vi.fn()}
        onMessageChange={vi.fn()}
        onChangeTemplate={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: front.name })).toBeVisible();
    expect(screen.getByRole("img", { name: "side" })).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Use photo 2" }));
    expect(onPhotoChange).toHaveBeenCalledWith("side-photo", { selected: false });
    expect(onRemoveImage).not.toHaveBeenCalled();
  });
});
