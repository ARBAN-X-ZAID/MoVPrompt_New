import { hasUnclaimedCreatorAssets } from "./creatorProjectAssets";
import type { CreatorProject } from "./types";

/** Gives signed-in browser-only media the same resumable claim identity used after auth handoff. */
export function prepareAuthenticatedAssetClaim(
  project: CreatorProject,
  createIntent: () => string = () => crypto.randomUUID(),
): CreatorProject {
  if (project.pendingGenerationId || !hasUnclaimedCreatorAssets(project)) return project;
  return {
    ...project,
    pendingGenerationId: createIntent(),
    updatedAt: new Date().toISOString(),
  };
}
