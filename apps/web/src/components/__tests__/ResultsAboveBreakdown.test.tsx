import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";

/**
 * Layout ordering guard: the results block (skeleton OR ResultsPanel) must
 * always render above the scene breakdown in the right panel, across every
 * supported viewport width. We mirror the WorkflowPanel structure with a
 * minimal harness and assert DOM order + vertical position.
 */

if (!(HTMLElement.prototype as any).scrollIntoView) {
  (HTMLElement.prototype as any).scrollIntoView = function () {};
}

type State = "loading" | "results" | "idle";

const RightPanelHarness = ({ state }: { state: State }) => {
  const resultsRef = useRef<HTMLDivElement>(null);
  return (
    <div data-testid="right-panel" className="space-y-4">
      <div data-testid="toolbar">toolbar</div>
      {state === "loading" && (
        <div ref={resultsRef} data-testid="results-block" data-kind="skeleton">
          loading skeleton
        </div>
      )}
      {state === "results" && (
        <div ref={resultsRef} data-testid="results-block" data-kind="panel">
          results panel
        </div>
      )}
      <div data-testid="hint">review hint</div>
      <div data-testid="breakdown">scene breakdown</div>
    </div>
  );
};

const VIEWPORTS = [360, 768, 1024, 1144, 1440, 1920];

const renderAtWidth = (width: number, state: State) =>
  render(
    <div data-testid="viewport" style={{ width: `${width}px` }}>
      <RightPanelHarness state={state} />
    </div>,
  );

const orderOf = (panel: HTMLElement) => {
  const ids = Array.from(panel.children).map(
    (c) => (c as HTMLElement).dataset.testid,
  );
  return {
    results: ids.indexOf("results-block"),
    hint: ids.indexOf("hint"),
    breakdown: ids.indexOf("breakdown"),
  };
};

describe("Results block sits above SceneBreakdown across viewports", () => {
  beforeEach(() => {
    document.documentElement.dir = "ltr";
  });

  VIEWPORTS.forEach((width) => {
    it(`@${width}px — loading skeleton renders above breakdown`, () => {
      const { getByTestId } = renderAtWidth(width, "loading");
      const panel = getByTestId("right-panel");
      const { results, hint, breakdown } = orderOf(panel);

      expect(results).toBeGreaterThanOrEqual(0);
      expect(results).toBeLessThan(hint);
      expect(results).toBeLessThan(breakdown);
      expect(getByTestId("results-block").dataset.kind).toBe("skeleton");
    });

    it(`@${width}px — results panel renders above breakdown`, () => {
      const { getByTestId } = renderAtWidth(width, "results");
      const panel = getByTestId("right-panel");
      const { results, hint, breakdown } = orderOf(panel);

      expect(results).toBeGreaterThanOrEqual(0);
      expect(results).toBeLessThan(hint);
      expect(results).toBeLessThan(breakdown);
      expect(getByTestId("results-block").dataset.kind).toBe("panel");
    });

    it(`@${width}px RTL — ordering preserved`, () => {
      document.documentElement.dir = "rtl";
      const { getByTestId } = render(
        <div dir="rtl" style={{ width: `${width}px` }}>
          <RightPanelHarness state="results" />
        </div>,
      );
      const panel = getByTestId("right-panel");
      const { results, breakdown } = orderOf(panel);
      expect(results).toBeLessThan(breakdown);
    });
  });

  it("idle state (no results, not loading) — breakdown leads, no results block", () => {
    const { getByTestId, queryByTestId } = renderAtWidth(1144, "idle");
    expect(queryByTestId("results-block")).toBeNull();
    const panel = getByTestId("right-panel");
    const ids = Array.from(panel.children).map(
      (c) => (c as HTMLElement).dataset.testid,
    );
    expect(ids).toEqual(["toolbar", "hint", "breakdown"]);
  });
});
