import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Pricing() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  return (
    <CreatorShell>
      <Seo title={`${tr("Pricing", "التسعير")} · MovPrompt`} description={tr("Start with one included template render. Credit purchases open after the private beta.", "ابدأ بتوليد قالب واحد مشمول. شراء الرصيد يتوفر بعد المرحلة التجريبية الخاصة.")} path="/pricing" />
      <div className="creator-page creator-pricing-page">
        <header className="creator-page-head creator-pricing-head">
          <div><p className="creator-kicker">{tr("Simple, usage-based pricing", "تسعير بسيط حسب الاستخدام")}</p><h1 className="creator-title">{tr("Create the first one on us.", "أول فيديو علينا.")}</h1><p className="creator-subtitle">{tr("Every verified account includes one curated template render. After that, see the exact credit price before you generate.", "كل حساب موثق يشمل توليد قالب مختار واحد. بعده تشوف سعر الرصيد الدقيق قبل أي توليد.")}</p></div>
        </header>
        <section className="creator-pricing-grid" aria-label={tr("Pricing options", "خيارات التسعير")}>
          <article className="creator-panel creator-panel-pad"><p className="creator-kicker">{tr("Starter", "البداية")}</p><h2>{tr("One included render", "توليد واحد مشمول")}</h2><p>{tr("Try a curated template with your own product before buying credits.", "جرّب قالباً مختاراً مع منتجك قبل شراء الرصيد.")}</p><ul><li><Check aria-hidden="true" /> {tr("One eligible Template Mode render", "توليد واحد مؤهل في وضع القوالب")}</li><li><Check aria-hidden="true" /> {tr("Simple editor and project history", "محرر بسيط وسجل للمشاريع")}</li><li><Check aria-hidden="true" /> {tr("MP4 download after a successful render", "تنزيل MP4 بعد نجاح التوليد")}</li></ul><Link className="creator-button creator-button-primary" to="/create"><Sparkles aria-hidden="true" /> {tr("Start creating", "ابدأ الإنشاء")}</Link></article>
          <article className="creator-panel creator-panel-pad"><p className="creator-kicker">{tr("Credits", "الرصيد")}</p><h2>{tr("Pay for what you create", "ادفع مقابل ما تنشئه")}</h2><p>{tr("Quotes depend on duration and capability. The price is locked before submission and failures refund automatically.", "يعتمد السعر على المدة والقدرة الإبداعية. يتم تثبيت السعر قبل الإرسال واسترجاع الرصيد تلقائياً عند الفشل.")}</p><ul><li><Check aria-hidden="true" /> {tr("Exact quote before every render", "سعر دقيق قبل كل توليد")}</li><li><Check aria-hidden="true" /> {tr("Arabic, English and bilingual campaigns", "حملات عربية وإنجليزية وثنائية اللغة")}</li><li><Check aria-hidden="true" /> {tr("Four separately quoted campaign ratios", "أربعة مقاسات حملات بتسعير منفصل")}</li></ul><div className="creator-import-note" role="note"><strong>{tr("Private beta", "مرحلة تجريبية خاصة")}</strong><span>{tr("Credit purchase is not connected yet. Your starter render and live quotes remain available.", "شراء الرصيد غير متصل حالياً. يظل التوليد الأول والأسعار المباشرة متاحة.")}</span></div></article>
        </section>
      </div>
    </CreatorShell>
  );
}
