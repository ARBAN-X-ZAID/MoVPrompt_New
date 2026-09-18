import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Coins, CreditCard, Gift, ArrowDownRight, ArrowUpRight, Film, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useAuth } from "@/hooks/useAuth";
import { useCredits, fetchLedger, type LedgerEntry } from "@/hooks/useCredits";
import { useLanguage } from "@/i18n/LanguageContext";

const REASON_LABEL: Record<string, string> = {
  signup_bonus: "Welcome bonus",
  backfill_bonus: "Welcome bonus",
  daily_grant: "Legacy daily credit",
  director_chat_text: "Director chat",
  director_chat_multimodal: "Director chat (with media)",
  image_generation: "Image generation",
  image_generation_refund: "Image refund",
  write_ad_scene: "Ad scene writer",
  write_ad_scene_refund: "Ad scene refund",
  video_render: "Video render",
  video_render_refund: "Video render refund",
};

const AccountBilling = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  const { balance, available, reserved, starterRenderAvailable, loading: balanceLoading, error: balanceError } = useCredits();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [activityState, setActivityState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setActivityState("loading");
    void fetchLedger(userId, 100).then((nextEntries) => {
      if (!active) return;
      setEntries(nextEntries);
      setActivityState("ready");
    }).catch(() => {
      if (!active) return;
      setEntries([]);
      setActivityState("error");
    });
    return () => { active = false; };
  }, [userId]);

  return (
    <CreatorShell>
      <Seo title={`${tr("Credits & pricing", "الرصيد والتسعير")} · MovPrompt`} description={tr("Review your credit balance, activity, and generation pricing.", "راجع رصيدك ونشاطك وتسعير التوليد.")} noindex />
      <div className="creator-page max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 min-h-11 gap-2">
          <Link to="/create"><ArrowLeft aria-hidden="true" className="w-4 h-4" /> {tr("Back to workspace", "العودة لمساحة العمل")}</Link>
        </Button>
        <h1 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
          <CreditCard aria-hidden="true" className="w-5 h-5 text-accent" /> {tr("Credits & pricing", "الرصيد والتسعير")}
        </h1>

        <Card className="p-6 mb-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{tr("Credit balance", "رصيد النقاط")}</div>
              <div className="mt-1 font-display text-4xl tabular-nums flex items-center gap-2">
                <Coins aria-hidden="true" className="w-7 h-7 text-accent" /> {balanceLoading ? "…" : balance ?? "—"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground" role={balanceError ? "alert" : undefined}>{balanceError
                ? tr("Balance temporarily unavailable. Your projects remain safe.", "الرصيد غير متوفر مؤقتاً. مشاريعك محفوظة.")
                : available === null
                  ? tr("Checking your balance…", "جارٍ التحقق من الرصيد…")
                  : ar
                    ? `${available} متاح${reserved ? ` · ${reserved} محجوز` : ""}`
                    : `${available} available${reserved ? ` · ${reserved} reserved` : ""}`}</div>
              {starterRenderAvailable && <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-500"><Gift aria-hidden="true" className="w-3.5 h-3.5" /> {tr("Starter template render available", "توليد قالب أولي متاح")}</div>}
            </div>
            <Button className="min-h-11 rounded-full" asChild><Link to="/pricing">{tr("View pricing & beta access", "عرض التسعير والدخول التجريبي")}</Link></Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="text-sm font-medium mb-3">{tr("Recent activity", "النشاط الأخير")}</div>
          {activityState === "loading" && <div className="text-sm text-muted-foreground" role="status">{tr("Loading activity…", "جارٍ تحميل النشاط…")}</div>}
          {activityState === "error" && <div className="text-sm text-muted-foreground" role="alert">{tr("Activity is temporarily unavailable. Try again after refreshing this page.", "النشاط غير متوفر مؤقتاً. حاول مرة ثانية بعد تحديث الصفحة.")}</div>}
          {activityState === "ready" && entries.length === 0 && <div className="text-sm text-muted-foreground">{tr("No credit activity yet.", "لا يوجد نشاط رصيد بعد.")}</div>}
          <ul className="divide-y divide-border/40">
            {entries.map((e) => {
              const positive = e.delta > 0;
              return (
                <li key={e.id} className="py-3 flex items-center gap-3">
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${positive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/40 text-muted-foreground"}`}>
                    {e.reason.includes("bonus") || e.reason === "daily_grant" ? (
                      <Gift className="w-4 h-4" />
                    ) : positive ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">{REASON_LABEL[e.reason] || e.reason.replace(/_/g, " ")}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className={`text-sm tabular-nums ${positive ? "text-emerald-400" : "text-foreground/80"}`}>
                    {positive ? "+" : ""}{e.delta}
                  </div>
                  <div className="text-xs tabular-nums text-muted-foreground w-16 text-right">
                    {e.balance_after}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-6 mt-6">
          <div className="text-sm font-medium mb-1 flex items-center gap-2">
            <Film aria-hidden="true" className="w-4 h-4 text-accent" /> {tr("Generation pricing", "تسعير التوليد")}
          </div>
          <div className="text-sm text-muted-foreground mb-5 max-w-2xl">
            {tr("MovPrompt confirms a live quote before each generation. It reflects the selected template or creative capability, duration, format, and references.", "يؤكد MovPrompt سعراً مباشراً قبل كل توليد حسب القالب أو القدرة الإبداعية والمدة والمقاس والمراجع.")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><Coins aria-hidden="true" className="w-4 h-4 text-accent" /> {tr("Confirmed before generation", "يُؤكد قبل التوليد")}</div>
              <p className="mt-1 text-xs text-muted-foreground">{tr("If a saved quote changes after sign-in, you must confirm the new price before anything starts.", "إذا تغيّر السعر بعد تسجيل الدخول، لازم تؤكد السعر الجديد قبل بدء أي توليد.")}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium"><ShieldCheck aria-hidden="true" className="w-4 h-4 text-emerald-500" /> {tr("Failed attempts are protected", "المحاولات الفاشلة محمية")}</div>
              <p className="mt-1 text-xs text-muted-foreground">{tr("Provider failures, invalid output, and confirmed cancellations settle through the credit ledger.", "فشل المزود أو النتيجة غير الصالحة أو الإلغاء المؤكد تتم تسويتها في سجل الرصيد.")}</p>
            </div>
          </div>
        </Card>
      </div>
    </CreatorShell>
  );
};

export default AccountBilling;
