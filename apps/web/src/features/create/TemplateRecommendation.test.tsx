import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TemplateRecommendations } from "./TemplateRecommendationCards";
import { OutcomeStep } from "./OutcomeStep";
import { CREATOR_TEMPLATES } from "./templates";

const props = {
  templates: CREATOR_TEMPLATES,
  goal: "launch" as const,
  vertical: "ecommerce" as const,
  language: "en" as const,
  aspectRatio: "9:16" as const,
  hasSource: true,
  configurationForTemplate: vi.fn(() => ({
    prompt: "confirmed source",
    durationSeconds: 8,
    aspectRatio: "9:16" as const,
    resolution: "720p" as const,
    audio: true,
    templateQuoteContext: { market: "KW", language: "en", goal: "launch", presenterMode: "none", bookingUrl: "", subtitles: true },
    creativeBrief: {} as never,
    references: [],
  })),
  quoteStateForTemplate: () => ({
    status: "ready" as const,
    key: "quoted-template",
    retryable: false,
    quote: { quoteId: "quote-1", credits: 42, expiresAt: "2099-01-01T00:00:00.000Z", entitlementEligible: false },
    retry: vi.fn(),
  } as never),
};

describe("TemplateRecommendations", () => {
  it("lets keyboard users change the selected outcome", () => {
    const onChange = vi.fn();
    render(<OutcomeStep value="launch" onChange={onChange} />);

    const selected = screen.getByRole("radio", { name: /Launch something new/ });
    fireEvent.keyDown(selected, { key: "ArrowRight" });

    expect(onChange).toHaveBeenCalledWith("offer");
    expect(screen.getByRole("radio", { name: /Launch something new/ })).toHaveAttribute("tabindex", "0");
  });

  it("quoted recommendation tracer selects an exact ready template and quote", () => {
    const onSelect = vi.fn();
    expect(TemplateRecommendations).toBeTypeOf("function");
    render(<TemplateRecommendations {...props} onSelect={onSelect} />);

    const card = screen.getAllByRole("article")[0]!;
    expect(card).toHaveTextContent("Why this fits");
    expect(card).toHaveTextContent("Confirmed price");
    expect(card).toHaveTextContent("No presenter available for this campaign");
    fireEvent.click(screen.getAllByRole("button", { name: "Use this template" })[0]!);

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      template: expect.objectContaining({ goals: expect.arrayContaining(["launch"]) }),
      quote: expect.objectContaining({ quoteId: "quote-1" }),
    }));
  });

  it("shows one actionable empty result without a confirmed source", () => {
    render(<TemplateRecommendations {...props} hasSource={false} onSelect={vi.fn()} />);

    expect(screen.getByText("No template fits this setup yet")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Use this template" })).not.toBeInTheDocument();
  });

  it("allows template selection while pricing remains unavailable", () => {
    const onSelect = vi.fn();
    render(
      <TemplateRecommendations
        {...props}
        quoteStateForTemplate={() => ({
          status: "unavailable",
          key: "quoted-template",
          quote: null,
          retryable: true,
          failure: { code: "pricing_unavailable", retryable: true },
          retry: vi.fn(),
        } as never)}
        onSelect={onSelect}
      />,
    );

    expect(screen.getAllByText("Price unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Retry price" }).length).toBeGreaterThan(0);
    expect(screen.queryByText("42 credits")).not.toBeInTheDocument();
    const selectButton = screen.getAllByRole("button", { name: "Use this template" })[0]!;
    expect(selectButton).toBeEnabled();
    fireEvent.click(selectButton);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      template: expect.objectContaining({ goals: expect.arrayContaining(["launch"]) }),
      quote: null,
    }));
  });

  it("asks the customer to review a changed quote instead of substituting a price", () => {
    render(
      <TemplateRecommendations
        {...props}
        quoteStateForTemplate={() => ({
          status: "changed",
          key: "quoted-template",
          quote: null,
          retryable: true,
          retry: vi.fn(),
        } as never)}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Price updated").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Review new price" }).length).toBeGreaterThan(0);
  });

  it("localizes the fail-closed presenter state for Arabic without advertising unavailable people options", () => {
    render(<TemplateRecommendations {...props} onSelect={vi.fn()} arabic />);

    expect(screen.getAllByText("لا يوجد مقدّم متاح لهذه الحملة").length).toBeGreaterThan(0);
    expect(screen.queryByText("مقدّم محتوى UGC متاح")).not.toBeInTheDocument();
  });
});
