import { ObjectId, type Db, type Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";
import { AdminCampaignDetailSchema } from "@movprompt/contracts";
import { addAdminRecordLabels } from "./record-labels.js";
import { adminError, adminObjectId, writeAdminAudit, type AdminActor } from "./security.js";
import { publicRunStatus } from "./generation-views.js";

const objectIds = (values: unknown[]) => [...new Map(
  values.filter((value): value is ObjectId => value instanceof ObjectId).map(value => [String(value), value]),
).values()];
const iso = (value: unknown) => value instanceof Date ? value.toISOString() : null;
const text = (value: unknown) => typeof value === "string" ? value : "";
const localizedName = (row: Document | undefined) => {
  const name = row?.recipe?.executableDefinition?.localizedName ?? row?.localizedName;
  return name && typeof name.en === "string" ? { en: name.en, ar: typeof name.ar === "string" ? name.ar : name.en } : null;
};

async function templateNamesByProjectVersion(db: Db, versionIds: ObjectId[]) {
  const versions = versionIds.length
    ? await db.collection(C.creatorProjectVersions).find({ _id: { $in: versionIds } }, { projection: { templateVersionId: 1 } }).toArray()
    : [];
  const templateVersionIds = objectIds(versions.map(row => row.templateVersionId));
  const templates = templateVersionIds.length
    ? await db.collection(C.videoTemplateVersions).find({ _id: { $in: templateVersionIds } }, { projection: { localizedName: 1, "recipe.executableDefinition.localizedName": 1 } }).toArray()
    : [];
  const names = new Map(templates.map(row => [String(row._id), localizedName(row)]));
  return new Map(versions.map(row => [String(row._id), names.get(String(row.templateVersionId)) ?? null]));
}

/**
 * Adds link and label fields to one page of campaigns with a fixed number of
 * batched reads. acceptedRunId is only needed by the customer campaigns tab.
 */
export async function addCampaignListFields(db: Db, rows: Document[], withAcceptedRun: boolean) {
  if (!rows.length) return;
  const runs = db.collection(C.renderRuns);
  const acceptedVersionIds = withAcceptedRun ? objectIds(rows.map(row => row.currentAcceptedVersionId)) : [];
  const [latest, accepted, templateNames] = await Promise.all([
    runs.aggregate([
      { $match: { projectId: { $in: rows.map(row => row._id) } } },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: { _id: "$projectId", runId: { $first: "$_id" } } },
    ], { maxTimeMS: 10000 }).toArray(),
    acceptedVersionIds.length ? runs.aggregate([
      { $match: { projectVersionId: { $in: acceptedVersionIds }, projectId: { $in: rows.map(row => row._id) }, status: "completed" } },
      { $sort: { completedAt: -1, _id: -1 } },
      { $group: { _id: { projectId: "$projectId", versionId: "$projectVersionId" }, runId: { $first: "$_id" } } },
    ], { maxTimeMS: 10000 }).toArray() : [],
    templateNamesByProjectVersion(db, objectIds(rows.map(row => row.currentWorkingVersionId))),
  ]);
  const latestRuns = new Map(latest.map(row => [String(row._id), row.runId]));
  const acceptedRuns = new Map(accepted.map(row => [`${row._id.projectId}:${row._id.versionId}`, row.runId]));
  for (const row of rows) {
    const latestRunId = latestRuns.get(String(row._id));
    if (latestRunId) row.latestRunId = latestRunId;
    const acceptedRunId = acceptedRuns.get(`${row._id}:${row.currentAcceptedVersionId}`);
    if (acceptedRunId) row.acceptedRunId = acceptedRunId;
    const templateName = templateNames.get(String(row.currentWorkingVersionId));
    if (templateName) row.templateName = templateName;
  }
}

/**
 * The owner's view of one campaign. Prompts, the creative brief, version ids and
 * checksums stay on the server: the raw configuration never crosses this boundary.
 */
export async function campaignDetail(database: MongoDatabase, id: string, actor: AdminActor) {
  const db = database.db;
  const projectId = adminObjectId(id);
  const project = await db.collection(C.creatorProjects).findOne(
    { _id: projectId },
    { projection: { userId: 1, title: 1, status: 1, currentWorkingVersionId: 1, currentAcceptedVersionId: 1, createdAt: 1, updatedAt: 1 } },
  );
  if (!project) return adminError("admin_record_not_found", "This record was not found.", 404);
  const owner = { projectId, userId: project.userId };
  const versionId = project.currentWorkingVersionId ?? project.currentAcceptedVersionId;
  const [version, summary, accepted, media, templateNames] = await Promise.all([
    versionId ? db.collection(C.creatorProjectVersions).findOne(
      { _id: versionId, ...owner },
      { projection: { "configuration.creatorProject.durationSeconds": 1, "configuration.creatorProject.language": 1, "configuration.generation.durationSeconds": 1, "configuration.generation.language": 1 } },
    ) : null,
    db.collection(C.renderRuns).aggregate([
      { $match: owner },
      { $sort: { createdAt: -1, _id: -1 } },
      { $group: {
        _id: null,
        latestRunId: { $first: "$_id" },
        status: { $first: "$status" },
        creditsUsed: { $sum: { $cond: [{ $eq: ["$refundStatus", "refunded"] }, 0, { $ifNull: ["$chargedCredits", 0] }] } },
      } },
    ], { maxTimeMS: 10000 }).toArray(),
    project.currentAcceptedVersionId ? db.collection(C.renderRuns).findOne(
      { ...owner, projectVersionId: project.currentAcceptedVersionId, status: "completed" },
      { projection: { _id: 1 }, sort: { completedAt: -1 } },
    ) : null,
    db.collection(C.creatorProjectAssets)
      .find({ ...owner, deletedAt: null }, { projection: { kind: 1, mimeType: 1, originalFilename: 1 } })
      .limit(100).toArray(),
    templateNamesByProjectVersion(db, objectIds([versionId])),
  ]);
  const labels: Document = { userId: project.userId };
  await addAdminRecordLabels(db, [labels]);
  const configuration = version?.configuration;
  const creator = configuration?.creatorProject;
  const generation = configuration?.generation;
  const durationSeconds = creator?.durationSeconds ?? generation?.durationSeconds;
  const language = creator?.language ?? generation?.language;
  const latest = summary[0];
  const customer = { id: project.userId ? String(project.userId) : null, name: text(labels.customerName), email: text(labels.customerEmail) };
  const view = AdminCampaignDetailSchema.parse({
    record: {
      id,
      title: text(project.title),
      status: text(project.status),
      userId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customer,
      templateName: templateNames.get(String(versionId)) ?? null,
      durationSeconds: typeof durationSeconds === "number" ? durationSeconds : null,
      language: typeof language === "string" ? language : null,
      createdAt: iso(project.createdAt),
      updatedAt: iso(project.updatedAt),
      generation: {
        latestRunId: latest ? String(latest.latestRunId) : null,
        acceptedRunId: accepted ? String(accepted._id) : null,
        status: latest ? publicRunStatus(latest.status) : null,
        creditsUsed: Number(latest?.creditsUsed ?? 0),
      },
    },
    related: {
      media: media.map(row => ({ id: String(row._id), filename: text(row.originalFilename), kind: text(row.kind), mimeType: text(row.mimeType) })),
    },
  });
  await writeAdminAudit(database, actor, "campaign.inspect", id, {});
  return view;
}
