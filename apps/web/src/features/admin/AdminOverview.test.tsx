import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("./api", () => ({ adminApi: { get } }));
import AdminOverview from "./AdminOverview";

const available = (value: number) => ({ value, status: "available" });
const day = (date: string, values: Record<string, number> = {}) => ({ day: date, completed: 0, failed: 0, cancelled: 0, active: 0, cashMinor: 0, ...values });
const overview = (overrides: Record<string, unknown> = {}) => ({
  metrics: {
    newCustomers: available(1),
    activeCustomers: available(2),
    openCases: available(0),
    cashCollectedMinor: available(5000),
  },
  daily: [day("2026-10-30", { completed: 4, failed: 1, cashMinor: 2000 }), day("2026-10-31", { completed: 2, active: 1, cashMinor: 3000 })],
  failures: [{ id: "provider_balance_required", count: 1 }],
  ...overrides,
});

async function renderOverview() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter><AdminOverview /></MemoryRouter>
  </QueryClientProvider>);
  await screen.findByRole("heading", { name: "Failure reasons" });
}

describe("owner overview charts", () => {
  beforeEach(() => get.mockReset());
  afterEach(cleanup);

  it("keeps every headline figure and removes processing time", async () => {
    get.mockResolvedValue(overview({ duration: { meanMs: 60000, sample: 1 } }));
    await renderOverview();
    expect(screen.queryByText(/Processing time/)).toBeNull();
    expect(screen.queryByText(/Average for completed/)).toBeNull();
    expect(screen.getByText("5.000 KWD")).toBeVisible();
    expect(screen.getByRole("link", { name: "View payments" })).toHaveAttribute("href", "/admin/payments");
    expect(screen.getByRole("link", { name: "New customers 1" })).toHaveAttribute("href", "/admin/customers");
    expect(screen.getByRole("link", { name: "Active customers 2" })).toHaveAttribute("href", "/admin/customers?status=active");
    expect(screen.getByRole("link", { name: "Open support cases 0" })).toHaveAttribute("href", "/admin/support?status=open");
    expect(screen.getByText("provider balance required")).toBeVisible();
  });

  it("totals the video outcomes from the daily rows and links each to its list", async () => {
    get.mockResolvedValue(overview());
    await renderOverview();
    expect(screen.getByRole("link", { name: "Completed 6" })).toHaveAttribute("href", "/admin/generations?status=completed");
    expect(screen.getByRole("link", { name: "Failed 1" })).toHaveAttribute("href", "/admin/generations?status=failed");
    expect(screen.getByRole("link", { name: "In progress 1" })).toHaveAttribute("href", "/admin/generations?status=processing");
    expect(screen.getByRole("link", { name: "Cancelled 0" })).toHaveAttribute("href", "/admin/generations?status=cancelled");
    expect(within(screen.getByRole("img", { name: /^Video results/ }).parentElement!).getByText("8")).toBeVisible();
  });

  it("gives screen readers the daily numbers, skipping quiet days", async () => {
    get.mockResolvedValue(overview({ daily: [day("2026-10-29"), day("2026-10-30", { completed: 4, cashMinor: 2000 })] }));
    await renderOverview();
    const table = screen.getByRole("table", { name: "Daily activity" });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("cell", { name: "2.000 KWD" })).toBeInTheDocument();
  });

  it("explains a quiet period instead of drawing empty charts", async () => {
    get.mockResolvedValue(overview({ daily: [day("2026-10-31")], failures: [], metrics: { cashCollectedMinor: available(0) } }));
    await renderOverview();
    expect(screen.getByText("No videos during this period")).toBeVisible();
    expect(screen.getByText("No failures during this period")).toBeVisible();
    expect(screen.queryByRole("img", { name: /^Video results/ })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("says a figure is unavailable rather than showing zero", async () => {
    get.mockResolvedValue(overview({ metrics: { ...overview().metrics, cashCollectedMinor: { value: null, status: "unavailable" }, activeCustomers: { value: null, status: "unavailable" } } }));
    await renderOverview();
    expect(screen.getByRole("link", { name: "Active customers Unavailable" })).toBeVisible();
    expect(screen.getAllByText("Unavailable")).toHaveLength(2);
    expect(screen.queryByText("0.000 KWD")).toBeNull();
    expect(screen.queryByRole("img", { name: "Cash collected per day" })).toBeNull();
  });
});
