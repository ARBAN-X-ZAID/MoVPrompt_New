import { useState } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));
vi.mock("@/components/LanguageToggle", () => ({ LanguageToggle: () => null }));
vi.mock("@/components/Seo", () => ({ Seo: () => null }));
vi.mock("./AdminRecordDetail", () => ({
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
      assuredUntil: new Date(Date.now() + 3600000).toISOString(),
    })),
  },
}));
import OwnerAdmin from "./OwnerAdmin";

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
    fireEvent.change(input, {
      target: { value: "Exact bilingual review · ٢٠٪" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm identity" }));
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
