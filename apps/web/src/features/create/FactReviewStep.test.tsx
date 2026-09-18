import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FactReviewStep } from "./FactReviewStep";
import { SourceChoiceStep } from "./SourceChoiceStep";

describe("FactReviewStep", () => {
  it("shows a required booking link for a product used in a booking campaign", () => {
    render(<FactReviewStep source={{ kind: "product_upload", subject: "product", assetKeys: [], facts: [{ field: "name", value: "Client product", provenance: "manual" }] }} goal="bookings" onEdit={vi.fn()} onConfirm={vi.fn()} onContinue={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByLabelText("Booking link")).toHaveAttribute("aria-required", "true");
  });
  it("keeps the fact review in RTL while labels and values remain associated in Arabic", () => {
    render(
      <FactReviewStep
        arabic
        source={{
          kind: "service_manual",
          subject: "service",
          assetKeys: [],
          facts: [{ field: "service_name", value: "صالون نورة", provenance: "manual" }],
        }}
        goal="bookings"
        onEdit={vi.fn()}
        onConfirm={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByRole("region", { name: "تأكد من التفاصيل التي سنستخدمها" })).toHaveAttribute("dir", "rtl");
    expect(screen.getByLabelText(/اسم النشاط أو الخدمة/)).toHaveValue("صالون نورة");
  });

  it("keeps service facts, optional states, footage selection, and presenter intent separate", () => {
    const onFiles = vi.fn();
    const view = render(
      <SourceChoiceStep
        value="upload"
        subject="service"
        url=""
        onChoiceChange={vi.fn()}
        onSubjectChange={vi.fn()}
        onUrlChange={vi.fn()}
        onImport={vi.fn()}
        onCancel={vi.fn()}
        onFiles={onFiles}
        onManualStart={vi.fn()}
      />,
    );

    const footage = new File(["video"], "tour.mp4", { type: "video/mp4" });
    fireEvent.change(screen.getByLabelText("Choose photos or footage"), { target: { files: [footage] } });
    expect(screen.getByLabelText("Choose photos or footage")).toHaveAttribute("accept", expect.stringContaining("video/mp4"));
    expect(onFiles).toHaveBeenCalledTimes(1);
    view.unmount();

    render(
      <FactReviewStep
        source={{
          kind: "real_footage",
          subject: "service",
          assetKeys: ["guest-assets/campaign/tour.mp4"],
          facts: [
            { field: "service_name", value: "Noura Salon", provenance: "manual" },
            { field: "location", value: "Salmiya", provenance: "manual" },
            { field: "media", value: "1 video added", provenance: "manual" },
          ],
        }}
        goal="bookings"
        onEdit={vi.fn()}
        onConfirm={vi.fn()}
        onContinue={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/Business or service name/)).toHaveValue("Noura Salon");
    expect(screen.getByLabelText(/Booking link/)).toHaveValue("");
    expect(screen.getByLabelText(/Booking link/)).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText("Description or tagline")).not.toHaveAttribute("aria-required", "true");
    expect(screen.queryByText("Not added")).toBeNull();
    expect(screen.queryByText(/not added to this campaign/)).toBeNull();
    expect(screen.getByText("Real footage")).toBeVisible();
    expect(screen.queryByText(/presenter/i)).not.toBeInTheDocument();
  });
});
