import { Bell, Clock3 } from "lucide-react";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useLanguage } from "@/i18n/LanguageContext";

export default function Notifications() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  return <CreatorShell><Seo title={`${tr("Notifications", "الإشعارات")} · MovPrompt`} description={tr("Generation, export and account updates.", "تحديثات التوليد والتصدير والحساب.")} noindex /><div className="creator-page"><header className="creator-page-head"><div><p className="creator-kicker">{tr("Updates", "التحديثات")}</p><h1 className="creator-title creator-title-sm">{tr("Notifications", "الإشعارات")}</h1><p className="creator-subtitle">{tr("Generation progress is available inside each project. The unified notification feed opens after the private beta.", "تقدم التوليد متوفر داخل كل مشروع. سجل الإشعارات الموحد يتوفر بعد المرحلة التجريبية الخاصة.")}</p></div></header><div className="creator-empty"><div><span className="creator-empty-icon"><Bell aria-hidden="true" /></span><h2>{tr("Notification feed not connected yet", "سجل الإشعارات غير متصل حالياً")}</h2><p>{tr("For the client preview, open Projects to check a render or export. No placeholder notifications are shown here.", "في معاينة العميل، افتح المشاريع لمتابعة أي توليد أو تصدير. ما نعرض إشعارات تجريبية هنا.")}</p><span className="creator-button creator-button-secondary" aria-disabled="true"><Clock3 aria-hidden="true" /> {tr("Private beta", "مرحلة تجريبية خاصة")}</span></div></div></div></CreatorShell>;
}
