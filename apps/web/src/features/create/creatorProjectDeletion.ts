import type { PublicRenderRun } from "@movprompt/contracts";
import type { CreatorProject } from "./types";

export function canDeleteCreatorDraft(project: CreatorProject, runs: readonly PublicRenderRun[] = []): boolean {
  if (project.hasGeneratedVideo || project.videoUrl) return false;
  if (project.status === "completed") return false;
  return !runs.some(run => run.projectId === project.id && (
    run.outputAvailable || run.status === "completed"
  ));
}
