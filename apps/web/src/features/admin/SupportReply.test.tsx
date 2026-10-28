import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
const mocks = vi.hoisted(() => ({ request: vi.fn(), mutate: vi.fn() }));
vi.mock("@/lib/api/portableApiClient", () => ({
  request: mocks.request,
  apiOrigin: () => "http://localhost:8787",
}));
vi.mock("./api", () => ({ adminApi: { mutate: mocks.mutate } }));
import { SupportReply } from "./SupportReply";

describe("verified support uploads and recoverable reply errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("crypto", webcrypto);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("uses the authenticated upload endpoint, preserves text on failure and binds only a successfully verified photo", async () => {
    const id = "000000000000000000000002",
      caseId = "000000000000000000000001";
    mocks.request.mockImplementation(async (path: string) =>
      path.endsWith("/verify")
        ? { id }
        : {
            id,
            upload: {
              url: "https://private-storage.example/cors-denied",
              headers: {},
            },
          },
    );
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Offline during upload"))
      .mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    mocks.mutate.mockResolvedValue({ revision: 3 });
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
      close = vi.fn();
    render(
      <QueryClientProvider client={client}>
        <SupportReply
          caseId={caseId}
          revision={2}
          admin
          ar={false}
          onClose={close}
        />
      </QueryClientProvider>,
    );
    const text = "Exact approved reply · خصم ٢٠٪";
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: text },
    });
    const file = new File(["photo bytes"], "product.png", {
      type: "image/png",
    });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new TextEncoder().encode("photo bytes").buffer,
    });
    fireEvent.change(screen.getByLabelText(/^Attach photos/), {
      target: { files: [file] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Offline during upload",
    );
    expect(screen.getByLabelText("Your message")).toHaveValue(text);
    expect(screen.getByLabelText("Who can read this message")).toHaveValue(
      "private",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry upload" }));
    expect(await screen.findByText("product.png")).toBeVisible();
    expect(fetch).toHaveBeenLastCalledWith(
      `http://localhost:8787/api/v1/admin/support/${caseId}/attachments/${id}/upload`,
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        body: file,
      }),
    );
    expect(mocks.request).toHaveBeenCalledWith(
      expect.stringContaining("/verify"),
      expect.anything(),
      expect.anything(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(mocks.mutate).toHaveBeenCalledWith(
      `support/${caseId}`,
      expect.objectContaining({
        expectedRevision: 2,
        message: text,
        visibility: "private",
        notifyEmail: false,
        attachmentIds: [id],
      }),
      expect.any(String),
    );
    client.clear();
  });
});
