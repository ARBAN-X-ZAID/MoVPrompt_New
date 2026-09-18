import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const credits = vi.hoisted(() => ({
  balance: null as number | null,
  loading: false,
  error: "Credit balance is temporarily unavailable." as string | null,
}));

vi.mock("@/hooks/useCredits", () => ({
  useCredits: () => ({ ...credits, reserved: 0, available: null, starterRenderAvailable: false, refresh: vi.fn() }),
}));

vi.mock("./WalletDrawer", () => ({
  WalletDrawer: () => null,
}));

import { CreditBadge } from "./CreditBadge";

describe("CreditBadge", () => {
  it("shows an honest unavailable state when the balance request fails", () => {
    render(<CreditBadge />);

    const button = screen.getByRole("button", { name: /credits unavailable — open wallet/i });
    expect(button).toHaveTextContent("Unavailable");
    expect(button).toHaveAttribute("title", "Credit balance is temporarily unavailable.");
  });

  it("distinguishes loading from an unavailable balance", () => {
    credits.loading = true;
    credits.error = null;
    render(<CreditBadge />);

    expect(screen.getByRole("button", { name: /credits loading — open wallet/i })).toHaveTextContent("…");
    credits.loading = false;
    credits.error = "Credit balance is temporarily unavailable.";
  });
});
