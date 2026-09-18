import { describe, expect, it, vi } from "vitest";
import type { MongoDatabase } from "@movprompt/db";
import type { R2Storage } from "@movprompt/storage";
import { cleanExpiredGuestMedia } from "./guest-media-cleanup.js";
describe("guest cleanup", () => {
  it("never deletes media when a guest still has an active render", async () => {
    const remove = vi.fn(); const update = vi.fn();
    const database = { transaction: async (fn: (s: object) => unknown) => fn({}), db: { collection: (name: string) => name === "guest_sessions" ? { find: () => [{ _id: "guest" }], updateOne: update } : { findOne: async () => ({ status: "processing" }) } } } as unknown as MongoDatabase;
    expect(await cleanExpiredGuestMedia(database, { delete: remove } as unknown as R2Storage)).toBe(0);
    expect(remove).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
});
