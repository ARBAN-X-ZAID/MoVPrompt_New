import { generationTime } from "./generationTime";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Play, Search, Video } from "lucide-react";
import type { AdminGenerationSummary } from "@movprompt/contracts";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { adminApi } from "./api";
import { AdminTable, AdminPagination, type AdminColumn } from "./AdminTable";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard, AdminFacts, AdminPageHeader, StatusBadge } from "./AdminChrome";
import { withReturnTo } from "./adminNav";
import { adminEnum } from "./labels";

function VideoResult({ row, ar, large = false }: { row: AdminGenerationSummary; ar: boolean; large?: boolean }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = row.campaign.name || (ar ? "حملة بدون عنوان" : "Untitled campaign");
  return <>
    {/* The video loads only when opened: a row of live previews made every page view stream each output. */}
    <button type="button" disabled={!row.mediaAvailable} onClick={() => { setFailed(false); setOpen(true); }}
      className={`admin-video-tile ${large ? "is-large" : ""}`}
      aria-label={row.mediaAvailable ? `${ar ? "مشاهدة" : "Play"} ${title}` : ar ? "لا يوجد فيديو مكتمل" : "No completed video"}>
      {row.mediaAvailable ? <Play aria-hidden="true" /> : <Video aria-hidden="true" />}
      {large && row.mediaAvailable && <span>{ar ? "تشغيل الفيديو" : "Play video"}</span>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-3xl" dir={ar ? "rtl" : "ltr"}>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{ar ? "الناتج الخاص بهذه المحاولة" : "Output from this generation"}</DialogDescription>
        {failed ? <p role="alert">{ar ? "هذا الفيديو غير متاح حالياً." : "This video is currently unavailable."}</p> : <video src={adminApi.media("generation", row.id)} controls playsInline preload="metadata" onError={() => setFailed(true)} className="max-h-[65vh] w-full rounded-lg" />}
      </DialogContent>
    </Dialog>
  </>;
}
function Customer({ row, ar }: { row: AdminGenerationSummary; ar: boolean }) {
  const name = row.customer.name || (ar ? "عميل غير متاح" : "Customer unavailable");
  return <div className="min-w-0 break-words">{row.customer.id ? <Link className="font-medium hover:underline" to={`/admin/customers/${row.customer.id}?tab=generations`}>{name}</Link> : name}<span className="mt-1 block text-xs text-muted-foreground" dir="auto">{row.customer.email}</span></div>;
}
const date = (value: string | null, ar: boolean) => value ? new Date(value).toLocaleString(ar ? "ar-KW-u-nu-latn" : "en-KW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" }) : ar ? "غير متاح" : "Unavailable";
export default function AdminGenerations({ id }: { id?: string }) {
  return id ? <GenerationDetail id={id} /> : <GenerationList />;
}
function GenerationList() {
  const { locale } = useLanguage(); const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (search !== urlSearch) change("search", search); }, 300);
    return () => clearTimeout(timer);
    // change only reads the current params, which are listed through urlSearch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch]);
  const query = useQuery({
    queryKey: ["admin", "generation-history", params.toString()],
    queryFn: () => adminApi.generations(params),
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
  function change(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete("page"); setParams(next, { replace: true }); }
  const from = useMemo(() => ({ pathname: location.pathname, search: location.search }), [location.pathname, location.search]);
  const columns = useMemo<AdminColumn<AdminGenerationSummary>[]>(() => [
    { key: "result", label: t("Video", "الفيديو"), render: row => <div className="flex items-center gap-3">
      <VideoResult row={row} ar={ar} />
      <span className="min-w-0"><span className="admin-cell-title" dir="auto">{row.campaign.name || t("Untitled campaign", "حملة بدون عنوان")}</span><span className="admin-cell-sub" dir="auto">{row.template.name[ar ? "ar" : "en"]}</span></span>
    </div> },
    { key: "customer", label: t("Customer", "العميل"), render: row => <Customer row={row} ar={ar} /> },
    { key: "status", label: t("Status", "الحالة"), width: "130px", render: row => <StatusBadge value={row.status} /> },
    { key: "time", label: t("Time taken", "الوقت المستغرق"), width: "130px", render: row => generationTime(row, ar) },
    { key: "date", label: t("Created", "تاريخ الإنشاء"), width: "180px", render: row => date(row.createdAt, ar) },
  ], [ar]); // eslint-disable-line react-hooks/exhaustive-deps
  const templates = query.data?.templates ?? [];
  return <div className="admin-stack">
    <div className="admin-toolbar !mb-0">
      <div className="admin-search"><Search aria-hidden="true" /><Input aria-label={t("Customer or campaign", "العميل أو الحملة")} placeholder={t("Search customer or campaign", "ابحث عن عميل أو حملة")} value={search} onChange={event => setSearch(event.target.value)} /></div>
      <select className="admin-select" aria-label={t("Status", "الحالة")} value={params.get("status") ?? ""} onChange={event => change("status", event.target.value)}>
        {["", "queued", "processing", "completed", "failed", "cancelled"].map(value => <option key={value} value={value}>{value ? adminEnum(value, "status", ar) : t("All statuses", "كل الحالات")}</option>)}
      </select>
      <select className="admin-select" aria-label={t("Template", "القالب")} value={params.get("templateId") ?? ""} onChange={event => change("templateId", event.target.value)}>
        <option value="">{t("All templates", "كل القوالب")}</option>
        {templates.map(template => <option key={template.id} value={template.id}>{template.name[ar ? "ar" : "en"]}</option>)}
      </select>
    </div>
    {params.get("userId") && <p className="admin-hint">{t("Filtered by customer", "تصفية حسب العميل")} <button type="button" className="admin-link" onClick={() => change("userId", "")}>{t("Clear filter", "إزالة التصفية")}</button></p>}
    {query.isPending ? <Loading /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <div>
      <AdminTable
        rows={query.data.items}
        columns={columns}
        rowHref={row => withReturnTo(`/admin/generations/${row.id}`, from)}
        rowLabel={row => `${t("Open generation", "فتح التوليد")} ${row.campaign.name ?? ""}`}
        empty={t("No generations found", "لا توجد عمليات توليد")}
        emptyHint={t("Try adjusting your search or filters", "جرّب تغيير البحث أو المرشحات")}
      />
      <AdminPagination page={Number(query.data.page)} total={Number(query.data.total)} ar={ar} onPage={page => { const next = new URLSearchParams(params); next.set("page", String(page)); setParams(next); }} />
    </div>}
    <p className="admin-hint">{t("Time includes waiting in the queue. Dates use Kuwait time.", "يشمل الوقت الانتظار في قائمة المعالجة. التواريخ بتوقيت الكويت.")}</p>
  </div>;
}
function GenerationDetail({ id }: { id: string }) {
  const { locale } = useLanguage(); const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const location = useLocation();
  const query = useQuery({ queryKey: ["admin", "generation-history", id], queryFn: () => adminApi.generation(id), refetchInterval: 60_000, refetchIntervalInBackground: false });
  if (query.isPending) return <Loading variant="detail" />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const row = query.data;
  return <>
    <AdminPageHeader
      back={{ fallback: "/admin/generations", label: t("Back to generations", "العودة إلى عمليات التوليد") }}
      title={<span dir="auto">{row.campaign.name || t("Untitled campaign", "حملة بدون عنوان")}</span>}
      meta={<><StatusBadge value={row.status} /><span dir="auto">{row.template.name[ar ? "ar" : "en"]}</span></>}
      actions={row.campaign.id ? <Button variant="outline" asChild><Link to={withReturnTo(`/admin/campaigns/${row.campaign.id}`, location)}>{t("Open campaign", "فتح الحملة")}</Link></Button> : undefined}
    />
    <div className="admin-template-layout">
      <AdminCard><VideoResult row={row} ar={ar} large />{!row.mediaAvailable && <p className="admin-hint mt-2">{t("No completed video for this generation.", "لا يوجد فيديو مكتمل لهذا التوليد.")}</p>}</AdminCard>
      <div className="admin-stack">
        <AdminCard title={t("Details", "التفاصيل")}>
          <AdminFacts items={[
            { label: t("Customer", "العميل"), value: <Customer row={row} ar={ar} /> },
            { label: t("Time taken", "الوقت المستغرق"), value: generationTime(row, ar) },
            { label: t("Created", "تاريخ الإنشاء"), value: date(row.createdAt, ar) },
            { label: t("Finished", "اكتمل"), value: date(row.finishedAt, ar) || "—" },
          ]} />
        </AdminCard>
        {row.failure && <AdminCard title={t("What went wrong", "ما الذي حدث")}><p className="text-sm">{row.failure[ar ? "ar" : "en"]}</p></AdminCard>}
      </div>
    </div>
  </>;
}
