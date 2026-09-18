import { hasRealCreatorVideo } from "./creatorProjectOutput";
import type { CreatorProject, CreatorStep } from "./types";

export function stepForLoadedProject(project: CreatorProject): CreatorStep {
  if (hasRealCreatorVideo(project)) return "editor";
  if (project.renderRunId && ["generating", "review", "completed"].includes(project.status)) {
    return "generating";
  }
  return project.product.images.length || project.product.name.trim() ? "details" : "source";
}
