import { Check, Coins, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useLanguage } from "@/i18n/LanguageContext";
import { openTopUpDialog } from "@/lib/credits/events";
import { HD_RESOLUTION_EXTRA_CREDITS, VIDEO_LENGTH_CREDIT_PRICES } from "@/lib/credits/generationPrices";

// Display copy only; the top-up dialog loads the authoritative catalog from apps/api/src/payments/credit-packages.ts.
const CREDIT_PACKS = [{ credits: 100, fils: 5_000 }, { credits: 300, fils: 13_000 }, { credits: 600, fils: 24_000 }] as const;
const kwd = (fils: number) => `KWD ${(fils / 1000).toFixed(3)}`;

export default function Pricing() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  return (
    <CreatorShell>
      <Seo title={`${tr("Pricing", "التسعير")} · MovPrompt`} description={tr("Buy credits by KNET or card and pay only for the videos you create. Failed videos refund automatically.", "اشترِ الرصيد عبر كي نت أو البطاقة وادفع فقط مقابل الفيديوهات التي تنشئها. يرجع رصيد الفيديو الفاشل تلقائياً.")} path="/pricing" />
      <div className="creator-page creator-pricing-page">
        <header className="creator-page-head creator-pricing-head">
          <div><p className="creator-kicker">{tr("Simple, usage-based pricing", "تسعير بسيط حسب الاستخدام")}</p><h1 className="creator-title">{tr("Pay only for the videos you create.", "ادفع فقط مقابل الفيديوهات التي تنشئها.")}</h1><p className="creator-subtitle">{tr("Top up your wallet once and use the credits on any template or Ad Studio video.", "اشحن محفظتك مرة واستخدم الرصيد في أي قالب أو فيديو من استوديو الإعلانات.")}</p></div>
        </header>
        <section className="creator-pricing-grid" aria-label={tr("Pricing options", "خيارات التسعير")}>
          <article className="creator-panel creator-panel-pad"><p className="creator-kicker">{tr("How credits work", "كيف يعمل الرصيد")}</p><h2>{tr("Credits per video", "الرصيد لكل فيديو")}</h2><p>{tr("You see the price before you generate. If a video fails, its credits return to your wallet automatically.", "تشوف السعر قبل التوليد. إذا فشل الفيديو، يرجع رصيده إلى محفظتك تلقائياً.")}</p><ul>{VIDEO_LENGTH_CREDIT_PRICES.map(({ seconds, credits }) => <li key={seconds}><Check aria-hidden="true" /> {tr(`${seconds}-second video: ${credits} credits`, `فيديو ${seconds} ثانية: ${credits} رصيد`)}</li>)}<li><Check aria-hidden="true" /> {tr(`720p in Ad Studio: +${HD_RESOLUTION_EXTRA_CREDITS} credits`, `دقة 720p في استوديو الإعلانات: +${HD_RESOLUTION_EXTRA_CREDITS} رصيد`)}</li><li><Check aria-hidden="true" /> {tr("Arabic or English campaigns", "حملات بالعربية أو الإنجليزية")}</li><li><Check aria-hidden="true" /> {tr("MP4 download after a successful render", "تنزيل MP4 بعد نجاح التوليد")}</li></ul><Link className="creator-button creator-button-secondary" to="/templates"><Sparkles aria-hidden="true" /> {tr("Start creating", "ابدأ الإنشاء")}</Link></article>
          <article className="creator-panel creator-panel-pad"><p className="creator-kicker">{tr("Credit packs", "باقات الرصيد")}</p><h2>{tr("Top up by KNET or card", "اشحن عبر كي نت أو البطاقة")}</h2><p>{tr("Credits are added to your wallet as soon as your payment is confirmed.", "يُضاف الرصيد إلى محفظتك فور تأكيد الدفع.")}</p><ul>{CREDIT_PACKS.map(pack => <li key={pack.credits}><Check aria-hidden="true" /> {tr(`${pack.credits} credits · ${kwd(pack.fils)}`, `${pack.credits} رصيد · ${kwd(pack.fils)}`)}</li>)}<li><Check aria-hidden="true" /> {tr("Or any amount from 10 credits, at 50 fils each", "أو أي كمية من 10 رصيد، بسعر 50 فلس للرصيد")}</li></ul><button type="button" className="creator-button creator-button-primary" onClick={openTopUpDialog}><Coins aria-hidden="true" /> {tr("Top up credits", "شحن الرصيد")}</button></article>
        </section>
      </div>
    </CreatorShell>
  );
}
