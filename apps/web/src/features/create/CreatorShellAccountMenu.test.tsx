import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const shellAuth = vi.hoisted(() => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Client Demo", email: "client@example.com" },
    signOut: shellAuth.signOut,
  }),
}));

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en", setLocale: vi.fn() }),
}));

vi.mock("@/components/credits/CreditBadge", () => ({
  CreditBadge: () => <span>0 credits</span>,
}));

import { CreatorShell } from "./CreatorShell";

describe("CreatorShell account menu", () => {
  it("keeps development account navigation payment free and supports sign-out", async () => {
    render(
      <MemoryRouter initialEntries={["/create"]}>
        <CreatorShell><div>Workspace</div></CreatorShell>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: "Advanced" })).not.toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("button", { name: /account menu: client@example.com/i }), {
      button: 0,
      ctrlKey: false,
    });

    expect(await screen.findByRole("menuitem", { name: /account settings/i })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /credits & pricing/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /preferences/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    await waitFor(() => expect(shellAuth.signOut).toHaveBeenCalledTimes(1));
  });
});
