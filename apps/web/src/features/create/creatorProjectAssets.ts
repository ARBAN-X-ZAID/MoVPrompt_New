import { mirrorProductImages } from "./creatorAssets";
import { replaceCreatorProjectSource, syncCreatorProject } from "./projectStore";
import { campaignSourceForProject } from "./sourceFacts";
import type { CreatorProject } from "./types";

export function hasUnclaimedCreatorAssets(project: CreatorProject): boolean {
  return project.product.images.some((image) =>
    !image.storagePath && Boolean(image.assetKey || image.source === "sample" || image.source === "url"),
  );
}

export function mergeClaimedCreatorProject(
  localProject: CreatorProject,
  cloudProject: CreatorProject,
  images: CreatorProject["product"]["images"],
): CreatorProject {
  const claimedSourceAssetKeys = images.flatMap((image) => image.storagePath ? [image.storagePath] : []);
  return {
    ...localProject,
    id: cloudProject.id,
    versionId: cloudProject.versionId,
    versionNumber: cloudProject.versionNumber,
    createdAt: cloudProject.createdAt,
    product: { ...localProject.product, images },
    source: { ...campaignSourceForProject(localProject), assetKeys: claimedSourceAssetKeys },
  };
}

/**
 * Guest link claims create an initial redacted version before their public
 * image URLs are mirrored. The follow-up source version is required before
 * guest IndexedDB can be removed: it is the durable proof of the stable keys.
 */
export async function persistGuestClaimedCreatorProject(
  project: CreatorProject,
  userId: string,
): Promise<CreatorProject> {
  const hasUnownedRemoteImages = project.product.images.some(
    (image) => image.source === "url" && !image.storagePath,
  );
  if (!hasUnownedRemoteImages) return syncCreatorProject(project, userId);

  let images: CreatorProject["product"]["images"];
  try {
    images = await mirrorProductImages(project.id, project.product.images);
  } catch (error) {
    throw new Error("MovPrompt could not secure the imported images yet. Your campaign is still saved here.", { cause: error });
  }
  if (images.some((image) => image.source === "url" && !image.storagePath)) {
    throw new Error("MovPrompt could not verify the imported images. Your campaign is still saved here.");
  }

  const persisted = await replaceCreatorProjectSource(
    { ...project, product: { ...project.product, images } },
    userId,
  );
  if (!persisted.versionId || persisted.product.images.some((image) => image.source === "url" && !image.storagePath)) {
    throw new Error("MovPrompt could not verify the imported images. Your campaign is still saved here.");
  }
  return persisted;
}

/**
 * Persists an authenticated project without ever placing remote image URLs in
 * the cloud recipe, then mirrors those images into the project's private
 * object-storage namespace and saves the resulting stable object keys.
 *
 * Guest drafts intentionally do not use this path. Their remote URLs remain
 * in IndexedDB until the authenticated claim flow runs.
 */
export async function syncCreatorProjectWithOwnedRemoteImages(
  project: CreatorProject,
  userId: string,
): Promise<CreatorProject> {
  const cloudProject = await syncCreatorProject(project, userId);
  const hasUnownedRemoteImages = project.product.images.some(
    (image) => image.source === "url" && !image.storagePath,
  );
  if (!hasUnownedRemoteImages) return cloudProject;

  const images = await mirrorProductImages(cloudProject.id, project.product.images);
  return replaceCreatorProjectSource(
    {
      ...project,
      id: cloudProject.id,
      versionId: cloudProject.versionId,
      versionNumber: cloudProject.versionNumber,
      createdAt: cloudProject.createdAt,
      product: { ...project.product, images },
    },
    userId,
  );
}
