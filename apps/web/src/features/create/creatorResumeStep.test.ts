import { describe, expect, it } from "vitest";
import { createDraftProject } from "./templates";
import { stepForLoadedProject } from "./creatorResumeStep";

describe("creator resume step", () => {
  it("resumes a saved draft on the create screen", () => {
    const project = createDraftProject();
    project.product.name = "Saved manual product";

    expect(stepForLoadedProject(project)).toBe("create");
  });

  it("starts an empty draft on the create screen", () => {
    expect(stepForLoadedProject(createDraftProject())).toBe("create");
  });

  it("returns to the finished video when one exists", () => {
    const project = createDraftProject();
    project.status = "review";
    project.renderRunId = "66666666-6666-4666-8666-666666666666";
    project.videoUrl = "https://example.test/video.mp4";

    expect(stepForLoadedProject(project)).toBe("result");
  });
});
