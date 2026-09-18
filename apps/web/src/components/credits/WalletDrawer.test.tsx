import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const creditMocks = vi.hoisted(() => ({
  fetchLedger: vi.fn().mockRejectedValue(new Error("offline")),
  user: { id: "user-1" },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: creditMocks.user }),
}));

vi.mock("@/hooks/useCredits", () => ({
  useCredits: () => ({
    balance: null,
    reserved: 0,
    available: null,
    starterRenderAvailable: false,
    loading: false,
    error: "Credit balance is temporarily unavailable.",
  }),
  fetchLedger: creditMocks.fetchLedger,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

import { WalletDrawer } from "./WalletDrawer";

describe("WalletDrawer", () => {
  it("handles a rejected activity request and shows a recoverable error", async () => {
    render(
      <MemoryRouter>
        <WalletDrawer open onOpenChange={vi.fn()} />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t load recent activity. Close and reopen the wallet to try again.",
    );
    expect(screen.getByText(/We couldn’t load your balance/)).toBeInTheDocument();
  });
});
