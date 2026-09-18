import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampaignSetupStep } from "./CampaignSetupStep";
import { createDraftProject } from "./templates";

describe("CampaignSetupStep", () => {
  it("shows only the selected template's settings and requires explicit repair of an old incompatible purpose", () => {
    const project = createDraftProject("app-service");
    project.goal = "bookings";
    project.bookingUrl = "https://example.com/book";
    const onChange = vi.fn();
    const onContinue = vi.fn();
    render(<CampaignSetupStep project={project} onChange={onChange} onContinue={onContinue} options={{ goals: ["demonstration", "launch"], languages: ["en"], ratios: ["9:16"], resolutions: ["480p"] }} />);
    expect(screen.queryByRole("option", { name: "Get bookings" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Kuwaiti Arabic" })).toBeNull();
    expect(screen.queryByRole("option", { name: /720p/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "16:9" })).toBeNull();
    expect(screen.getByRole("button", { name: "Continue to review" })).toBeDisabled();
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Booking link")).toHaveValue(project.bookingUrl);
    fireEvent.change(screen.getByLabelText("Campaign purpose"), { target: { value: "demonstration" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ goal: "demonstration" }), "goal");
  });
  it("validates a supplied optional contact value and keeps it editable", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.whatsapp = "invalid";
    const onContinue = vi.fn();
    render(<CampaignSetupStep project={project} onChange={vi.fn()} onContinue={onContinue} />);
    expect(screen.getByLabelText("WhatsApp number")).toHaveAttribute("aria-required", "false");
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByLabelText("WhatsApp number")).toHaveAttribute("aria-invalid", "true");
  });
  it("shows campaign controls without a price or payment field", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.offer = "A gift with every order";
    project.cta = "Order on WhatsApp";
    const onChange = vi.fn();
    const onContinue = vi.fn();

    render(<CampaignSetupStep project={project} onChange={onChange} onContinue={onContinue} />);

    expect(screen.getByRole("heading", { name: "Set up your campaign" })).toBeVisible();
    expect(screen.getByText("No presenter")).toBeVisible();
    expect(screen.getByLabelText("Market")).toHaveValue("KW");
    expect(screen.queryByLabelText("Price")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Offer")).toHaveValue("A gift with every order");

    fireEvent.change(screen.getByLabelText("Call to action"), { target: { value: "Shop now" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cta: "Shop now" }), "cta");
    fireEvent.click(screen.getByRole("button", { name: "Continue to review" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("keeps Arabic, bilingual and hidden delivery values intact", () => {
    const project = createDraftProject("salon-booking-offer");
    project.promotionKind = "business";
    project.language = "bilingual";
    project.goal = "bookings";
    project.bookingUrl = "https://noura.example/book";
    project.whatsapp = "+96550000000";
    project.product = { ...project.product, name: "Noura Salon" };
    const onChange = vi.fn();

    render(<CampaignSetupStep project={project} onChange={onChange} onContinue={vi.fn()} arabic />);

    expect(screen.getByLabelText("لغة الحملة")).toHaveValue("bilingual");
    expect(screen.getByLabelText("رابط الحجز")).toHaveValue("https://noura.example/book");
    expect(screen.getByLabelText("رقم واتساب")).toHaveValue("+96550000000");
    expect(screen.getByLabelText("رقم واتساب")).toHaveAttribute("aria-required", "false");
    expect(screen.queryByLabelText("السعر")).not.toBeInTheDocument();
    expect(screen.getByLabelText("الدعوة للإجراء")).toHaveValue("Book now");
  });

  it("localizes CTA labels without changing persisted campaign values", () => {
    const project = createDraftProject("luxury-product-reveal");
    const onChange = vi.fn();
    render(<CampaignSetupStep project={project} onChange={onChange} onContinue={vi.fn()} arabic />);

    const cta = screen.getByLabelText("الدعوة للإجراء");
    expect(screen.getByRole("option", { name: "تسوّق الآن · موصى به" })).toHaveValue("Shop now");
    fireEvent.change(cta, { target: { value: "Order on WhatsApp" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ cta: "Order on WhatsApp" }), "cta");
  });
});
