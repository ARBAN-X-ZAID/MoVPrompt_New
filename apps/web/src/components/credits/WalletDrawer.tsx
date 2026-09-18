import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Coins, ArrowDownRight, ArrowUpRight, Gift } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits, fetchLedger, type LedgerEntry } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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

const REASON_LABEL_AR: Record<string, string> = {
  signup_bonus: "رصيد ترحيبي",
  backfill_bonus: "رصيد ترحيبي",
  daily_grant: "رصيد يومي سابق",
  director_chat_text: "محادثة المخرج",
  director_chat_multimodal: "محادثة المخرج مع مواد",
  image_generation: "توليد صورة",
  image_generation_refund: "استرجاع توليد صورة",
  write_ad_scene: "كتابة مشهد إعلان",
  write_ad_scene_refund: "استرجاع كتابة مشهد",
  video_render: "توليد فيديو",
  video_render_refund: "استرجاع توليد فيديو",
};

function formatReason(r: string) {
  return REASON_LABEL[r] || r.replace(/_/g, " ");
}

export function WalletDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { balance, reserved, available, starterRenderAvailable, loading: balanceLoading, error: balanceError } = useCredits();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [activityState, setActivityState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setActivityState("loading");
    void fetchLedger(userId, 50)
      .then((nextEntries) => {
        if (!active) return;
        setEntries(nextEntries);
        setActivityState("ready");
      })
      .catch(() => {
        if (!active) return;
        setEntries([]);
        setActivityState("error");
      });
    return () => { active = false; };
  }, [open, userId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-2xl tracking-tight flex items-center gap-2">
            <Coins aria-hidden="true" className="w-5 h-5 text-accent" /> {tr("Credits", "الرصيد")}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 rounded-2xl border border-border/60 bg-[hsl(240_5%_8%)] p-5">
          <div className="text-xs uppercase text-muted-foreground tracking-wider">{tr("Balance", "الرصيد")}</div>
          <div className="mt-1 font-display text-4xl tabular-nums">{balanceLoading ? "…" : balance ?? "—"}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {balanceError
              ? tr("We couldn’t load your balance. Close and reopen the wallet to try again.", "تعذر تحميل الرصيد. أغلق المحفظة وافتحها وحاول مرة ثانية.")
              : starterRenderAvailable
              ? tr("Your verified account includes one starter template render.", "حسابك الموثق يشمل توليد قالب أولي واحد.")
              : reserved > 0 && available !== null
                ? (ar ? `${available} متاح · ${reserved} محجوز للتوليدات النشطة.` : `${available} available · ${reserved} reserved for active renders.`)
                : tr("Credits are charged only after a render is accepted by the provider.", "يتم خصم الرصيد فقط بعد قبول المزود لطلب التوليد.")}
          </div>
          <Button
            className="mt-4 w-full rounded-full"
            onClick={() => {
              onOpenChange(false);
              navigate("/account/billing");
            }}
          >
            {tr("View pricing & beta access", "عرض التسعير والدخول التجريبي")}
          </Button>
        </div>

        <div className="mt-6">
          <div className="text-xs uppercase text-muted-foreground tracking-wider mb-2">{tr("Recent activity", "النشاط الأخير")}</div>
          <ul className="space-y-1">
            {activityState === "loading" && <li className="text-sm text-muted-foreground" role="status">{tr("Loading activity…", "جارٍ تحميل النشاط…")}</li>}
            {activityState === "error" && <li className="text-sm text-muted-foreground" role="alert">{tr("We couldn’t load recent activity. Close and reopen the wallet to try again.", "تعذر تحميل النشاط الأخير. أغلق المحفظة وافتحها وحاول مرة ثانية.")}</li>}
            {activityState === "ready" && entries.length === 0 && <li className="text-sm text-muted-foreground">{tr("No activity yet.", "لا يوجد نشاط بعد.")}</li>}
            {entries.map((e) => {
              const positive = e.delta > 0;
              return (
                <li key={e.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      positive ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {e.reason.includes("bonus") || e.reason === "daily_grant" ? (
                      <Gift className="w-3.5 h-3.5" />
                    ) : positive ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{ar ? REASON_LABEL_AR[e.reason] || formatReason(e.reason) : formatReason(e.reason)}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className={`text-sm tabular-nums ${positive ? "text-emerald-400" : "text-foreground/80"}`}>
                    {positive ? "+" : ""}
                    {e.delta}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
