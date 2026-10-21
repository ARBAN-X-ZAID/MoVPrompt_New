import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import type { TopUpOrder } from "@movprompt/contracts";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useLanguage } from "@/i18n/LanguageContext";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import { openTopUpDialog } from "@/lib/credits/events";
import "@/components/credits/top-up.css";

const POLL_MS = 2_000;
const POLL_LIMIT_MS = 90_000;

/** Where a payment gateway returns the customer. The webhook, not this page, credits the wallet. */
export default function BillingReturn({ outcome }: { outcome: "success" | "cancel" }) {
  const [params] = useSearchParams();
  // Some gateways append "?param=..." to a return URL that already has a query, so read the leading id.
  const orderId = params.get("order")?.match(/^[a-f0-9]{24}/)?.[0] ?? null;
  // UPayments appends its own reference to the return URL; the API re-verifies it with the gateway.
  const trackId = params.get("track_id");
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  const [order, setOrder] = useState<TopUpOrder | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [lookupFailed, setLookupFailed] = useState(false);

  useEffect(() => {
    if (!orderId || !/^[a-f0-9]{24}$/.test(orderId)) { setLookupFailed(true); return; }
    let active = true;
    const started = Date.now();
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await portableCreatorApi.topUpOrder(orderId, trackId);
        if (!active) return;
        setOrder(next);
        if (next.status !== "pending" || outcome === "cancel") return;
      } catch {
        if (!active) return;
        setLookupFailed(true);
        return;
      }
      if (Date.now() - started > POLL_LIMIT_MS) { setTimedOut(true); return; }
      timer = window.setTimeout(() => void poll(), POLL_MS);
    };
    void poll();
    return () => { active = false; window.clearTimeout(timer); };
  }, [orderId, outcome, trackId]);

  const credited = order?.status === "credited";
  const closed = order && ["failed", "cancelled", "expired"].includes(order.status);
  const cancelled = outcome === "cancel" && !credited;

  const view = credited
    ? { icon: <CheckCircle2 aria-hidden="true" />, tone: "is-success", title: tr(`${order.credits} credits added`, `تمت إضافة ${order.credits} رصيد`), body: tr("Your payment was confirmed and your wallet is updated.", "تم تأكيد الدفع وتحديث محفظتك.") }
    : cancelled || closed
      ? { icon: <XCircle aria-hidden="true" />, tone: "", title: tr("Payment not completed", "لم يكتمل الدفع"), body: tr("No credits were added and you were not charged. You can try again any time.", "لم تتم إضافة رصيد ولم يتم خصم أي مبلغ. يمكنك المحاولة مرة ثانية في أي وقت.") }
      : lookupFailed
        ? { icon: <XCircle aria-hidden="true" />, tone: "", title: tr("We couldn't find this top-up", "تعذر العثور على عملية الشحن"), body: tr("Check your credit balance in the wallet. If you were charged and no credits appear, contact support.", "تحقق من رصيدك في المحفظة. إذا تم الخصم ولم يظهر الرصيد، تواصل مع الدعم.") }
        : { icon: <Clock3 aria-hidden="true" />, tone: "", title: tr("Confirming your payment…", "جارٍ تأكيد الدفع…"), body: timedOut ? tr("This is taking longer than usual. Your credits will appear as soon as the payment provider confirms it.", "يستغرق هذا وقتاً أطول من المعتاد. سيظهر الرصيد فور تأكيد مزود الدفع.") : tr("Keep this page open for a moment.", "أبقِ هذه الصفحة مفتوحة للحظات.") };

  return (
    <CreatorShell>
      <div className="creator-page">
        <section className="top-up-dialog top-up-done top-up-page" role="status" aria-live="polite" dir={ar ? "rtl" : "ltr"}>
          <span className={`top-up-icon ${view.tone}`}>{view.icon}</span>
          <h1>{view.title}</h1>
          <p>{view.body}</p>
          {credited ? <Link className="top-up-primary" to="/templates">{tr("Create a video", "أنشئ فيديو")}</Link>
            : (cancelled || closed || lookupFailed) ? <button type="button" className="top-up-primary" onClick={openTopUpDialog}>{tr("Try again", "حاول مرة ثانية")}</button>
            : null}
        </section>
      </div>
    </CreatorShell>
  );
}
