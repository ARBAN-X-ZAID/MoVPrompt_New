import type { Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import { AdminGenerationSummarySchema, type AdminGenerationQuery } from "@movprompt/contracts";
import { adminError, adminObjectId } from "./security.js";

const localized = (value: unknown, en: string, ar: string) => {
  const row = value && typeof value === "object" ? value as Document : {};
  return { en: typeof row.en === "string" ? row.en : en, ar: typeof row.ar === "string" ? row.ar : typeof row.en === "string" ? row.en : ar };
};
const iso = (value: unknown) => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
const id = (value: unknown) => value && /^[a-f\d]{24}$/i.test(String(value)) ? String(value) : null;
export function generationSummary(row: Document, now = new Date()) {
  const terminal = ["completed", "failed", "cancelled"].includes(row.status);
  const createdAt = iso(row.createdAt);
  const finishedAt = terminal ? iso(row.completedAt ?? row.finishedAt) : null;
  const end = terminal ? finishedAt : now.toISOString();
  const seconds = createdAt && end ? (Date.parse(end) - Date.parse(createdAt)) / 1000 : null;
  const elapsedSeconds = seconds !== null && seconds >= 0 ? Math.floor(seconds) : null;
  const templateName = row.template?.recipe?.executableDefinition?.localizedName ?? row.template?.localizedName;
  return AdminGenerationSummarySchema.parse({
    id: String(row._id),
    campaign: { id: id(row.project?._id), name: row.project?.title || "" },
    customer: { id: id(row.customer?._id), name: row.customer?.name || "", email: row.customer?.email || "" },
    template: { id: id(row.template?.templateId), name: localized(templateName, "Template unavailable", "القالب غير متاح") },
    status: ["submitting", "queued"].includes(row.status) ? "queued" : terminal ? row.status : "processing",
    createdAt, finishedAt, elapsedSeconds,
    timing: elapsedSeconds === null ? "unavailable" : terminal ? "finished" : "elapsed",
    mediaAvailable: row.status === "completed" && !row.privacyErasedAt && Boolean(row.outputBucket && row.outputObjectKey),
    failure: row.status === "failed" ? localized(null, "This video could not be completed. Review the campaign before trying again.", "تعذر إكمال هذا الفيديو. راجع الحملة قبل المحاولة مجدداً.") : null,
  });
}

export function createGenerationViews(database: MongoDatabase) {
  const db = database.db;
  const joins: Document[] = [
    { $lookup: { from: "users", localField: "userId", foreignField: "_id", pipeline: [{ $project: { name: 1, email: 1 } }], as: "customer" } },
    { $lookup: { from: C.creatorProjects, localField: "projectId", foreignField: "_id", pipeline: [{ $project: { title: 1 } }], as: "project" } },
    { $lookup: { from: C.creatorProjectVersions, localField: "projectVersionId", foreignField: "_id", pipeline: [{ $project: { templateVersionId: 1 } }], as: "version" } },
    { $set: { customer: { $first: "$customer" }, project: { $first: "$project" }, version: { $first: "$version" } } },
    { $lookup: { from: C.videoTemplateVersions, localField: "version.templateVersionId", foreignField: "_id", pipeline: [{ $project: { templateId: 1, localizedName: 1, "recipe.executableDefinition.localizedName": 1 } }], as: "template" } },
    { $set: { template: { $first: "$template" } } },
  ];
  async function list(query: AdminGenerationQuery) {
    const match: Document = {};
    if (query.userId) match.userId = adminObjectId(query.userId);
    if (query.status) match.status = query.status === "queued" ? { $in: ["submitting", "queued"] } : query.status === "processing" ? { $in: ["processing", "cancelling"] } : query.status;
    const after: Document = {};
    if (query.templateId) after["template.templateId"] = adminObjectId(query.templateId);
    if (query.search) {
      const search = { $regex: query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      after.$or = [{ "customer.name": search }, { "customer.email": search }, { "project.title": search }];
    }
    const [result] = await db.collection(C.renderRuns).aggregate([
      { $match: match }, ...joins, { $match: after },
      { $facet: {
        items: [{ $sort: { createdAt: -1, _id: -1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }],
        count: [{ $count: "total" }],
      } },
    ], { maxTimeMS: 10000 }).toArray();
    const templates = await db.collection(C.videoTemplateVersions).aggregate([
      { $sort: { versionNumber: -1 } },
      { $group: { _id: "$templateId", name: { $first: { $ifNull: ["$recipe.executableDefinition.localizedName", "$localizedName"] } } } },
      { $limit: 200 },
    ], { maxTimeMS: 10000 }).toArray();
    return { items: (result?.items ?? []).map((row: Document) => generationSummary(row)), total: result?.count[0]?.total ?? 0, page: query.page, limit: query.limit,
      templates: templates.filter(row => id(row._id)).map(row => ({ id: String(row._id), name: localized(row.name, "Template unavailable", "القالب غير متاح") })) };
  }
  async function detail(runId: string) {
    const [row] = await db.collection(C.renderRuns).aggregate([{ $match: { _id: adminObjectId(runId) } }, ...joins], { maxTimeMS: 10000 }).toArray();
    if (!row) return adminError("generation_not_found", "Generation not found.", 404);
    return generationSummary(row);
  }
  return { list, detail };
}
