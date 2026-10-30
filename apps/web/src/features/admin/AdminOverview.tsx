import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
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
        <Loading variant="metrics" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="mb-4 text-xs text-muted-foreground">
            {ar ? "آخر تحديث" : "Updated"}{" "}
            {new Date(query.dataUpdatedAt).toLocaleTimeString(locale)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(object(query.data.metrics))
              .filter(([key]) =>
                [
                  "newCustomers",
                  "activeCustomers",
                  "cashCollectedMinor",
                  "runs.completed",
                  "runs.failed",
                  "openCases",
                ].includes(key),
              )
              .map(([key, raw]) => {
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
                  </article>
                );
              })}
          </div>
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {[
              ["duration", ar ? "وقت المعالجة" : "Processing time"],
              ["failures", ar ? "أسباب الفشل" : "Failure reasons"],
            ].map(([key, name]) => (
              <section key={key} className="admin-panel">
                <h2 className="mb-5 font-medium">{name}</h2>
                {key === "duration" ? (
                  <div>
                    <p className="text-3xl font-semibold tabular-nums">
                      {object(query.data.duration).meanMs == null
                        ? ar
                          ? "غير متاح"
                          : "Unavailable"
                        : `${Math.round(Number(object(query.data.duration).meanMs) / 1000)} ${ar ? "ثانية" : "seconds"}`}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {ar
                        ? "متوسط وقت معالجة الفيديوهات المكتملة"
                        : "Average processing time for completed videos"}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {(
                      (query.data.failures as Record<string, unknown>[]) ?? []
                    ).map((failure, index) => (
                      <li
                        key={index}
                        className="flex justify-between gap-3 text-sm"
                      >
                        <span>
                          {String(
                            failure.id ??
                              failure._id ??
                              (ar ? "سبب غير معروف" : "Unknown reason"),
                          ).replaceAll("_", " ")}
                        </span>
                        <strong>{String(failure.count)}</strong>
                      </li>
                    ))}
                    {!(query.data.failures as unknown[])?.length && (
                      <li className="text-sm text-muted-foreground">
                        {ar
                          ? "لا توجد أخطاء خلال هذه الفترة"
                          : "No failures during this period"}
                      </li>
                    )}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
