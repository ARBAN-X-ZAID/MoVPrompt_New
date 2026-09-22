import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";

import { TemplateGrid } from "./TemplateGrid";
import { CREATOR_TEMPLATES, DISCOVERABLE_CREATOR_TEMPLATES, PREVIEWED_CREATOR_TEMPLATES } from "./templates";

const languageState = vi.hoisted(() => ({ locale: "en" as "en" | "ar" }));
const featureState = vi.hoisted(() => ({ portableAuth: false }));
const catalogApi = vi.hoisted(() => ({ listTemplates: vi.fn(), getTemplate: vi.fn() }));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: languageState.locale }),
}));

vi.mock("@/config/features", () => ({
  isFeatureEnabled: (feature: string) => feature === "portableAuth" ? featureState.portableAuth : false,
}));

vi.mock("@/lib/api/portableApiClient", () => ({ portableCreatorApi: catalogApi }));

describe("TemplateGrid", () => {
  const originalPreviews = CREATOR_TEMPLATES.map(t => t.previewVideo);
  afterEach(() => {
    CREATOR_TEMPLATES.forEach((t, i) => { t.previewVideo = originalPreviews[i]!; });
    featureState.portableAuth = false;
    catalogApi.listTemplates.mockReset();
    catalogApi.getTemplate.mockReset();
  });
  it("offers an explicit way to continue with the already-selected template", () => {
    languageState.locale = "en";
    const onSelect = vi.fn();
    const selectedId = CREATOR_TEMPLATES[0]!.id;
    const view = render(
      <MemoryRouter>
        <TemplateGrid selectedId={selectedId} onSelect={onSelect} />
      </MemoryRouter>,
    );

    const card = screen.getByTestId(`v2-${selectedId}`);
    expect(card).toHaveAttribute("data-template-selected", "true");
    fireEvent.click(within(card).getByRole("button", { name: /Choose .* template/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(selectedId);
    view.unmount();
  });

  it("renders verified motion previews for every approved launch template", () => {
    languageState.locale = "en";
    const view = render(
      <MemoryRouter>
        <TemplateGrid onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    expect(view.container.querySelectorAll("video")).toHaveLength(0);
    expect(screen.queryByText("Video preview coming later")).not.toBeInTheDocument();
    expect(view.container.querySelectorAll(".creator-template-card-v2")).toHaveLength(DISCOVERABLE_CREATOR_TEMPLATES.length);
    expect(view.container.querySelectorAll<HTMLImageElement>(".creator-template-card-v2 img")[0]).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Play .* preview/i })).toHaveLength(CATEGORY_PREVIEW_TEMPLATE_IDS.length);
    expect(screen.queryByRole("link", { name: /View .* details/ })).not.toBeInTheDocument();
    view.unmount();
  });

  it("renders the verified templates in their discovery categories", () => {
    languageState.locale = "en";
    const expected = {
      Electronics: DISCOVERABLE_CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "electronics").length,
      Food: DISCOVERABLE_CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "food").length,
      Ecommerce: DISCOVERABLE_CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "ecommerce").length,
      Advertising: DISCOVERABLE_CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "advertising").length,
      Brand: DISCOVERABLE_CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "brand").length,
    };
    expect(CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "electronics")).toHaveLength(2);
    expect(CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "food")).toHaveLength(2);
    expect(CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "ecommerce")).toHaveLength(1);
    expect(CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "advertising")).toHaveLength(2);
    expect(CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === "brand")).toHaveLength(1);
    for (const [name, count] of Object.entries(expected)) {
      const view = render(
        <MemoryRouter>
          <TemplateGrid onSelect={vi.fn()} />
        </MemoryRouter>,
      );
      const filter = screen.getByRole("button", { name, pressed: false });
      if (count === 0) {
        expect(filter).toBeDisabled();
        view.unmount();
        continue;
      }
      fireEvent.click(filter);
      const group = within(screen.getByRole("region", { name }));
      expect(group.getAllByRole("button", { name: /Choose .* template/ })).toHaveLength(count);
      expect(screen.queryByRole("region", { name: "Beauty / Cosmetics" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Real Estate / Business Services" })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("keeps an already-selected direction selected inside its category", () => {
    languageState.locale = "en";
    const selected = PREVIEWED_CREATOR_TEMPLATES.find((template) => template.id === "restaurant-food-hero")!;
    const view = render(
      <MemoryRouter>
        <TemplateGrid selectedId={selected.id} onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Food", pressed: false }));
    const selectedGroup = screen.getByRole("region", { name: "Food" });
    const selectedCard = within(selectedGroup).getByTestId(`v2-${selected.id}`);
    expect(selectedCard).toHaveAttribute("data-template-selected", "true");
    expect(within(selectedCard).getByRole("button", { name: /Play .* preview/i })).toBeVisible();
    view.unmount();
  });

  it("localizes catalog proof groups in Arabic", () => {
    languageState.locale = "ar";
    const view = render(
      <MemoryRouter>
        <TemplateGrid onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "الإلكترونيات", pressed: false }));
    expect(screen.getByRole("region", { name: "الإلكترونيات" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "الأطعمة", pressed: false }));
    expect(screen.getByRole("region", { name: "الأطعمة" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "الإعلانات", pressed: false }));
    expect(screen.getByRole("region", { name: "الإعلانات" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "العقار وخدمات الأعمال" })).not.toBeInTheDocument();
    view.unmount();
  });

  it("shows the advertising directions only inside the Advertising category", () => {
    languageState.locale = "en";
    const advertising = CREATOR_TEMPLATES.find((template) => template.id === "new-york-billboard-takeover")!;
    const fashion = CREATOR_TEMPLATES.find((template) => template.id === "fashion-product-showcase")!;
    const food = CREATOR_TEMPLATES.find((template) => template.id === "restaurant-food-hero")!;
    const onSelect = vi.fn();
    const view = render(
      <MemoryRouter>
        <TemplateGrid onSelect={onSelect} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Advertising", pressed: false }));
    const chooseAdvertising = screen.getByRole("button", { name: `Choose ${advertising.name} template` });
    expect(chooseAdvertising).toBeEnabled();
    expect(screen.getByRole("button", { name: `Choose ${fashion.name} template` })).toBeEnabled();
    fireEvent.click(chooseAdvertising);
    expect(onSelect).toHaveBeenCalledWith(advertising.id);
    expect(screen.queryByRole("button", { name: `Choose ${food.name} template` })).not.toBeInTheDocument();
    view.unmount();
  });

  it("filters discoverable templates into their discovery categories", () => {
    languageState.locale = "en";
    const view = render(
      <MemoryRouter>
        <TemplateGrid onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button", { name: /Choose .* template/i })).toHaveLength(DISCOVERABLE_CREATOR_TEMPLATES.length);
    const filters = [
      ["Electronics", "electronics"],
      ["Food", "food"],
      ["Ecommerce", "ecommerce"],
      ["Advertising", "advertising"],
      ["Brand", "brand"],
    ] as const;
    for (const [label, category] of filters) {
      const count = DISCOVERABLE_CREATOR_TEMPLATES.filter((template) => template.discoveryCategory === category).length;
      const filter = screen.getByRole("button", { name: label, pressed: false });
      if (count === 0) {
        expect(filter).toBeDisabled();
        continue;
      }
      fireEvent.click(filter);
      expect(screen.getAllByRole("button", { name: /Choose .* template/i })).toHaveLength(count);
      fireEvent.click(screen.getByRole("button", { name: "All", pressed: false }));
    }
    expect(screen.getByRole("button", { name: "Advertising", pressed: false })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Brand", pressed: false })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: /Choose .* template/i })).toHaveLength(DISCOVERABLE_CREATOR_TEMPLATES.length);
    view.unmount();
  });

  it("makes local fallback previews nonselectable until the published catalog is available", async () => {
    languageState.locale = "en";
    featureState.portableAuth = true;
    catalogApi.listTemplates.mockRejectedValue(new Error("catalog offline"));
    const onSelect = vi.fn();
    const view = render(<MemoryRouter><TemplateGrid onSelect={onSelect} /></MemoryRouter>);

    await screen.findByText("Local template previews are available to view only while the published catalog reconnects.");
    const firstCard = screen.getByTestId(`v2-${CREATOR_TEMPLATES[0]!.id}`);
    const chooseButton = within(firstCard).getByRole("button", { name: /Choose .* template/i });
    expect(chooseButton).toBeDisabled();
    fireEvent.click(chooseButton);
    expect(onSelect).not.toHaveBeenCalled();

    catalogApi.listTemplates.mockResolvedValue([]);
    fireEvent.click(screen.getByRole("button", { name: "Retry catalog" }));
    await waitFor(() => expect(screen.getByText("Local template previews are available to view only while the published catalog reconnects.")).toBeVisible());
    view.unmount();
  });
});
