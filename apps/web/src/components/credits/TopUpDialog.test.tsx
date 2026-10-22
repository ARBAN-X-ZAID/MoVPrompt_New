import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({ creditPackages: vi.fn(), createTopUp: vi.fn(), topUpOrder: vi.fn() }));

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
  payments: { available: true, mode, checkout: mode === "test" ? "instant" as const : "hosted" as const, customAmount: { min: 10, max: 10_000, amountMinorPerCredit: 50 } },
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

  it("prices a custom amount and opens the payment page in a new tab, keeping this tab signed in", async () => {
    const tab = { closed: false, opener: {}, document: { title: "", body: { textContent: "" } }, location: { replace: vi.fn() }, close: vi.fn() };
    vi.stubGlobal("open", vi.fn(() => tab));
    api.creditPackages.mockResolvedValue(catalog("live"));
    api.createTopUp.mockResolvedValue({ order: order(250, "pending"), checkoutUrl: "https://pay.example.test/x", requestId: "r" });
    api.topUpOrder.mockResolvedValue(order(250, "credited"));
    renderDialog();
    fireEvent.change(await screen.findByLabelText("Credits to add"), { target: { value: "250" } });
    expect(screen.getByText(/12\.500/, { selector: ".top-up-option-price" })).toBeInTheDocument();
    expect(screen.getByText(/pay securely by KNET or card/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Pay KWD\s*12\.500$/ }));
    expect(await screen.findByRole("heading", { name: "Complete your payment in the new tab" })).toBeInTheDocument();
    expect(tab.location.replace).toHaveBeenCalledWith("https://pay.example.test/x");
    expect(tab.opener).toBeNull();
    expect(await screen.findByRole("heading", { name: "250 credits added" }, { timeout: 5_000 })).toBeInTheDocument();
    expect(api.topUpOrder).toHaveBeenCalledWith("a".repeat(24));
    vi.unstubAllGlobals();
  });

  it("falls back to the same tab when the browser blocks the new tab", async () => {
    const assign = vi.fn();
    vi.stubGlobal("open", vi.fn(() => null));
    vi.stubGlobal("location", { ...window.location, assign });
    api.creditPackages.mockResolvedValue(catalog("live"));
    api.createTopUp.mockResolvedValue({ order: order(300, "pending"), checkoutUrl: "https://pay.example.test/x", requestId: "r" });
    renderDialog();
    await screen.findByRole("radio", { name: /300 credits/ });
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
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
