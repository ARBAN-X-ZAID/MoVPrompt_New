import type { PublicRenderRun } from "@movprompt/contracts";
import { PortableApiError } from "@/lib/api/portableApiClient";

interface DeletionDependencies {
  trash: () => Promise<unknown>;
  listRuns: () => Promise<readonly Pick<PublicRenderRun, "id" | "projectId" | "status" | "outputAvailable">[]>;
  cancel: (runId: string, idempotencyKey: string) => Promise<unknown>;
  wait?: () => Promise<void>;
}

export class ProjectDeletionPendingError extends Error {
  constructor() {
    super("Generation is still stopping. Your project is preserved. Try Delete again once it stops.");
  }
}

function isActiveError(error: unknown) {
  return error instanceof PortableApiError && error.code === "project_generation_in_progress";
}

export async function trashUnfinishedProject(projectId: string, dependencies: DeletionDependencies, attempts = 30): Promise<void> {
  try {
    await dependencies.trash();
    return;
  } catch (error) {
    if (!isActiveError(error)) throw error;
  }
  const runs = await dependencies.listRuns();
  if (runs.some(run => run.projectId === projectId && (run.outputAvailable || run.status === "completed"))) {
    throw new PortableApiError("This project already has a generated video and cannot be deleted.", "project_has_generated_video", false);
  }
  const active = runs.filter(run => run.projectId === projectId && !["completed", "failed", "cancelled"].includes(run.status));
  for (const run of active) {
    if (run.status !== "cancelling") await dependencies.cancel(run.id, `delete-project:${projectId}:${run.id}`);
  }
  const wait = dependencies.wait ?? (() => new Promise<void>(resolve => window.setTimeout(resolve, 1000)));
  // The API checks ownership, saved outputs and active jobs again on every attempt.
  // A video completing during cancellation must remain protected, never silently discarded.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await dependencies.trash();
      return;
    } catch (error) {
      if (!isActiveError(error)) throw error;
      if (attempt + 1 < attempts) await wait();
    }
  }
  throw new ProjectDeletionPendingError();
}
