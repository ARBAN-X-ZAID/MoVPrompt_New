import { generationTime } from "./generationTime";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Play, Video, ArrowLeft } from "lucide-react";
import type { AdminGenerationSummary } from "@movprompt/contracts";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { adminApi } from "./api";
import { AdminTable, AdminPagination } from "./AdminTable";
import { ErrorState, Loading } from "./AdminDisplay";
import { adminEnum } from "./labels";

function VideoResult({ row, ar, large = false }: { row: AdminGenerationSummary; ar: boolean; large?: boolean }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = row.campaign.name || (ar ? "حملة بدون عنوان" : "Untitled campaign");
  return <>
    <button type="button" disabled={!row.mediaAvailable} onClick={() => { setFailed(false); setOpen(true); }}
      className={`${large ? "h-48 w-full" : "h-16 w-24 shrink-0"} relative overflow-hidden rounded-lg border bg-muted flex items-center justify-center disabled:cursor-default`}
      aria-label={row.mediaAvailable ? `${ar ? "مشاهدة" : "Play"} ${title}` : ar ? "لا يوجد فيديو مكتمل" : "No completed video"}>
      {row.mediaAvailable ? <><video src={`${adminApi.media("generation", row.id)}#t=0.1`} preload="metadata" muted playsInline aria-hidden="true" className="h-full w-full object-cover" /><span className="absolute rounded-full bg-black/65 p-2 text-white"><Play className="h-4 w-4" /></span></> : <Video className="h-6 w-6 text-muted-foreground" />}
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
const date = (value: string | null, ar: boolean) => value ? new Date(value).toLocaleString(ar ? "ar-KW" : "en-KW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" }) : ar ? "غير متاح" : "Unavailable";
export default function AdminGenerations({ id }: { id?: string }) {
  return id ? <GenerationDetail id={id} /> : <GenerationList />;
}
function GenerationList() {
  const { locale } = useLanguage(); const ar = locale === "ar";
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [params, setParams] = useSearchParams();
  const query = useQuery({ queryKey: ["admin", "generation-history", params.toString()], queryFn: () => adminApi.generations(params), refetchInterval: 30000, refetchIntervalInBackground: false });
  function change(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== "page") next.delete("page"); setParams(next, { replace: true }); }
  const returnTo = `/admin/generations${params.size ? `?${params}` : ""}`;
  const columns = [
    { key: "result", label: t("Result", "الناتج"), render: (row: AdminGenerationSummary) => <div className="flex items-center gap-3"><VideoResult row={row} ar={ar} /><Link className="font-medium hover:underline" to={`/admin/generations/${row.id}?returnTo=${encodeURIComponent(returnTo)}`}>{row.campaign.name || t("Untitled campaign", "حملة بدون عنوان")}</Link></div> },
    { key: "template", label: t("Template", "القالب"), render: (row: AdminGenerationSummary) => row.template.name[ar ? "ar" : "en"] },
    { key: "customer", label: t("Customer", "العميل"), render: (row: AdminGenerationSummary) => <Customer row={row} ar={ar} /> },
    { key: "status", label: t("Status", "الحالة"), render: (row: AdminGenerationSummary) => <span className="admin-status">{adminEnum(row.status, "status", ar)}</span> },
    { key: "time", label: t("Time taken", "الوقت المستغرق"), render: (row: AdminGenerationSummary) => generationTime(row, ar) },
    { key: "date", label: t("Created", "تاريخ الإنشاء"), render: (row: AdminGenerationSummary) => date(row.createdAt, ar) },
  ];
  return <div className="space-y-5">
    <div className="admin-filter-grid">
      <label className="admin-field md:col-span-2">{t("Customer or campaign", "العميل أو الحملة")}<Input value={params.get("search") ?? ""} onChange={event => change("search", event.target.value)} /></label>
      <label className="admin-field">{t("Status", "الحالة")}<select className="admin-select" value={params.get("status") ?? ""} onChange={event => change("status", event.target.value)}><option value="">{t("All statuses", "كل الحالات")}</option>{["queued", "processing", "completed", "failed", "cancelled"].map(status => <option key={status} value={status}>{adminEnum(status, "status", ar)}</option>)}</select></label>
      <label className="admin-field">{t("Template", "القالب")}<select className="admin-select" value={params.get("templateId") ?? ""} onChange={event => change("templateId", event.target.value)}><option value="">{t("All templates", "كل القوالب")}</option>{query.data?.templates.map(item => <option key={item.id} value={item.id}>{item.name[ar ? "ar" : "en"]}</option>)}</select></label>
    </div>
    {params.get("userId") && <Button variant="outline" onClick={() => change("userId", "")}>{t("Clear customer filter", "إزالة تصفية العميل")}</Button>}
    <p className="text-xs text-muted-foreground">{t("Time includes waiting in the queue. Dates use Kuwait time.", "يشمل الوقت الانتظار في الطابور. التواريخ بتوقيت الكويت.")}</p>
    {query.isPending ? <Loading /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <><AdminTable columns={columns.map(column => ({ ...column, render: row => column.render(row as AdminGenerationSummary) }))} rows={query.data.items} empty={t("No generations found", "لا توجد عمليات توليد")} /><AdminPagination page={query.data.page} total={query.data.total} limit={query.data.limit} ar={ar} onPage={page => change("page", String(page))} /></>}
  </div>;
}
function GenerationDetail({ id }: { id: string }) {
  const { locale } = useLanguage(); const ar = locale === "ar";
  const [params] = useSearchParams();
  const query = useQuery({ queryKey: ["admin", "generation-history", id], queryFn: () => adminApi.generation(id), refetchInterval: 30000, refetchIntervalInBackground: false });
  if (query.isPending) return <Loading variant="detail" />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const row = query.data;
  const requested = params.get("returnTo") ?? "";
  const back = /^\/admin\/(generations|customers)(\/|\?|$)/.test(requested) ? requested : "/admin/generations";
  return <div className="space-y-6">
    <Link className="inline-flex items-center gap-2 text-sm hover:underline" to={back}><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{ar ? "العودة للسجلات" : "Back to records"}</Link>
    <section className="admin-panel grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div><h2 className="mb-4 text-xl font-semibold">{row.campaign.name || (ar ? "حملة بدون عنوان" : "Untitled campaign")}</h2><VideoResult row={row} ar={ar} large />{!row.mediaAvailable && <p className="mt-3 text-sm text-muted-foreground">{ar ? "لا يوجد فيديو مكتمل متاح لهذه المحاولة." : "No completed video is available for this generation."}</p>}</div>
      <dl className="space-y-5">
        {[[ar ? "القالب" : "Template", row.template.name[ar ? "ar" : "en"]], [ar ? "الحالة" : "Status", adminEnum(row.status, "status", ar)], [ar ? "الوقت المستغرق" : "Time taken", generationTime(row, ar)], [ar ? "تاريخ الإنشاء" : "Created", date(row.createdAt, ar)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}
        <div><dt className="mb-1 text-xs text-muted-foreground">{ar ? "العميل" : "Customer"}</dt><dd><Customer row={row} ar={ar} /></dd></div>
        {row.campaign.id && <Link className="inline-block text-sm underline" to={`/admin/campaigns/${row.campaign.id}`}>{ar ? "فتح الحملة" : "Open campaign"}</Link>}
      </dl>
    </section>
    {row.failure && <p className="admin-panel text-sm">{row.failure[ar ? "ar" : "en"]}</p>}
  </div>;
}
