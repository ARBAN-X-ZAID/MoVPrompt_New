import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { object } from "./adminData";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
import { useAdminActions } from "./useAdminActions";
import { AdminForm } from "./AdminForm";
export function RetentionPanel() {
  const { ar, run, form, setForm } = useAdminActions();
  const query = useQuery({
    queryKey: ["admin", "retention"],
    queryFn: () => adminApi.get("retention"),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const policy = object(query.data.policy);
  return (
    <section className="admin-panel mt-6 space-y-4">
      <h2 className="font-semibold">
        {ar
          ? "الاحتفاظ والمهملات ومحو الحسابات"
          : "Retention, trash and account erasure"}
      </h2>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "تبقى الوسائط المحذوفة قابلة للاستعادة لمدة ٣٠ يوماً. قبل أي تنظيف دائم يفحص العامل المراجع والنسخ المستقلة والعمليات النشطة. محو الحساب إجراء منفصل يحتاج إلى مراجعة الرصيد والنزاعات وفترة الاستعادة وبصمة البيانات."
          : "Deleted media remains recoverable for 30 days. Permanent cleanup checks references, independent copies and active operations. Account erasure separately requires review of balances, disputes, recovery grace and the exact data snapshot."}
      </p>
      <p role="status" className="rounded border p-3 text-sm">
        {policy.enabled === true
          ? ar
            ? "التنفيذ مفعل وفق نسخة السياسة المعروضة. لا توجد إزالة تلقائية للسجلات المالية أو سجل التدقيق."
            : "Execution is enabled under the displayed policy version. Financial and audit records are not automatically removed."
          : ar
            ? "التنفيذ الدائم معطل. لا توجد سياسة احتفاظ معتمدة ومفعلة بعد. المسح التالي يعد قائمة للمراجعة فقط."
            : "Permanent execution is disabled. No reviewed retention policy is enabled yet. The next scan prepares a review inventory only."}
      </p>
      <DataValue value={query.data} ar={ar} />
      <Button
        variant="outline"
        onClick={() =>
          run(
            policy.enabled === true
              ? ar
                ? "مسح وجدولة التنظيف المؤهل"
                : "Scan and queue eligible cleanup"
              : ar
                ? "إعداد قائمة مراجعة الاحتفاظ"
                : "Prepare retention inventory",
            "retention/scan",
            [],
            {},
            policy.enabled === true
              ? ar
                ? "قد يزيل العامل الملفات المؤهلة بشكل دائم وفق السياسة المعتمدة، بعد مدة الاستعادة وفحص المراجع. تبقى الملفات المرتبطة محفوظة."
                : "The worker may permanently remove eligible files under the approved policy after the recovery period and reference checks. Referenced files remain retained."
              : ar
                ? "لا يزيل هذا المسح أي ملفات بشكل دائم ما دام التنفيذ معطلاً."
                : "This scan does not permanently remove files while execution is disabled.",
          )
        }
      >
        {policy.enabled === true
          ? ar
            ? "مسح وجدولة التنظيف المؤهل"
            : "Scan and queue eligible cleanup"
          : ar
            ? "إعداد قائمة المراجعة"
            : "Prepare review inventory"}
      </Button>
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
