import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() }),
}));

vi.mock("@/components/credits/CreditBadge", () => ({
  CreditBadge: () => null,
}));

import { CreatorShell } from "./CreatorShell";

describe("CreatorShell navigation", () => {
  it("highlights Templates when reopening a custom-form ad project in the shared creator", () => {
    render(<MemoryRouter initialEntries={["/projects/existing"]}><CreatorShell templateId="female-product-review">Workspace</CreatorShell></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Templates" })).toHaveClass("is-active");
    expect(screen.getByRole("link", { name: "Ad Studio" })).not.toHaveClass("is-active");
  });
  it("keeps section switching and sign-in tied to the current draft", () => {
    render(<MemoryRouter initialEntries={["/ad-studio?draft=saved&project=campaign"]}><CreatorShell>Workspace</CreatorShell></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Ad Studio" })).toHaveClass("is-active");
    expect(screen.getByRole("link", { name: "Templates" })).toHaveAttribute("href", "/templates?draft=saved&project=campaign");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?next=%2Fad-studio%3Fdraft%3Dsaved%26project%3Dcampaign");
    fireEvent.click(screen.getByRole("button", { name: /menu/i }));
    expect(within(screen.getByRole("navigation", { name: "Mobile creator workspace" })).getByRole("link", { name: "Ad Studio" })).toHaveAttribute("href", "/ad-studio?draft=saved&project=campaign");
  });
  it("offers Templates, Ad Studio and Projects", () => {
    render(
      <MemoryRouter initialEntries={["/templates"]}>
        <CreatorShell>
          <div>Workspace</div>
        </CreatorShell>
      </MemoryRouter>,
    );

    const workspace = screen.getByRole("navigation", { name: "Creator workspace" });
    expect(screen.getByRole("link", { name: "MovPrompt home" })).toHaveAttribute("href", "/templates");
    expect(screen.getByRole("link", { name: "Templates" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Projects" })).toBeVisible();
    expect(workspace.querySelectorAll("a")).toHaveLength(3);
    expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Advanced" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?next=/templates");
  });
});
