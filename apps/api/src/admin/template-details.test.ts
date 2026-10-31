import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import type { MongoDatabase } from "@movprompt/db";
import { getCreativeTemplate } from "@movprompt/creative-engine";
import { isRoutineAdminMutation } from "./management-policy.js";
import { createAdminTemplateService } from "./template-service.js";
import { adminTemplateView, templateOverrides } from "./template-view.js";
import type { AdminActor, AdminSecurity } from "./security.js";

const id = new ObjectId();
const versionId = new ObjectId();
const definition = getCreativeTemplate("premium-phone-reveal");
const actor = { userId: String(id), requestId: "test" } as AdminActor;
const security = { command: async (_actor: unknown, _key: string, _input: unknown, work: (session: unknown) => unknown) => work(undefined) } as unknown as AdminSecurity;

function fixture(head: Record<string, unknown> = {}) {
  const row = { _id: id, slug: definition.slug, revision: 4, currentPublishedVersionId: String(versionId), ...head };
  const updateOne = vi.fn(async () => ({ matchedCount: 1 }));
  const insertOne = vi.fn(async () => ({}));
  const collection = vi.fn((name: string) => {
    if (name === "audit_logs") return { insertOne };
    if (name.includes("version")) return { findOne: async () => ({ _id: versionId, templateId: id, versionNumber: definition.versionNumber, recipe: { executableDefinition: definition, familyId: definition.id } }) };
    return { findOne: async () => row, updateOne };
  });
  const service = createAdminTemplateService({ db: { collection } } as unknown as MongoDatabase, security);
  return { service, updateOne, insertOne, collection };
}

describe("template details", () => {
  const path = `/api/v1/admin/templates/${id}/details`;
  const input = { expectedRevision: 4, displayDescription: { en: "Owner copy", ar: "وصف المالك" }, enabledLanguages: ["en"] };

  it("allows only validated details through routine management", () => {
    expect(isRoutineAdminMutation("POST", path, input)).toBe(true);
    expect(isRoutineAdminMutation("POST", path, { expectedRevision: 4, displayName: null })).toBe(true);
    for (const body of [
      { expectedRevision: 4 },
      { ...input, enabledLanguages: [] },
      { ...input, enabledLanguages: ["en", "en"] },
      { ...input, enabledLanguages: ["bilingual"] },
      { ...input, displayDescription: { en: "x".repeat(241), ar: "و" } },
      { ...input, displayName: { en: "Only English" } },
      { ...input, tags: ["same", "SAME"] },
      { ...input, sortOrder: -1 },
      { ...input, discoveryCategory: "invented" },
      { ...input, prompt: "locked" },
      { ...input, scenes: [] },
      { ...input, durationRecipes: {} },
    ]) expect(isRoutineAdminMutation("POST", path, body)).toBe(false);
  });

  it("writes overrides to the head, leaves publication alone, and audits before and after", async () => {
    const { service, updateOne, insertOne, collection } = fixture({ displayName: { en: "Old", ar: "قديم" } });
    const result = await service.details(actor, String(id), "operation-key", { expectedRevision: 4, displayName: null, displayDescription: input.displayDescription, category: "brand", discoveryCategory: "brand", tags: ["a"], sortOrder: 3, enabledLanguages: ["ar", "en"] });
    expect(result).toMatchObject({ revision: 5, overrides: { displayName: null, category: "brand", enabledLanguages: ["en", "ar"] } });
    const update = (updateOne.mock.calls as unknown[][])[0]![1] as { $set: Record<string, unknown>; $unset: Record<string, string>; $inc: unknown };
    expect(update.$set).toMatchObject({ displayDescription: input.displayDescription, displayCategory: "brand", displayDiscoveryCategory: "brand", displayTags: ["a"], displaySortOrder: 3, enabledLanguages: ["en", "ar"] });
    expect(update.$set).not.toHaveProperty("adminManaged");
    expect(update.$set).not.toHaveProperty("publicationPinned");
    expect(update.$set).not.toHaveProperty("category");
    expect(update.$unset).toEqual({ displayName: "" });
    expect(update.$inc).toEqual({ revision: 1 });
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ action: "template.details", changes: expect.objectContaining({ before: expect.objectContaining({ displayName: { en: "Old", ar: "قديم" } }) }) }), expect.anything());
    expect(collection.mock.calls.filter(([name]) => name.includes("version"))).toHaveLength(1);
  });

  it("rejects a stale revision before any write", async () => {
    const { service, updateOne } = fixture();
    await expect(service.details(actor, String(id), "operation-key", { ...input, expectedRevision: 3 } as never)).rejects.toMatchObject({ code: "template_publication_changed" });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("rejects a language the current version does not support", async () => {
    const onlyArabic = { ...definition, supportedLanguages: ["ar" as const] };
    const updateOne = vi.fn();
    const collection = (name: string) => name.includes("version")
      ? { findOne: async () => ({ _id: versionId, versionNumber: definition.versionNumber, recipe: { executableDefinition: onlyArabic, familyId: definition.id } }) }
      : { findOne: async () => ({ _id: id, slug: definition.slug, revision: 4, currentPublishedVersionId: String(versionId) }), updateOne };
    const service = createAdminTemplateService({ db: { collection } } as unknown as MongoDatabase, security);
    await expect(service.details(actor, String(id), "operation-key", { expectedRevision: 4, enabledLanguages: ["en"] })).rejects.toMatchObject({ code: "unsupported_template_language", status: 400 });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it("rejects a category outside the catalog", async () => {
    const { service, updateOne } = fixture();
    await expect(service.details(actor, String(id), "operation-key", { expectedRevision: 4, category: "invented" })).rejects.toMatchObject({ code: "unsupported_template_category", status: 400 });
    expect(updateOne).not.toHaveBeenCalled();
  });
});

describe("admin template view", () => {
  it("shows effective values beside the overrides and version defaults, without bilingual", () => {
    const head = { slug: definition.slug, category: definition.category, displayCategory: "brand", enabledLanguages: ["ar"], enabledDurations: [15], displaySortOrder: 2 };
    const view = adminTemplateView(head, { recipe: {} }, { ...definition, supportedLanguages: ["en", "ar", "bilingual"] });
    expect(view).toMatchObject({ category: "brand", sortOrder: 2, selectableLanguages: ["en", "ar"], enabledLanguages: ["ar"], enabledDurations: [15], overrides: { category: "brand", enabledLanguages: ["ar"], displayName: null } });
    expect(view.defaults).toMatchObject({ name: definition.localizedName, category: definition.category });
    expect(templateOverrides({}).enabledLanguages).toBeNull();
  });

  it("falls back to everything the version supports when a head choice has gone stale", () => {
    const view = adminTemplateView({ enabledLanguages: ["ar"], enabledDurations: [20] }, { recipe: {} }, { ...definition, supportedLanguages: ["en"], supportedDurations: [8] });
    expect(view.enabledLanguages).toEqual(["en"]);
    expect(view.enabledDurations).toEqual([8]);
  });
});
