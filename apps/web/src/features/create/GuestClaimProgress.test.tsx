import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GuestClaimProgress } from "./GuestClaimProgress";

describe("GuestClaimProgress", () => {
  it("announces one factual stage with a named cancel action and no invented render progress", () => {
    render(
      <GuestClaimProgress
        progress={{ stage: "asset", localAssetId: "asset-1", current: 2, total: 3 }}
        copy={{
          heading: "Securing your campaign…",
          detail: "Saving your campaign and images privately. Keep this page open.",
          creating: "Creating your private campaign",
          asset: (current, total) => `Securing image ${current} of ${total}`,
          verifying: "Checking saved campaign details",
          cancel: "Cancel and keep editing",
        }}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.getByRole("status")).toHaveTextContent("Securing image 2 of 3");
    expect(screen.getByRole("button", { name: "Cancel and keep editing" })).toBeVisible();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/minutes|seedance|provider|%/i)).not.toBeInTheDocument();
  });
});
