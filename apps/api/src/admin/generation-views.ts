import type { Document, ObjectId } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import { AdminGenerationSummarySchema, type AdminGenerationQuery } from "@movprompt/contracts";
import { adminError, adminObjectId } from "./security.js";
import { ADMIN_SEARCH_ID_LIMIT, escapeSearchPattern, findCustomersBySearch } from "./customer-views.js";
import { createTtlCache } from "./ttl-cache.js";

const localized = (value: unknown, en: string, ar: string) => {
  const row = value && typeof value === "object" ? value as Document : {};
  return { en: typeof row.en === "string" ? row.en : en, ar: typeof row.ar === "string" ? row.ar : typeof row.en === "string" ? row.en : ar };
};
const iso = (value: unknown) => value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
const id = (value: unknown) => value && /^[a-f\d]{24}$/i.test(String(value)) ? String(value) : null;
const isTerminalRun = (status: unknown) => ["completed", "failed", "cancelled"].includes(String(status));
/** The stored run status as the owner sees it. */
export const publicRunStatus = (status: string) =>
  ["submitting", "queued"].includes(status) ? "queued" : isTerminalRun(status) ? status : "processing";
export function generationSummary(row: Document, now = new Date()) {
  const terminal = isTerminalRun(row.status);
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
    status: publicRunStatus(row.status),
    createdAt, finishedAt, elapsedSeconds,
    timing: elapsedSeconds === null ? "unavailable" : terminal ? "finished" : "elapsed",
    mediaAvailable: row.status === "completed" && !row.privacyErasedAt && Boolean(row.outputBucket && row.outputObjectKey),
    failure: row.status === "failed" ? localized(null, "This video could not be completed. Review the campaign before trying again.", "تعذر إكمال هذا الفيديو. راجع الحملة قبل المحاولة مجدداً.") : null,
  });
}

const TEMPLATE_OPTIONS_TTL_MS = 5 * 60 * 1000;
const NO_MATCH: Document = { _id: { $in: [] } };

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
  // Everything generationSummary and the joins read from a run, and nothing else.
  const summaryFields: Document = { userId: 1, projectId: 1, projectVersionId: 1, status: 1, createdAt: 1, completedAt: 1, finishedAt: 1, privacyErasedAt: 1, outputBucket: 1, outputObjectKey: 1 };

  // Run rows carry no template pointer, so the filter walks template versions to
  // project versions and matches runs on the indexed projectVersionId.
  async function templateRunFilter(templateId: string): Promise<Document> {
    const templateVersions = await db.collection(C.videoTemplateVersions)
      .find({ templateId: adminObjectId(templateId) }, { projection: { _id: 1 }, maxTimeMS: 10000 }).toArray();
    if (!templateVersions.length) return NO_MATCH;
    // Covered by { templateVersionId, _id }: stored configurations are never read.
    const projectVersions = await db.collection(C.creatorProjectVersions)
      .find({ templateVersionId: { $in: templateVersions.map(row => row._id) } }, { projection: { _id: 1 }, maxTimeMS: 10000 }).toArray();
    return projectVersions.length ? { projectVersionId: { $in: projectVersions.map(row => row._id) } } : NO_MATCH;
  }

  async function searchRunFilter(search: string, userId: ObjectId | undefined) {
    const [customers, projects] = await Promise.all([
      findCustomersBySearch(db, search, userId),
      db.collection(C.creatorProjects)
        .find({ ...(userId ? { userId } : {}), title: { $regex: escapeSearchPattern(search), $options: "i" } }, { projection: { _id: 1 }, maxTimeMS: 10000 })
        .sort({ createdAt: -1, _id: -1 }).limit(ADMIN_SEARCH_ID_LIMIT).toArray(),
    ]);
    const clauses: Document[] = [];
    if (customers.ids.length) clauses.push({ userId: { $in: customers.ids } });
    if (projects.length) clauses.push({ projectId: { $in: projects.map(row => row._id) } });
    return {
      filter: clauses.length ? { $or: clauses } : NO_MATCH,
      partial: customers.partial || projects.length === ADMIN_SEARCH_ID_LIMIT,
    };
  }

  // Template names change rarely and this list renders on every poll of the page.
  const templateOptions = createTtlCache<"all", Document[]>(TEMPLATE_OPTIONS_TTL_MS);
  const loadTemplateOptions = () => db.collection(C.videoTemplateVersions).aggregate([
    { $project: { templateId: 1, versionNumber: 1, localizedName: 1, "recipe.executableDefinition.localizedName": 1 } },
    { $sort: { versionNumber: -1 } },
    { $group: { _id: "$templateId", name: { $first: { $ifNull: ["$recipe.executableDefinition.localizedName", "$localizedName"] } } } },
    { $limit: 200 },
  ], { maxTimeMS: 10000 }).toArray();

  async function list(query: AdminGenerationQuery) {
    const match: Document = {};
    const userId = query.userId ? adminObjectId(query.userId) : undefined;
    if (userId) match.userId = userId;
    if (query.status) match.status = query.status === "queued" ? { $in: ["submitting", "queued"] } : query.status === "processing" ? { $in: ["processing", "cancelling"] } : query.status;
    const [templateFilter, searchFilter] = await Promise.all([
      query.templateId ? templateRunFilter(query.templateId) : {},
      query.search ? searchRunFilter(query.search, userId) : { filter: {}, partial: false },
    ]);
    const filter: Document = { ...match, ...templateFilter, ...searchFilter.filter };
    const collection = db.collection(C.renderRuns);
    const [rows, total, templates] = await Promise.all([
      collection.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1, _id: -1 } },
        { $skip: (query.page - 1) * query.limit },
        { $limit: query.limit },
        { $project: summaryFields },
        ...joins,
      ], { maxTimeMS: 10000 }).toArray(),
      Object.keys(filter).length ? collection.countDocuments(filter, { maxTimeMS: 10000 }) : collection.estimatedDocumentCount({ maxTimeMS: 10000 }),
      templateOptions("all", loadTemplateOptions),
    ]);
    return { items: rows.map(row => generationSummary(row)), total, page: query.page, limit: query.limit,
      ...(searchFilter.partial ? { totalCapped: true } : {}),
      templates: templates.filter(row => id(row._id)).map(row => ({ id: String(row._id), name: localized(row.name, "Template unavailable", "القالب غير متاح") })) };
  }
  async function detail(runId: string) {
    const [row] = await db.collection(C.renderRuns).aggregate([{ $match: { _id: adminObjectId(runId) } }, { $project: summaryFields }, ...joins], { maxTimeMS: 10000 }).toArray();
    if (!row) return adminError("generation_not_found", "Generation not found.", 404);
    return generationSummary(row);
  }
  return { list, detail };
}
