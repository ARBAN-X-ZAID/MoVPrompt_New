import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));
vi.mock("@/components/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("./AdminCustomer", () => ({
  default: function Draft() {
    const [value, setValue] = useState("");
    return (
      <label>
        Unfinished review
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
    );
  },
}));
vi.mock("./OwnerAccess", () => ({
  OwnerAccess: ({ reload }: { reload: () => void }) => (
    <button onClick={reload}>Complete local confirmation</button>
  ),
}));
vi.mock("./api", () => ({
  adminApi: {
    identity: vi.fn(async () => ({
      email: "owner@example.test",
      readOnly: true,
      assuredUntil: new Date(Date.now() + 3600000).toISOString(),
    })),
  },
}));
vi.mock("./AdminOverview", () => ({ default: () => <p>Simple overview</p> }));
vi.mock("./AdminTemplateManager", () => ({
  default: () => <p>Template availability only</p>,
}));
import OwnerAdmin from "./OwnerAdmin";
import { adminApi } from "./api";
import { PortableApiError } from "@/lib/api/portableApiClient";
afterEach(cleanup);

describe("owner confirmation preserves unfinished work", () => {
  it("keeps form state mounted through requested and automatic step-up dialogs", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={["/admin/customers/000000000000000000000001"]}
        >
          <OwnerAdmin />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const input = await screen.findByLabelText("Unfinished review");
    expect(screen.getByRole("status")).toHaveTextContent("Read-only access");
    fireEvent.change(input, {
      target: { value: "Exact bilingual review · ٢٠٪" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm password" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Complete local confirmation" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("Unfinished review")).toHaveValue(
      "Exact bilingual review · ٢٠٪",
    );
    act(() =>
      window.dispatchEvent(new Event("movprompt:admin-confirmation-required")),
    );
    expect(screen.getByRole("dialog")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Complete local confirmation" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByLabelText("Unfinished review")).toHaveValue(
      "Exact bilingual review · ٢٠٪",
    );
    client.clear();
  });
});

describe("simplified navigation", () => {
  it.each([
    ["/admin", "Simple overview"],
    ["/admin/pricing", "Simple overview"],
    ["/admin/templates/old-editor", "Template availability only"],
  ])(
    "keeps nine destinations and redirects removed editors at %s",
    async (path, text) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <OwnerAdmin />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      await screen.findByText(text);
      const nav = screen.getByRole("navigation", { name: "Administration" });
      expect(within(nav).getAllByRole("link")).toHaveLength(9);
      expect(within(nav).queryByText("Packages & pricing")).toBeNull();
      expect(within(nav).queryByText("Communications")).toBeNull();
      expect(screen.queryByLabelText("Unfinished review")).toBeNull();
      client.clear();
    },
  );
});

it("returns to owner access when a cached session is rejected after sign-out", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={["/admin/customers/000000000000000000000001"]}
      >
        <OwnerAdmin />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByLabelText("Unfinished review");
  vi.mocked(adminApi.identity).mockRejectedValueOnce(
    new PortableApiError(
      "Authentication required",
      "authentication_required",
      false,
      undefined,
      401,
    ),
  );
  await act(async () => {
    await client.invalidateQueries({ queryKey: ["admin", "identity"] });
  });
  await waitFor(() =>
    expect(screen.queryByLabelText("Unfinished review")).toBeNull(),
  );
  expect(
    screen.getByRole("button", { name: "Complete local confirmation" }),
  ).toBeVisible();
  client.clear();
});
