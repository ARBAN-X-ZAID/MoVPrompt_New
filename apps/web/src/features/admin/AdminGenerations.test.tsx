import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminGenerationSummary } from "@movprompt/contracts";
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
vi.mock("./api", () => ({ adminApi: { generations: vi.fn(), generation: vi.fn(), media: (_kind: string, id: string) => `/private/${id}` } }));
import { adminApi } from "./api";
import AdminGenerations from "./AdminGenerations";
import { generationTime } from "./generationTime";
import { DataValue } from "./AdminDisplay";
const row: AdminGenerationSummary = {
  id: "000000000000000000000101", campaign: { id: "000000000000000000000102", name: "Friday offer" },
  customer: { id: "000000000000000000000103", name: "Perfume shop", email: "shop@example.test" },
  template: { id: "000000000000000000000104", name: { en: "Perfume ad", ar: "إعلان عطر" } },
  status: "completed", createdAt: "2026-10-01T00:00:00Z", finishedAt: "2026-10-01T00:02:18Z", elapsedSeconds: 138,
  timing: "finished", mediaAvailable: true, failure: null,
};
let client: QueryClient;
function show(id?: string) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><AdminGenerations id={id} /></MemoryRouter></QueryClientProvider>);
}
afterEach(() => { cleanup(); client?.clear(); vi.clearAllMocks(); });
describe("readable generation workspace", () => {
  it("shows labels instead of identifiers and previews exactly the selected run without autoplay", async () => {
    vi.mocked(adminApi.generations).mockResolvedValue({ items: [row], total: 1, page: 1, limit: 25, templates: [{ id: row.template.id!, name: row.template.name }] });
    const { container } = show();
    expect(await screen.findByText("Friday offer")).toBeVisible();
    expect(screen.getByText("shop@example.test")).toBeVisible();
    expect(screen.getByText("2 min 18 sec")).toBeVisible();
    expect(container.textContent).not.toContain(row.id);
    expect(container.textContent).not.toContain(row.customer.id);
    // Rows must not stream anything until the owner presses play.
    expect(container.querySelector("video")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Play Friday offer" }));
    const player = screen.getByRole("dialog").querySelector("video");
    expect(player?.getAttribute("src")).toBe(`/private/${row.id}`);
    expect(player?.autoplay).toBe(false);
    fireEvent.change(screen.getByLabelText("Customer or campaign"), { target: { value: "perfume" } });
    await waitFor(() => expect(vi.mocked(adminApi.generations).mock.calls.at(-1)?.[0].get("search")).toBe("perfume"));
  });
  it("shows unavailable terminal timing and never plays a failed generation", async () => {
    vi.mocked(adminApi.generation).mockResolvedValue({ ...row, status: "failed", mediaAvailable: false, elapsedSeconds: null, timing: "unavailable", finishedAt: null });
    const { container } = show(row.id);
    expect((await screen.findAllByText("Unavailable"))[0]).toBeVisible();
    expect(container.querySelector("video")).toBeNull();
    expect(screen.getByRole("button", { name: "No completed video" })).toBeDisabled();
    expect(generationTime({ ...row, timing: "elapsed", elapsedSeconds: 7 }, false)).toBe("Elapsed · 7 sec");
  });
  it("removes nested internal metadata without altering customer text or payment references", () => {
    const { container } = render(<DataValue ar={false} value={{ _id: row.id, userId: row.customer.id, nested: { projectVersionId: row.id, name: "Customer-approved words", providerReference: "PAY-1234" } }} />);
    expect(container.textContent).not.toContain(row.id);
    expect(container.textContent).not.toContain(row.customer.id);
    expect(container.textContent).toContain("Customer-approved words");
    expect(container.textContent).toContain("PAY-1234");
  });
});
