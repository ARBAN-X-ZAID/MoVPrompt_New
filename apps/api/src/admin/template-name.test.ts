import { describe, expect, it, vi } from "vitest";
import { TemplateNameInputSchema, createAdminTemplateService } from "./template-service.js";
import { adminFilter } from "./data-service.js";
import { isRoutineAdminMutation } from "./management-policy.js";
import type { MongoDatabase } from "@movprompt/db";
import type { AdminActor, AdminSecurity } from "./security.js";
import { ObjectId } from "mongodb";

describe("template display names", () => {
  const id = new ObjectId();
  const input = { expectedRevision: 2, name: { en: "Jewelry", ar: "مجوهرات" } };
  it("permits only validated name edits through routine management", () => {
    const path = `/api/v1/admin/templates/${id}/name`;
    expect(isRoutineAdminMutation("POST", path, input)).toBe(true);
    for (const body of [{ ...input, name: { en: " ", ar: "اسم" } }, { ...input, definition: {} }, { ...input, expectedRevision: -1 }]) expect(isRoutineAdminMutation("POST", path, body)).toBe(false);
    expect(TemplateNameInputSchema.parse({ ...input, name: { en: " Jewelry ", ar: "مجوهرات" } }).name.en).toBe("Jewelry");
  });
  it("lists the Ad Studio template with the rest of the catalog", () => {
    expect(adminFilter("templates", { page: 1, limit: 25, direction: "desc" } as Parameters<typeof adminFilter>[1])).not.toHaveProperty("slug");
  });
  it("rejects stale revisions before any write", async () => {
    const updateOne = vi.fn();
    const database = { db: { collection: () => ({ findOne: async () => ({ _id: id, revision: 3 }), updateOne }) } } as unknown as MongoDatabase;
    const security = { command: async (_actor: unknown, _key: string, _input: unknown, work: (session: unknown) => unknown) => work(undefined) } as unknown as AdminSecurity;
    await expect(createAdminTemplateService(database, security).rename({} as AdminActor, String(id), "key", input)).rejects.toThrow();
    expect(updateOne).not.toHaveBeenCalled();
  });
  it("updates only the catalog head and records an audit entry", async () => {
    const updateOne = vi.fn(async () => ({ matchedCount: 1 }));
    const insertOne = vi.fn(async () => ({}));
    const collection = vi.fn((name: string) => {
      if (name === "audit_logs") return { insertOne };
      return { findOne: async () => ({ _id: id, revision: 2 }), updateOne };
    });
    const database = { db: { collection } } as unknown as MongoDatabase;
    const security = { command: async (_actor: unknown, _key: string, _input: unknown, work: (session: unknown) => unknown) => work(undefined) } as unknown as AdminSecurity;
    await expect(createAdminTemplateService(database, security).rename({ userId: String(id), requestId: "test" } as AdminActor, String(id), "key", input)).resolves.toMatchObject({ revision: 3, name: input.name });
    expect(updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.objectContaining({ displayName: input.name }), $inc: { revision: 1 } }), expect.anything());
    expect(updateOne).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ $set: expect.not.objectContaining({ adminManaged: expect.anything() }) }), expect.anything());
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ action: "template.rename" }), expect.anything());
    expect(collection.mock.calls.some(([name]) => name.includes("versions"))).toBe(false);
  });
});
