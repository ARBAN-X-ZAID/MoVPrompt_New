import { invalidateAdminData } from "./adminQueries";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { useAdminActions } from "./useAdminActions";
import { AdminForm, type AdminFormField } from "./AdminForm";
export default function AdminCreateAction({ resource }: { resource: string }) {
  const { run, form, setForm, ar, reason, client } = useAdminActions();
  const navigate = useNavigate();
  function open() {
    const customer: AdminFormField = {
      name: "userId",
      label: ar ? "معرّف العميل" : "Customer ID",
      required: true,
    };
    if (resource === "financial-requests") {
      setForm({
        title: ar ? "طلب تعديل الرصيد" : "Request credit adjustment",
        description: ar
          ? "يُسجل الطلب أولاً. راجع أثره ثم وافق عليه من صفحة الطلب."
          : "Record the request first. Review its impact and approve it from the request detail page.",
        fields: [
          customer,
          {
            name: "delta",
            label: ar ? "تغيير الرصيد" : "Credit change",
            type: "number",
            required: true,
            hint: ar
              ? "قيمة موجبة للإضافة وسالبة للخصم"
              : "Positive to grant, negative to deduct",
          },
          reason,
        ],
        submit: async (values, key) => {
          const result = await adminApi.mutate(
            "finance/requests",
            { kind: "credit-adjustment", ...values },
            key,
          );
          invalidateAdminData(client);
          navigate(`/admin/financial-requests/${result.id}`);
        },
      });
    }
    if (resource === "support")
      setForm({
        title: ar ? "فتح حالة دعم" : "Open support case",
        description: ar
          ? "اربط الحالة بالعميل ثم أضف التفاصيل"
          : "Link the case to a customer and record the issue",
        fields: [
          customer,
          {
            name: "subject",
            label: ar ? "الموضوع" : "Subject",
            required: true,
          },
          {
            name: "category",
            label: ar ? "الفئة" : "Category",
            type: "select",
            value: "generation",
            options: [
              "payment",
              "credits",
              "generation",
              "assets",
              "account",
            ].map((value) => ({ value, label: value })),
          },
          {
            name: "message",
            label: ar ? "ملاحظة أولية خاصة" : "Initial private note",
            type: "textarea",
            required: true,
          },
        ],
        submit: async (values, key) => {
          const result = await adminApi.mutate("support", values, key);
          invalidateAdminData(client);
          navigate(`/admin/support/${result.id}`);
        },
      });
    if (resource === "moderation")
      run(ar ? "فتح مراجعة" : "Open moderation review", "moderation", [
        customer,
        {
          name: "category",
          label: ar ? "الفئة" : "Category",
          type: "select",
          value: "reported-media",
          options: [
            "reported-media",
            "permission-dispute",
            "abuse",
            "suspicious-payment",
            "clinic-review",
          ].map((value) => ({ value, label: value })),
        },
      ]);
    if (resource === "reports")
      setForm({
        title: ar ? "تصدير تقرير" : "Export report",
        description: ar
          ? "تصدير خاص بحد أقصى ١٠ آلاف سجل ولمدة لا تتجاوز سنة"
          : "Private export, limited to 10,000 rows and a range of up to one year",
        fields: [
          {
            name: "report",
            label: ar ? "التقرير" : "Report",
            type: "select",
            value: "payments",
            options: [
              "customers",
              "generations",
              "payments",
              "credits",
              "assets",
              "support",
              "audit",
            ].map((value) => ({ value, label: value })),
          },
          {
            name: "from",
            label: ar ? "من" : "From",
            type: "datetime-local",
            required: true,
          },
          {
            name: "to",
            label: ar ? "إلى" : "To",
            type: "datetime-local",
            required: true,
          },
          reason,
        ],
        submit: async (values, key) => {
          await adminApi.mutate(
            "reports",
            {
              ...values,
              from: new Date(String(values.from)).toISOString(),
              to: new Date(String(values.to)).toISOString(),
            },
            key,
          );
          invalidateAdminData(client);
        },
      });
  }
  if (
    !["financial-requests", "support", "moderation", "reports"].includes(
      resource,
    )
  )
    return null;
  return (
    <>
      <Button onClick={open}>
        <Plus className="me-2 h-4 w-4" />
        {resource === "reports"
          ? ar
            ? "تصدير"
            : "Export"
          : ar
            ? "إنشاء"
            : "Create"}
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
    </>
  );
}
