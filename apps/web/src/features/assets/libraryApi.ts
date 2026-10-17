import { z } from "zod";
import { LibraryEntryResponseSchema, LibraryListResponseSchema, LibraryUploadResponseSchema, type LibraryEntry, type LibraryKind, type SaveLibraryEntry } from "@movprompt/contracts";
import { apiOrigin, request } from "@/lib/api/portableApiClient";
import { isFeatureEnabled } from "@/config/features";

const base = "/api/v1/reference-library";
export const libraryApi = {
  async status() {
    if (!isFeatureEnabled("referenceLibrary")) return false;
    const response = await fetch(`${apiOrigin()}${base}/status`, { credentials: "omit" });
    if (!response.ok) throw new Error("Saved asset availability could not be checked.");
    return z.object({ enabled: z.boolean() }).parse(await response.json()).enabled;
  },
  list: (kind: LibraryKind, search = "", cursor?: string) => request(`${base}?${new URLSearchParams({ kind, search, ...(cursor ? { cursor } : {}) })}`, LibraryListResponseSchema),
  assertOwner: (expectedOwnerId: string) => request(`${base}/session`, z.object({ ownerId: z.string() }), { expectedOwnerId }),
  find: (id: string) => request(`${base}/${id}`, LibraryEntryResponseSchema).then(value => value.entry),
  save: (input: SaveLibraryEntry, key: string, expectedOwnerId?: string) => request(`${base}/save`, LibraryEntryResponseSchema, { method: "POST", body: input, idempotencyKey: key, ...(expectedOwnerId ? { expectedOwnerId } : {}) }).then(value => value.entry),
  autoSave: (kind: LibraryKind, uploadId: string, key: string, expectedOwnerId: string) => request(`${base}/auto-save`, LibraryEntryResponseSchema, { method: "POST", body: { kind, uploadId }, idempotencyKey: key, expectedOwnerId }).then(value => value.entry),
  remove: (entry: LibraryEntry, key: string) => request(`${base}/${entry.id}/delete`, LibraryEntryResponseSchema, { method: "POST", body: { expectedRevision: entry.revision }, idempotencyKey: key }),
  photoUrl: (entryId: string, photoId: string) => `${apiOrigin()}${base}/${entryId}/photos/${photoId}`,
  async photo(entryId: string, photoId: string) {
    const response = await fetch(this.photoUrl(entryId, photoId), { credentials: "include", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("The saved photo could not be loaded.");
    return response.blob();
  },
  async upload(file: File, key: string, expectedOwnerId?: string) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 12 * 1024 * 1024) throw new Error("Choose a JPEG, PNG or WebP photo under 12 MB.");
    const checksumSha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, "0")).join("");
    const result = await request(`${base}/uploads`, LibraryUploadResponseSchema, { method: "POST", idempotencyKey: key, ...(expectedOwnerId ? { expectedOwnerId } : {}), body: { name: file.name, mimeType: file.type, sizeBytes: file.size, checksumSha256 } });
    // Same authenticated API boundary as normal assets; no public bucket or browser CORS dependency.
    const response = await fetch(`${apiOrigin()}${base}/uploads/${result.uploadId}/content`, { method: "PUT", credentials: "include", headers: result.upload.headers, body: file, signal: AbortSignal.timeout(60_000) });
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message ?? "The photo upload failed. Try again."); }
    return result.uploadId;
  },
};
