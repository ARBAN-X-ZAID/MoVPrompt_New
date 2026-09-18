import type { GuestClaimAssetManifest } from "@movprompt/contracts";

import type { CreationDraft } from "./contracts";

const DATABASE_NAME = "movprompt-guest-creator";
const DATABASE_VERSION = 2;
const DRAFTS = "drafts";
const ASSETS = "assets";

export const DRAFT_SAVE_EVENT = "movprompt:guest-draft-save-state";
export const GUEST_DRAFT_SCHEMA_VERSION = 2;

export type DraftSaveEventDetail = {
  draftId: string;
  state: "saving" | "saved" | "error";
  savedAt?: string;
};

export type GuestClaimCheckpoint = {
  pendingGenerationId: string;
  snapshotDigest: string;
  configuration: unknown;
  assetManifest: GuestClaimAssetManifest;
  /**
   * Written only after the owned source version exists and before local
   * IndexedDB cleanup. This is the client-side receipt that makes a reload
   * after a cleanup interruption a reuse operation, never a new version.
   */
  sourcePersistence?: GuestSourcePersistence;
  cleanupEligibleAt?: string;
};

export type GuestSourcePersistence = {
  pendingGenerationId: string;
  snapshotDigest: string;
  projectId: string;
  versionId: string;
  versionNumber: number;
  sourceFingerprint?: string;
  completedAt: string;
};

export type StoredGuestDraft = CreationDraft & {
  schemaVersion: typeof GUEST_DRAFT_SCHEMA_VERSION;
  blobKeys: string[];
  claimCheckpoint?: GuestClaimCheckpoint;
};

export type StoredGuestAsset = {
  key: string;
  draftId: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
};

export type GuestDraftLoadResult =
  | { state: "available"; draft: StoredGuestDraft }
  | { state: "expired" | "missing" };

export interface GuestDraftStorage {
  getDraft(id: string): Promise<StoredGuestDraft | null>;
  putDraft(draft: StoredGuestDraft): Promise<void>;
  getAsset(key: string): Promise<StoredGuestAsset | null>;
  putAsset(asset: StoredGuestAsset): Promise<void>;
  deleteDraftAndAssets(id: string): Promise<void>;
  listDrafts(): Promise<StoredGuestDraft[]>;
}

let testStorage: GuestDraftStorage | null = null;
let clock: () => Date = () => new Date();

function now() {
  return clock();
}

function isExpired(draft: Pick<CreationDraft, "expiresAt">) {
  return new Date(draft.expiresAt).getTime() <= now().getTime();
}

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Guest draft storage is unavailable."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Guest draft storage is unavailable."));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFTS)) database.createObjectStore(DRAFTS, { keyPath: "id" });
      if (!database.objectStoreNames.contains(ASSETS)) {
        const assets = database.createObjectStore(ASSETS, { keyPath: "key" });
        assets.createIndex("draftId", "draftId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readOne<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  return openDatabase().then((database) => new Promise<T | null>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error("Guest draft operation failed."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error("Guest draft transaction failed."));
  }));
}

const indexedDbStorage: GuestDraftStorage = {
  getDraft: (id) => readOne<StoredGuestDraft>(DRAFTS, id),
  async putDraft(draft) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(DRAFTS, "readwrite");
      transaction.objectStore(DRAFTS).put(draft);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Guest draft transaction failed.")); };
    });
  },
  getAsset: (key) => readOne<StoredGuestAsset>(ASSETS, key),
  async putAsset(asset) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(ASSETS, "readwrite");
      transaction.objectStore(ASSETS).put(asset);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Guest asset transaction failed.")); };
    });
  },
  async deleteDraftAndAssets(id) {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([DRAFTS, ASSETS], "readwrite");
      transaction.objectStore(DRAFTS).delete(id);
      const cursor = transaction.objectStore(ASSETS).index("draftId").openCursor(IDBKeyRange.only(id));
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.delete();
        current.continue();
      };
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error("Guest draft deletion failed.")); };
    });
  },
  async listDrafts() {
    const database = await openDatabase();
    return new Promise<StoredGuestDraft[]>((resolve, reject) => {
      const transaction = database.transaction(DRAFTS, "readonly");
      const request = transaction.objectStore(DRAFTS).getAll();
      request.onsuccess = () => resolve(request.result as StoredGuestDraft[]);
      request.onerror = () => reject(request.error ?? new Error("Guest draft listing failed."));
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => reject(transaction.error ?? new Error("Guest draft transaction failed."));
    });
  },
};

