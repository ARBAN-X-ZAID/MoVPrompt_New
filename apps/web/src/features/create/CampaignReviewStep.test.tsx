import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CampaignReviewStep } from "./CampaignReviewStep";
import { createDraftProject, templateRequiresSourceMedia } from "./templates";

describe("CampaignReviewStep", () => {
  it("renders an exact product review and routes each group to its owning step", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product = {
      ...project.product,
      sourceType: "product_link",
      sourceUrl: "https://example.test/products/amber",
      name: "Amber No. 7",
      description: "A concentrated parfum extract.",
      brand: "Northfield",
      price: "12.500",
      images: [{ id: "amber", name: "amber.jpg", url: "https://example.test/amber.jpg", mimeType: "image/jpeg", source: "url" }],
    };
    project.source = {
      kind: "product_url",
      subject: "product",
      assetKeys: [],
      facts: [
        { field: "name", value: "Amber No. 7", provenance: "imported" },
        { field: "price", value: "12.500", provenance: "user_confirmed" },
      ],
    };
    project.offer = "Gift wrapping included";
    project.whatsapp = "+965 5000 0000";
    const onEdit = vi.fn();
    const onGenerate = vi.fn();

    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "quote-amber", capability: "video.product_fidelity", credits: 120, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "campaign-amber", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={onEdit}
        onGenerate={onGenerate}
      />,
    );

    expect(screen.getByRole("heading", { name: "Review your campaign" })).toBeVisible();
    expect(screen.getByText("Source")).toBeVisible();
    expect(screen.getByText("Campaign")).toBeVisible();
    expect(screen.getByText("Presenter and media")).toBeVisible();
    expect(screen.getByText("Delivery")).toBeVisible();
    expect(screen.getByText("Rights")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Price" })).toBeVisible();
    expect(screen.getByText("Imported")).toBeVisible();
    expect(screen.getByText("120 credits")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Edit source" }));
    expect(onEdit).toHaveBeenCalledWith("source");
    fireEvent.click(screen.getByRole("button", { name: "Generate campaign" }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("keeps development generation open without showing prices or credits", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product = {
      ...project.product,
      name: "Amber No. 7",
      price: "12.500",
      images: [{ id: "amber", name: "amber.jpg", url: "https://example.test/amber.jpg", mimeType: "image/jpeg", source: "url" }],
    };
    project.source = {
      kind: "product_upload",
      subject: "product",
      assetKeys: [],
      facts: [
        { field: "name", value: "Amber No. 7", provenance: "manual" },
        { field: "price", value: "12.500", provenance: "manual" },
      ],
    };
    const onGenerate = vi.fn();

    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        hidePricing
        quote={{ quoteId: "local-session", capability: "video.product_fidelity", credits: 0, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "local", pricingVersion: "development-free-v1", estimateOnly: false }}
        quoteState="ready"
        onEdit={vi.fn()}
        onGenerate={onGenerate}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Price" })).not.toBeInTheDocument();
    expect(screen.queryByText(/credits/i)).not.toBeInTheDocument();
    expect(screen.queryByText("12.500 KWD")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Generate campaign" }));
    expect(onGenerate).toHaveBeenCalledOnce();
  });

  it("keeps an Arabic service review direction-safe and blocks generation for an expired quote", () => {
    const project = createDraftProject("gcc-offer-launch");
    project.promotionKind = "business";
    project.language = "ar";
    project.product = {
      ...project.product,
      sourceType: "business_link",
      sourceUrl: "https://noura.example.test/book",
      name: "صالون نورة",
      description: "عناية بالشعر والبشرة",
      price: "18.000",
    };
    project.location = "السالمية، الكويت";
    project.bookingUrl = "https://noura.example.test/book";
    project.whatsapp = "+965 50000000";
    project.source = {
      kind: "business_url",
      subject: "service",
      assetKeys: [],
      facts: [
        { field: "service_name", value: "صالون نورة", provenance: "user_confirmed" },
        { field: "location", value: "السالمية، الكويت", provenance: "imported" },
        { field: "booking_url", value: "https://noura.example.test/book", provenance: "manual" },
        { field: "whatsapp", value: "+965 50000000", provenance: "manual" },
      ],
    };

    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed={false}
        quote={null}
        quoteState="expired"
        arabic
        onEdit={vi.fn()}
        onGenerate={vi.fn()}
        onRetryQuote={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "راجع حملتك" })).toBeVisible();
    expect(screen.getAllByText("https://noura.example.test/book")[0]).toHaveAttribute("dir", "ltr");
    expect(screen.getByRole("button", { name: "حدّث السعر" })).toBeVisible();
    expect(screen.getByRole("button", { name: "أنشئ الحملة" })).toBeDisabled();
  });

  it("requires the client image for a manual service launch template", () => {
    const project = createDraftProject("app-service");
    project.promotionKind = "business";
    project.product = { ...project.product, name: "Skin consultation" };
    project.source = {
      kind: "service_manual",
      subject: "service",
      assetKeys: [],
      facts: [{ field: "service_name", value: "Skin consultation", provenance: "manual" }],
    };
    const onGenerate = vi.fn();

    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "quote-service", capability: "video.product_fidelity", credits: 120, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "service", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={vi.fn()}
        onGenerate={onGenerate}
      />,
    );

    expect(screen.getByRole("button", { name: "Generate campaign" })).toBeDisabled();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("still blocks a manual product campaign when its selected template requires a visual reference", () => {
    const project = createDraftProject("luxury-product-reveal");
    project.product = { ...project.product, sourceType: "upload", name: "Oud oil", images: [] };
    project.source = {
      kind: "product_upload",
      subject: "product",
      assetKeys: [],
      facts: [{ field: "name", value: "Oud oil", provenance: "manual" }],
    };

    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "quote-product", capability: "video.product_fidelity", credits: 120, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "product", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Generate campaign" })).toBeDisabled();
    // The same specific message appears in both the inline missing-source list and the
    // bottom-of-page paragraph so the screen reader and the visual UI agree.
    expect(screen.getAllByText("Upload at least one product photo to continue.").length).toBeGreaterThan(0);
  });

  it("derives the media requirement from the immutable template recipe", () => {
    expect(templateRequiresSourceMedia("luxury-product-reveal")).toBe(true);
    expect(templateRequiresSourceMedia("app-service")).toBe(true);
  });

  it("names the missing product name specifically and links back to the source step", () => {
    const project = createDraftProject("premium-phone-reveal");
    project.product = {
      ...project.product,
      sourceType: "upload",
      name: "",
      images: [{ id: "phone", name: "phone.jpg", url: "blob:phone", mimeType: "image/jpeg", source: "upload" }],
    };
    project.source = {
      kind: "product_upload",
      subject: "product",
      assetKeys: [],
      facts: [],
    };
    const onEdit = vi.fn();
    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "q1", capability: "video.cinematic", credits: 100, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "h", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={onEdit}
        onGenerate={vi.fn()}
      />,
    );

    // The new inline list summarizes each missing field with a clickable "Edit source" link.
    const listHeading = screen.getByText(/Before you can generate/);
    expect(listHeading).toBeVisible();
    const phoneLabels = screen.getAllByText("Add a phone model or product name to continue.");
    expect(phoneLabels.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Generate campaign" })).toBeDisabled();

    // Clicking the inline list's "Edit source" button jumps back to the source step
    const missingLinks = screen.getAllByRole("button", { name: "Edit source" });
    fireEvent.click(missingLinks[missingLinks.length - 1]!);
    expect(onEdit).toHaveBeenCalledWith("source");
  });

  it("names the missing image specifically for image-first templates", () => {
    const project = createDraftProject("new-york-billboard-takeover");
    project.product = {
      ...project.product,
      sourceType: "upload",
      name: "Northfield Cola",
      images: [],
    };
    project.source = {
      kind: "product_upload",
      subject: "product",
      assetKeys: [],
      facts: [{ field: "name", value: "Northfield Cola", provenance: "manual" }],
    };
    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "q2", capability: "video.cinematic", credits: 100, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "h", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    const matches = screen.getAllByText("Upload at least one product photo to continue.");
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Generate campaign" })).toBeDisabled();
  });

  it("names both missing source name and media together", () => {
    const project = createDraftProject("premium-phone-reveal");
    project.product = { ...project.product, sourceType: "upload", name: "", images: [] };
    project.source = {
      kind: "product_upload",
      subject: "product",
      assetKeys: [],
      facts: [],
    };
    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "q3", capability: "video.cinematic", credits: 100, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "h", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    const phoneLabels = screen.getAllByText("Add a phone model or product name to continue.");
    const mediaLabels = screen.getAllByText("Upload at least one product photo to continue.");
    expect(phoneLabels.length).toBeGreaterThan(0);
    expect(mediaLabels.length).toBeGreaterThan(0);
  });

  it("asks for a Kuwait WhatsApp number when the goal is whatsapp_orders and the number is empty", () => {
    const project = createDraftProject("restaurant-food-hero");
    project.goal = "whatsapp_orders";
    project.product = {
      ...project.product,
      sourceType: "upload",
      name: "Mandi Rice",
      images: [{ id: "rice", name: "rice.jpg", url: "blob:rice", mimeType: "image/jpeg", source: "upload" }],
    };
    project.whatsapp = "";
    project.source = {
      kind: "product_upload",
      subject: "product",
      assetKeys: [],
      facts: [{ field: "name", value: "Mandi Rice", provenance: "manual" }],
    };
    render(
      <CampaignReviewStep
        project={project}
        rightsConfirmed
        quote={{ quoteId: "q4", capability: "video.cinematic", credits: 100, entitlementEligible: false, expiresAt: new Date(Date.now() + 60_000).toISOString(), breakdown: [], configurationHash: "h", pricingVersion: "test", estimateOnly: false }}
        quoteState="ready"
        onEdit={vi.fn()}
        onGenerate={vi.fn()}
      />,
    );

    expect(screen.getByText("Add a Kuwait WhatsApp number to continue.")).toBeVisible();
  });
});
