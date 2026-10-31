import {
  ProjectStatusSchema,
  RenderRunStatusSchema,
  draftProjectBucket,
  isRenderRunActive,
  renderRunBucket,
  type ProjectLibraryCounts,
  type ProjectLibraryFilter,
  type ProjectLibraryQuery,
} from "@movprompt/contracts";
import { COLLECTIONS, mongoDocumentFromStorage, mongoObjectIdString, toMongoObjectId, type MongoDatabase } from "@movprompt/db";
import type { Document } from "mongodb";

// The id-translating collection wrapper covers find and update but not
// aggregate or distinct, so this module uses the raw driver and storage form
// (`_id`, ObjectId references) throughout.

/** Business-funded candidates stay out of customer history until they are released. */
export const CUSTOMER_VISIBLE_RUNS: Document = {
  $or: [{ businessFundingId: { $exists: false } }, { businessCandidateReady: true }],
};

const OUTPUT_SAVED: Document = {
  outputBucket: { $type: "string", $ne: "" },
  outputObjectKey: { $type: "string", $ne: "" },
};

const OUTPUT_SAVED_EXPRESSION: Document = {
  $and: ["$outputBucket", "$outputObjectKey"].flatMap((field) => [
    { $eq: [{ $type: field }, "string"] },
    { $ne: [field, ""] },
  ]),
};

/** Mirrors the shape check in the web `projectFromCloud`: other versions never reach the page. */
const LISTABLE_VERSION: Document = {
  "configuration.creatorProject.product": { $type: "object" },
  "configuration.creatorProject.scenes": { $type: "array" },
};

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Query form of `renderRunBucket`, derived from it so the two cannot disagree. */
function runBucketFilter(filter: ProjectLibraryFilter): Document | null {
  if (filter === "all") return {};
  const clauses = RenderRunStatusSchema.options.flatMap((status) => [true, false].flatMap((outputAvailable) => (
    renderRunBucket({ status, outputAvailable }) === filter
      ? [{ status, ...(outputAvailable ? OUTPUT_SAVED : { $nor: [OUTPUT_SAVED] }) }]
      : []
  )));
  return clauses.length ? { $or: clauses } : null;
}

/** Query form of `draftProjectBucket`, over the pipeline's computed `hasGeneratedVideo`. */
function draftBucketFilter(filter: ProjectLibraryFilter): Document {
  if (filter === "all") return {};
  return {
    $or: ProjectStatusSchema.options.flatMap((status) => [true, false].flatMap((hasGeneratedVideo) => (
      draftProjectBucket({ status, hasGeneratedVideo }) === filter ? [{ status, hasGeneratedVideo }] : []
    ))),
  };
}

export type ProjectLibraryRowPage = {
  items: ({ kind: "run"; row: Document } | { kind: "draft"; projectId: string })[];
  total: number;
  counts: ProjectLibraryCounts;
  hasActive: boolean;
};

/**
 * One page of the customer's library: generated runs, newest first, then drafts,
 * most recently updated first. Drafts are projects with no customer-visible run.
 * Counts cover the whole library and deliberately ignore the search, as the
 * chips always have; `total` is what the current filter and search can page over.
 */
