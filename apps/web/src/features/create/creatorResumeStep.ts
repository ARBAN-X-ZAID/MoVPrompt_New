import { hasRealCreatorVideo } from "./creatorProjectOutput";
import type { CreatorProject, CreatorStep } from "./types";

export function stepForLoadedProject(project: CreatorProject): CreatorStep {
  if (hasRealCreatorVideo(project)) return "result";
  if (project.renderRunId && ["generating", "review", "completed"].includes(project.status)) {
    return "generating";
  }
  return "create";
}
