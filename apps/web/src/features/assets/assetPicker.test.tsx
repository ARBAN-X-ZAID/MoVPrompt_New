import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LibraryEntrySchema } from "@movprompt/contracts";
import { AssetPicker } from "./AssetPicker";
import { LibraryWorkspace } from "./LibraryWorkspace";
import { libraryApi } from "./libraryApi";
vi.mock("./libraryApi", () => ({ libraryApi: { list: vi.fn(), photo: vi.fn(async () => new Blob()), save: vi.fn() } }));
vi.mock("./deviceLibrary", () => ({ LIBRARY_DEVICE_EVENT: "device-test", deviceLibrary: { all: vi.fn(async () => []), put: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "owner" } }) }));
const entry = (digit = "a", kind: "product" | "presenter" = "product") => LibraryEntrySchema.parse({ id: digit.repeat(24), kind, revision: 1, name: "Product " + digit, approved: false, deleted: false, reviewedAt: null, updatedAt: "2026-10-17T10:00:00.000Z", photos: [{ id: digit.repeat(24), name: digit + ".png", checksumSha256: digit.repeat(64), mimeType: "image/png", sizeBytes: 20, width: 2, height: 2 }], approval: { policyVersion: "2026-10-17", revision: 1, approved: false, reviewedAt: null, sameSubjectConfirmed: false, rightsConfirmed: false, adultConfirmed: false } });
const picker = (overrides: Partial<Parameters<typeof AssetPicker>[0]> = {}) => {
  const props = { kind: "product" as const, ar: false, limit: 1, signedIn: true, onUpload: vi.fn(), onSelectAccount: vi.fn(async () => {}), onSelectDevice: vi.fn(async () => {}), ...overrides };
  render(<AssetPicker {...props} />); return props;
};
beforeEach(() => {
  vi.clearAllMocks(); URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = vi.fn();
  vi.mocked(libraryApi.list).mockResolvedValue({ entries: [entry(), entry("b")], nextCursor: null, requestId: "test" });
  vi.mocked(libraryApi.save).mockImplementation(async input => ({ ...entry(input.id![0], input.kind), revision: 2, approved: true }) as never);
});
afterEach(cleanup);

it("selects a product photo with one tap and no permission checkbox", async () => {
  const props = picker();
  fireEvent.click(await screen.findByRole("button", { name: "a.png" }));
  expect(screen.queryByRole("checkbox")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select photo" }));
  await waitFor(() => expect(props.onSelectAccount).toHaveBeenCalledWith([{ entry: expect.objectContaining({ approved: true, revision: 2 }), ids: ["a".repeat(24)] }]));
  expect(libraryApi.save).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1, approved: true }), expect.any(String));
});

it("swaps the choice when only one photo is allowed and counts up to the limit otherwise", async () => {
  picker();
  fireEvent.click(await screen.findByRole("button", { name: "a.png" })); fireEvent.click(screen.getByRole("button", { name: "b.png" }));
  expect(screen.getByRole("button", { name: "a.png" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "b.png" })).toHaveAttribute("aria-pressed", "true");
  cleanup();
  const props = picker({ limit: 2 });
  fireEvent.click(await screen.findByRole("button", { name: "a.png" })); fireEvent.click(screen.getByRole("button", { name: "b.png" }));
  fireEvent.click(screen.getByRole("button", { name: "Select 2 photos" }));
  await waitFor(() => expect(props.onSelectAccount).toHaveBeenCalled()); expect(vi.mocked(props.onSelectAccount).mock.calls[0]![0]).toHaveLength(2);
});

it("opens the device upload from the grid", async () => {
  const props = picker();
  fireEvent.click(await screen.findByRole("button", { name: "Upload new" }));
  expect(props.onUpload).toHaveBeenCalled();
});

it("still asks for consent before an unapproved presenter photo is used", async () => {
  vi.mocked(libraryApi.list).mockResolvedValue({ entries: [entry("a", "presenter")], nextCursor: null, requestId: "test" });
  const props = picker({ kind: "presenter" });
  fireEvent.click(await screen.findByRole("button", { name: "a.png" }));
  expect(screen.getByRole("button", { name: "Select photo" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "This adult (18+) agreed to appear in my videos." }));
  fireEvent.click(screen.getByRole("button", { name: "Select photo" }));
  await waitFor(() => expect(props.onSelectAccount).toHaveBeenCalled());
});

it("keeps the My assets page free of selection controls", async () => {
  render(<LibraryWorkspace kind="product" ar={false} />);
  await screen.findByText("Product a");
  expect(screen.queryByRole("button", { name: "Use selected photos" })).toBeNull();
});

it("lets nothing more be picked once the template's photo slots are full", async () => {
  picker({ limit: 0 });
  expect(await screen.findByRole("button", { name: "a.png" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Upload new" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "All photo slots are full. Remove one first." })).toBeDisabled();
});

it("never ticks past the limit", async () => {
  vi.mocked(libraryApi.list).mockResolvedValue({ entries: [entry(), entry("b"), entry("c")], nextCursor: null, requestId: "test" });
  picker({ limit: 2 });
  fireEvent.click(await screen.findByRole("button", { name: "a.png" })); fireEvent.click(screen.getByRole("button", { name: "b.png" }));
  expect(screen.getByRole("button", { name: "c.png" })).toBeDisabled();
});