export async function listProjectLibraryPage(
  database: MongoDatabase,
  userId: string,
  query: ProjectLibraryQuery,
  runScope: Document,
): Promise<ProjectLibraryRowPage> {
  const owner = toMongoObjectId(userId);
  const projects = database.db.collection(COLLECTIONS.creatorProjects);
  const runs = database.db.collection(COLLECTIONS.renderRuns);
  const exportRows = database.db.collection(COLLECTIONS.exports);
  const skip = (query.page - 1) * query.limit;
  const titleMatch: Document = query.search ? { title: { $regex: escapeRegex(query.search), $options: "i" } } : {};

  const [trashedIds, titleMatchIds] = await Promise.all([
    projects.distinct("_id", { userId: owner, status: "trashed" }),
    query.search ? projects.distinct("_id", { userId: owner, deletedAt: null, ...titleMatch }) : null,
  ]);
  const ownedRuns: Document = { $and: [{ userId: owner, projectId: { $nin: trashedIds } }, runScope] };

  const [runTally, runProjectIds, savedRunProjectIds, exportedProjectIds] = await Promise.all([
    runs.aggregate<{ _id: { status: Parameters<typeof renderRunBucket>[0]["status"]; outputAvailable: boolean }; count: number }>([
      { $match: ownedRuns },
      { $group: { _id: { status: "$status", outputAvailable: OUTPUT_SAVED_EXPRESSION }, count: { $sum: 1 } } },
    ]).toArray(),
    runs.distinct("projectId", ownedRuns),
    // Same evidence as `hasGeneratedVideo` in listProjects, which also counts
    // runs hidden from customer history.
    runs.distinct("projectId", { userId: owner, $or: [{ status: "completed" }, { outputObjectKey: { $exists: true, $nin: [null, ""] } }] }),
    exportRows.distinct("projectId", { userId: owner }),
  ]);

  const counts: ProjectLibraryCounts = { all: 0, ready: 0, progress: 0, attention: 0, drafts: 0 };
  let hasActive = false;
  for (const { _id, count } of runTally) {
    counts[renderRunBucket(_id)] += count;
    counts.all += count;
    hasActive ||= isRenderRunActive(_id.status);
  }

  const runBucket = runBucketFilter(query.filter);
  const listedRuns: Document | null = runBucket && {
    $and: [ownedRuns, runBucket, ...(titleMatchIds ? [{ projectId: { $in: titleMatchIds } }] : [])],
  };
  const runTotal = !listedRuns
    ? 0
    : titleMatchIds ? await runs.countDocuments(listedRuns) : counts[query.filter];
  const runRows = listedRuns && skip < runTotal
    ? await runs.find(listedRuns).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(query.limit).toArray()
    : [];

  const draftSkip = Math.max(0, skip - runTotal);
  const draftSlots = query.limit - runRows.length;
  const listedDrafts: Document = { ...draftBucketFilter(query.filter), ...titleMatch };
  const runProjects = new Set(runProjectIds.map(String));
  const generatedIds = [...savedRunProjectIds, ...exportedProjectIds].filter((id) => !runProjects.has(String(id)));
  const [drafts] = await projects.aggregate<{
    tally: { _id: { status: string; hasGeneratedVideo: boolean }; count: number }[];
    matching: { total: number }[];
    page: { _id: unknown }[];
  }>([
    { $match: { userId: owner, deletedAt: null, _id: { $nin: runProjectIds } } },
    {
      $project: {
        title: 1,
        status: 1,
        updatedAt: 1,
        workingVersionId: { $ifNull: ["$currentWorkingVersionId", "$currentAcceptedVersionId"] },
        hasGeneratedVideo: {
          $or: [
            { $ne: [{ $ifNull: ["$currentAcceptedVersionId", null] }, null] },
            { $eq: ["$status", "completed"] },
            { $in: ["$_id", generatedIds] },
          ],
        },
      },
    },
    {
      $lookup: {
        from: COLLECTIONS.creatorProjectVersions,
        localField: "workingVersionId",
        foreignField: "_id",
        pipeline: [{ $match: { userId: owner, ...LISTABLE_VERSION } }, { $project: { _id: 1 } }],
        as: "listableVersion",
      },
    },
    { $match: { listableVersion: { $ne: [] } } },
    {
      $facet: {
        tally: [{ $group: { _id: { status: "$status", hasGeneratedVideo: "$hasGeneratedVideo" }, count: { $sum: 1 } } }],
        matching: [{ $match: listedDrafts }, { $count: "total" }],
        // $limit must be positive; a full page simply discards this row below.
        page: [{ $match: listedDrafts }, { $sort: { updatedAt: -1, _id: -1 } }, { $skip: draftSkip }, { $limit: Math.max(1, draftSlots) }, { $project: { _id: 1 } }],
      },
    },
  ]).toArray();

  for (const { _id, count } of drafts?.tally ?? []) {
    counts[draftProjectBucket(_id)] += count;
    counts.all += count;
  }

  return {
    items: [
      ...runRows.map((row) => ({ kind: "run" as const, row: mongoDocumentFromStorage(row) as Document })),
      ...(drafts?.page ?? []).slice(0, draftSlots).map((row) => ({ kind: "draft" as const, projectId: mongoObjectIdString(row._id) })),
    ],
    total: runTotal + (drafts?.matching[0]?.total ?? 0),
    counts,
    hasActive,
  };
}
