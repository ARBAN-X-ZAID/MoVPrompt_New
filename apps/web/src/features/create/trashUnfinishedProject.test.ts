import { describe, expect, it, vi } from "vitest";
import { PortableApiError } from "@/lib/api/portableApiClient";
import { trashUnfinishedProject } from "./trashUnfinishedProject";

const activeError = () => new PortableApiError("active", "project_generation_in_progress", false, undefined, 409);
function dependencies() {
  return {
    trash: vi.fn<() => Promise<unknown>>().mockResolvedValue({}),
    listRuns: vi.fn().mockResolvedValue([{ id: "run-test", projectId: "project-test", status: "processing", outputAvailable: false }]),
    cancel: vi.fn().mockResolvedValue({ status: "cancelling" }),
    wait: vi.fn().mockResolvedValue(undefined),
  };
}
describe("safe non-generated project deletion", () => {
  it("deletes an idle project without cancellation", async () => {
    const deps = dependencies(); await trashUnfinishedProject("project-test", deps);
    expect(deps.trash).toHaveBeenCalledTimes(1); expect(deps.cancel).not.toHaveBeenCalled();
  });
  it("waits for active generation cancellation before deletion", async () => {
    const deps = dependencies(); deps.trash.mockRejectedValueOnce(activeError()).mockRejectedValueOnce(activeError());
    await trashUnfinishedProject("project-test", deps);
    expect(deps.cancel).toHaveBeenCalledExactlyOnceWith("run-test", "delete-project:project-test:run-test");
    expect(deps.trash).toHaveBeenCalledTimes(3); expect(deps.wait).toHaveBeenCalledTimes(1);
  });
  it("keeps a project if a video completes during cancellation", async () => {
    const deps = dependencies(); deps.trash.mockRejectedValueOnce(activeError());
    deps.listRuns.mockResolvedValue([{ id: "run-test", projectId: "project-test", status: "completed", outputAvailable: true }]);
    await expect(trashUnfinishedProject("project-test", deps)).rejects.toThrow("generated");
    expect(deps.cancel).not.toHaveBeenCalled(); expect(deps.trash).toHaveBeenCalledTimes(1);
  });
  it("stops waiting with a clear retry message instead of staying stuck", async () => {
    const deps = dependencies(); deps.trash.mockRejectedValue(activeError());
    await expect(trashUnfinishedProject("project-test", deps, 2)).rejects.toThrow("Try Delete again");
    expect(deps.trash).toHaveBeenCalledTimes(3);
  });
  it("preserves failures without cancelling unrelated media", async () => {
    const deps = dependencies(); deps.trash.mockRejectedValue(new Error("offline"));
    await expect(trashUnfinishedProject("project-test", deps)).rejects.toThrow("offline");
    expect(deps.cancel).not.toHaveBeenCalled();
  });
});
