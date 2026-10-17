import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LibraryWorkspace } from "./LibraryWorkspace";
import { libraryApi } from "./libraryApi";
import { LibraryEntrySchema } from "@movprompt/contracts";
vi.mock("./libraryApi", () => ({ libraryApi: { list: vi.fn(), photo: vi.fn(async () => new Blob()), save: vi.fn() } }));
const entry = (digit = "a") => LibraryEntrySchema.parse({ id: digit.repeat(24), kind: "product", revision: 1, name: "Product " + digit, approved: false, deleted: false, reviewedAt: null, updatedAt: "2026-10-17T10:00:00.000Z", photos: [{ id: digit.repeat(24), name: digit + ".png", checksumSha256: digit.repeat(64), mimeType: "image/png", sizeBytes: 20, width: 2, height: 2 }], approval: { policyVersion: "2026-10-17", revision: 1, approved: false, reviewedAt: null, sameSubjectConfirmed: false, rightsConfirmed: false, adultConfirmed: false } });
beforeEach(() => { vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = vi.fn(); vi.mocked(libraryApi.list).mockResolvedValue({ entries: [entry(), entry("b")], nextCursor: null, requestId: "test" }); vi.mocked(libraryApi.save).mockImplementation(async input => ({ ...entry(input.id![0]), ...input, revision: 2, photos: entry(input.id![0]).photos, approved: true }) as never); });
afterEach(cleanup);
it("requires first-use approval and attaches the newly approved revision", async () => {
  const select = vi.fn(async (_choices: { entry: unknown; ids: string[] }[]) => {}); render(<LibraryWorkspace kind="product" ar={false} limit={1} onSelectBatch={select} />);
  const photos = await screen.findAllByRole("checkbox"); fireEvent.click(photos[0]);
  expect(screen.getByRole("button", { name: "Use selected photos" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "I have permission to use these product photos." }));
  fireEvent.click(screen.getByRole("button", { name: "Use selected photos" }));
  await waitFor(() => expect(select).toHaveBeenCalledWith([{ entry: expect.objectContaining({ approved: true, revision: 2 }), ids: ["a".repeat(24)] }]));
  expect(libraryApi.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1, approved: true }), expect.any(String));
});
it("supports selecting separate automatic entries within the template's limit", async () => {
  const select = vi.fn(async (_choices: { entry: unknown; ids: string[] }[]) => {}); render(<LibraryWorkspace kind="product" ar={false} limit={2} onSelectBatch={select} />);
  const photos = await screen.findAllByRole("checkbox"); fireEvent.click(photos[0]); fireEvent.click(photos[1]);
  fireEvent.click(screen.getByRole("checkbox", { name: "I have permission to use these product photos." })); fireEvent.click(screen.getByRole("button", { name: "Use selected photos" }));
  await waitFor(() => expect(select).toHaveBeenCalled()); expect(select.mock.calls[0][0]).toHaveLength(2);
});
