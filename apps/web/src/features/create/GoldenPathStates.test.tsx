import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FactReviewStep } from "./FactReviewStep";
import { SourceChoiceStep } from "./SourceChoiceStep";
import { CampaignReviewStep } from "./CampaignReviewStep";
import { createDraftProject } from "./templates";

describe("golden path source recovery states", () => {
  it("keeps the complete Arabic link draft visible and offers a single retry after a scan failure", () => {
    const retry = vi.fn();
    render(
      <SourceChoiceStep
        value="business_link"
        subject="service"
        url="https://noura.example.test/book"
        error="لم نتمكن من قراءة هذا الرابط. حملتك محفوظة."
        arabic
        onChoiceChange={vi.fn()}
        onSubjectChange={vi.fn()}
        onUrlChange={vi.fn()}
        onImport={vi.fn()}
        onCancel={vi.fn()}
        onFiles={vi.fn()}
        onManualStart={vi.fn()}
        onRetry={retry}
      />,
    );

    expect(screen.getByRole("heading", { name: "شنو تبي تروّج له؟" })).toBeVisible();
    expect(screen.getByDisplayValue("https://noura.example.test/book")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "حاول رابطاً آخر" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("announces an adjacent required booking error, focuses it, and keeps all entered service values", () => {
    render(
      <FactReviewStep
        source={{
          kind: "service_manual",
          subject: "service",
          assetKeys: [],
          facts: [
            { field: "service_name", value: "Noura Salon", provenance: "manual" },
            { field: "whatsapp", value: "+96550000000", provenance: "manual" },
          ],
        }}
        goal="bookings"
        onEdit={vi.fn()}
        onConfirm={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const booking = screen.getByLabelText("Booking link");
    expect(booking).toHaveFocus();
    expect(booking).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Add booking link to continue.");
    expect(screen.getByLabelText("Business or service name")).toHaveValue("Noura Salon");
    expect(screen.getByLabelText("WhatsApp number")).toHaveValue("+96550000000");
  });

  it("keeps the exact review available through quote and service outages without enabling Generate", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product = {
      ...project.product,
      name: "Amber No. 7",
      images: [{ id: "amber", name: "amber.jpg", url: "https://example.test/amber.jpg", source: "upload" }],
    };
    const retry = vi.fn();

    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={null}
        quoteState="unavailable"
        sourceError="Generation is temporarily paused. Your campaign is saved and ready to continue."
        requestId="req_review_1"
        onEdit={vi.fn()}
        onRetryQuote={retry}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByText("Amber No. 7")).toBeVisible();
    expect(screen.getAllByText("We couldn’t confirm the current price. Your campaign is saved.")).not.toHaveLength(0);
    expect(screen.getByRole("button", { name: "Generate campaign" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh price" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByText("Generation is temporarily paused. Your campaign is saved and ready to continue.")).toBeVisible();
  });
});
