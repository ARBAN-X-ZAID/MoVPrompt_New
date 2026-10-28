import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/i18n/LanguageContext", () => ({
  useLanguage: () => ({ locale: "en" }),
}));
vi.mock("./api", () => ({ adminApi: { list: vi.fn(), mutate: vi.fn() } }));
import { adminApi } from "./api";
import AdminTemplates from "./AdminTemplates";
const published = {
  id: "template-1",
  slug: "sample-ad",
  publishingState: "published",
  currentPublishedVersionId: "version-1",
  revision: 4,
};
let rows: Record<string, unknown>[];
let client: QueryClient;
function show(readOnly = false) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminTemplates readOnly={readOnly} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  rows = [{ ...published }];
  vi.mocked(adminApi.list).mockImplementation(async () => ({
    items: rows,
    total: rows.length,
    page: 1,
    limit: 25,
    source: "synthetic",
    evaluatedAt: new Date().toISOString(),
  }));
});
afterEach(() => {
  cleanup();
  client?.clear();
});
describe("simple template availability", () => {
  it("disables and restores the same version with revision checks, without duration controls", async () => {
    vi.mocked(adminApi.mutate).mockImplementation(async (_path, body) => {
      const input = body as { action: string };
      rows = [
        {
          ...rows[0],
          publishingState:
            input.action === "unpublish" ? "unpublished" : "published",
          revision: Number(rows[0].revision) + 1,
        },
      ];
      return {};
    });
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Disable sample ad" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Enable sample ad" }),
      ).toBeEnabled(),
    );
    expect(adminApi.mutate).toHaveBeenNthCalledWith(
      1,
      "templates/template-1/state",
      {
        action: "unpublish",
        expectedRevision: 4,
        reason: "Owner disabled template from the template list",
      },
      expect.any(String),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enable sample ad" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Disable sample ad" }),
      ).toBeEnabled(),
    );
    expect(adminApi.mutate).toHaveBeenNthCalledWith(
      2,
      "templates/template-1/state",
      {
        action: "restore-publication",
        expectedRevision: 5,
        reason: "Owner enabled the existing template from the template list",
      },
      expect.any(String),
    );
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(
      screen.queryByText(/8s|15s|20s|duration|Duplicate|Publish draft/i),
    ).toBeNull();
    expect(rows[0].currentPublishedVersionId).toBe("version-1");
  });
  it("reuses the idempotency key after an uncertain failure and requires a deliberate retry", async () => {
    vi.mocked(adminApi.mutate)
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValue({});
    show();
    fireEvent.click(
      await screen.findByRole("button", { name: "Disable sample ad" }),
    );
    await screen.findByText("Connection interrupted");
    expect(adminApi.mutate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Disable sample ad" }));
    await waitFor(() => expect(adminApi.mutate).toHaveBeenCalledTimes(2));
    expect(vi.mocked(adminApi.mutate).mock.calls[0][2]).toBe(
      vi.mocked(adminApi.mutate).mock.calls[1][2],
    );
  });
  it("prevents writes in inspection mode", async () => {
    show(true);
    const button = await screen.findByRole("button", {
      name: "Disable sample ad",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(adminApi.mutate).not.toHaveBeenCalled();
  });
  it("does not offer to publish a template without an existing approved version", async () => {
    rows = [
      {
        ...published,
        publishingState: "draft",
        currentPublishedVersionId: null,
      },
    ];
    show();
    expect(
      await screen.findByRole("button", { name: "Enable sample ad" }),
    ).toBeDisabled();
  });
});
