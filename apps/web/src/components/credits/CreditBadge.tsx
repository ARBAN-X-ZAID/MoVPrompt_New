import { useState } from "react";
import { Coins } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { WalletDrawer } from "./WalletDrawer";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/i18n/LanguageContext";
import { MINIMUM_VIDEO_CREDITS } from "@/lib/credits/generationPrices";
import "./credit-badge.css";

export function CreditBadge({ className }: { className?: string }) {
  const { balance, available, loading, error } = useCredits();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [open, setOpen] = useState(false);

  const spendable = available ?? balance;
  const unavailable = spendable === null && !loading;
  const low = spendable !== null && spendable < MINIMUM_VIDEO_CREDITS;
  const plan = ar ? "الدفع حسب الاستخدام" : "Pay as you go";
  const label = loading && spendable === null
    ? (ar ? "جارٍ تحميل الرصيد" : "Credits loading")
    : unavailable
      ? (ar ? "الرصيد غير متوفر" : "Credits unavailable")
      : (ar ? `${spendable} رصيد متاح، خطة ${plan}` : `${spendable} credits available, ${plan} plan`);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("credit-badge", low && "is-low", unavailable && "is-unavailable", className)}
        aria-label={`${label} — ${ar ? "افتح المحفظة" : "open wallet"}`}
        title={error || label}
      >
        <Coins aria-hidden="true" className="credit-badge-icon" />
        <span className="credit-badge-amount">
          {loading && spendable === null ? "…" : unavailable ? (ar ? "غير متوفر" : "Unavailable") : spendable}
        </span>
        {!unavailable && <span className="credit-badge-unit">{ar ? "رصيد" : "credits"}</span>}
        <span className="credit-badge-plan" aria-hidden="true">{plan}</span>
      </button>
      <WalletDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