function storage() {
  return testStorage ?? indexedDbStorage;
}

function blobKeysFor(draft: CreationDraft) {
  return [...new Set([
    ...draft.assetKeys,
    ...draft.product.images.flatMap((image) => image.assetKey ? [image.assetKey] : []),
  ])];
}

function asStoredDraft(draft: CreationDraft, existing: StoredGuestDraft | null): StoredGuestDraft {
  const savedAt = now().toISOString();
  return {
    ...draft,
    createdAt: existing?.createdAt ?? draft.createdAt,
    updatedAt: savedAt,
    expiresAt: existing?.expiresAt ?? draft.expiresAt,
    schemaVersion: GUEST_DRAFT_SCHEMA_VERSION,
    blobKeys: blobKeysFor(draft),
    ...(existing?.claimCheckpoint ? { claimCheckpoint: existing.claimCheckpoint } : {}),
  };
}

export function createMemoryGuestDraftStorage(): GuestDraftStorage {
  const drafts = new Map<string, StoredGuestDraft>();
  const assets = new Map<string, StoredGuestAsset>();
  return {
    async getDraft(id) { return drafts.get(id) ?? null; },
    async putDraft(draft) { drafts.set(draft.id, draft); },
    async getAsset(key) { return assets.get(key) ?? null; },
    async putAsset(asset) { assets.set(asset.key, asset); },
    async deleteDraftAndAssets(id) {
      drafts.delete(id);
      for (const [key, asset] of assets) if (asset.draftId === id) assets.delete(key);
    },
    async listDrafts() { return [...drafts.values()]; },
  };
}

/** Test-only seams keep time and durable browser storage deterministic without changing production behavior. */
export function setGuestDraftStorageForTests(next?: GuestDraftStorage) {
  testStorage = next ?? null;
}

export function setGuestDraftClockForTests(next?: () => Date) {
  clock = next ?? (() => new Date());
}

export async function saveGuestDraft(draft: CreationDraft): Promise<CreationDraft> {
  window.dispatchEvent(new CustomEvent<DraftSaveEventDetail>(DRAFT_SAVE_EVENT, {
    detail: { draftId: draft.id, state: "saving" },
  }));
  try {
    const existing = await storage().getDraft(draft.id);
    const stored = asStoredDraft(draft, existing);
    await storage().putDraft(stored);
    window.dispatchEvent(new CustomEvent<DraftSaveEventDetail>(DRAFT_SAVE_EVENT, {
      detail: { draftId: draft.id, state: "saved", savedAt: stored.updatedAt },
    }));
    return stored;
  } catch (error) {
    window.dispatchEvent(new CustomEvent<DraftSaveEventDetail>(DRAFT_SAVE_EVENT, {
      detail: { draftId: draft.id, state: "error" },
    }));
    throw error;
  }
}

export async function loadGuestDraft(id: string): Promise<GuestDraftLoadResult> {
  const draft = await storage().getDraft(id);
  if (!draft) return { state: "missing" };
  if (isExpired(draft)) {
    await storage().deleteDraftAndAssets(id);
    return { state: "expired" };
  }
  return { state: "available", draft };
}

export async function getGuestDraft(id: string): Promise<CreationDraft | null> {
  const loaded = await loadGuestDraft(id);
  return loaded.state === "available" ? loaded.draft : null;
}

