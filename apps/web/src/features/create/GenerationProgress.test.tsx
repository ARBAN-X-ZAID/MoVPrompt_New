import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenerationProgress } from "./GenerationProgress";

const start = Date.parse("2026-09-15T12:00:00Z");
afterEach(() => { cleanup(); vi.useRealTimers(); });
function show(props = {}) {
  vi.useFakeTimers(); vi.setSystemTime(start + 120_000);
  return render(<GenerationProgress stage="rendering" startedAt={start} lastCheckedAt={start + 119_000} {...props} />);
}
describe("generation progress", () => {
  it("shows linear estimated progress, elapsed time and remaining estimate", () => {
    show();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "44");
    expect(screen.getByText("Estimated progress")).toBeVisible();
    expect(screen.getByText("02:00")).toBeVisible();
    expect(screen.getByText("Up to 3 min remaining")).toBeVisible();
    expect(screen.getByText("Creating your video")).toBeVisible();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText("02:01")).toBeVisible();
  });
  it("never reaches 100% on a timer and explains delays", () => {
    show(); act(() => { vi.advanceTimersByTime(900_000); });
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"))).toBeLessThan(100);
    expect(screen.getByText(/Taking longer than usual/)).toBeVisible();
    expect(screen.queryByText("0 min remaining")).toBeNull();
  });
  it("shows ready only after the server reports ready", () => {
    show({ stage: "ready", completedAt: start + 121_000 });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("02:01")).toBeVisible();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.getByText("02:01")).toBeVisible();
  });
  it("freezes estimated progress when status cannot be checked and offers retry", () => {
    const retry = vi.fn(); const view = show();
    const previous = screen.getByRole("progressbar").getAttribute("aria-valuenow");
    view.rerender(<GenerationProgress stage="rendering" startedAt={start} error="Connection unavailable. Your project is saved." onRetry={retry} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", previous);
    expect(screen.getByRole("alert")).toHaveTextContent("Connection unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Retry status check" })); expect(retry).toHaveBeenCalledOnce();
  });
  it("displays a terminal failure without suggesting work is complete", () => {
    show({ stage: "failed", error: "Video creation failed. Your project is saved." });
    expect(screen.getByRole("alert")).toHaveTextContent("Video creation failed");
    expect(screen.queryByRole("button", { name: "Retry status check" })).toBeNull();
    expect(screen.queryByText(/remaining/)).toBeNull();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow", "100");
  });
  it("keeps Arabic labels and direction accessible", () => {
    const { container } = show({ arabic: true });
    expect(screen.getByRole("progressbar")).toHaveAccessibleName("تقدم إنشاء الفيديو التقديري");
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
    expect(screen.getByText("الوقت المنقضي")).toBeVisible();
  });
});
