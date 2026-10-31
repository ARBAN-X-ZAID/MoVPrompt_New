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
  familyId: "jewelry-product-showcase",
  name: { en: "sample ad", ar: "إعلان تجريبي" },
  supportedDurations: [8, 15, 20],
  publishingState: "published",
  currentPublishedVersionId: "version-1",
  revision: 4,
};
let rows: Record<string, unknown>[];
let client: QueryClient;
function show(readOnly = false, id?: string) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdminTemplates readOnly={readOnly} id={id} />
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
  it("saves a localized name and refreshes the heading", async () => {
    vi.mocked(adminApi.mutate).mockImplementation(async (_path, body) => {
      rows = [{ ...rows[0], name: (body as { name: unknown }).name, revision: 5 }];
      return {};
    });
    show(false, "template-1");
    fireEvent.change(await screen.findByLabelText("English name"), { target: { value: "Luxury jewelry" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await screen.findByRole("heading", { level: 1, name: "Luxury jewelry" });
    expect(adminApi.mutate).toHaveBeenCalledWith("templates/template-1/name", { expectedRevision: 4, name: { en: "Luxury jewelry", ar: published.name.ar } }, expect.any(String));
  });
  it("retains entered names and the command key after a failed save", async () => {
    vi.mocked(adminApi.mutate).mockRejectedValue(new Error("Please retry"));
    show(false, "template-1");
    fireEvent.change(await screen.findByLabelText("English name"), { target: { value: "New name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("English name")).toHaveValue("New name");
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(adminApi.mutate).toHaveBeenCalledTimes(2));
    expect(vi.mocked(adminApi.mutate).mock.calls[0][2]).toBe(vi.mocked(adminApi.mutate).mock.calls[1][2]);
  });
  it("keeps one duration enabled and confirms individual length changes", async () => {
    rows = [{ ...published, enabledDurations: [8] }];
    show(false, "template-1");
    expect(
      await screen.findByRole("switch", { name: "8 seconds" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "15 seconds" }));
    expect(adminApi.mutate).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm" }),
    );
    await waitFor(() =>
      expect(adminApi.mutate).toHaveBeenCalledWith(
        "templates/template-1/availability",
        { expectedRevision: 4, enabledDurations: [8, 15] },
        expect.any(String),
      ),
    );
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });

  it("disables and restores the same version with revision checks, with confirmation and without duration editing", async () => {
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
    expect(adminApi.mutate).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm" }),
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
        reason: "Owner confirmed template availability change",
      },
      expect.any(String),
    );
    fireEvent.click(screen.getByRole("button", { name: "Enable sample ad" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm" }),
    );
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
        reason: "Owner confirmed template availability change",
      },
      expect.any(String),
    );
    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText("8 s, 15 s, 20 s")).toBeVisible();
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
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm" }),
    );
    await screen.findByText("Connection interrupted");
    expect(adminApi.mutate).toHaveBeenCalledTimes(1);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm" }),
    );
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
