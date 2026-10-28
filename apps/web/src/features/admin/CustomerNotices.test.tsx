import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "synthetic-user" } }),
}));
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "ar" }),
}));
vi.mock("@/config/features", () => ({ isFeatureEnabled: () => true }));
vi.mock("@/lib/api/portableApiClient", () => ({ request: mocks.request }));
import { CustomerNotices } from "./CustomerNotices";
describe("published customer notice reader", () => {
  it("shows exact Arabic text and keeps maintenance visible after dismissing an announcement", async () => {
    mocks.request.mockResolvedValue({
      items: [
        {
          id: "one",
          revision: 1,
          kind: "announcement",
          title: { en: "Notice", ar: "إشعار" },
          body: { en: "Exact 20%!", ar: "خصم ٢٠٪ حتى الجمعة!" },
        },
      ],
      maintenanceMessage: {
        en: "Available until 17:30.",
        ar: "متاح حتى ١٧:٣٠.",
      },
      pauseGeneration: true,
      evaluatedAt: new Date().toISOString(),
    });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/templates"]}>
          <CustomerNotices />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("خصم ٢٠٪ حتى الجمعة!")).toBeVisible();
    expect(screen.getByText("متاح حتى ١٧:٣٠.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "إخفاء إشعار" }));
    await waitFor(() =>
      expect(screen.queryByText("خصم ٢٠٪ حتى الجمعة!")).toBeNull(),
    );
    expect(screen.getByText("متاح حتى ١٧:٣٠.")).toBeVisible();
    client.clear();
  });
});
