import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { object } from "./adminData";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
export default function AdminOverview() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [params, setParams] = useSearchParams();
  const days = params.get("days") ?? "30";
  const query = useQuery({
    queryKey: ["admin", "overview", days],
    queryFn: () => adminApi.get(`overview?days=${days}`),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
  const names: Record<string, [string, string]> = {
    newCustomers: ["New customers", "عملاء جدد"],
    activeCustomers: ["Active customers", "العملاء النشطون"],
    cashCollectedMinor: ["Cash collected", "المبالغ المحصلة"],
    cashRefundedMinor: ["Cash refunded", "المبالغ المستردة"],
    outstandingCredits: [
      "Outstanding credits · all time",
      "الأرصدة القائمة · كل الوقت",
    ],
    openCases: [
      "Open support cases · current",
      "حالات الدعم المفتوحة · حالياً",
    ],
    pendingPayments: [
      "Pending payments · current",
      "المدفوعات المعلقة · حالياً",
    ],
    failedPayments: ["Failed payments", "المدفوعات الفاشلة"],
    "runs.queued": ["Queued generations", "فيديوهات في الانتظار"],
    "runs.processing": ["Processing", "قيد المعالجة"],
    "runs.completed": ["Completed", "مكتمل"],
    "runs.failed": ["Failed generations", "فيديوهات فاشلة"],
    "runs.cancelled": ["Cancelled", "ملغى"],
  };
  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {ar
            ? "الأرقام من السجلات الفعلية للنظام"
            : "Figures from the system’s canonical records"}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">{ar ? "الفترة" : "Time range"}</span>
          <select
            className="admin-select w-auto"
            value={days}
            onChange={(event) => setParams({ days: event.target.value })}
          >
            {[7, 30, 90].map((value) => (
              <option key={value} value={value}>
                {ar ? `آخر ${value} يوماً` : `Last ${value} days`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(object(query.data.metrics)).map(([key, raw]) => {
              const metric = object(raw);
              const money = key.endsWith("Minor");
              const count =
                metric.status === "unavailable"
                  ? ar
                    ? "غير متاح"
                    : "Unavailable"
                  : money
                    ? `${(Number(metric.value) / 1000).toFixed(3)} KWD`
                    : Number(metric.value).toLocaleString(
                        ar ? "ar-KW" : "en-KW",
                      );
              return (
                <article key={key} className="admin-metric">
                  <h2 className="text-xs font-medium text-muted-foreground">
                    {names[key]?.[ar ? 1 : 0] ?? key}
                  </h2>
                  <p
                    className="mt-3 text-2xl font-semibold tabular-nums"
                    dir="auto"
                  >
                    {count}
                  </p>
                  <details className="mt-3 text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer">
                      {ar ? "المصدر والتحديث" : "Source & freshness"}
                    </summary>
                    <p className="mt-2 break-all">{String(metric.source)}</p>
                    <DataValue
                      value={{
                        from: metric.from,
                        to: metric.to,
                        updatedAt: metric.evaluatedAt,
                      }}
                      ar={ar}
                    />
                  </details>
                </article>
              );
            })}
          </div>
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {[
              ["duration", ar ? "وقت المعالجة" : "Processing time"],
              ["failures", ar ? "أسباب الفشل" : "Failure reasons"],
              ["heartbeats", ar ? "حالة المعالجة" : "Worker heartbeats"],
              ["providerCosts", ar ? "تكاليف المزود" : "Provider spending"],
            ].map(([key, name]) => (
              <section key={key} className="admin-panel">
                <h2 className="mb-5 font-medium">{name}</h2>
                <DataValue value={query.data[key!]} ar={ar} />
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
