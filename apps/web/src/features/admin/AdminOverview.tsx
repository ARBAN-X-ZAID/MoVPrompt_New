import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { formatDuration, formatKwd, object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard } from "./AdminChrome";

const METRICS: { key: string; en: string; ar: string; to: string; money?: boolean }[] = [
  { key: "newCustomers", en: "New customers", ar: "عملاء جدد", to: "/admin/customers" },
  { key: "activeCustomers", en: "Active customers", ar: "العملاء النشطون", to: "/admin/customers?status=active" },
  { key: "cashCollectedMinor", en: "Cash collected", ar: "المبالغ المحصلة", to: "/admin/payments", money: true },
  { key: "runs.completed", en: "Videos completed", ar: "فيديوهات مكتملة", to: "/admin/generations?status=completed" },
  { key: "runs.failed", en: "Videos failed", ar: "فيديوهات فاشلة", to: "/admin/generations?status=failed" },
  { key: "openCases", en: "Open support cases", ar: "حالات الدعم المفتوحة", to: "/admin/support?status=open" },
];

export default function AdminOverview() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [params, setParams] = useSearchParams();
  const days = params.get("days") ?? "30";
  const query = useQuery({
    queryKey: ["admin", "overview", days],
    queryFn: () => adminApi.get(`overview?days=${days}`),
    refetchInterval: 300_000,
    refetchIntervalInBackground: false,
    placeholderData: keepPreviousData,
  });
  const failures = (query.data?.failures as Record<string, unknown>[] | undefined) ?? [];
  const meanMs = object(query.data?.duration).meanMs;
  return <div className="admin-stack">
    <div className="admin-segment w-fit" role="group" aria-label={ar ? "الفترة" : "Time range"}>
      {[7, 30, 90].map(value => <button key={value} type="button" aria-pressed={days === String(value)} onClick={() => setParams({ days: String(value) })}>
        {ar ? `${value} يوماً` : `${value} days`}
      </button>)}
    </div>
    {query.isPending ? <Loading variant="metrics" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
      <div className="admin-metric-grid" data-cols="3">
        {METRICS.map(metric => {
          const raw = object(object(query.data.metrics)[metric.key]);
          const value = raw.status === "unavailable"
            ? ar ? "غير متاح" : "Unavailable"
            : metric.money ? formatKwd(raw.value) : Number(raw.value ?? 0).toLocaleString(ar ? "ar-KW-u-nu-latn" : "en-KW");
          return <Link key={metric.key} to={metric.to} className="admin-metric">
            <span>{ar ? metric.ar : metric.en}</span>
            <strong dir="auto">{value}</strong>
          </Link>;
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title={ar ? "وقت المعالجة" : "Processing time"} description={ar ? "متوسط وقت الفيديوهات المكتملة" : "Average for completed videos"}>
          <p className="text-2xl font-semibold">{meanMs == null ? (ar ? "غير متاح" : "Unavailable") : formatDuration(Number(meanMs) / 1000, ar)}</p>
        </AdminCard>
        <AdminCard title={ar ? "أسباب الفشل" : "Failure reasons"} description={ar ? "خلال الفترة المحددة" : "During this period"}>
          {failures.length ? <ul className="grid gap-2 text-sm">
            {failures.map((failure, index) => <li key={index} className="flex justify-between gap-3">
              <span>{String(failure.id ?? failure._id ?? (ar ? "سبب غير معروف" : "Unknown reason")).replaceAll("_", " ")}</span>
              <strong className="font-semibold">{String(failure.count)}</strong>
            </li>)}
          </ul> : <p className="admin-hint">{ar ? "لا توجد أخطاء خلال هذه الفترة" : "No failures during this period"}</p>}
        </AdminCard>
      </div>
    </>}
  </div>;
}
