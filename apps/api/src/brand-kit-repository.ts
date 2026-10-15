import { createHash } from "node:crypto";
import { BrandKitRecordSchema, type BrandKitRecord, type SaveBrandKitRequest } from "@movprompt/contracts";
import { newMongoObjectId, type MongoDatabase } from "@movprompt/db";

export interface BrandKitRepository {
  find(userId: string, id: string): Promise<BrandKitRecord | null>;
  list(userId: string): Promise<BrandKitRecord[]>;
  save(userId: string, key: string, request: SaveBrandKitRequest): Promise<BrandKitRecord>;
  archive(userId: string, id: string): Promise<boolean>;
}

export function createMongoBrandKitRepository(database: MongoDatabase): BrandKitRepository {
  const kits = database.collection("creator_brand_kits");
  const revisions = database.collection("creator_brand_kit_revisions");
  const operations = database.collection("creator_brand_kit_operations");
  const record = (row: Record<string, unknown>): BrandKitRecord => BrandKitRecordSchema.parse({
    id: row.id, revision: row.revision, snapshot: row.snapshot,
    ...(row.logoSource ? { logoSource: row.logoSource } : {}), updatedAt: row.updatedAt,
  });
  return {
    async find(userId, id) { const row = await kits.findOne({ id, userId, archived: false }); return row ? record(row) : null; },
    async list(userId) { return (await kits.find({ userId, archived: false }).sort({ updatedAt: -1 }).limit(100).toArray()).map(record); },
    async save(userId, key, input) {
      const operationId = createHash("sha256").update(`${userId}\0${key}`).digest("hex").slice(0, 24);
      const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      return database.transaction(async session => {
        const existing = await operations.findOne({ id: operationId, userId }, { session });
        if (existing) {
          if (existing.digest !== digest) throw new Error("brand_kit_idempotency_conflict");
          return record(existing.result);
        }
        const current = input.id ? await kits.findOne({ id: input.id, userId, archived: false }, { session }) : null;
        if (input.id && !current) throw new Error("brand_kit_not_found");
        if (current && current.revision !== input.expectedRevision) throw new Error("brand_kit_revision_conflict");
        const result: BrandKitRecord = {
          id: input.id ?? newMongoObjectId(), revision: Number(current?.revision ?? 0) + 1,
          snapshot: structuredClone(input.snapshot), ...(input.logoSource ? { logoSource: input.logoSource } : {}), updatedAt: new Date().toISOString(),
        };
        const filter = current ? { id: result.id, userId, revision: current.revision } : { id: result.id, userId };
        await kits.updateOne(filter, { $set: { ...result, userId, archived: false }, ...(input.logoSource ? {} : { $unset: { logoSource: "" } }) }, { session, upsert: !current });
        await revisions.insertOne({ ...result, id: newMongoObjectId(), kitId: result.id, userId }, { session });
        await operations.insertOne({ id: operationId, userId, digest, result }, { session });
        return result;
      });
    },
    async archive(userId, id) {
      return database.transaction(async session => {
        const result = await kits.updateOne({ id, userId }, { $set: { archived: true, updatedAt: new Date().toISOString() } }, { session });
        return result.matchedCount > 0;
      });
    },
  };
}
