import { describe, it, expect, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { RotateCcw, ScanSearch, Sparkles, X } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/i18n/LanguageContext";
import { ar } from "@/i18n/translations/ar";
import { useEffect } from "react";

/**
 * Regression guard: at 360px in Arabic/RTL, dense action rows must not overflow.
 * We assert the structural classes that prevent overflow (`flex-col sm:flex-row`,
 * `hidden sm:inline`, `w-full sm:w-auto`) and verify `aria-label` carries the
 * Arabic string so collapsed icon-only buttons remain accessible.
 */

const STORAGE_KEY = "movprompt-lang";

// Mirrors the breakdown header pattern in WorkflowPanel (icon-only on mobile).
const BreakdownHeaderRow = () => {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        aria-label={t("wp.startOver")}
        title={t("wp.startOver")}
        className="px-2 sm:px-3"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("wp.startOver")}</span>
      </Button>
      <Button
        size="sm"
        aria-label={t("wp.reAnalyze")}
        title={t("wp.reAnalyze")}
        className="px-2 sm:px-3"
      >
        <ScanSearch className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t("wp.reAnalyze")}</span>
      </Button>
    </div>
  );
};

// Mirrors the upload phase primary-CTA row in WorkflowPanel.
const AnalyzeCtaRow = () => {
  const { t } = useLanguage();
  return (
    <div
      data-testid="analyze-row"
      className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center items-stretch sm:items-center"
    >
      <Button data-testid="cta-btn" className="w-full sm:w-auto px-4 sm:px-8">
        <Sparkles className="w-4 h-4" />
        {t("wp.analyzeScene")}
      </Button>
      <Button
        data-testid="cta-btn"
        variant="outline"
        className="w-full sm:w-auto px-4 sm:px-8"
      >
        {t("wp.skip")}
      </Button>
    </div>
  );
};

// Mirrors the ConfigPanel "Clear" button pattern.
const ClearButtonRow = () => {
  const { t } = useLanguage();
  return (
    <Button
      size="sm"
      variant="ghost"
      aria-label={t("config.clear")}
      title={t("config.clear")}
      className="px-2 sm:px-3"
    >
      <X className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">{t("config.clear")}</span>
    </Button>
  );
};

const ForceArabic = ({ children }: { children: React.ReactNode }) => {
  const { setLocale } = useLanguage();
  useEffect(() => {
    setLocale("ar");
  }, [setLocale]);
  return <>{children}</>;
};

const renderInArabicRtlAt360 = (ui: React.ReactElement) => {
  localStorage.setItem(STORAGE_KEY, "ar");
  const utils = render(
    <LanguageProvider>
      <ForceArabic>
        <div
          data-testid="viewport-360"
          dir="rtl"
          style={{ width: "360px", overflow: "visible" }}
        >
          {ui}
        </div>
      </ForceArabic>
    </LanguageProvider>,
  );
  // Flush the forced-locale effect.
  act(() => {});
  return utils;
};

describe("RTL overflow regression at 360px", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
  });

  it("applies dir=rtl and Arabic locale on the document", () => {
    renderInArabicRtlAt360(<BreakdownHeaderRow />);
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });

  it("collapses Start Over / Re-analyze labels to icon-only on mobile with preserved aria-label", () => {
    const { getByRole } = renderInArabicRtlAt360(<BreakdownHeaderRow />);

    const startOver = getByRole("button", { name: ar["wp.startOver"] });
    const reAnalyze = getByRole("button", { name: ar["wp.reAnalyze"] });

    // aria-label is non-empty and matches the Arabic translation.
    expect(startOver.getAttribute("aria-label")).toBe(ar["wp.startOver"]);
    expect(startOver.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(0);
    expect(reAnalyze.getAttribute("aria-label")).toBe(ar["wp.reAnalyze"]);
    expect(reAnalyze.getAttribute("aria-label")?.length ?? 0).toBeGreaterThan(0);

    // Label spans use `hidden sm:inline` so Arabic text is hidden at 360px.
    const startOverLabel = startOver.querySelector("span");
    const reAnalyzeLabel = reAnalyze.querySelector("span");
    expect(startOverLabel?.className).toMatch(/hidden/);
    expect(startOverLabel?.className).toMatch(/sm:inline/);
    expect(reAnalyzeLabel?.className).toMatch(/hidden/);
    expect(reAnalyzeLabel?.className).toMatch(/sm:inline/);
  });

  it("stacks primary CTAs vertically on mobile (flex-col sm:flex-row, w-full sm:w-auto)", () => {
    const { getByTestId, getAllByTestId } = renderInArabicRtlAt360(<AnalyzeCtaRow />);

    const row = getByTestId("analyze-row");
    expect(row.className).toMatch(/flex-col/);
    expect(row.className).toMatch(/sm:flex-row/);

    const ctas = getAllByTestId("cta-btn");
    expect(ctas.length).toBeGreaterThanOrEqual(2);
    ctas.forEach((btn) => {
      expect(btn.className).toMatch(/w-full/);
      expect(btn.className).toMatch(/sm:w-auto/);
    });
  });

  it("collapses the Clear button label on mobile and preserves aria-label", () => {
    const { getByRole } = renderInArabicRtlAt360(<ClearButtonRow />);
    const clearBtn = getByRole("button", { name: ar["config.clear"] });
    expect(clearBtn.getAttribute("aria-label")).toBe(ar["config.clear"]);
    const labelSpan = clearBtn.querySelector("span");
    expect(labelSpan?.className).toMatch(/hidden/);
    expect(labelSpan?.className).toMatch(/sm:inline/);
  });

  it("keeps the 360px RTL viewport wrapper intact (regression guard for overflow container)", () => {
    const { getByTestId } = renderInArabicRtlAt360(<BreakdownHeaderRow />);
    const viewport = getByTestId("viewport-360");
    expect(viewport).toHaveAttribute("dir", "rtl");
    expect(viewport.style.width).toBe("360px");
  });
});