export async function putGuestAsset(draftId: string, file: File): Promise<string> {
  const key = `${draftId}/${crypto.randomUUID()}`;
  await storage().putAsset({ key, draftId, name: file.name, mimeType: file.type, size: file.size, blob: file, createdAt: now().toISOString() });
  return key;
}

export async function getGuestAsset(key: string): Promise<StoredGuestAsset | null> {
  return storage().getAsset(key);
}

/** Legacy deletion remains for expiry and legacy flows. New claim code must use deleteVerifiedGuestDraft. */
export async function deleteGuestDraft(id: string) {
  await storage().deleteDraftAndAssets(id);
}

export async function expireGuestDraft(id: string): Promise<boolean> {
  const draft = await storage().getDraft(id);
  if (!draft || !isExpired(draft)) return false;
  await storage().deleteDraftAndAssets(id);
  return true;
}

export async function cleanupExpiredGuestDrafts() {
  const drafts = await storage().listDrafts();
  await Promise.all(drafts.filter(isExpired).map((draft) => storage().deleteDraftAndAssets(draft.id)));
}

export async function markClaimCheckpoint(id: string, checkpoint: GuestClaimCheckpoint): Promise<StoredGuestDraft | null> {
  const loaded = await loadGuestDraft(id);
  if (!("draft" in loaded) || loaded.draft.pendingGenerationId !== checkpoint.pendingGenerationId) return null;
  const next: StoredGuestDraft = { ...loaded.draft, claimCheckpoint: checkpoint, updatedAt: now().toISOString() };
  await storage().putDraft(next);
  return next;
}

export async function markGuestDraftCleanupEligible(id: string, pendingGenerationId: string): Promise<boolean> {
  const loaded = await loadGuestDraft(id);
  if (!("draft" in loaded)) return false;
  const checkpoint = loaded.draft.claimCheckpoint;
  if (!checkpoint || checkpoint.pendingGenerationId !== pendingGenerationId) return false;
  const savedAt = now().toISOString();
  await storage().putDraft({ ...loaded.draft, updatedAt: savedAt, claimCheckpoint: { ...checkpoint, cleanupEligibleAt: savedAt } });
  return true;
}

/**
 * Records the exact immutable source version before any local cleanup. The
 * pending intent and snapshot digest bind the marker to one guest claim, so a
 * later retry cannot accidentally reuse it for changed campaign facts.
 */
export async function markGuestDraftSourcePersistence(
  id: string,
  completion: Omit<GuestSourcePersistence, "completedAt">,
): Promise<StoredGuestDraft | null> {
  const loaded = await loadGuestDraft(id);
  if (!("draft" in loaded)) return null;
  const checkpoint = loaded.draft.claimCheckpoint;
  if (
    !checkpoint
    || checkpoint.pendingGenerationId !== completion.pendingGenerationId
    || checkpoint.snapshotDigest !== completion.snapshotDigest
  ) {
    return null;
  }
  const savedAt = now().toISOString();
  const next: GuestSourcePersistence = {
    ...completion,
    completedAt: savedAt,
  };
  await storage().putDraft({
    ...loaded.draft,
    updatedAt: savedAt,
    claimCheckpoint: { ...checkpoint, sourcePersistence: next },
  });
  return await storage().getDraft(id);
}

/** Deletes a local draft only after its exact canonical receipt was verified. Safe to replay. */
export async function deleteVerifiedGuestDraft(id: string, pendingGenerationId: string): Promise<boolean> {
  const loaded = await loadGuestDraft(id);
  if (!("draft" in loaded)) return true;
  const checkpoint = loaded.draft.claimCheckpoint;
  if (!checkpoint?.cleanupEligibleAt || checkpoint.pendingGenerationId !== pendingGenerationId) return false;
  await storage().deleteDraftAndAssets(id);
  return true;
}
