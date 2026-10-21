import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Coins, FlaskConical, Loader2 } from "lucide-react";
import type { CreditPackagesResponse } from "@movprompt/contracts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useLanguage } from "@/i18n/LanguageContext";
import { PortableApiError, portableCreatorApi } from "@/lib/api/portableApiClient";
import { OPEN_TOP_UP_EVENT } from "@/lib/credits/events";
import { GENERATION_CREDIT_PRICES } from "@/lib/credits/generationPrices";
import { cn } from "@/lib/utils";
import "./top-up.css";

type Choice = { kind: "package"; id: string } | { kind: "custom" };
type Phase = { name: "choose" } | { name: "submitting" } | { name: "done"; credits: number };

function formatKwd(amountMinor: number, arabic: boolean): string {
  return new Intl.NumberFormat(arabic ? "ar-KW" : "en-KW", { style: "currency", currency: "KWD", minimumFractionDigits: 3 }).format(amountMinor / 1000);
}

/** Mounted once at the app root; any screen opens it with openTopUpDialog(). */
export function TopUpDialogHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_TOP_UP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_TOP_UP_EVENT, onOpen);
  }, []);
  return <TopUpDialog open={open} onOpenChange={setOpen} />;
}

export function TopUpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const id = useId();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { available, balance } = useCredits();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  const [catalog, setCatalog] = useState<CreditPackagesResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [customCredits, setCustomCredits] = useState("");
  const [phase, setPhase] = useState<Phase>({ name: "choose" });
  const [error, setError] = useState("");
  // One key per attempt: a network retry reuses it, so the server never creates two orders.
  const attemptKey = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase({ name: "choose" });
    setError("");
    attemptKey.current = null;
    if (!userId) return;
    let active = true;
    setLoadError("");
    void portableCreatorApi.creditPackages()
      .then((result) => {
        if (!active) return;
        setCatalog(result);
        const preferred = result.packages.find((item) => item.popular) ?? result.packages[0];
        setChoice((current) => current ?? (preferred ? { kind: "package", id: preferred.id } : null));
      })
      .catch((reason) => {
        if (!active) return;
        setCatalog(null);
        setLoadError(reason instanceof PortableApiError && reason.status === 503
          ? tr("Top-ups aren't available yet.", "شحن الرصيد غير متاح حالياً.")
          : tr("We couldn't load credit packages. Close and try again.", "تعذر تحميل باقات الرصيد. أغلق وحاول مرة ثانية."));
      });
    return () => { active = false; };
    // tr only depends on locale, which is already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, locale]);

  const custom = catalog?.payments.customAmount ?? null;
  const testMode = catalog?.payments.mode === "test";
  const hosted = catalog?.payments.checkout === "hosted";
  const customValue = Number(customCredits);
  const customValid = custom !== null && Number.isSafeInteger(customValue) && customValue >= custom.min && customValue <= custom.max;
  const selectedPackage = choice?.kind === "package" ? catalog?.packages.find((item) => item.id === choice.id) : undefined;
  const creditsToAdd = selectedPackage?.credits ?? (choice?.kind === "custom" && customValid ? customValue : null);
  const canSubmit = Boolean(catalog?.payments.available) && creditsToAdd !== null && phase.name === "choose";

  const select = (next: Choice) => {
    setChoice(next);
    setError("");
    attemptKey.current = null;
  };

  const submit = async () => {
    if (!canSubmit || !choice) return;
    attemptKey.current ??= `topup:${crypto.randomUUID()}`;
    setPhase({ name: "submitting" });
    setError("");
    try {
      const result = await portableCreatorApi.createTopUp({ ...(choice.kind === "package" ? { packageId: choice.id } : { customCredits: customValue }), language: ar ? "ar" : "en" }, attemptKey.current);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.order.status === "credited") {
        attemptKey.current = null;
        setPhase({ name: "done", credits: result.order.credits });
        return;
      }
      setPhase({ name: "choose" });
      setError(tr("The top-up did not complete. You were not charged.", "لم يكتمل الشحن. لم يتم خصم أي مبلغ."));
    } catch (reason) {
      setPhase({ name: "choose" });
      setError(reason instanceof PortableApiError ? reason.message : tr("The top-up could not be completed. Try again.", "تعذر إكمال الشحن. حاول مرة ثانية."));
    }
  };

  const spendable = available ?? balance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-up-dialog sm:max-w-[520px]" overlayClassName="bg-black/55 backdrop-blur-md" closeLabel={tr("Close", "إغلاق")} dir={ar ? "rtl" : "ltr"}>
        {phase.name === "done" ? (
          <div className="top-up-done" role="status">
            <span className="top-up-icon is-success"><CheckCircle2 aria-hidden="true" /></span>
            <DialogTitle>{tr(`${phase.credits} credits added`, `تمت إضافة ${phase.credits} رصيد`)}</DialogTitle>
            <DialogDescription>
              {tr("They're in your wallet and ready to use.", "أُضيف الرصيد إلى محفظتك وجاهز للاستخدام.")}
            </DialogDescription>
            <button type="button" className="top-up-primary" onClick={() => onOpenChange(false)}>{tr("Done", "تم")}</button>
          </div>
        ) : (
          <>
            <div className="top-up-head">
              <span className="top-up-icon"><Coins aria-hidden="true" /></span>
              <div>
                <DialogTitle>{tr("Top up credits", "شحن الرصيد")}</DialogTitle>
                <DialogDescription>
                  {tr(`A template video uses ${GENERATION_CREDIT_PRICES.template} credits and an Ad Studio video ${GENERATION_CREDIT_PRICES.adStudio}.`, `فيديو القالب يستخدم ${GENERATION_CREDIT_PRICES.template} رصيد وفيديو استوديو الإعلانات ${GENERATION_CREDIT_PRICES.adStudio}.`)}
                </DialogDescription>
              </div>
            </div>

            {!user ? (
              <p className="top-up-message">{tr("Sign in to top up your credits.", "سجّل الدخول لشحن رصيدك.")} <Link to="/auth" onClick={() => onOpenChange(false)}>{tr("Sign in", "تسجيل الدخول")}</Link></p>
            ) : loadError ? (
              <p className="top-up-message" role="alert">{loadError}</p>
            ) : !catalog ? (
              <p className="top-up-message" role="status"><Loader2 className="top-up-spin" aria-hidden="true" /> {tr("Loading packages…", "جارٍ تحميل الباقات…")}</p>
            ) : !catalog.payments.available ? (
              <p className="top-up-message" role="alert">{tr("Top-ups aren't available yet. Online payment is coming soon.", "شحن الرصيد غير متاح حالياً. الدفع الإلكتروني قريباً.")}</p>
            ) : (
              <>
                {testMode && <p className="top-up-test" role="note"><FlaskConical aria-hidden="true" /> {hosted
                  ? tr("Test mode: pay with a test card on the payment page. No real money is charged.", "وضع الاختبار: ادفع ببطاقة اختبار في صفحة الدفع. لا يتم خصم أي مبلغ حقيقي.")
                  : tr("Test mode: credits are added instantly and no payment is taken.", "وضع الاختبار: يُضاف الرصيد فوراً دون أي دفع.")}</p>}
                <fieldset className="top-up-options" disabled={phase.name === "submitting"}>
                  <legend className="sr-only">{tr("Choose credits", "اختر الرصيد")}</legend>
                  {catalog.packages.map((item) => (
                    <label key={item.id} className={cn("top-up-option", choice?.kind === "package" && choice.id === item.id && "is-selected")}>
                      <input type="radio" name={`${id}-choice`} checked={choice?.kind === "package" && choice.id === item.id} onChange={() => select({ kind: "package", id: item.id })} />
                      <span className="top-up-option-credits">{item.credits} <small>{tr("credits", "رصيد")}</small></span>
                      {item.popular && <span className="top-up-badge">{tr("Most popular", "الأكثر طلباً")}</span>}
                      <span className="top-up-option-price">{formatKwd(item.amountMinor, ar)}</span>
                    </label>
                  ))}
                  {custom && (
                    <label className={cn("top-up-option top-up-option-custom", choice?.kind === "custom" && "is-selected")}>
                      <input type="radio" name={`${id}-choice`} checked={choice?.kind === "custom"} onChange={() => select({ kind: "custom" })} />
                      <span className="top-up-option-credits">{tr("Custom amount", "مبلغ مخصص")}</span>
                      <input
                        className="top-up-custom-input"
                        type="number"
                        inputMode="numeric"
                        min={custom.min}
                        max={custom.max}
                        step={1}
                        placeholder={tr(`${custom.min}–${custom.max}`, `${custom.min}–${custom.max}`)}
                        aria-label={tr("Credits to add", "الرصيد المراد إضافته")}
                        aria-invalid={choice?.kind === "custom" && customCredits !== "" && !customValid ? true : undefined}
                        value={customCredits}
                        onFocus={() => select({ kind: "custom" })}
                        onChange={(event) => { setCustomCredits(event.target.value); select({ kind: "custom" }); }}
                      />
                    </label>
                  )}
                </fieldset>
                {choice?.kind === "custom" && customCredits !== "" && !customValid && custom && (
                  <p className="top-up-error" role="alert">{tr(`Enter a whole number from ${custom.min} to ${custom.max}.`, `أدخل عدداً صحيحاً من ${custom.min} إلى ${custom.max}.`)}</p>
                )}
                {error && <p className="top-up-error" role="alert">{error}</p>}
                <button type="button" className="top-up-primary" disabled={!canSubmit} onClick={() => void submit()}>
                  {phase.name === "submitting" ? <><Loader2 className="top-up-spin" aria-hidden="true" /> {hosted ? tr("Opening secure payment…", "جارٍ فتح صفحة الدفع الآمنة…") : tr("Adding credits…", "جارٍ إضافة الرصيد…")}</>
                    : hosted && selectedPackage ? tr(`Pay ${formatKwd(selectedPackage.amountMinor, false)}`, `ادفع ${formatKwd(selectedPackage.amountMinor, true)}`)
                    : creditsToAdd ? tr(`Add ${creditsToAdd} credits`, `أضف ${creditsToAdd} رصيد`) : tr("Choose an amount", "اختر الكمية")}
                </button>
                <p className="top-up-footnote">
                  {hosted && tr("You'll pay securely by KNET or card on the payment page. ", "ستدفع بأمان عبر كي نت أو البطاقة في صفحة الدفع. ")}
                  {spendable !== null && tr(`Current balance: ${spendable} credits. `, `رصيدك الحالي: ${spendable}. `)}
                  {tr("If a video fails, its credits return automatically.", "إذا فشل الفيديو، يرجع رصيده تلقائياً.")}
                </p>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
