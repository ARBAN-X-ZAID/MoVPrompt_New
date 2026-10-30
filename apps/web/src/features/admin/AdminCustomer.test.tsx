import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("@/lib/api/portableApiClient", () => ({
  request: vi.fn(async () => ({
    id: "111111111111111111111111",
    name: "Local retailer",
    email: "retailer@example.test",
    locale: "en",
    createdAt: "2026-10-01T00:00:00Z",
    inactive: false,
    emailDeliveryAvailable: false,
    wallet: { balance: 100, reserved: 20, available: 80 },
    counts: { projects: 2, generations: 3, assets: 1, support: 1 },
  })),
}));
vi.mock("./api", () => ({
  adminApi: {
    customerRecords: vi.fn(async () => ({
      items: [
        {
          id: "entry-1",
          kind: "refund",
          reason: "provider_failure",
          delta: 10,
          balanceAfter: 100,
          createdAt: "2026-10-02T00:00:00Z",
        },
      ],
      total: 30,
      page: 1,
      limit: 25,
    })),
    mutate: vi.fn(),
    media: vi.fn(),
  },
}));
import AdminCustomer from "./AdminCustomer";
import { adminApi } from "./api";
afterEach(cleanup);
describe("customer workspace", () => {
  it("enables customer management without unlocking refunds", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AdminCustomer id="111111111111111111111111" readOnly canEditProfile canChangeStatus /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByRole("button", { name: "Edit profile" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Make inactive" })).toBeEnabled();
    fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "Purchases" }));
    const refund = await screen.findByRole("button", { name: "Refund", exact: true });
    expect(refund).toBeDisabled();
    client.clear();
  });
  it("shows basic details and keeps full wallet pagination inside the customer", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={["/admin/customers/111111111111111111111111"]}
        >
          <AdminCustomer id="111111111111111111111111" readOnly={false} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText("Local retailer");
    expect(
      screen.queryByText(
        /Email verified|Revoke sessions|Export customer data|Request account deletion|Reconcile credit/,
      ),
    ).toBeNull();
    expect(screen.queryByText("111111111111111111111111")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Send password reset" }),
    ).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Wallet" }));
    await screen.findByText("Failed generation refund");
    expect(screen.queryByText("provider_failure")).toBeNull();
    expect(screen.getByRole("tab", { name: "Wallet" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(
        vi
          .mocked(adminApi.customerRecords)
          .mock.calls.some(
            ([, , query]) =>
              query.get("page") === "2" &&
              query.get("userId") === "111111111111111111111111",
          ),
      ).toBe(true),
    );
    client.clear();
  });
});
