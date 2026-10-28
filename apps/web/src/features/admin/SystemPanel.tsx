import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { object } from "./adminData";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
import { useAdminActions } from "./useAdminActions";
import { AdminForm } from "./AdminForm";

const names: Record<string, [string, string]> = {
  "admin-worker": ["Operations worker", "عامل العمليات"],
  "failed-background-jobs": [
    "Failed background jobs",
    "المهام الخلفية الفاشلة",
  ],
  "payment-reconciliation": [
    "Payments awaiting reconciliation",
    "مدفوعات تنتظر التسوية",
  ],
  "credit-provenance": ["Credit reconciliation", "تسوية الأرصدة"],
  "provider-reported-spending": [
    "Provider-reported spending · USD",
    "إنفاق المزوّد المُبلغ عنه · دولار",
  ],
  "backup-recovery": [
    "Production backup and recovery",
    "النسخ الاحتياطي والاستعادة للإنتاج",
  ],
};
export function SystemPanel() {
  const { ar, run, form, setForm } = useAdminActions();
  const query = useQuery({
    queryKey: ["admin", "system"],
    queryFn: () => adminApi.get("system/status"),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const alerts = (
    Array.isArray(query.data.alerts) ? query.data.alerts : []
  ).map(object);
  const checks = (
    Array.isArray(query.data.checks) ? query.data.checks : []
  ).map(object);
  return (
    <section
      className="admin-panel mb-6"
      aria-labelledby="admin-system-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="admin-system-heading" className="text-xl font-semibold">
            {ar ? "حالة النظام والتنبيهات" : "System status and alerts"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {ar
              ? "مصدر كل فحص ووقت تحديثه موضحان أدناه. المراجعة لا تعني حل المشكلة."
              : "Each check shows its source and evaluation time. Reviewing an alert does not resolve the underlying issue."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {ar ? "تحديث" : "Refresh"}
        </Button>
      </div>
      {!checks.length && (
        <p className="py-5 text-sm" role="status">
          {ar
            ? "غير متاح · بانتظار أول فحص من عامل العمليات"
            : "Unavailable · waiting for the first operations-worker check"}
        </p>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {checks.map((check) => {
          const alert = alerts.find(
            (item) => item.key === check.key && item.active,
          );
          return (
            <article
              key={String(check.key)}
              className="min-w-0 rounded-xl border p-4"
            >
              <h3 className="font-medium">
                {names[String(check.key)]?.[ar ? 1 : 0] ?? String(check.key)}
              </h3>
              <p className="my-3 text-sm font-medium">
                {check.state === "healthy"
                  ? ar
                    ? "يعمل ضمن الحدود"
                    : "Within limits"
                  : check.state === "attention"
                    ? ar
                      ? "يتطلب الانتباه"
                      : "Needs attention"
                    : ar
                      ? "غير متاح"
                      : "Unavailable"}
              </p>
              {check.stale === true && (
                <p className="mb-3 text-xs text-muted-foreground">
                  {ar
                    ? "نتيجة قديمة · بانتظار فحص جديد"
                    : "Stale result · waiting for a new worker check"}
                </p>
              )}
              <DataValue
                value={{
                  source: check.source,
                  from: check.from,
                  to: check.to,
                  evaluatedAt: check.evaluatedAt,
                  observed: check.observed,
                  threshold: check.threshold,
                }}
                ar={ar}
              />
              {alert && (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    {alert.reviewedAt
                      ? ar
                        ? "تمت المراجعة · ما زال التنبيه نشطاً"
                        : "Reviewed · alert remains active"
                      : ar
                        ? "لم تتم المراجعة"
                        : "Not reviewed"}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() =>
                      run(
                        ar ? "مراجعة التنبيه" : "Review alert",
                        `system/alerts/${alert.id}/review`,
                        [],
                        { expectedRevision: alert.revision },
                      )
                    }
                  >
                    {ar ? "تسجيل المراجعة" : "Record review"}
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <details className="mt-6 rounded-xl border p-4">
        <summary className="cursor-pointer text-sm">
          {ar
            ? "سياسة النسخ الاحتياطي ودليل الاختبار المحلي"
            : "Backup policy and local drill evidence"}
        </summary>
        <div className="mt-4">
          <DataValue
            value={{
              policy: query.data.backupPolicy,
              localDrill: query.data.lastLocalDrill,
            }}
            ar={ar}
          />
          <p className="mt-4 text-xs text-muted-foreground">
            {ar
              ? "الاختبار المحلي لا يثبت قابلية استعادة الإنتاج."
              : "A local drill does not verify production recoverability."}
          </p>
        </div>
      </details>
      {form && (
        <AdminForm
          title={form.title}
          description={form.description}
          fields={form.fields}
          onSubmit={form.submit}
          onClose={() => setForm(null)}
        />
      )}
    </section>
  );
}
