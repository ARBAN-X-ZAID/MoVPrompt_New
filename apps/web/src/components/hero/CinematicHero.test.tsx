import { render, screen, waitFor, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";

import { ThemeProvider } from "@/components/ThemeProvider";
import { CinematicHero } from "./CinematicHero";

const languageState = vi.hoisted(() => ({ locale: "en" as "en" | "ar" }));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: languageState.locale }),
}));

function renderHero(locale: "en" | "ar") {
  languageState.locale = locale;
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ThemeProvider>
          <CinematicHero />
        </ThemeProvider>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("CinematicHero scrollable campaign galleries", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exposes both mobile galleries to keyboard users", () => {
    const view = renderHero("en");

    expect(screen.getByRole("group", { name: "Three example campaign directions for one product" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("group", { name: "Product, creator and lifestyle campaign previews" })).toHaveAttribute("tabindex", "0");
    view.unmount();
  });

  it("keeps Advanced Mode out of public homepage navigation", () => {
    const view = renderHero("en");

    expect(screen.queryByRole("link", { name: /^Advanced(?: Studio)?$/ })).not.toBeInTheDocument();
    view.unmount();
  });

  it("localizes the gallery labels for Arabic interface users", () => {
    const view = renderHero("ar");

    expect(screen.getByRole("group", { name: "ثلاثة أمثلة لاتجاهات حملة لمنتج واحد" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("group", { name: "معاينات حملات المنتج وصانع المحتوى ونمط الحياة" })).toHaveAttribute("tabindex", "0");
    view.unmount();
  });

  it("shows only the verified previews", () => {
    const view = renderHero("en");
    const ready = screen.getByRole("region", { name: "Ready previews" });
    expect(within(ready).getAllByRole("button", { name: /Play .* preview/ })).toHaveLength(CATEGORY_PREVIEW_TEMPLATE_IDS.length);
    expect(screen.queryByRole("region", { name: "More campaign directions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Selected direction" })).not.toBeInTheDocument();
    view.unmount();
  });

  it("localizes homepage catalog proof groups for Arabic", async () => {
    const view = renderHero("ar");

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "معاينات جاهزة" })).toBeVisible();
      expect(screen.queryByRole("region", { name: "الاتجاه المحدد" })).not.toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "اتجاهات حملات إضافية" })).not.toBeInTheDocument();
    });
    view.unmount();
  });
});
