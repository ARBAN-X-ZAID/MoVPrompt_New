import type { CreatorAsset, CreatorProject } from "../create/types";
import { libraryApi } from "./libraryApi";
import { request } from "@/lib/api/portableApiClient";
import { z } from "zod";

/** Reconcile by stable photo identity. Never replace facts, scripts, offers or unrelated UI edits. */
export async function reconcileLibraryProject(project: CreatorProject): Promise<CreatorProject> {
  const linked = project.product.images.filter(image => image.librarySource);
  if (!linked.length) return project;
  const entryIds = [...new Set(linked.map(image => image.librarySource!.entryId))];
  const entries = new Map(await Promise.all(entryIds.map(async id => [id, await libraryApi.find(id).catch(error => { if (error.status === 404) return null; throw error; })] as const)));
  let changed = false;
  const images: CreatorAsset[] = [];
  for (const image of project.product.images) {
    const source = image.librarySource;
    if (!source) { images.push(image); continue; }
    const entry = entries.get(source.entryId); const photo = entry?.photos.find(photo => photo.id === source.photoId);
    if (!entry || entry.deleted || !photo) { changed = true; continue; }
    if (photo.checksumSha256 !== image.checksum) {
      const { storagePath: _storage, assetKey: _local, personRightsConfirmed: _rights, ...rest } = image;
      images.push({ ...rest, id: crypto.randomUUID(), name: photo.name, checksum: photo.checksumSha256, mimeType: photo.mimeType, url: "", librarySource: { ...source, revision: entry.revision, sizeBytes: photo.sizeBytes }, libraryReviewRequired: true });
      changed = true;
    } else if (!entry.approved && !image.libraryReviewRequired) {
      const { personRightsConfirmed: _rights, ...rest } = image;
      images.push({ ...rest, libraryReviewRequired: true }); changed = true;
    } else images.push(image);
  }
  return changed ? { ...project, ...(project.source ? { source: { ...project.source, assetKeys: images.flatMap(image => image.storagePath ? [image.storagePath] : image.assetKey ? [image.assetKey] : []) } } : {}), libraryReviewRequired: true, product: { ...project.product, images } } : project;
}

/** Existing campaigns receive owner-verified independent copies before saving a working version. */
export async function attachLibraryPhotos(project: CreatorProject): Promise<CreatorProject> {
  const images = await Promise.all(project.product.images.map(async image => {
    if (!image.librarySource || image.storagePath) return image;
    const copy = await request("/api/v1/reference-library/copies", z.object({ assetId: z.string(), objectKey: z.string() }), { method: "POST", idempotencyKey: `${project.id}:${image.librarySource.entryId}:${image.librarySource.photoId}:${image.librarySource.revision}:${image.checksum}`, body: { projectId: project.id, source: image.librarySource, checksum: image.checksum } });
    return { ...image, id: copy.assetId, storagePath: copy.objectKey };
  }));
  return { ...project, product: { ...project.product, images } };
}
