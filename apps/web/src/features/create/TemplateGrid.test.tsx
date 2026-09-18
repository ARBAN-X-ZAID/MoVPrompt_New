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

  it("renders one usable template in each approved discovery category", () => {
    languageState.locale = "en";
    for (const name of ["Electronics", "Food", "Ecommerce", "Advertising"]) {
      const view = render(
        <MemoryRouter>
          <TemplateGrid onSelect={vi.fn()} />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole("button", { name, pressed: false }));
      const group = within(screen.getByRole("region", { name }));
      expect(group.getAllByRole("button", { name: /Choose .* template/ })).toHaveLength(1);
      expect(screen.queryByRole("region", { name: "Beauty / Cosmetics" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Real Estate / Business Services" })).not.toBeInTheDocument();
      view.unmount();
    }
  });

  it("keeps an already-selected direction selected inside its category", () => {
    languageState.locale = "en";
    const selected = PREVIEWED_CREATOR_TEMPLATES[1]!;
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

  it("shows the advertising direction only inside the Advertising category", () => {
    languageState.locale = "en";
    const advertising = CREATOR_TEMPLATES.find((template) => template.id === "new-york-billboard-takeover")!;
    const hiddenPosterOnlyTemplate = CREATOR_TEMPLATES.find((template) => !template.previewVideo && template.id !== advertising.id)!;
    const onSelect = vi.fn();
    const view = render(
      <MemoryRouter>
        <TemplateGrid onSelect={onSelect} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Advertising", pressed: false }));
    const chooseAdvertising = screen.getByRole("button", { name: `Choose ${advertising.name} template` });
    expect(chooseAdvertising).toBeEnabled();
    fireEvent.click(chooseAdvertising);
    expect(onSelect).toHaveBeenCalledWith(advertising.id);
    expect(screen.queryByRole("button", { name: `Choose ${hiddenPosterOnlyTemplate.name} template` })).not.toBeInTheDocument();
    view.unmount();
  });

  it("filters one template into each discovery category", () => {
    languageState.locale = "en";
    const view = render(
      <MemoryRouter>
        <TemplateGrid onSelect={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button", { name: /Choose .* template/i })).toHaveLength(DISCOVERABLE_CREATOR_TEMPLATES.length);
    for (const category of ["Electronics", "Food", "Ecommerce", "Advertising"]) {
      fireEvent.click(screen.getByRole("button", { name: category, pressed: false }));
      expect(screen.getAllByRole("button", { name: /Choose .* template/i })).toHaveLength(1);
      fireEvent.click(screen.getByRole("button", { name: "All", pressed: false }));
    }
    const advertising = screen.getByRole("button", { name: "Advertising", pressed: false });
    expect(advertising).toBeEnabled();
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
