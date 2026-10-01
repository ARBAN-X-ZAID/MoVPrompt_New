import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateScreen } from "./CreateScreen";
import { createDraftProject, getCreatorTemplate } from "./templates";

vi.mock("./useCapabilities", () => ({ useCapabilities: () => ({ templateReady: true, active: { durations: [8, 15, 20] } }) }));

describe("creator error placement", () => {
  it.each([false, true])("places generation/quote errors below Generate, separately from import errors (Arabic %s)", arabic => {
    const project = createDraftProject("fashion-product-showcase");
    project.product.images = [{ id: "shirt", name: "shirt.jpeg", url: "/shirt.jpeg", mimeType: "image/jpeg", source: "upload", referenceRole: "subject", selected: true }];
    const props = { project, template: getCreatorTemplate(project.templateId), durationSeconds: 15, linkUrl: "", arabic, quote: null, quoteState: "unavailable" as const, onFiles: vi.fn(), onLinkChange: vi.fn(), onImportLink: vi.fn(), onCancelImport: vi.fn(), onDurationChange: vi.fn(), onMessageChange: vi.fn(), onChangeTemplate: vi.fn(), onGenerate: vi.fn() };
    const { rerender } = render(<CreateScreen {...props} error="Import failed" generationError="Generation failed" quoteError="Catalog updating" />);
    expect(screen.getByRole("radio", { name: "9:16" })).toHaveAttribute("aria-checked", "true");
    for (const ratio of ["4:5", "1:1", "16:9"]) expect(screen.queryByRole("radio", { name: ratio })).toBeNull();
    const generate = screen.getByRole("button", { name: arabic ? "ولّد الفيديو" : "Generate video" });
    expect(generate.nextElementSibling).toBe(screen.getByText("Generation failed"));
    expect(generate).toHaveAttribute("aria-describedby", screen.getByText("Generation failed").id);
    expect(screen.getByText("Generation failed").closest(".creator-create-stage")).toBeNull();
    expect(screen.getByText("Import failed").closest(".creator-create-stage")).not.toBeNull();
    rerender(<CreateScreen {...props} quoteError="Catalog updating" />);
    expect(generate.nextElementSibling).toBe(screen.getByText("Catalog updating"));
    expect(screen.getAllByText("Catalog updating")).toHaveLength(1);
  });
  it.each([false, true])("shows actionable photo guidance instead of raw quote validation codes (Arabic %s)", arabic => {
    const project = createDraftProject("female-product-review");
    const props = { project, template: getCreatorTemplate(project.templateId), durationSeconds: 15, linkUrl: "", arabic, quote: null, quoteState: "unavailable" as const, onFiles: vi.fn(), onLinkChange: vi.fn(), onImportLink: vi.fn(), onCancelImport: vi.fn(), onDurationChange: vi.fn(), onMessageChange: vi.fn(), onChangeTemplate: vi.fn(), onGenerate: vi.fn() };
    const { rerender } = render(<CreateScreen {...props} quoteError="subject_photos_required" />);
    expect(screen.queryByText("subject_photos_required")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(arabic ? "أضف صورة واحدة" : "Add one photo");
    project.product.images = [
      { id: "product", name: "product.png", url: "/product.png", mimeType: "image/png", source: "upload", referenceRole: "subject", selected: true },
      { id: "adult", name: "adult.png", url: "/adult.png", mimeType: "image/png", source: "upload", referenceRole: "character", selected: true },
    ];
    rerender(<CreateScreen {...props} quoteError="character_rights_required" />);
    expect(screen.queryByText("character_rights_required")).toBeNull();
    const instruction = screen.getByRole("alert");
    expect(instruction).toHaveTextContent(arabic ? "أكّد إذن الاستخدام" : "Confirm permission below each selected character photo");
    expect(screen.getByRole("button", { name: arabic ? "ولّد الفيديو" : "Generate video" }).nextElementSibling).toBe(instruction);
  });
});
