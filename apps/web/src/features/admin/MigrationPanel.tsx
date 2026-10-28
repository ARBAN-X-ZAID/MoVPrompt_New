import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { object } from "./adminData";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
import { useAdminActions } from "./useAdminActions";
import { AdminForm } from "./AdminForm";
export function MigrationPanel() {
  const { ar, run, form, setForm } = useAdminActions();
  const query = useQuery({
    queryKey: ["admin", "migration"],
    queryFn: () => adminApi.get("migration/status"),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const jobs = (Array.isArray(query.data.jobs) ? query.data.jobs : []).map(
    object,
  );
  return (
    <section
      className="admin-panel mt-6"
      aria-labelledby="admin-migration-heading"
    >
      <h2 id="admin-migration-heading" className="text-xl font-semibold">
        {ar ? "مراجعة البيانات التاريخية" : "Historical data review"}
      </h2>
      <p className="my-3 text-sm text-muted-foreground">
        {ar
          ? "افحص ٥٠ محفظة في كل دفعة. التسوية تنشئ سجلات المصدر فقط ولا تعدّل الأرصدة أو الفيديوهات المقبولة. راجع كل اختلاف."
          : "Inspect up to 50 wallets per batch. Reconciliation builds provenance records without changing balances or accepted videos. Discrepancies require review."}
      </p>
      <Button
        variant="outline"
        onClick={() =>
          run(ar ? "فحص المحافظ" : "Inspect wallets", "migration/scan", [])
        }
      >
        {ar ? "بدء فحص للقراءة فقط" : "Start read-only inventory"}
      </Button>
      <div className="mt-5 space-y-4">
        {jobs.map((job) => (
          <article
            key={String(job.id)}
            className="min-w-0 rounded-xl border p-4"
          >
            <DataValue
              value={{
                kind: job.kind,
                status: job.status,
                createdAt: job.createdAt,
                items: job.items,
                outcomes: job.outcomes,
                failureCode: job.failureCode,
              }}
              ar={ar}
            />
            {job.kind === "migration.scan" && job.status === "completed" && (
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  disabled={
                    new Date(String(job.expiresAt)).getTime() <= Date.now()
                  }
                  onClick={() =>
                    run(
                      ar ? "تسوية الدفعة المراجعة" : "Reconcile reviewed batch",
                      "migration/reconcile",
                      [],
                      { scanId: job.id, fingerprint: job.fingerprint },
                      ar
                        ? "تُعاد مقارنة البيانات قبل كل تعديل. البنود التي تغيّرت تحتاج فحصاً جديداً."
                        : "Sources are checked again before each write. Changed records require a fresh inventory.",
                    )
                  }
                >
                  {ar
                    ? "اعتماد تسوية المصدر"
                    : "Approve provenance reconciliation"}
                </Button>
                {job.nextCursor && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      run(
                        ar ? "فحص الدفعة التالية" : "Inspect next batch",
                        "migration/scan",
                        [],
                        { afterId: job.nextCursor },
                      )
                    }
                  >
                    {ar ? "الدفعة التالية" : "Next batch"}
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        {ar
          ? "إيقاف الخدمات القديمة في الإنتاج يحتاج تحققاً مستقلاً قبل الإطلاق."
          : "Disabling legacy services in production needs independent cutover verification before release."}
      </p>
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
