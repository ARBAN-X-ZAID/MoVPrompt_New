import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import type { RecordData } from "./adminData";
import type { AdminFormField } from "./AdminForm";
type FormState = {
  title: string;
  description: string;
  fields: AdminFormField[];
  submitLabel?: string;
  submit: (values: RecordData, key: string) => Promise<unknown>;
};
export function useAdminActions() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const client = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [notice, setNotice] = useState("");
  const reason: AdminFormField = {
    name: "reason",
    label: ar ? "سبب الإجراء" : "Reason for this action",
    type: "textarea",
    required: true,
    hint: ar
      ? "٨ أحرف على الأقل، تُحفظ في سجل التدقيق"
      : "At least 8 characters, recorded in the audit trail",
  };
  const run = (
    title: string,
    path: string,
    fields: AdminFormField[],
    base: RecordData = {},
    description?: string,
  ) =>
    setForm({
      title,
      description:
        description ??
        (ar
          ? "راجع المعلومات قبل التأكيد. يُسجل هذا الإجراء باسم المالك."
          : "Review the details before confirming. This action is recorded under your owner account."),
      fields: [...fields, reason],
      submit: async (values, key) => {
        const result = await adminApi.mutate(path, { ...base, ...values }, key);
        setNotice(
          result.status === "queued"
            ? `${ar ? "تمت إضافة الطلب إلى قائمة المعالجة" : "Request queued for processing"} · ${result.operationId ?? ""}`
            : ar
              ? "تم حفظ الإجراء"
              : "Action saved",
        );
        await client.invalidateQueries({ queryKey: ["admin"] });
        return result;
      },
    });
  return { form, setForm, run, reason, ar, client, notice };
}
