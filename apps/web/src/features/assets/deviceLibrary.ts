import { DeviceLibraryRecordSchema, type DeviceLibraryRecord, type LibraryKind } from "@movprompt/contracts";

export type DevicePhoto = DeviceLibraryRecord & { blob?: Blob };
const databaseName = "movprompt-device-library";
export const LIBRARY_DEVICE_EVENT = "movprompt:device-library-changed";
const announce = () => window.dispatchEvent(new Event(LIBRARY_DEVICE_EVENT));
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id" });
    request.onerror = () => reject(request.error ?? new Error("Device storage unavailable."));
    request.onsuccess = () => resolve(request.result);
  });
}
async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("photos", mode); const request = action(tx.objectStore("photos"));
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(tx.error ?? request.error ?? new Error("Device storage unavailable.")); };
  });
}
export const deviceLibrary = {
  async all(ownerId: string | null, kind?: LibraryKind): Promise<DevicePhoto[]> {
    const records = await transact<DevicePhoto[]>("readonly", store => store.getAll());
    return records.filter(row => row.ownerId === ownerId && (!kind || row.kind === kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  async get(id: string): Promise<DevicePhoto | undefined> { return transact("readonly", store => store.get(id)); },
  async put(row: DevicePhoto) {
    const { blob, ...metadata } = row;
    DeviceLibraryRecordSchema.parse(metadata);
    await transact("readwrite", store => store.put({ ...metadata, ...(blob ? { blob } : {}) })); announce();
  },
  async remove(id: string) { await transact("readwrite", store => store.delete(id)); announce(); },
  async replaceIfCurrent(row: DevicePhoto) {
    const db = await database();
    const changed = await new Promise<boolean>((resolve, reject) => {
      const tx = db.transaction("photos", "readwrite"), store = tx.objectStore("photos");
      const request = store.get(row.id); let changed = false;
      request.onsuccess = () => {
        const current = request.result as DevicePhoto | undefined;
        if (current?.operationKey === row.operationKey && current.ownerId === row.ownerId) { store.put(row); changed = true; }
      };
      tx.oncomplete = () => { db.close(); resolve(changed); }; tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    });
    if (changed) announce(); return changed;
  },
  async add(file: File, kind: LibraryKind, checksumSha256: string, ownerId: string | null): Promise<DevicePhoto> {
    const id = `${ownerId ?? "guest"}:${kind}:${checksumSha256}`;
    const previous = await this.get(id); const now = new Date().toISOString();
    // Recheck server receipts for a fresh upload: its previous entry may have been deleted.
    const row: DevicePhoto = { id, ownerId, kind, name: file.name.slice(0, 240), mimeType: file.type.toLowerCase() as DevicePhoto["mimeType"], sizeBytes: file.size, checksumSha256, createdAt: previous?.createdAt ?? now, updatedAt: now, approved: ownerId ? false : previous?.approved ?? false, status: ownerId ? "pending" : "device", operationKey: ownerId ? crypto.randomUUID() : previous?.operationKey ?? crypto.randomUUID(), blob: file };
    await this.put(row); return row;
  },
  async adopt(ownerId: string) {
    // A readwrite transaction claims guest rows atomically across tabs. Claimed rows
    // stay scoped to their first account and never migrate into a later account.
    const db = await database();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("photos", "readwrite"); const store = tx.objectStore("photos"); const request = store.getAll();
      request.onsuccess = () => { for (const row of request.result as DevicePhoto[]) if (row.ownerId === null) store.put({ ...row, ownerId, status: "pending" }); };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    }); announce();
  },
};
