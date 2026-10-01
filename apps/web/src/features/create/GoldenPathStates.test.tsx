import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreateScreen } from "./CreateScreen";
import { createDraftProject, getCreatorTemplate } from "./templates";

function renderCreateScreen(overrides: Partial<React.ComponentProps<typeof CreateScreen>> = {}) {
  const project = overrides.project ?? createDraftProject("luxury-product-reveal");
  return render(
    <CreateScreen
      project={project}
      template={getCreatorTemplate(project.templateId)}
      durationSeconds={project.durationSeconds}
      linkUrl=""
      quote={null}
      quoteState="loading"
      onFiles={vi.fn()}
      onLinkChange={vi.fn()}
      onImportLink={vi.fn()}
      onCancelImport={vi.fn()}
      onDurationChange={vi.fn()}
      onMessageChange={vi.fn()}
      onChangeTemplate={vi.fn()}
      onGenerate={vi.fn()}
      {...overrides}
    />,
  );
}

describe("golden path create screen states", () => {
  it("keeps an Arabic link draft visible and reports a scan failure in Arabic", () => {
    renderCreateScreen({
      arabic: true,
      linkUrl: "https://noura.example.test/book",
      error: "لم نتمكن من قراءة هذا الرابط. حملتك محفوظة.",
    });

    expect(screen.getByRole("radio", { name: "9:16" })).toBeVisible();
    expect(screen.getByDisplayValue("https://noura.example.test/book")).toBeVisible();
    expect(screen.getByText("لم نتمكن من قراءة هذا الرابط. حملتك محفوظة.")).toBeVisible();
  });

  it("offers four video shapes and reports the chosen one", () => {
    const onAspectRatioChange = vi.fn();
    renderCreateScreen({ onAspectRatioChange });
    for (const ratio of ["9:16", "4:5", "1:1", "16:9"]) {
      expect(screen.getByRole("radio", { name: ratio })).toBeVisible();
    }
    expect(screen.getByRole("radio", { name: "9:16" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "16:9" }));
    expect(onAspectRatioChange).toHaveBeenCalledWith("16:9");
  });

  it("keeps Generate disabled while the price is unavailable and offers one retry", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product = {
      ...project.product,
      name: "Amber No. 7",
      images: [{ id: "amber", name: "amber.jpg", url: "https://example.test/amber.jpg", mimeType: "image/jpeg", source: "upload" }],
    };
    const retry = vi.fn();

    renderCreateScreen({
      project,
      quoteState: "unavailable",
      quoteError: "We couldn't reach the server. Check your connection.",
      quoteFailure: { code: "service_unavailable", message: "unavailable", retryable: true },
      onRetryQuote: retry,
    });

    expect(screen.getByText("We couldn't reach the server. Check your connection.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Generate video/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry price" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("asks for a photo when the template needs one before generating", () => {
    renderCreateScreen({
      quote: { quoteId: "q1", capability: "video.cinematic", credits: 90, entitlementEligible: false, configurationHash: "h", pricingVersion: "test", expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], estimateOnly: false },
      quoteState: "ready",
    });

    expect(screen.getByText(/Add one photo/)).toBeVisible();
    expect(screen.getByRole("button", { name: /Generate video/ })).toBeDisabled();
  });
});
