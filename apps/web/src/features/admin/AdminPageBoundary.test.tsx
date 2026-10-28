import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { AdminPageBoundary } from "./AdminPageBoundary";
it("keeps a readable recovery state and resets when navigation changes", () => {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  const expectedFailure = (event: ErrorEvent) => {
    if (event.error?.message === "Synthetic render failure")
      event.preventDefault();
  };
  window.addEventListener("error", expectedFailure);
  function Broken(): never {
    throw new Error("Synthetic render failure");
  }
  try {
    const view = render(
      <AdminPageBoundary key="broken" ar={false}>
        <Broken />
      </AdminPageBoundary>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "This section could not be displayed",
    );
    expect(
      screen.getByRole("button", { name: "Reload section" }),
    ).toBeEnabled();
    view.rerender(
      <AdminPageBoundary key="another-section" ar={false}>
        <p>New section remains available</p>
      </AdminPageBoundary>,
    );
    expect(screen.getByText("New section remains available")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
  } finally {
    window.removeEventListener("error", expectedFailure);
    consoleError.mockRestore();
  }
});
