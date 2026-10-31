import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("./api", () => ({ adminApi: { campaign: vi.fn(), get: vi.fn(), list: vi.fn(), payments: vi.fn(), media: (kind: string, id: string) => `/private/${kind}/${id}` } }));
import { adminApi } from "./api";
import AdminCampaignDetail from "./AdminCampaignDetail";
import AdminFinanceDetail from "./AdminFinanceDetail";
import AdminRecordList from "./AdminRecordList";
import AdminPayments from "./AdminPayments";

const id = "a".repeat(24);
const userId = "b".repeat(24);
const runId = "c".repeat(24);
const campaign = {
  record: {
    id, title: "Friday offer", status: "ready", userId, customerName: "Perfume shop", customerEmail: "shop@example.test",
    customer: { id: userId, name: "Perfume shop", email: "shop@example.test" }, templateName: { en: "Perfume ad", ar: "إعلان عطر" },
    durationSeconds: 15, language: "ar", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z",
    generation: { latestRunId: runId, acceptedRunId: runId, status: "completed", creditsUsed: 80 },
  },
  related: { media: [{ id: "d".repeat(24), filename: "bottle.jpg", kind: "product", mimeType: "image/jpeg" }] },
};
let client: QueryClient;
function show(node: React.ReactNode, entry = "/admin") {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[entry]}>{node}</MemoryRouter></QueryClientProvider>);
}
beforeEach(() => vi.resetAllMocks());
afterEach(() => { cleanup(); client?.clear(); });

describe("campaign details", () => {
  it("shows only what an owner needs, with a back button", async () => {
    vi.mocked(adminApi.campaign).mockResolvedValue(campaign as never);
    const { container } = show(<AdminCampaignDetail id={id} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Friday offer" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to campaigns" })).toHaveAttribute("href", "/admin/campaigns");
    expect(screen.getByText("15 seconds")).toBeVisible();
    expect(screen.getByText("Arabic")).toBeVisible();
    expect(screen.getByText("80")).toBeVisible();
    expect(screen.getByRole("button", { name: "bottle.jpg" })).toBeVisible();
    expect(container.textContent).not.toContain(id);
    expect(container.textContent).not.toContain(userId);
    expect(container.textContent).not.toMatch(/prompt|checksum|configuration|version/i);
  });
  it("loads the video only when played and handles campaigns with no video", async () => {
    vi.mocked(adminApi.campaign).mockResolvedValue(campaign as never);
    const { container, unmount } = show(<AdminCampaignDetail id={id} />);
    fireEvent.click(await screen.findByRole("button", { name: "Play final video" }));
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("dialog").querySelector("video")?.getAttribute("src")).toBe(`/private/generation/${runId}`);
    unmount();
    vi.mocked(adminApi.campaign).mockResolvedValue({ ...campaign, record: { ...campaign.record, generation: { latestRunId: null, acceptedRunId: null, status: null, creditsUsed: 0 } }, related: { media: [] } } as never);
    show(<AdminCampaignDetail id={id} />);
    expect(await screen.findByText("No final video yet")).toBeVisible();
    expect(screen.getByText("No photos on this campaign.")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Open generation" })).toBeNull();
  });
  it("returns to the list the owner came from", async () => {
    vi.mocked(adminApi.campaign).mockResolvedValue(campaign as never);
    show(<AdminCampaignDetail id={id} />, `/admin/campaigns/${id}?returnTo=${encodeURIComponent("/admin/campaigns?status=ready&page=3")}`);
    expect(await screen.findByRole("link", { name: "Back to campaigns" })).toHaveAttribute("href", "/admin/campaigns?status=ready&page=3");
  });
});

