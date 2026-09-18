import { useState } from "react";
import { Coins } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { WalletDrawer } from "./WalletDrawer";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";

export function CreditBadge({ className }: { className?: string }) {
  const { balance, loading, error } = useCredits();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  const unavailable = balance === null && !loading;
  const low = balance !== null && balance < 10;
  const label = loading
    ? (ar ? "جارٍ تحميل الرصيد" : "Credits loading")
    : unavailable
      ? (ar ? "الرصيد غير متوفر" : "Credits unavailable")
      : (ar ? `${balance} رصيد` : `${balance} credits`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex min-h-11 items-center gap-1.5 px-3 rounded-full border text-xs font-medium transition-colors",
          unavailable
            ? "border-border/50 text-muted-foreground bg-muted/30 hover:border-border"
            : low
            ? "border-accent/40 text-accent bg-accent/10 hover:bg-accent/20"
            : "border-border/50 text-foreground/90 bg-[hsl(240_5%_9%)] hover:border-border",
          className,
        )}
        aria-label={`${label} — ${ar ? "افتح المحفظة" : "open wallet"}`}
        title={error || label}
      >
        <Coins className="w-3.5 h-3.5" />
        <span className={balance !== null ? "tabular-nums" : undefined}>
          {loading ? "…" : unavailable ? (ar ? "غير متوفر" : "Unavailable") : balance}
        </span>
      </button>
      <WalletDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
