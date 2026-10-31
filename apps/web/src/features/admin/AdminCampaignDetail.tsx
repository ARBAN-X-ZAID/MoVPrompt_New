import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Film, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard, AdminEmpty, AdminFacts, AdminPageHeader, StatusBadge } from "./AdminChrome";
import { withReturnTo } from "./adminNav";

const LANGUAGES: Record<string, [string, string]> = { en: ["English", "الإنجليزية"], ar: ["Arabic", "العربية"], bilingual: ["English and Arabic", "الإنجليزية والعربية"] };

export default function AdminCampaignDetail({ id }: { id: string }) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const location = useLocation();
  const [playing, setPlaying] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const query = useQuery({ queryKey: ["admin", "campaigns", id], queryFn: () => adminApi.campaign(id) });
  if (query.isPending) return <Loading variant="detail" />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const row = query.data.record;
  const generation = row.generation;
  const media = query.data.related.media;
  const templateName = row.templateName?.[ar ? "ar" : "en"] ?? "";
  const title = String(row.title || t("Untitled campaign", "حملة بدون عنوان"));
  const when = (value: unknown) => value ? new Date(String(value)).toLocaleDateString(locale, { dateStyle: "medium" }) : "—";
  const video = generation.acceptedRunId ? String(generation.acceptedRunId) : null;
  const latestRun = generation.latestRunId ? String(generation.latestRunId) : null;
  return <>
    <AdminPageHeader
      back={{ fallback: "/admin/campaigns", label: t("Back to campaigns", "العودة إلى الحملات") }}
      title={<span dir="auto">{title}</span>}
      meta={<><StatusBadge value={row.status} />{templateName ? <span dir="auto">{templateName}</span> : null}</>}
      actions={<>
        {row.userId ? <Button variant="outline" asChild><Link to={withReturnTo(`/admin/customers/${row.userId}`, location)}>{t("Open customer", "فتح العميل")}</Link></Button> : null}
        {latestRun && <Button variant="outline" asChild><Link to={withReturnTo(`/admin/generations/${latestRun}`, location)}>{t("Open generation", "فتح التوليد")}</Link></Button>}
      </>}
    />
    <div className="admin-template-layout">
      <AdminCard title={t("Final video", "الفيديو النهائي")}>
        {video
          ? <button type="button" className="admin-video-tile is-large" aria-label={t("Play final video", "تشغيل الفيديو النهائي")} onClick={() => setPlaying(true)}><Play aria-hidden="true" /><span>{t("Play video", "تشغيل الفيديو")}</span></button>
          : <AdminEmpty title={t("No final video yet", "لا يوجد فيديو نهائي بعد")} icon={<Film aria-hidden="true" />} />}
      </AdminCard>
      <div className="admin-stack">
        <AdminCard title={t("Campaign details", "تفاصيل الحملة")}>
          <AdminFacts items={[
            { label: t("Customer", "العميل"), value: row.userId ? <Link className="admin-link" to={withReturnTo(`/admin/customers/${row.userId}`, location)} dir="auto">{String(row.customerName ?? "—")}</Link> : "—" },
            { label: t("Template", "القالب"), value: <span dir="auto">{templateName || "—"}</span> },
            { label: t("Length", "المدة"), value: row.durationSeconds ? t(`${row.durationSeconds} seconds`, `${row.durationSeconds} ثانية`) : "—" },
            { label: t("Language", "اللغة"), value: LANGUAGES[String(row.language)]?.[ar ? 1 : 0] ?? "—" },
            { label: t("Latest video status", "حالة آخر فيديو"), value: generation.status ? <StatusBadge value={generation.status} /> : "—" },
            { label: t("Credits used", "الرصيد المستخدم"), value: String(generation.creditsUsed ?? 0) },
            { label: t("Created", "تاريخ الإنشاء"), value: when(row.createdAt) },
            { label: t("Last updated", "آخر تحديث"), value: when(row.updatedAt) },
          ]} />
        </AdminCard>
        <AdminCard title={t("Customer photos", "صور العميل")} description={t("Opening a photo is recorded in the audit history.", "يُسجل فتح الصورة في سجل التدقيق.")}>
          {media.length ? <div className="flex flex-wrap gap-2">
            {media.map(item => <Button key={String(item.id)} variant="outline" size="sm" onClick={() => setPhoto(String(item.id))}>
              <span dir="auto" className="max-w-52 truncate">{String(item.filename || t("Photo", "صورة"))}</span>
            </Button>)}
          </div> : <p className="admin-hint">{t("No photos on this campaign.", "لا توجد صور في هذه الحملة.")}</p>}
        </AdminCard>
      </div>
    </div>
    <Dialog open={playing} onOpenChange={setPlaying}>
      <DialogContent className="sm:max-w-3xl" dir={ar ? "rtl" : "ltr"}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{t("Final video for this campaign", "الفيديو النهائي لهذه الحملة")}</DialogDescription>
        {playing && video && <video className="max-h-[70dvh] w-full" src={adminApi.media("generation", video)} controls playsInline />}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(photo)} onOpenChange={open => !open && setPhoto(null)}>
      <DialogContent className="sm:max-w-3xl" dir={ar ? "rtl" : "ltr"}>
        <DialogTitle>{t("Customer photo", "صورة العميل")}</DialogTitle>
        <DialogDescription>{t("Private to this customer's campaign", "خاصة بحملة هذا العميل")}</DialogDescription>
        {photo && <img className="max-h-[70dvh] w-full rounded-lg object-contain" src={adminApi.media("campaign", photo)} alt={t("Customer photo", "صورة العميل")} />}
      </DialogContent>
    </Dialog>
  </>;
}
