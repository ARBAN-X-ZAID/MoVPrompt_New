import { Link, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { formatCount, formatKwd, object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard, AdminEmpty } from "./AdminChrome";
import { BarList, CashChart, DailyTable, VideoCharts, type OverviewDay } from "./OverviewCharts";

const COUNTS: { key: string; en: string; ar: string; to: string }[] = [
  { key: "newCustomers", en: "New customers", ar: "عملاء جدد", to: "/admin/customers" },
  { key: "activeCustomers", en: "Active customers", ar: "العملاء النشطون", to: "/admin/customers?status=active" },
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
  const daily = (query.data?.daily as OverviewDay[] | undefined) ?? [];
  const metrics = object(query.data?.metrics);
  const unavailable = ar ? "غير متاح" : "Unavailable";
  const cash = object(metrics.cashCollectedMinor);
  const hasVideos = daily.some(day => day.completed || day.failed || day.active || day.cancelled);
  return <div className="admin-stack">
    <div className="admin-segment w-fit" role="group" aria-label={ar ? "الفترة" : "Time range"}>
      {[7, 30, 90].map(value => <button key={value} type="button" aria-pressed={days === String(value)} onClick={() => setParams({ days: String(value) })}>
        {ar ? `${value} يوماً` : `${value} days`}
      </button>)}
    </div>
    {query.isPending ? <Loading variant="metrics" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
      <AdminCard title={ar ? "الفيديوهات" : "Videos"} description={ar ? "حسب يوم الإنشاء بتوقيت الكويت" : "By creation day, Kuwait time"}>
        {hasVideos ? <VideoCharts days={daily} ar={ar} /> : <AdminEmpty title={ar ? "لا توجد فيديوهات خلال هذه الفترة" : "No videos during this period"} />}
      </AdminCard>
      <div className="admin-chart-row">
        <AdminCard title={ar ? "المبالغ المحصلة" : "Cash collected"} description={ar ? "خلال الفترة المحددة" : "During this period"} actions={<Link className="admin-link text-sm" to="/admin/payments">{ar ? "عرض المدفوعات" : "View payments"}</Link>}>
          <p className="admin-chart-figure" dir="auto">{cash.status === "unavailable" ? unavailable : formatKwd(cash.value)}</p>
          {cash.status !== "unavailable" && <CashChart days={daily} ar={ar} />}
        </AdminCard>
        <AdminCard title={ar ? "العملاء والدعم" : "Customers and support"} description={ar ? "الحالات المفتوحة حالياً" : "Support shows cases open now"}>
          <BarList items={COUNTS.map(item => {
            const raw = object(metrics[item.key]);
            const value = raw.status === "unavailable" ? null : Number(raw.value ?? 0);
            return { label: ar ? item.ar : item.en, value, display: value === null ? unavailable : formatCount(value, ar), to: item.to };
          })} />
        </AdminCard>
        <AdminCard title={ar ? "أسباب الفشل" : "Failure reasons"} description={ar ? "خلال الفترة المحددة" : "During this period"}>
          {failures.length ? <BarList tone="failed" items={failures.map(failure => ({
            label: String(failure.id ?? failure._id ?? (ar ? "سبب غير معروف" : "Unknown reason")).replaceAll("_", " "),
            value: Number(failure.count),
            display: formatCount(Number(failure.count), ar),
          }))} /> : <p className="admin-hint">{ar ? "لا توجد أخطاء خلال هذه الفترة" : "No failures during this period"}</p>}
        </AdminCard>
      </div>
      <DailyTable days={daily} ar={ar} />
    </>}
  </div>;
}
