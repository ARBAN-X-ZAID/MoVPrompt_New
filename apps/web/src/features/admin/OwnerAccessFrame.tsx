import type { ReactNode } from "react";
import { ArrowLeft, LockKeyhole, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageContext";
import "./owner-access.css";

export function OwnerAccessFrame({
  children,
  compact = false,
  loading = false,
}: {
  children: ReactNode;
  compact?: boolean;
  loading?: boolean;
}) {
  const { locale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const ar = locale === "ar";
  return (
    <div
      className={`owner-access${compact ? " owner-access--compact" : ""}`}
      dir={ar ? "rtl" : "ltr"}
    >
      {!compact && (
        <header className="owner-access-header">
          <Link to="/templates" className="owner-access-brand">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            <span>MovPrompt</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11"
              onClick={toggleTheme}
              aria-label={ar ? "تغيير المظهر" : "Toggle theme"}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </header>
      )}
      <main className="owner-access-main" aria-busy={loading || undefined}>
        <section className="owner-access-panel">{children}</section>
        {!compact && (
          <p className="owner-access-footer">
            <LockKeyhole aria-hidden="true" className="h-3.5 w-3.5" />
            {ar ? "دخول خاص بمالك المنصة" : "Private owner access"}
          </p>
        )}
      </main>
    </div>
  );
}

export function OwnerAccessLoading() {
  const { locale } = useLanguage();
  return (
    <OwnerAccessFrame loading>
      <div className="owner-access-skeleton" aria-hidden="true">
        <div className="owner-skeleton-mark" />
        <div className="owner-skeleton-heading" />
        <div className="owner-skeleton-copy" />
        <div className="owner-skeleton-field" />
        <div className="owner-skeleton-field" />
        <div className="owner-skeleton-button" />
      </div>
      <p role="status" className="owner-access-loading-label">
        {locale === "ar" ? "جارٍ فتح مساحة العمل…" : "Opening your workspace…"}
      </p>
    </OwnerAccessFrame>
  );
}
