import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CreatorProgress } from "./CreatorProgress";
import type { CreatorStep } from "./types";

const englishSteps: Array<{ id: CreatorStep; label: string }> = [
  { id: "source", label: "Source" },
  { id: "template", label: "Template" },
  { id: "details", label: "Campaign" },
  { id: "generating", label: "Create" },
  { id: "editor", label: "Review" },
];

describe("CreatorProgress", () => {
  it("keeps desktop progress semantics and gives mobile users a complete English current-step summary", () => {
    render(<CreatorProgress current="source" steps={englishSteps} label="Step" arabic={false} />);

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "1");
    expect(progress).toHaveAttribute("aria-valuetext", "Source (1 / 5)");
    expect(screen.getByText("Step 1 of 5: Source")).toBeInTheDocument();
    expect(screen.getByText("Source").closest("div")).toHaveAttribute("aria-current", "step");
  });

  it("renders the complete Arabic current-step summary while retaining semantic progress values", () => {
    const arabicSteps = englishSteps.map((step, index) => ({
      ...step,
      label: ["المصدر", "القالب", "الحملة", "الإنشاء", "المراجعة"][index]!,
    }));
    render(<CreatorProgress current="source" steps={arabicSteps} label="الخطوة" arabic />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText("الخطوة 1 من 5: المصدر")).toBeInTheDocument();
  });
});
