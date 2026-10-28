import { SystemPanel } from "./SystemPanel";
import { MigrationPanel } from "./MigrationPanel";
import { RetentionPanel } from "./RetentionPanel";
import { OwnerSecurity } from "./OwnerSecurity";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
import { useAdminActions } from "./useAdminActions";
import { AdminForm } from "./AdminForm";
export default function AdminSettings() {
  const { run, form, setForm, ar } = useAdminActions();
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => adminApi.get("settings"),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <SystemPanel />
      <RetentionPanel />
      <section className="admin-panel max-w-3xl mt-6">
        <p className="mb-6 text-sm leading-6 text-muted-foreground">
          {ar
            ? "إيقاف الطلبات الجديدة لا يوقف إشعارات الدفع أو التسويات أو استعادة النتائج الحالية."
            : "Pausing new submissions keeps payment webhooks, reconciliation and existing output recovery running."}
        </p>
        <p className="mb-5 text-xs text-muted-foreground">
          {ar
            ? "طلبات المعاينة والاستعادة الممولة تستخدم ميزانية منفصلة بالدولار، واعتماداً مسجلاً من المالك. لا يجيز هذا الإعداد وحده الإنفاق."
            : "Funded preview and recovery requests use a separate reviewed USD budget and recorded owner approval. This setting alone cannot authorize spending."}
        </p>
        <DataValue
          value={Object.fromEntries(
            Object.entries(query.data).filter(
              ([key]) => key !== "dailyRecoveryBudgetMinor",
            ),
          )}
          ar={ar}
        />
        <Button
          className="mt-6"
          onClick={() =>
            run(
              ar ? "تحديث الضوابط التشغيلية" : "Update operational controls",
              "settings",
              [
                {
                  name: "pauseGeneration",
                  label: ar
                    ? "إيقاف إنشاء فيديوهات جديدة"
                    : "Pause new generations",
                  type: "checkbox",
                  value: Boolean(query.data.pauseGeneration),
                },
                {
                  name: "pauseCinematic",
                  label: ar
                    ? "إيقاف الفيديو السينمائي"
                    : "Pause cinematic video",
                  type: "checkbox",
                  value:
                    Array.isArray(query.data.pausedCapabilities) &&
                    query.data.pausedCapabilities.includes("video.cinematic"),
                },
                {
                  name: "pauseProduct",
                  label: ar
                    ? "إيقاف فيديو دقة المنتج"
                    : "Pause product-fidelity video",
                  type: "checkbox",
                  value:
                    Array.isArray(query.data.pausedCapabilities) &&
                    query.data.pausedCapabilities.includes(
                      "video.product_fidelity",
                    ),
                },
                {
                  name: "pauseSpeech",
                  label: ar
                    ? "إيقاف فيديوهات الشخصيات الناطقة"
                    : "Pause speaking UGC / Adstudio",
                  type: "checkbox",
                  value:
                    Array.isArray(query.data.pausedCapabilities) &&
                    query.data.pausedCapabilities.includes("presenter.ai_ugc"),
                },
                {
                  name: "maintenanceEn",
                  label: "Maintenance notice · English",
                  type: "textarea",
                  value: String(
                    (query.data.maintenanceMessage as Record<string, unknown>)
                      ?.en ?? "",
                  ),
                  required: false,
                },
                {
                  name: "maintenanceAr",
                  label: "إشعار الصيانة · العربية",
                  type: "textarea",
                  value: String(
                    (query.data.maintenanceMessage as Record<string, unknown>)
                      ?.ar ?? "",
                  ),
                  required: false,
                },
              ],
              {
                expectedRevision: query.data.revision,
                dailyRecoveryBudgetMinor:
                  query.data.dailyRecoveryBudgetMinor ?? 0,
                pausedCapabilities: query.data.pausedCapabilities,
                maintenanceMessage: query.data.maintenanceMessage,
              },
            )
          }
        >
          {ar ? "تعديل الضوابط" : "Edit controls"}
        </Button>
        {form && (
          <AdminForm
            title={form.title}
            description={form.description}
            fields={form.fields}
            onSubmit={async (values, key) => {
              const {
                pauseCinematic,
                pauseProduct,
                pauseSpeech,
                maintenanceEn,
                maintenanceAr,
                ...rest
              } = values;
              return form.submit(
                {
                  ...rest,
                  pausedCapabilities: [
                    ...(pauseCinematic ? ["video.cinematic"] : []),
                    ...(pauseProduct ? ["video.product_fidelity"] : []),
                    ...(pauseSpeech ? ["presenter.ai_ugc"] : []),
                  ],
                  maintenanceMessage: {
                    en: maintenanceEn ?? "",
                    ar: maintenanceAr ?? "",
                  },
                },
                key,
              );
            }}
            onClose={() => setForm(null)}
          />
        )}
      </section>
      <OwnerSecurity />
      <MigrationPanel />
    </>
  );
}
