import { describe, expect, it } from "vitest";
import { createDraftProject } from "./templates";
import { stepForLoadedProject } from "./creatorResumeStep";

describe("creator resume step", () => {
  it("resumes a saved manual product after source entry even without an image", () => {
    const project = createDraftProject();
    project.product.name = "Saved manual product";

    expect(stepForLoadedProject(project)).toBe("details");
  });

  it("starts an empty draft at source entry", () => {
    expect(stepForLoadedProject(createDraftProject())).toBe("source");
  });
});
