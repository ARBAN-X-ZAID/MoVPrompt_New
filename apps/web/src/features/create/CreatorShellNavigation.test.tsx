import { render, screen } from "@testing-library/react";
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
  it("offers only Templates and Projects", () => {
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
    expect(workspace.querySelectorAll("a")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Advanced" })).toBeNull();
  });
});