describe("payment and credit details", () => {
  it("shows a readable payment with its activity", async () => {
    vi.mocked(adminApi.get).mockResolvedValue({ record: { userId, customerName: "Perfume shop", amountMinor: 20_000, currency: "KWD", credits: 250, provider: "upayments", providerReference: "PAY-1", status: "credited", createdAt: "2026-10-01T00:00:00Z", creditedAt: "2026-10-01T00:01:00Z" }, related: { events: [{ _id: "e1", id: "e1", type: "payment.captured", createdAt: "2026-10-01T00:01:00Z" }] } });
    const { container } = show(<AdminFinanceDetail resource="payments" id={id} />);
    expect(await screen.findByRole("heading", { level: 1, name: "20.000 KWD" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to payments" })).toBeVisible();
    expect(screen.getByText("PAY-1")).toBeVisible();
    expect(screen.getByText("payment captured")).toBeVisible();
    expect(container.textContent).not.toContain(userId);
  });
  it("shows a credit entry with signed amount and a link to what caused it", async () => {
    vi.mocked(adminApi.get).mockResolvedValue({ record: { userId, customerName: "Perfume shop", kind: "charge", reason: "video_generation", delta: -80, balanceAfter: 120, referenceType: "render_run", referenceId: runId, createdAt: "2026-10-01T00:00:00Z" }, related: {} });
    show(<AdminFinanceDetail resource="credits" id={id} />);
    expect(await screen.findByRole("heading", { level: 1, name: "Video generation" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to credit ledger" })).toBeVisible();
    expect(screen.getByText("-80")).toBeVisible();
    expect(screen.getByRole("link", { name: "View generation" }).getAttribute("href")).toContain(`/admin/generations/${runId}`);
  });
});

describe("list screens", () => {
  const listed = (items: Record<string, unknown>[], extra = {}) => ({ items, total: items.length, page: 1, limit: 25, source: "synthetic", evaluatedAt: "2026-10-01T00:00:00Z", ...extra });
  it("opens the whole row and remembers filters for Back", async () => {
    vi.mocked(adminApi.list).mockResolvedValue(listed([{ id, name: "Local retailer", email: "shop@example.test", status: "active", createdAt: "2026-10-01T00:00:00Z" }]) as never);
    show(<AdminRecordList resource="customers" />, "/admin/customers?status=active&page=2");
    const row = await screen.findByRole("link", { name: "Open Local retailer" });
    expect(row).toHaveClass("admin-row-link");
    expect(row.getAttribute("href")).toBe(`/admin/customers/${id}?returnTo=${encodeURIComponent("/admin/customers?status=active&page=2")}`);
  });
  it("offers a status menu instead of free typing on campaigns", async () => {
    vi.mocked(adminApi.list).mockResolvedValue(listed([]) as never);
    show(<AdminRecordList resource="campaigns" />);
    const filter = await screen.findByRole("combobox", { name: "Status filter" });
    expect(within(filter).getAllByRole("option").map(option => option.textContent)).toContain("Draft");
    expect(await screen.findByText("No matching records")).toBeVisible();
  });
  it("uses readable labels for credit transaction types", async () => {
    vi.mocked(adminApi.list).mockResolvedValue(listed([]) as never);
    show(<AdminRecordList resource="credits" />);
    const filter = await screen.findByRole("combobox", { name: "Status filter" });
    const options = within(filter).getAllByRole("option").map(option => option.textContent);
    expect(options).toEqual(["All transactions", "Purchase", "Video charge", "Failed video refund", "Cash refund", "Adjustment"]);
  });
  it("shows totals as a lower bound when the count is capped", async () => {
    vi.mocked(adminApi.list).mockResolvedValue(listed([{ id, name: "A", email: "a@example.test", status: "active" }], { total: 10_000, totalCapped: true }) as never);
    show(<AdminRecordList resource="customers" />);
    expect(await screen.findByText(/of 10,000\+/)).toBeVisible();
  });
  it("opens the payment from its row, not the customer", async () => {
    vi.mocked(adminApi.payments).mockResolvedValue({ items: [{ id, userId, customerName: "Perfume shop", customerEmail: "shop@example.test", amountMinor: 5_000, credits: 100, status: "credited", createdAt: "2026-10-01T00:00:00Z" }], total: 1, page: 1, limit: 25, totals: { collected: 5_000, refunded: 0, net: 5_000 } } as never);
    show(<AdminPayments />, "/admin/payments?period=month");
    const row = await screen.findByRole("link", { name: "Open payment 5.000 KWD" });
    expect(row.getAttribute("href")).toContain(`/admin/payments/${id}`);
    expect(screen.queryByRole("link", { name: /Perfume shop/ })).toBeNull();
  });
});
