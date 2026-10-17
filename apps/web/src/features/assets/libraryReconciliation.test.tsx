import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LibraryEntrySchema, defaultNativeUgcSettings } from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { createDraftProject } from "../create/templates";
import { projectToCreationDraft } from "../create/contracts";
import { hasUnclaimedCreatorAssets, canCopyLibraryToOwnedProject } from "../create/creatorProjectAssets";
import { TemplatePhotos } from "../create/TemplatePhotos";
import { LibraryCampaign } from "./LibraryCampaign";
import { reconcileLibraryProject } from "./libraryReconciliation";
import { libraryApi } from "./libraryApi";
vi.mock("./libraryApi", () => ({ libraryApi: { status: vi.fn(async () => true), find: vi.fn(), list: vi.fn(), photo: vi.fn(async () => new Blob(["photo"], { type: "image/png" })) } }));
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
const originalCreateObjectURL = URL.createObjectURL, originalRevokeObjectURL = URL.revokeObjectURL;
const entry = () => LibraryEntrySchema.parse({ id: "a".repeat(24), name: "Library name only", kind: "product", revision: 1, photos: [{ id: "b".repeat(24), name: "bottle.png", mimeType: "image/png", checksumSha256: "c".repeat(64), sizeBytes: 68, width: 2, height: 2 }], approved: true, deleted: false, reviewedAt: "2026-10-17T10:00:00.000Z", updatedAt: "2026-10-17T10:00:00.000Z", approval: { policyVersion: "2026-10-17", revision: 1, approved: true, reviewedAt: "2026-10-17T10:00:00.000Z", sameSubjectConfirmed: true, rightsConfirmed: true, adultConfirmed: false } });
function project() {
  const value = createDraftProject("female-product-review");
  value.product.name = "Confirmed product"; value.product.description = "Approved facts";
  value.offer = "20% off — خصم ٢٠٪"; value.cta = "فقط!";
  value.nativeUgc = { ...defaultNativeUgcSettings(), enabled: true, script: "Approved exact words.", scriptApproved: true, approvedLanguage: "en" };
  value.product.images = [{ id: crypto.randomUUID(), name: "bottle.png", url: "", mimeType: "image/png", source: "upload", checksum: "c".repeat(64), selected: true, referenceRole: "subject", librarySource: { entryId: "a".repeat(24), photoId: "b".repeat(24), revision: 1, kind: "product", sizeBytes: 68 } }];
  return value;
}
beforeEach(() => { vi.mocked(libraryApi.find).mockResolvedValue(entry()); vi.mocked(libraryApi.list).mockResolvedValue({ entries: [entry()], nextCursor: null, requestId: "test" }); URL.createObjectURL = vi.fn(() => "blob:preview"); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { cleanup(); vi.clearAllMocks(); URL.createObjectURL = originalCreateObjectURL; URL.revokeObjectURL = originalRevokeObjectURL; });
describe("library selection and local reconciliation", () => {
  it("replaces only linked photos and preserves approved speech, facts, offers and display messages", async () => {
    const original = project(); const before = structuredClone(original);
    vi.mocked(libraryApi.find).mockResolvedValue({ ...entry(), revision: 2, photos: [{ ...entry().photos[0]!, checksumSha256: "d".repeat(64) }] });
    const updated = await reconcileLibraryProject(original);
    expect(original).toEqual(before); expect(updated.libraryReviewRequired).toBe(true);
    expect(updated.product.name).toBe(original.product.name); expect(updated.product.description).toBe(original.product.description);
    expect(updated.offer).toBe(original.offer); expect(updated.cta).toBe(original.cta); expect(updated.nativeUgc).toEqual(original.nativeUgc);
    expect(updated.product.images[0]!.checksum).toBe("d".repeat(64)); expect(updated.product.images[0]!.libraryReviewRequired).toBe(true);
    expect(projectToCreationDraft(updated, true).campaign.libraryReviewRequired).toBe(true);
    expect(hasUnclaimedCreatorAssets(updated)).toBe(true);
    expect(canCopyLibraryToOwnedProject(updated)).toBe(false); updated.versionId = "e".repeat(24); updated.id = "f".repeat(24); expect(canCopyLibraryToOwnedProject(updated)).toBe(true);
  });
  it("removes deleted references, retains unrelated photos and keeps an explicit review notice even with zero library photos", async () => {
    const original = project(); const other = { ...original.product.images[0]!, id: crypto.randomUUID(), librarySource: undefined, name: "Unrelated upload" };
    original.product.images.push(other); vi.mocked(libraryApi.find).mockResolvedValue({ ...entry(), deleted: true, approved: false });
    const updated = await reconcileLibraryProject(original); expect(updated.product.images).toEqual([other]); expect(updated.libraryReviewRequired).toBe(true);
    expect(updated.nativeUgc).toEqual(original.nativeUgc);
  });
  it("does not silently add new library photos or change names into product facts", async () => {
    const original = project(); vi.mocked(libraryApi.find).mockResolvedValue({ ...entry(), name: "A renamed library entry", revision: 2, photos: [...entry().photos, { ...entry().photos[0]!, id: "f".repeat(24) }] });
    expect(await reconcileLibraryProject(original)).toBe(original);
  });
  it("fails closed on network errors and marks approval withdrawal for review", async () => {
    vi.mocked(libraryApi.find).mockRejectedValueOnce(new Error("offline")); await expect(reconcileLibraryProject(project())).rejects.toThrow("offline");
    vi.mocked(libraryApi.find).mockResolvedValue({ ...entry(), approved: false }); expect((await reconcileLibraryProject(project())).libraryReviewRequired).toBe(true);
  });
  it("lets guests open sign-in without losing their configured draft", async () => {
    const value = project(); const signIn = vi.fn(async () => {}); const change = vi.fn();
    render(<LibraryCampaign project={value} signedIn={false} onProjectChange={change} onSignIn={signIn}><TemplatePhotos templateId={value.templateId} images={value.product.images} onFiles={vi.fn()} /></LibraryCampaign>);
    const buttons = await screen.findAllByRole("button", { name: "Choose from library" }); fireEvent.click(buttons[0]!);
    expect(signIn).toHaveBeenCalledOnce(); expect(change).not.toHaveBeenCalled(); expect(value.product.name).toBe("Confirmed product");
  });
  it.each(Object.entries(LAUNCH_PHOTO_POLICIES))("keeps library buttons inside supported product/presenter roles for %s", async (templateId, policy) => {
    const value = createDraftProject(templateId); value.product.images = [];
    render(<LibraryCampaign project={value} signedIn={true} onProjectChange={vi.fn()} onSignIn={vi.fn(async () => {})}><TemplatePhotos templateId={templateId} images={[]} onFiles={vi.fn()} /></LibraryCampaign>);
    await waitFor(() => expect(vi.mocked(libraryApi.status)).toHaveBeenCalled());
    const expected = policy.groups.filter(group => group.role === "subject" || group.role === "character").length;
    await waitFor(() => expect(screen.queryAllByRole("button", { name: "Choose from library" })).toHaveLength(expected));
  });
  it("blocks saved presenter picking when character speech is enabled", async () => {
    const value = project(); render(<LibraryCampaign project={value} signedIn onProjectChange={vi.fn()} onSignIn={vi.fn(async () => {})}><TemplatePhotos templateId={value.templateId} images={value.product.images} characterUploadDisabled onFiles={vi.fn()} /></LibraryCampaign>);
    const buttons = await screen.findAllByRole("button", { name: "Choose from library" }); expect(buttons[0]).toBeEnabled(); expect(buttons[1]).toBeDisabled();
  });
});
