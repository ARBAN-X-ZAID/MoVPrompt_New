import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useEffect, useRef, useState } from "react";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";

/**
 * RTL guard for the right-panel results ordering and smooth-scroll behavior.
 *
 * We mirror the pattern used in WorkflowPanel:
 *  - resultsBlock renders ABOVE SceneBreakdown
 *  - scrollIntoView fires once per new results object (tracked via a ref),
 *    not on every re-render of the parent.
 */

const STORAGE_KEY = "movprompt-lang";

const ForceArabic = ({ children }: { children: React.ReactNode }) => {
  const { setLocale } = useLanguage();
  useEffect(() => {
    setLocale("ar");
  }, [setLocale]);
  return <>{children}</>;
};

type Results = { id: string } | null;

const RightPanelHarness = ({
  results,
  bump,
}: {
  results: Results;
  bump: number;
}) => {
  const resultsRef = useRef<HTMLDivElement>(null);
  const scrolledKeyRef = useRef<unknown>(null);

  useEffect(() => {
    if (!results) {
      scrolledKeyRef.current = null;
      return;
    }
    if (scrolledKeyRef.current === results) return;
    if (!resultsRef.current) return;
    scrolledKeyRef.current = results;
    resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [results]);

  return (
    <div data-testid="right-panel" className="space-y-4">
      <div data-testid="toolbar">toolbar bump:{bump}</div>
      {results && (
        <div ref={resultsRef} data-testid="results-block">
          results:{results.id}
        </div>
      )}
      <div data-testid="breakdown">scene breakdown</div>
    </div>
  );
};

const renderInArabicRtl = (ui: React.ReactElement) => {
  localStorage.setItem(STORAGE_KEY, "ar");
  const utils = render(
    <LanguageProvider>
      <ForceArabic>
        <div dir="rtl" style={{ width: "1144px" }}>
          {ui}
        </div>
      </ForceArabic>
    </LanguageProvider>,
  );
  act(() => {});
  return utils;
};

// jsdom doesn't implement scrollIntoView; install a no-op so the effect runs.
if (!(HTMLElement.prototype as any).scrollIntoView) {
  (HTMLElement.prototype as any).scrollIntoView = function () {};
}

describe("RTL right-panel results ordering and scroll guard", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  });

  it("places resultsBlock above SceneBreakdown in DOM order under RTL", () => {
    const { getByTestId } = renderInArabicRtl(
      <RightPanelHarness results={{ id: "r1" }} bump={0} />,
    );

    expect(document.documentElement.dir).toBe("rtl");

    const panel = getByTestId("right-panel");
    const children = Array.from(panel.children) as HTMLElement[];
    const resultsIdx = children.findIndex((c) => c.dataset.testid === "results-block");
    const breakdownIdx = children.findIndex((c) => c.dataset.testid === "breakdown");

    expect(resultsIdx).toBeGreaterThanOrEqual(0);
    expect(breakdownIdx).toBeGreaterThanOrEqual(0);
    expect(resultsIdx).toBeLessThan(breakdownIdx);
  });

  it("calls scrollIntoView exactly once when results first appear and skips unrelated re-renders", () => {
    const scrollSpy = vi
      .spyOn(HTMLElement.prototype, "scrollIntoView")
      .mockImplementation(() => {});

    const Wrapper = () => {
      const [results, setResults] = useState<Results>(null);
      const [bump, setBump] = useState(0);
      return (
        <>
          <button data-testid="set-results" onClick={() => setResults({ id: "r1" })}>
            set
          </button>
          <button data-testid="bump" onClick={() => setBump((b) => b + 1)}>
            bump
          </button>
          <RightPanelHarness results={results} bump={bump} />
        </>
      );
    };

    const { getByTestId } = renderInArabicRtl(<Wrapper />);

    expect(scrollSpy).not.toHaveBeenCalled();

    act(() => {
      getByTestId("set-results").click();
    });
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    // Unrelated re-renders must NOT re-trigger scrollIntoView.
    act(() => {
      getByTestId("bump").click();
    });
    act(() => {
      getByTestId("bump").click();
    });
    expect(scrollSpy).toHaveBeenCalledTimes(1);

    scrollSpy.mockRestore();
  });
});
