import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { consumeAuthReturnIntent, readAuthReturnIntent, safeAuthReturnPath } from "@/lib/auth/returnPath";

export default function AuthCallback() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptedRefresh = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const { t } = useLanguage();
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const requestedPath = useMemo(
    () => safeAuthReturnPath(searchParams.get("next"), readAuthReturnIntent()),
    [searchParams],
  );

  useEffect(() => {
    if (loading || refreshing) return;
    if (user) {
      consumeAuthReturnIntent();
      navigate(requestedPath, { replace: true });
      return;
    }
    if (!attemptedRefresh.current) {
      attemptedRefresh.current = true;
      setRefreshing(true);
      void refresh().finally(() => setRefreshing(false));
      return;
    }
    navigate(`/auth?next=${encodeURIComponent(requestedPath)}`, { replace: true });
  }, [loading, navigate, refresh, refreshing, requestedPath, user]);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4" role="status" aria-live="polite">
      <div className="text-center"><Loader2 aria-hidden className="mx-auto h-6 w-6 animate-spin text-primary" /><h1 ref={headingRef} tabIndex={-1} className="mt-4 font-display text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t("auth.callbackLoadingTitle")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("auth.callbackLoadingDescription")}</p></div>
    </main>
  );
}
