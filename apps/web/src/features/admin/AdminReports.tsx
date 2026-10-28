import { ReportActivityChart } from "./ReportActivityChart";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
import AdminRecordList from "./AdminRecordList";

type Report = {
  status: string;
  source: string;
  scope: string;
  from: string | null;
  to: string;
  updatedAt: string;
  rows: Array<Record<string, unknown>> | null;
};
const names: Record<string, [string, string]> = {
  acquisition: ["New customers", "العملاء الجدد"],
  activation: ["First generation activity", "نشاط التوليد الأول"],
  generationStatus: ["Generation outcomes", "نتائج التوليد"],
  templatePerformance: ["Template version performance", "أداء نسخ القوالب"],
  failureReasons: ["Generation failures", "أسباب فشل التوليد"],
  cashCollections: ["Cash collected · KWD fils", "المبالغ المحصلة · فلس"],
  cashRefunds: [
    "Confirmed cash refunds · KWD fils",
    "المبالغ المستردة المؤكدة · فلس",
  ],
  creditLedger: ["Credit purchases and usage", "مشتريات واستهلاك الرصيد"],
  wallets: ["Current wallet balances", "أرصدة المحافظ الحالية"],
  generationReservations: [
    "Current generation reservations",
    "حجوزات التوليد الحالية",
  ],
  providerCosts: [
    "Provider-reported spending · USD microunits",
    "إنفاق المزود المبلغ · ميكرو دولار",
  ],
  uploadStorage: [
    "Recorded campaign uploads · bytes",
    "الملفات المسجلة للحملات · بايت",
  ],
  libraryStorage: [
    "Independent library objects · bytes",
    "ملفات المكتبة المستقلة · بايت",
  ],
  supportWorkload: ["Support workload", "حجم عمل الدعم"],
  openSupport: ["Currently open support cases", "حالات الدعم المفتوحة حالياً"],
  internalRecovery: [
    "Business-funded recovery requests",
    "طلبات الاستعادة الممولة من الشركة",
  ],
};
export default function AdminReports() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [params, setParams] = useSearchParams();
  const days = params.get("days") ?? "30";
  const query = useQuery({
    queryKey: ["admin", "reports-summary", days],
    queryFn: () => adminApi.get(`reports/summary?days=${days}`),
  });
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {ar
            ? "المشتريات النقدية واستهلاك الرصيد وحدتان منفصلتان. كل تقرير يوضح المصدر والفترة والتغطية."
            : "Cash purchases and credit consumption are separate units. Every report shows its source, period and coverage."}
        </p>
        <label className="text-sm">
          <span className="sr-only">{ar ? "الفترة" : "Time range"}</span>
          <select
            className="admin-select"
            value={days}
            onChange={(event) => setParams({ days: event.target.value })}
          >
            {[7, 30, 90, 365].map((value) => (
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
          <ReportActivityChart
            ar={ar}
            acquisition={
              (query.data.reports as Record<string, Report>).acquisition
                ?.rows ?? []
            }
            activation={
              (query.data.reports as Record<string, Report>).activation?.rows ??
              []
            }
          />
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {Object.entries(query.data.reports as Record<string, Report>).map(
              ([key, report]) => (
                <section
                  className={`admin-panel ${key === "templatePerformance" ? "xl:col-span-2" : ""}`}
                  key={key}
                >
                  <h2 className="font-semibold">
                    {names[key]?.[ar ? 1 : 0] ?? key}
                  </h2>
                  {report.status !== "available" ? (
                    <p className="my-4 text-sm text-muted-foreground">
                      {ar ? "غير متوفر" : "Unavailable"}
                    </p>
                  ) : !report.rows?.length ? (
                    <p className="my-4 text-sm text-muted-foreground">
                      {ar
                        ? "لا توجد سجلات مطابقة لهذه الفترة"
                        : "No matching records in this period"}
                    </p>
                  ) : (
                    <div className="mt-4 max-h-96 overflow-auto">
                      <DataValue value={report.rows} ar={ar} />
                    </div>
                  )}
                  <details className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      {ar ? "المصدر والفترة" : "Source and period"}
                    </summary>
                    <p className="mt-2 break-all" dir="ltr">
                      {report.source}
                    </p>
                    <DataValue
                      value={{
                        scope: report.scope,
                        from: report.from,
                        to: report.to,
                        updatedAt: report.updatedAt,
                      }}
                      ar={ar}
                    />
                  </details>
                </section>
              ),
            )}
          </div>
          <section className="admin-panel text-xs text-muted-foreground">
            <h2 className="mb-4 font-semibold text-foreground">
              {ar ? "أساس التقرير وحدوده" : "Report basis and limits"}
            </h2>
            <DataValue
              value={
                ar
                  ? {
                      cash: "أعداد صحيحة بالفلس الكويتي من الطلبات والمبالغ المستردة المؤكدة. استهلاك الرصيد ليس إيراداً إضافياً.",
                      activation:
                        "أول عملية توليد مسجلة حسب يوم الكويت. لا تمثل معدل تحويل لنفس مجموعة المسجلين.",
                      providerCosts:
                        "ميكرو دولار أمريكي مبلغ من المزود مع توضيح التغطية. العينات الناقصة غير متوفرة ولا تعد مجانية. لا يوجد تحويل للدينار أو ادعاء ربح.",
                      storage:
                        "ملفات الحملة الموثقة وملفات نسخ المكتبة المستقلة. لا يشمل ملفات غير مسجلة أو أحجام نتائج بلا بيانات أو تخزين المزود.",
                    }
                  : query.data.notes
              }
              ar={ar}
            />
          </section>
        </>
      )}
      <section>
        <h2 className="mb-4 text-lg font-semibold">
          {ar ? "ملفات التصدير الخاصة" : "Private report exports"}
        </h2>
        <AdminRecordList resource="reports" />
      </section>
    </div>
  );
}
