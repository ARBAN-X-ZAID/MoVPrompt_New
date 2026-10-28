import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { X, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { isFeatureEnabled } from "@/config/features";
import { request } from "@/lib/api/portableApiClient";
import { Button } from "@/components/ui/button";

const TextSchema = z.object({ en: z.string(), ar: z.string() });
const NoticesSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      revision: z.number(),
      kind: z.string(),
      title: TextSchema,
      body: TextSchema,
    }),
  ),
  maintenanceMessage: TextSchema,
  pauseGeneration: z.boolean(),
  evaluatedAt: z.string(),
});
export function CustomerNotices() {
  const location = useLocation();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [dismissed, setDismissed] = useState<string[]>([]);
  const enabled =
    isFeatureEnabled("communications") &&
    !/^\/(admin|auth|reset-password)(\/|$)/.test(location.pathname);
  const query = useQuery({
    queryKey: ["customer-notices", user?.id ?? "guest"],
    queryFn: () => request("/api/v1/communications/status", NoticesSchema),
    enabled,
    staleTime: 60000,
    retry: false,
  });
  if (!enabled || !query.data) return null;
  const maintenance = query.data.maintenanceMessage[locale];
  const items = query.data.items.filter(
    (item) =>
      !dismissed.includes(`${user?.id ?? "guest"}:${item.id}:${item.revision}`),
  );
  if (!maintenance && !items.length) return null;
  return (
    <aside
      aria-label={ar ? "إشعارات المنصة" : "Platform notices"}
      className="border-b border-primary/20 bg-muted/60 px-4 py-3 text-foreground"
      dir={ar ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-7xl space-y-3">
        {maintenance && (
          <p role="status" className="flex items-start gap-2 text-sm leading-6">
            <Info
              aria-hidden="true"
              className="mt-1 h-4 w-4 shrink-0 text-primary"
            />
            <span className="whitespace-pre-wrap">{maintenance}</span>
          </p>
        )}
        {items.map((item) => (
          <div
            key={`${item.id}:${item.revision}`}
            className="flex items-start justify-between gap-4"
          >
            <div>
              <strong className="text-sm">{item.title[locale]}</strong>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {item.body[locale]}
              </p>
              <Link
                className="mt-2 inline-block text-xs text-primary underline"
                to="/notifications"
              >
                {ar ? "فتح الإشعارات والدعم" : "Open notifications and support"}
              </Link>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                ar ? `إخفاء ${item.title.ar}` : `Dismiss ${item.title.en}`
              }
              onClick={() =>
                setDismissed((previous) => [
                  ...previous,
                  `${user?.id ?? "guest"}:${item.id}:${item.revision}`,
                ])
              }
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </aside>
  );
}
