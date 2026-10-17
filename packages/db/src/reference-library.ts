import { createHash } from "node:crypto";
import { LibraryEntrySchema, LibraryUploadRequestSchema, SaveLibraryEntrySchema, type LibraryEntry, type LibrarySource, type LibraryPhoto, type SaveLibraryEntry } from "@movprompt/contracts";
import { objectKeys } from "@movprompt/storage";
import type { ClientSession, Document } from "mongodb";
import { COLLECTIONS, newMongoObjectId, type MongoDatabase } from "./mongo-client.js";

type Photo = LibraryPhoto & { objectKey: string };
type Entry = Omit<LibraryEntry, "photos"> & { photos: Photo[] };
export interface LibraryStorage {
  assetsBucket: string;
  get(input: { bucket: string; key: string; maxBytes: number }): Promise<{ body: Uint8Array; contentType?: string; checksumSha256?: string }>;
  put(input: { bucket: string; key: string; body: Uint8Array; contentType: string; metadata: Record<string, string> }): Promise<unknown>;
}
export class ReferenceLibraryError extends Error {
  constructor(readonly code: "not_found" | "conflict" | "invalid" | "review_required" | "unavailable", message: string) { super(message); }
}
const fail = (code: ReferenceLibraryError["code"], message: string): never => { throw new ReferenceLibraryError(code, message); };
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const operationId = (user: string, key: string) => hash(`${user}\0${key}`).slice(0, 24);
function approval(kind: "product" | "presenter", approved: boolean, revision: number, reviewedAt: string | null): LibraryEntry["approval"] {
  return { policyVersion: "2026-10-17", revision, approved, reviewedAt, sameSubjectConfirmed: approved, rightsConfirmed: approved, adultConfirmed: approved && kind === "presenter" };
}
const active = ["submitting", "queued", "processing", "cancelling"];
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function libraryImages(configuration: unknown): Record<string, unknown>[] {
  const images = object(object(object(configuration).creatorProject).product).images;
  return Array.isArray(images) ? images.map(object) : [];
}

