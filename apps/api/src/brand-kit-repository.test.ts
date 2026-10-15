import { describe, expect, it } from "vitest";
import { defaultProductModelAdSettings } from "@movprompt/contracts";
import type { MongoDatabase } from "@movprompt/db";
import { createMongoBrandKitRepository } from "./brand-kit-repository.js";

/** Transactional fixture: no configured database or network is used. */
function databaseFixture() {
  let data = new Map<string, Array<Record<string, unknown>>>();
  const rows = (name: string) => { if (!data.has(name)) data.set(name, []); return data.get(name)!; };
  const matches = (row: Record<string, unknown>, filter: Record<string, unknown>) => Object.entries(filter).every(([key, value]) => row[key] === value);
  const database = {
    async transaction<T>(operation: (session: object) => Promise<T>) {
      const before = structuredClone(data);
      try { return await operation({}); } catch (error) { data = before; throw error; }
    },
    collection(name: string) {
      return {
        async findOne(filter: Record<string, unknown>) { return structuredClone(rows(name).find(row => matches(row, filter)) ?? null); },
        find(filter: Record<string, unknown>) { const query = { sort: () => query, limit: () => query, toArray: async () => structuredClone(rows(name).filter(row => matches(row, filter))) }; return query; },
        async updateOne(filter: Record<string, unknown>, update: { $set: Record<string, unknown>; $unset?: Record<string, unknown> }, options: { upsert?: boolean } = {}) {
          let row = rows(name).find(row => matches(row, filter));
          if (!row && !options.upsert) return { matchedCount: 0 };
          if (!row) { row = { ...filter }; rows(name).push(row); }
          Object.assign(row, structuredClone(update.$set));
          for (const key of Object.keys(update.$unset ?? {})) delete row[key];
          return { matchedCount: 1 };
        },
        async insertOne(input: Record<string, unknown>) { if (rows(name).some(row => row.id === input.id)) throw new Error("duplicate key"); rows(name).push(structuredClone(input)); },
      };
    },
  };
  return { database: database as unknown as MongoDatabase, rows };
}
const owner = "a".repeat(24), other = "b".repeat(24);
const kit = () => ({ ...defaultProductModelAdSettings().brandKit, name: "My brand" });
describe("brand-kit transactional persistence (unpaid fixture)", () => {
  it("replays one save, rejects changed-key payloads and keeps revisions immutable", async () => {
    const db = databaseFixture(); const repo = createMongoBrandKitRepository(db.database);
    const first = await repo.save(owner, "create", { snapshot: kit() });
    expect(await repo.save(owner, "create", { snapshot: kit() })).toEqual(first);
    expect(db.rows("creator_brand_kits")).toHaveLength(1); expect(db.rows("creator_brand_kit_revisions")).toHaveLength(1);
    await expect(repo.save(owner, "create", { snapshot: { ...kit(), name: "Changed" } })).rejects.toThrow("idempotency_conflict");
    const second = await repo.save(owner, "update", { id: first.id, expectedRevision: 1, snapshot: { ...kit(), name: "New name" } });
    expect(second.revision).toBe(2); expect(first.snapshot.name).toBe("My brand");
    expect(db.rows("creator_brand_kit_revisions")[0]!.snapshot).toMatchObject({ name: "My brand" });
    await expect(repo.save(owner, "stale", { id: first.id, expectedRevision: 1, snapshot: kit() })).rejects.toThrow("revision_conflict");
    expect(db.rows("creator_brand_kit_revisions")).toHaveLength(2);
  });
  it("isolates owners and archives idempotently without removing history", async () => {
    const db = databaseFixture(); const repo = createMongoBrandKitRepository(db.database); const first = await repo.save(owner, "create", { snapshot: kit() });
    expect(await repo.list(other)).toEqual([]); expect(await repo.find(other, first.id)).toBeNull();
    await expect(repo.save(other, "edit", { id: first.id, expectedRevision: 1, snapshot: kit() })).rejects.toThrow("not_found");
    expect(await repo.archive(other, first.id)).toBe(false);
    expect(await repo.archive(owner, first.id)).toBe(true); expect(await repo.archive(owner, first.id)).toBe(true);
    expect(await repo.list(owner)).toEqual([]); expect(db.rows("creator_brand_kit_revisions")).toHaveLength(1);
  });
  it("removes obsolete logo metadata when a new revision omits the logo", async () => {
    const db = databaseFixture(); const repo = createMongoBrandKitRepository(db.database); const checksum = "c".repeat(64);
    const first = await repo.save(owner, "create", { snapshot: { ...kit(), logoChecksum: checksum }, logoSource: { projectId: "d".repeat(24), assetId: "e".repeat(24), checksum } });
    await repo.save(owner, "remove-logo", { id: first.id, expectedRevision: 1, snapshot: kit() });
    expect((await repo.find(owner, first.id))?.logoSource).toBeUndefined();
    expect(db.rows("creator_brand_kit_revisions")[0]!.logoSource).toBeDefined();
  });
});
