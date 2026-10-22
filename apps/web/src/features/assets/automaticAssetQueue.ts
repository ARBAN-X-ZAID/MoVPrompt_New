import type { LibraryKind } from "@movprompt/contracts";
import { isFeatureEnabled } from "@/config/features";
import { libraryApi } from "./libraryApi";
import { deviceLibrary } from "./deviceLibrary";

let currentOwner: string | null | undefined;
let available = false;
let pending: Promise<void> | null = null;
export async function queueAutomaticPhoto(file: File, kind: LibraryKind, checksum: string, ownerId: string | null = currentOwner ?? null) {
  if (!isFeatureEnabled("referenceLibrary")) return;
  if (!file.size || file.size > 12 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type.toLowerCase())) throw new Error("Choose a JPEG, PNG or WebP photo under 12 MB.");
  if (typeof createImageBitmap === "function") {
    const decoded = await createImageBitmap(file);
    try { if (!decoded.width || !decoded.height) throw new Error("This photo could not be decoded."); } finally { decoded.close(); }
  } else {
    const url = URL.createObjectURL(file);
    try { await new Promise<void>((resolve, reject) => { const image = new Image(); image.onload = () => image.naturalWidth && image.naturalHeight ? resolve() : reject(new Error("This photo could not be decoded.")); image.onerror = () => reject(new Error("This photo could not be decoded.")); image.src = url; }); } finally { URL.revokeObjectURL(url); }
  }
  const row = await deviceLibrary.add(file, kind, checksum, ownerId);
  void drainAutomaticPhotos();
  return row;
}
export async function drainAutomaticPhotos(retry = false) {
  if (pending || !available || !currentOwner || navigator.onLine === false) return pending;
  const ownerId = currentOwner;
  pending = (async () => {
    if ((await deviceLibrary.all(null)).length) await libraryApi.assertOwner(ownerId);
    if (currentOwner !== ownerId) return;
    await deviceLibrary.adopt(ownerId);
    for (const row of await deviceLibrary.all(ownerId)) {
      if (currentOwner !== ownerId) break;
      if (!row.blob || row.status === "saved" || (row.status === "failed" && !retry)) continue;
      try {
        if (!await deviceLibrary.replaceIfCurrent({ ...row, status: "saving" })) continue;
        const file = new File([row.blob], row.name, { type: row.mimeType });
        const upload = await libraryApi.upload(file, row.operationKey, ownerId);
        if (currentOwner !== ownerId) { await deviceLibrary.replaceIfCurrent({ ...row, status: "pending" }); break; }
        if ((await deviceLibrary.get(row.id))?.operationKey !== row.operationKey) continue;
        let entry = await libraryApi.autoSave(row.kind, upload, row.operationKey, ownerId);
        // Only a guest's explicit first-use confirmation migrates approval. A fresh
        // account upload never silently renews a withdrawn library permission.
        if (row.approved && !entry.approved && entry.photos.length === 1) {
          if (currentOwner !== ownerId) throw new Error("Account changed.");
          entry = await libraryApi.save({ id: entry.id, expectedRevision: entry.revision, kind: entry.kind, name: entry.name, photos: entry.photos.map(photo => ({ id: photo.id })), approved: true }, row.operationKey + ":approval", ownerId);
        }
        const photo = entry.photos.find(photo => photo.checksumSha256 === row.checksumSha256);
        if (!photo || entry.deleted) throw new Error("The saved photo could not be verified.");
        // Only a verified server receipt permits removal of the independent local blob.
        const { blob: _blob, ...metadata } = row;
        await deviceLibrary.replaceIfCurrent({ ...metadata, approved: false, status: "saved", receipt: { entryId: entry.id, photoId: photo.id, revision: entry.revision, kind: entry.kind, checksumSha256: photo.checksumSha256 } });
        window.dispatchEvent(new Event("movprompt:library-changed"));
      } catch { await deviceLibrary.replaceIfCurrent({ ...row, status: "failed" }); }
    }
  })().catch(error => { console.warn("automatic_assets_queue_failed", error instanceof Error ? error.message : "storage_unavailable"); }).finally(() => { pending = null; });
  return pending;
}
export function configureAutomaticAssets(input: { ownerId?: string | null; available?: boolean }) {
  if ("ownerId" in input) currentOwner = input.ownerId;
  if ("available" in input) available = input.available === true;
}