export function createReferenceLibraryService(options: {
  database: MongoDatabase; storage: LibraryStorage;
  verify?: (input: { kind: "product"; bytes: Uint8Array; mimeType: string; checksumSha256: string }) => Promise<{ width?: number; height?: number }>;
}) {
  const { database, storage } = options;
  const entries = database.collection("creator_reference_library");
  const revisions = database.collection("creator_reference_library_revisions");
  const uploads = database.collection("creator_reference_library_uploads");
  const operations = database.collection("creator_reference_library_operations");
  const projects = database.collection(COLLECTIONS.creatorProjects);
  const versions = database.collection(COLLECTIONS.creatorProjectVersions);
  const assets = database.collection(COLLECTIONS.creatorProjectAssets);
  const publicEntry = (entry: Entry): LibraryEntry => LibraryEntrySchema.parse({ ...entry, approval: entry.approval ?? approval(entry.kind, entry.approved, entry.revision, entry.reviewedAt), photos: entry.photos.map(({ objectKey: _key, ...photo }) => photo) });
  async function find(userId: string, id: string, session?: ClientSession): Promise<Entry> {
    const row = await entries.findOne({ id, userId }, session ? { session } : {});
    if (!row) return fail("not_found", "This saved item was not found.");
    return row.value as Entry;
  }
  async function bytes(photo: { objectKey: string; checksumSha256: string; sizeBytes: number }) {
    const result = await storage.get({ bucket: storage.assetsBucket, key: photo.objectKey, maxBytes: 12 * 1024 * 1024 });
    if (result.body.byteLength !== photo.sizeBytes || hash(result.body) !== photo.checksumSha256) return fail("invalid", "The saved photo could not be verified.");
    return result.body;
  }
  async function copyPhoto(userId: string, projectId: string, photo: Photo, source: LibrarySource) {
    const id = operationId(userId, `library-copy:${projectId}:${source.entryId}:${photo.id}:${photo.checksumSha256}`);
    const key = objectKeys.creatorAsset({ userId, projectId, assetId: id, kind: source.kind === "presenter" ? "reference" : "product", checksumSha256: photo.checksumSha256 });
    await storage.put({ bucket: storage.assetsBucket, key, body: await bytes(photo), contentType: photo.mimeType, metadata: { "sha256-hex": photo.checksumSha256 } });
    return { id, key, photo, source };
  }
  async function resolve(userId: string, source: LibrarySource, checksum?: string, session?: ClientSession) {
    const entry = await find(userId, source.entryId, session);
    const photo = entry.photos.find(photo => photo.id === source.photoId);
    if (entry.deleted || !entry.approved || entry.kind !== source.kind || !photo || (checksum && checksum !== photo.checksumSha256) || source.sizeBytes !== photo.sizeBytes || source.revision > entry.revision) return fail("review_required", "A saved reference changed or needs permission review. Refresh your campaign and review its photos.");
    return { entry, photo };
  }
  const assertConfiguration = (userId: string, configuration: unknown, session?: ClientSession, lock = false) => assertLibraryConfiguration(database, userId, configuration, session, lock);
  async function enqueue(userId: string, session: ClientSession) {
    const now = new Date();
    await database.collection(COLLECTIONS.workerJobs).insertOne({ id: newMongoObjectId(), name: "reference-library.reconcile.v1", data: { userId }, status: "queued", leaseOwner: null, leaseExpiresAt: null, retryCount: 0, retryLimit: 5, startAfter: now, createdAt: now, updatedAt: now }, { session });
  }
  async function commit(userId: string, key: string, input: unknown, build: (current: Entry | null) => Promise<Entry>, id?: string, expectedRevision?: number) {
    const opId = operationId(userId, key); const digest = hash(JSON.stringify(input));
    const replay = await operations.findOne({ id: opId, userId });
    if (replay) { if (replay.digest !== digest) return fail("conflict", "This save key was already used for a different change."); return publicEntry(replay.value as Entry); }
    const current = id ? await find(userId, id) : null;
    if (current && (current.deleted || current.revision !== expectedRevision)) return fail("conflict", "This item changed. Reload it before saving.");
    const next = await build(current);
    return database.transaction(async session => {
      const previous = await operations.findOne({ id: opId, userId }, { session });
      if (previous) { if (previous.digest !== digest) return fail("conflict", "This save key was already used."); return publicEntry(previous.value as Entry); }
      const latest = id ? await find(userId, id, session) : null;
      if (latest && (latest.deleted || latest.revision !== expectedRevision)) return fail("conflict", "This item changed. Reload it before saving.");
      await entries.updateOne({ id: next.id, userId }, { $set: { value: next, userId, kind: next.kind, deleted: next.deleted, updatedAt: next.updatedAt } }, { upsert: !latest, session });
      await revisions.insertOne({ id: newMongoObjectId(), entryId: next.id, userId, revision: next.revision, value: next, createdAt: new Date() }, { session });
      await operations.insertOne({ id: opId, userId, digest, value: next, createdAt: new Date() }, { session });
      await enqueue(userId, session);
      return publicEntry(next);
    });
  }
  return {
    find: async (userId: string, id: string) => publicEntry(await find(userId, id)),
    async list(userId: string, input: { kind?: string; search?: string; cursor?: string } = {}) {
      const filter: Document = { userId, ...(input.kind ? { kind: input.kind } : {}) };
      // Tombstones are returned during draft reconciliation, never as selectable entries.
      if (input.cursor) filter.id = { $gt: input.cursor };
      if (input.search) filter["value.name"] = { $regex: input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const rows = await entries.find(filter).sort({ id: 1 }).limit(51).toArray();
      return { entries: rows.slice(0, 50).map(row => publicEntry(row.value as Entry)), nextCursor: rows.length > 50 ? String(rows[49]!.id) : null };
    },
    async allocateUpload(userId: string, key: string, input: unknown) {
      const metadata = LibraryUploadRequestSchema.parse(input); const id = operationId(userId, `upload:${key}`);
      const objectKey = `users/${userId}/reference-library/uploads/${id}/${metadata.checksumSha256}`;
      await uploads.updateOne({ id, userId }, { $setOnInsert: { id, userId, ...metadata, objectKey, verified: false, createdAt: new Date() } }, { upsert: true });
      const stored = await uploads.findOne({ id, userId });
      if (stored?.checksumSha256 !== metadata.checksumSha256 || stored.name !== metadata.name || stored.sizeBytes !== metadata.sizeBytes || stored.mimeType !== metadata.mimeType) return fail("conflict", "This upload key was already used.");
      return { id, objectKey, metadata };
    },
    async writeUpload(userId: string, id: string, body: Uint8Array) {
      const upload = await uploads.findOne({ id, userId });
      if (!upload) return fail("not_found", "The photo upload was not found.");
      if (!options.verify) return fail("unavailable", "Image verification is unavailable.");
      if (body.byteLength !== upload.sizeBytes || hash(body) !== upload.checksumSha256) return fail("invalid", "The photo checksum or size does not match.");
      const verified = await options.verify({ kind: "product", bytes: body, mimeType: String(upload.mimeType), checksumSha256: String(upload.checksumSha256) });
      if (!verified.width || !verified.height) return fail("invalid", "The photo could not be decoded.");
      await storage.put({ bucket: storage.assetsBucket, key: String(upload.objectKey), body, contentType: String(upload.mimeType), metadata: { "sha256-hex": String(upload.checksumSha256) } });
      await uploads.updateOne({ id, userId }, { $set: { verified: true, width: verified.width, height: verified.height } });
    },
    async completeUpload(userId: string, id: string) {
      const upload = await uploads.findOne({ id, userId });
      if (!upload) return fail("not_found", "The photo upload was not found.");
      if (!options.verify) return fail("unavailable", "Image verification is unavailable.");
      const body = await bytes(upload as unknown as Photo);
      const verified = await options.verify({ kind: "product", bytes: body, mimeType: String(upload.mimeType), checksumSha256: String(upload.checksumSha256) });
      if (!verified.width || !verified.height) return fail("invalid", "The photo could not be decoded.");
      await uploads.updateOne({ id, userId }, { $set: { verified: true, width: verified.width, height: verified.height } });
    },
    async save(userId: string, key: string, request: SaveLibraryEntry) {
      const input = SaveLibraryEntrySchema.parse(request);
      return commit(userId, key, input, async current => {
        if (current && current.kind !== input.kind) return fail("invalid", "Products and presenters must remain separate.");
        const entryId = current?.id ?? operationId(userId, `entry:${key}`);
        const photos: Photo[] = [];
        for (const source of input.photos) {
          let photo: Photo;
          if (source.uploadId) {
            const upload = await uploads.findOne({ id: source.uploadId, userId, verified: true });
            if (!upload) return fail("invalid", "Complete photo verification before saving.");
            photo = { id: source.id, name: String(upload.name), objectKey: String(upload.objectKey), checksumSha256: String(upload.checksumSha256), mimeType: upload.mimeType as Photo["mimeType"], sizeBytes: Number(upload.sizeBytes), width: Number(upload.width), height: Number(upload.height) };
          } else if (source.projectSource) {
            const project = await projects.findOne({ id: source.projectSource.projectId, userId, deletedAt: null });
            const asset = project ? await assets.findOne({ id: source.projectSource.assetId, projectId: project.id, userId }) : null;
            if (!asset || !options.verify) return fail("not_found", "Use a verified photo from your own campaign.");
            const body = await bytes({ objectKey: String(asset.objectKey), checksumSha256: String(asset.checksumSha256), sizeBytes: Number(asset.sizeBytes) });
            const verified = await options.verify({ kind: "product", bytes: body, mimeType: String(asset.mimeType), checksumSha256: String(asset.checksumSha256) });
            if (!verified.width || !verified.height) return fail("invalid", "The campaign photo could not be decoded.");
            photo = { id: source.id, name: String(asset.originalFilename ?? "Campaign photo"), objectKey: String(asset.objectKey), checksumSha256: String(asset.checksumSha256), mimeType: asset.mimeType as Photo["mimeType"], sizeBytes: body.byteLength, width: verified.width, height: verified.height };
          } else {
            const existing = current?.photos.find(photo => photo.id === source.id);
            if (!existing) return fail("invalid", "Choose an uploaded or saved photo.");
            photo = existing;
          }
          const objectKey = `users/${userId}/reference-library/entries/${entryId}/${photo.id}/${photo.checksumSha256}`;
          await storage.put({ bucket: storage.assetsBucket, key: objectKey, body: await bytes(photo), contentType: photo.mimeType, metadata: { "sha256-hex": photo.checksumSha256 } });
          photos.push({ ...photo, objectKey });
        }
        const now = new Date().toISOString();
        return { id: entryId, name: input.name, kind: input.kind, photos, revision: (current?.revision ?? 0) + 1, approved: input.approved, reviewedAt: input.approved ? now : null, approval: approval(input.kind, input.approved, (current?.revision ?? 0) + 1, input.approved ? now : null), deleted: false, updatedAt: now };
      }, input.id, input.expectedRevision);
    },
    async remove(userId: string, id: string, revision: number, key: string) {
      return commit(userId, key, { id, revision, action: "delete" }, async current => ({ ...current!, deleted: true, approved: false, reviewedAt: null, approval: approval(current!.kind, false, current!.revision + 1, null), revision: current!.revision + 1, updatedAt: new Date().toISOString() }), id, revision);
    },
    async photo(userId: string, id: string, photoId: string) {
      const entry = await find(userId, id);
      if (entry.deleted) return fail("not_found", "This item was deleted.");
      const photo = entry.photos.find(photo => photo.id === photoId);
      if (!photo) return fail("not_found", "The saved photo was not found.");
      return { body: await bytes(photo), mimeType: photo.mimeType };
    },
    resolve, assertConfiguration,
    async attach(userId: string, projectId: string, source: LibrarySource, checksum: string, key = `${projectId}:${source.entryId}:${source.photoId}:${checksum}`) {
      if (!await projects.findOne({ id: projectId, userId, deletedAt: null })) return fail("not_found", "Campaign not found.");
      const digest = hash(JSON.stringify({ projectId, source, checksum }));
      const operation = operationId(userId, `attach:${key}`);
      const previous = await operations.findOne({ id: operation, userId });
      if (previous && previous.digest !== digest) return fail("conflict", "This copy key was already used for a different photo.");
      const { photo } = await resolve(userId, source, checksum);
      const copy = await copyPhoto(userId, projectId, photo, source);
      await assets.updateOne({ id: copy.id, userId, projectId }, { $setOnInsert: { id: copy.id, userId, projectId, bucket: storage.assetsBucket, objectKey: copy.key, kind: source.kind === "presenter" ? "reference" : "product", mimeType: photo.mimeType, sizeBytes: photo.sizeBytes, checksumSha256: photo.checksumSha256, width: photo.width, height: photo.height, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
      await operations.updateOne({ id: operation, userId }, { $setOnInsert: { id: operation, userId, digest, createdAt: new Date() } }, { upsert: true });
      const completed = await operations.findOne({ id: operation, userId });
      if (completed?.digest !== digest) return fail("conflict", "This copy key was already used for a different photo.");
      return { assetId: copy.id, objectKey: copy.key };
    },
    async copyToClaim(userId: string, source: LibrarySource, projectId: string, assetId: string, expected: { checksumSha256: string; sizeBytes: number; mimeType: string }) {
      const { photo } = await resolve(userId, source, expected.checksumSha256);
      if (photo.sizeBytes !== expected.sizeBytes || photo.mimeType !== expected.mimeType) return fail("invalid", "The saved photo does not match the campaign.");
      const key = objectKeys.creatorAsset({ userId, projectId, assetId, kind: source.kind === "presenter" ? "reference" : "product", checksumSha256: photo.checksumSha256 });
      await storage.put({ bucket: storage.assetsBucket, key, body: await bytes(photo), contentType: photo.mimeType, metadata: { "sha256-hex": photo.checksumSha256 } });
      return { key, bucket: storage.assetsBucket };
    },
    async reconcileOwner(userId: string) {
      const rows = await projects.find({ userId, mode: "template", deletedAt: null, status: { $ne: "trashed" } }).toArray();
      for (const project of rows) {
        if (!project.currentWorkingVersionId || project.currentWorkingVersionId === project.currentAcceptedVersionId) continue;
        if (await database.collection(COLLECTIONS.renderRuns).findOne({ userId, projectId: project.id, status: { $in: active } })) continue;
        const version = await versions.findOne({ id: project.currentWorkingVersionId, userId });
        if (!version) continue;
        const configuration = structuredClone(version.configuration);
        const images = libraryImages(configuration); const next: Record<string, unknown>[] = []; const copied: Awaited<ReturnType<typeof copyPhoto>>[] = [];
        const fences: { id: string; revision: number }[] = []; let changed = false;
        for (const image of images) {
          if (!image.librarySource) { next.push(image); continue; }
          const source = image.librarySource as LibrarySource;
          const entry = await find(userId, source.entryId).catch(error => { if (error instanceof ReferenceLibraryError && error.code === "not_found") return null; throw error; });
          const photo = entry?.photos.find(photo => photo.id === source.photoId);
          if (entry) fences.push({ id: entry.id, revision: entry.revision });
          if (!entry || entry.deleted || !photo) { changed = true; continue; }
          if (photo.checksumSha256 !== image.checksum) {
            const updatedSource = { ...source, revision: entry.revision, sizeBytes: photo.sizeBytes };
            const copy = await copyPhoto(userId, String(project.id), photo, updatedSource); copied.push(copy);
            const { personRightsConfirmed: _rights, assetKey: _local, ...rest } = image;
            next.push({ ...rest, id: copy.id, name: photo.name, url: "", checksum: photo.checksumSha256, mimeType: photo.mimeType, storagePath: copy.key, librarySource: updatedSource, libraryReviewRequired: true }); changed = true;
          } else if (!entry.approved && !image.libraryReviewRequired) {
            const { personRightsConfirmed: _rights, ...rest } = image; next.push({ ...rest, libraryReviewRequired: true }); changed = true;
          } else next.push(image);
        }
        if (!changed) continue;
        const creator = object(configuration.creatorProject); object(creator.product).images = next;
        // Deletions need an explicit review even when no linked photos remain.
        creator.libraryReviewRequired = true;
        const source = object(creator.source);
        if (Array.isArray(source.assetKeys)) source.assetKeys = next.filter(image => image.selected !== false && image.storagePath).map(image => image.storagePath);
        const generation = object(configuration.generation);
        generation.references = next.filter(image => image.selected !== false && image.storagePath).map(image => ({ objectKey: image.storagePath, mimeType: image.mimeType, ...(image.referenceRole ? { referenceRole: image.referenceRole } : {}), ...(image.personRightsConfirmed ? { personRightsConfirmed: true } : {}) }));
        await database.transaction(async session => {
          const latest = await projects.findOne({ id: project.id, userId }, { session });
          if (!latest || latest.currentAcceptedVersionId === version.id) return;
          if (latest.currentWorkingVersionId !== version.id) return fail("conflict", "The draft changed during synchronization. Its latest edits will be retried.");
          if (await database.collection(COLLECTIONS.renderRuns).findOne({ userId, projectId: project.id, status: { $in: active } }, { session })) return;
          for (const fence of fences) {
            const row = await entries.findOne({ id: fence.id, userId, "value.revision": fence.revision }, { session });
            if (!row) return fail("conflict", "A saved reference changed during draft synchronization.");
            await entries.updateOne({ id: fence.id, userId }, { $inc: { generationFence: 1 } }, { session });
          }
          for (const copy of copied) await assets.updateOne({ id: copy.id, userId, projectId: project.id }, { $setOnInsert: { id: copy.id, userId, projectId: project.id, bucket: storage.assetsBucket, objectKey: copy.key, kind: copy.source.kind === "presenter" ? "reference" : "product", mimeType: copy.photo.mimeType, sizeBytes: copy.photo.sizeBytes, checksumSha256: copy.photo.checksumSha256, width: copy.photo.width, height: copy.photo.height, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true, session });
          const latestVersion = await versions.findOne({ projectId: project.id, userId }, { session, sort: { versionNumber: -1 } });
          const id = newMongoObjectId(); const now = new Date();
          const productRecipe = { ...object(version.productRecipe), images: next.filter(image => image.storagePath).map(image => ({ assetId: image.id, name: image.name, objectKey: image.storagePath, mimeType: image.mimeType, checksumSha256: image.checksum, ...(image.referenceRole ? { referenceRole: image.referenceRole } : {}), ...(image.selected === undefined ? {} : { selected: image.selected }), ...(image.personRightsConfirmed ? { personRightsConfirmed: true } : {}), ...(image.librarySource ? { librarySource: image.librarySource } : {}), ...(image.libraryReviewRequired ? { libraryReviewRequired: true } : {}) })) };
          object(generation.templateQuoteContext).libraryReviewRequired = true;
          const campaignRecipe = { ...object(version.campaignRecipe), libraryReviewRequired: true };
          await versions.insertOne({ ...version, productRecipe, campaignRecipe, id, parentVersionId: version.id, versionNumber: Number(latestVersion?.versionNumber ?? version.versionNumber) + 1, configuration, operationKey: `library-sync:${version.id}`, changeReason: "Saved references changed. Review photos before generating.", createdAt: now }, { session });
          await projects.updateOne({ id: project.id, userId, currentWorkingVersionId: version.id }, { $set: { currentWorkingVersionId: id, status: "ready", updatedAt: now } }, { session });
        });
      }
    },
  };
}
export type ReferenceLibraryService = ReturnType<typeof createReferenceLibraryService>;

/** A write fence serializes library edits against starting a new render. Replays remain immutable. */
export async function assertLibraryConfiguration(database: MongoDatabase, userId: string, configuration: unknown, session?: ClientSession, lock = false) {
  if (object(object(configuration).creatorProject).libraryReviewRequired) return fail("review_required", "Review the updated saved references before generating.");
  const entries = database.collection("creator_reference_library");
  for (const image of libraryImages(configuration)) {
    if (image.libraryReviewRequired) return fail("review_required", "Review the updated saved references before generating.");
    if (!image.librarySource) continue;
    const source = image.librarySource as LibrarySource;
    const row = await entries.findOne({ id: source.entryId, userId }, session ? { session } : {});
    const entry = row?.value as Entry | undefined;
    const photo = entry?.photos.find(photo => photo.id === source.photoId);
    if (!entry || entry.deleted || !entry.approved || entry.kind !== source.kind || !photo || image.checksum !== photo.checksumSha256 || source.sizeBytes !== photo.sizeBytes || source.revision > entry.revision) return fail("review_required", "A saved reference changed or needs permission review. Refresh and review its photos.");
    if ((source.kind === "presenter" ? "character" : "subject") !== image.referenceRole) return fail("invalid", "The saved photo has the wrong campaign role.");
    if (lock && session) {
      const fenced = await entries.updateOne({ id: entry.id, userId, "value.revision": entry.revision }, { $inc: { generationFence: 1 } }, { session });
      if (!fenced.matchedCount) return fail("review_required", "The saved reference changed before generation.");
    }
  }
}
