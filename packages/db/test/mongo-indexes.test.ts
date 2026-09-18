import { describe, expect, it, vi } from "vitest";

import { COLLECTIONS, type MongoDatabase } from "../src/mongo-client.js";
import { ensureMongoIndexes } from "../src/mongo-indexes.js";

describe("MongoDB indexes", () => {
  it("replaces the sparse creator version operation index with a string-only partial index", async () => {
    const createIndex = vi.fn(async () => "index");
    const dropIndex = vi.fn(async () => undefined);
    const collections = new Map<string, {
      createIndex: typeof createIndex;
      dropIndex: typeof dropIndex;
      indexes: () => Promise<Array<Record<string, unknown>>>;
    }>();

    const database = {
      collection(name: string) {
        if (!collections.has(name)) {
          collections.set(name, {
            createIndex,
            dropIndex,
            indexes: async () => name === COLLECTIONS.creatorProjectVersions
              ? [{ name: "userId_1_operationKey_1", unique: true, sparse: true }]
              : name === COLLECTIONS.workerJobs
                ? [{
                    name: "name_1_singletonKey_1",
                    unique: true,
                    partialFilterExpression: { singletonKey: { $type: "string" } },
                  }]
                : [],
          });
        }
        return collections.get(name)!;
      },
    } as unknown as MongoDatabase;

    await ensureMongoIndexes(database);

    expect(dropIndex).toHaveBeenCalledOnce();
    expect(dropIndex).toHaveBeenCalledWith("userId_1_operationKey_1");
    expect(createIndex).toHaveBeenCalledWith(
      { userId: 1, operationKey: 1 },
      {
        unique: true,
        partialFilterExpression: { operationKey: { $type: "string" } },
      },
    );
  });
});
