import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { SourceChoiceStep } from "./SourceChoiceStep";

function renderSourceChoice(overrides: Partial<ComponentProps<typeof SourceChoiceStep>> = {}) {
  const onChoiceChange = vi.fn();
  const onSubjectChange = vi.fn();
  const onFiles = vi.fn();
  const onManualStart = vi.fn();
  const view = render(
    <SourceChoiceStep
      value="product_link"
      subject="product"
      url=""
      onChoiceChange={onChoiceChange}
      onSubjectChange={onSubjectChange}
      onUrlChange={vi.fn()}
      onImport={vi.fn()}
      onCancel={vi.fn()}
      onFiles={onFiles}
      onManualStart={onManualStart}
      {...overrides}
    />,
  );
  return { onChoiceChange, onSubjectChange, onFiles, onManualStart, view };
}

describe("SourceChoiceStep", () => {
  it("uses roving tabindex and arrow keys for source radios", () => {
    const { onChoiceChange } = renderSourceChoice();
    const productLink = screen.getByRole("radio", { name: /Product link/i });
    const businessLink = screen.getByRole("radio", { name: /Business or service link/i });

    expect(productLink).toHaveAttribute("tabindex", "0");
    expect(businessLink).toHaveAttribute("tabindex", "-1");
    productLink.focus();
    fireEvent.keyDown(productLink, { key: "ArrowRight" });

    expect(onChoiceChange).toHaveBeenCalledWith("business_link");
    expect(businessLink).toHaveFocus();
  });

  it("uses roving tabindex and Home/End keys for product or service radios", () => {
    const { onSubjectChange } = renderSourceChoice({ value: "upload", subject: "product" });
    const product = screen.getByRole("radio", { name: "A product" });
    const service = screen.getByRole("radio", { name: "A business or service" });

    product.focus();
    fireEvent.keyDown(product, { key: "End" });
    expect(onSubjectChange).toHaveBeenCalledWith("service");
    expect(service).toHaveFocus();
  });

  it("offers product and business links plus photos, real footage, and manual facts as distinct truthful starts", () => {
    const upload = renderSourceChoice({ value: "upload", subject: "service" });

    expect(screen.getByRole("radio", { name: /Product link/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Business or service link/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Upload photos or footage/i })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Enter details manually/i })).toBeVisible();

    const input = screen.getByLabelText(/Choose photos or footage/i);
    expect(input).toHaveAttribute("accept", "image/jpeg,image/png,image/webp,video/mp4,video/quicktime");
    fireEvent.change(input, { target: { files: [new File(["footage"], "spokesperson.mov", { type: "video/quicktime" })] } });
    expect(upload.onFiles).toHaveBeenCalledTimes(1);

    upload.onChoiceChange.mockClear();
    fireEvent.click(screen.getByRole("radio", { name: /Enter details manually/i }));
    expect(upload.onChoiceChange).toHaveBeenCalledWith("manual");

    upload.view.unmount();
    const manual = renderSourceChoice({ value: "manual", subject: "service" });
    fireEvent.click(screen.getByRole("button", { name: "Enter details" }));
    expect(manual.onManualStart).toHaveBeenCalledTimes(1);
  });

  it("associates a source-link recovery error with the actual invalid URL field", () => {
    renderSourceChoice({ error: "We couldn’t read that link. Try another link." });

    const url = screen.getByLabelText("Product link");
    const error = screen.getByRole("alert");
    const describedBy = url.getAttribute("aria-describedby") ?? "";

    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(describedBy.split(" ")).toContain(error.id);
    expect(document.getElementById(error.id)).toHaveTextContent("We couldn’t read that link. Try another link.");
  });

  it("keeps source error semantics and controls readable in Arabic RTL", () => {
    renderSourceChoice({ arabic: true, error: "Enter a complete product link beginning with http:// or https://." });

    const url = screen.getByLabelText("رابط المنتج");
    expect(url).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("أدخل رابطاً كاملاً للمنتج.");
    expect(screen.getByRole("radio", { name: /رابط منتج/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("region", { name: "شنو تبي تروّج له؟" })).toHaveAttribute("dir", "rtl");
  });

  it("disables the manual radio for templates that require a primary reference image", () => {
    const { onChoiceChange } = renderSourceChoice({ templateId: "new-york-billboard-takeover" });
    const manual = screen.getByRole("radio", { name: /Enter details manually/i });
    expect(manual).toHaveAttribute("aria-disabled", "true");
    expect(manual).toHaveClass("is-disabled");
    expect(screen.getByText(/Not available for this template/)).toBeVisible();
    fireEvent.click(manual);
    expect(onChoiceChange).not.toHaveBeenCalled();
  });

  it("keeps the manual radio enabled for templates that do not require a primary reference image", () => {
    // clinic-appointment-campaign has explicit requiredInputs that do not include
    // any real video or photo reference, so the manual option stays enabled.
    const { onChoiceChange } = renderSourceChoice({ templateId: "clinic-appointment-campaign" });
    const manual = screen.getByRole("radio", { name: /Enter details manually/i });
    expect(manual).not.toHaveAttribute("aria-disabled");
    fireEvent.click(manual);
    expect(onChoiceChange).toHaveBeenCalledWith("manual");
  });
});
