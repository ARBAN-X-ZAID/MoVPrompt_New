import { ObjectId, type Document } from "mongodb";
import { COLLECTIONS as C, type MongoDatabase } from "@movprompt/db";

export async function libraryAssetUsage(
  database: MongoDatabase,
  entryId: string,
  userId: ObjectId,
) {
  const versions = database.db.collection(C.creatorProjectVersions);
  const filter = {
    userId,
    $or: [
      {
        "configuration.creatorProject.product.images.librarySource.entryId":
          entryId,
      },
      { "productRecipe.images.librarySource.entryId": entryId },
    ],
  };
  const [rows, total] = await Promise.all([
    versions
      .find(filter, {
        projection: {
          projectId: 1,
          versionNumber: 1,
          "configuration.creatorProject.product.images.id": 1,
          "configuration.creatorProject.product.images.librarySource": 1,
          "productRecipe.images.librarySource": 1,
        },
        maxTimeMS: 10000,
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
    versions.countDocuments(filter, { maxTimeMS: 10000 }),
  ]);
  const projectIds = rows
    .map((row) => row.projectId)
    .filter((id) => id instanceof ObjectId);
  const [projects, runs] = await Promise.all([
    database.db
      .collection(C.creatorProjects)
      .find(
        { _id: { $in: projectIds }, userId },
        {
          projection: {
            title: 1,
            currentWorkingVersionId: 1,
            currentAcceptedVersionId: 1,
            deletedAt: 1,
          },
        },
      )
      .toArray(),
    database.db
      .collection(C.renderRuns)
      .find(
        {
          userId,
          projectVersionId: { $in: rows.map((row) => row._id) },
          status: { $in: ["submitting", "queued", "processing", "cancelling"] },
        },
        { projection: { projectVersionId: 1, status: 1 } },
      )
      .limit(200)
      .toArray(),
  ]);
  const byId = new Map(
    projects.map((project) => [String(project._id), project]),
  );
  return {
    total,
    truncated: total > rows.length,
    items: rows.map((row) => {
      const project = byId.get(String(row.projectId));
      const images: Document[] =
        row.configuration?.creatorProject?.product?.images ??
        row.productRecipe?.images ??
        [];
      const linked = images
        .filter((image) => image.librarySource?.entryId === entryId)
        .map((image) => image.librarySource);
      return {
        versionId: row._id,
        projectId: row.projectId,
        title: project?.title ?? null,
        versionNumber: row.versionNumber,
        working: String(project?.currentWorkingVersionId) === String(row._id),
        accepted: String(project?.currentAcceptedVersionId) === String(row._id),
        projectInTrash: Boolean(project?.deletedAt),
        linkedPhotos: linked.map((source) => ({
          photoId: source.photoId,
          revision: source.revision,
          kind: source.kind,
        })),
        activeRuns: runs
          .filter((run) => String(run.projectVersionId) === String(row._id))
          .map((run) => ({ runId: run._id, status: run.status })),
      };
    }),
  };
}
