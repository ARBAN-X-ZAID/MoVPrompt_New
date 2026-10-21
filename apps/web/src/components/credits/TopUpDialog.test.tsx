import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ creditPackages: vi.fn(), createTopUp: vi.fn() }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/hooks/useCredits", () => ({ useCredits: () => ({ available: 40, balance: 40 }) }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("@/lib/api/portableApiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/portableApiClient")>("@/lib/api/portableApiClient");
  return { ...actual, portableCreatorApi: api };
});

import { PortableApiError } from "@/lib/api/portableApiClient";
import { TopUpDialog } from "./TopUpDialog";

const catalog = (mode: "test" | "live" = "test") => ({
  packages: [
    { id: "credits-100", credits: 100, amountMinor: 5_000, currency: "KWD", popular: false },
    { id: "credits-300", credits: 300, amountMinor: 13_000, currency: "KWD", popular: true },
    { id: "credits-600", credits: 600, amountMinor: 24_000, currency: "KWD", popular: false },
  ],
  payments: { available: true, mode, checkout: mode === "test" ? "instant" as const : "hosted" as const, customAmount: mode === "test" ? { min: 10, max: 10_000 } : null },
  requestId: "r",
});
const order = (credits: number, status = "credited") => ({ id: "a".repeat(24), status, credits, amountMinor: credits * 50, currency: "KWD", provider: "manual", packageId: null, createdAt: new Date(0).toISOString(), creditedAt: null });

function renderDialog() {
  return render(<MemoryRouter><TopUpDialog open onOpenChange={vi.fn()} /></MemoryRouter>);
}

describe("TopUpDialog", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("lists packages with KWD prices, preselects the popular one and flags test mode", async () => {
    api.creditPackages.mockResolvedValue(catalog());
    renderDialog();
    expect(await screen.findByRole("radio", { name: /300 credits/ })).toBeChecked();
    expect(screen.getByText(/13\.000/)).toBeInTheDocument();
    expect(screen.getByRole("note")).toHaveTextContent("no payment is taken");
    expect(screen.getByRole("button", { name: "Add 300 credits" })).toBeEnabled();
  });

  it("adds credits and shows the confirmation", async () => {
    api.creditPackages.mockResolvedValue(catalog());
    api.createTopUp.mockResolvedValue({ order: order(300), checkoutUrl: null, requestId: "r" });
    renderDialog();
    fireEvent.click(await screen.findByRole("button", { name: "Add 300 credits" }));
    expect(await screen.findByRole("heading", { name: "300 credits added" })).toBeInTheDocument();
    expect(api.createTopUp).toHaveBeenCalledWith({ packageId: "credits-300", language: "en" }, expect.stringMatching(/^topup:/));
  });

  it("validates custom amounts before submitting", async () => {
    api.creditPackages.mockResolvedValue(catalog());
    api.createTopUp.mockResolvedValue({ order: order(250), checkoutUrl: null, requestId: "r" });
    renderDialog();
    const input = await screen.findByLabelText("Credits to add");
    fireEvent.change(input, { target: { value: "5" } });
    expect(screen.getByRole("alert")).toHaveTextContent("from 10 to 10000");
    expect(screen.getByRole("button", { name: "Choose an amount" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Add 250 credits" }));
    await waitFor(() => expect(api.createTopUp).toHaveBeenCalledWith({ customCredits: 250, language: "en" }, expect.any(String)));
  });

  it("hides custom amounts for live gateways and sends the customer to the payment page", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    api.creditPackages.mockResolvedValue(catalog("live"));
    api.createTopUp.mockResolvedValue({ order: order(300, "pending"), checkoutUrl: "https://pay.example.test/x", requestId: "r" });
    renderDialog();
    await screen.findByRole("radio", { name: /300 credits/ });
    expect(screen.queryByLabelText("Credits to add")).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByText(/pay securely by KNET or card/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Pay KWD\s*13\.000$/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://pay.example.test/x"));
    vi.unstubAllGlobals();
  });

  it("explains when top-ups are not available yet", async () => {
    api.creditPackages.mockRejectedValue(new PortableApiError("x", "payments_unavailable", true, undefined, 503));
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent("Top-ups aren't available yet.");
  });

  it("shows the unavailable message instead of packages when no payment provider is configured", async () => {
    api.creditPackages.mockResolvedValue({ ...catalog("live"), payments: { available: false, mode: "live", checkout: "hosted", customAmount: null } });
    renderDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent("Top-ups aren't available yet.");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});
