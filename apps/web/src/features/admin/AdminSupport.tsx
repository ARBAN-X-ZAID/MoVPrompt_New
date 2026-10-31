import { invalidateAdminData } from "./adminQueries";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { object } from "./adminData";
import { Loading, ErrorState } from "./AdminDisplay";
import { SupportReply, SupportAttachments } from "./SupportReply";
import { AdminForm } from "./AdminForm";
import { useAdminActions } from "./useAdminActions";
import { AdminCard, AdminPageHeader, StatusBadge } from "./AdminChrome";
import { withReturnTo } from "./adminNav";
import { adminEnum } from "./labels";

export default function AdminSupport({
  id,
  readOnly,
}: {
  id: string;
  readOnly: boolean;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const location = useLocation();
  const [reply, setReply] = useState(false);
  const { form, setForm, notice, client } = useAdminActions();
  const query = useQuery({
    queryKey: ["admin", "support", id],
    queryFn: () => adminApi.get(`support/${id}`),
  });
  const row = object(query.data?.record),
    related = object(query.data?.related);
  const customer = useQuery({
    queryKey: ["admin", "customer-summary", row.userId],
    queryFn: () => adminApi.get(`customers/${row.userId}/summary`),
    enabled: Boolean(row.userId),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      <AdminPageHeader
        back={{ fallback: "/admin/support", label: t("Back to support", "العودة للدعم") }}
        title={<span dir="auto">{String(row.subject)}</span>}
        meta={<>
          <StatusBadge value={row.status} />
          <span>{t("Opened", "تاريخ الفتح")} {new Date(String(row.createdAt)).toLocaleDateString(locale, { dateStyle: "medium" })}</span>
          <span>{t("Updated", "آخر تحديث")} {new Date(String(row.updatedAt ?? row.createdAt)).toLocaleDateString(locale, { dateStyle: "medium" })}</span>
        </>}
        actions={<>
        <Button
          variant="outline"
          disabled={readOnly}
          onClick={() =>
            setForm({
              title: t("Update status", "تحديث الحالة"),
              description: t(
                "Choose the current status of this issue.",
                "اختر الحالة الحالية لهذه المشكلة.",
              ),
              fields: [
                {
                  name: "status",
                  label: t("Status", "الحالة"),
                  type: "select",
                  value: String(row.status),
                  options: [
                    "open",
                    "in-progress",
                    "waiting-customer",
                    "resolved",
                    "closed",
                  ].map((value) => ({
                    value,
                    label: adminEnum(value, "status", ar),
                  })),
                },
              ],
              submit: async (values, key) => {
                await adminApi.mutate(
                  `support/${id}`,
                  {
                    ...values,
                    expectedRevision: row.revision,
                    reason: "Owner updated support case status",
                  },
                  key,
                );
                invalidateAdminData(client);
              },
            })
          }
        >
          {t("Update status", "تحديث الحالة")}
        </Button>
          <Button disabled={readOnly} onClick={() => setReply(true)}>{t("Reply", "رد")}</Button>
        </>}
      />
      {notice && <p role="status" className="admin-hint mb-4">{notice}</p>}
      <div className="admin-grid-2">
        <section className="admin-stack" aria-label={t("Issue and replies", "المشكلة والردود")}>
          {(Array.isArray(related.messages) ? related.messages : []).map(object).map((message) => (
            <article key={String(message.id)} className="admin-card" style={message.visibility === "private" ? { background: "var(--a-surface-2)" } : undefined}>
              <p className="admin-hint mb-2">
                {message.visibility === "private" ? t("Private owner note", "ملاحظة خاصة") : t("Customer conversation", "محادثة العميل")}
                {" · "}{new Date(String(message.createdAt)).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="whitespace-pre-wrap break-words" dir="auto">{String(message.message ?? "")}</p>
              <SupportAttachments attachments={message.attachments} caseId={id} admin ar={ar} />
              {message.emailStatus && <p className="admin-hint mt-2">{adminEnum(String(message.emailStatus), "emailStatus", ar)}</p>}
            </article>
          ))}
        </section>
        <div className="admin-stack">
          {customer.data && <AdminCard title={t("Customer", "العميل")}>
            <Link className="block" to={withReturnTo(`/admin/customers/${row.userId}?tab=support`, location)}>
              <span className="admin-cell-title hover:underline" dir="auto">{String(customer.data.name)}</span>
              <span className="admin-cell-sub break-all" dir="auto">{String(customer.data.email)}</span>
            </Link>
          </AdminCard>}
          {(row.projectId || row.paymentId) && <AdminCard title={t("Related records", "السجلات المرتبطة")}>
            <div className="grid gap-2 text-sm">
              {row.projectId && <Link className="admin-link" to={withReturnTo(`/admin/campaigns/${row.projectId}`, location)}>{t("Related campaign", "الحملة المرتبطة")}</Link>}
              {row.paymentId && <Link className="admin-link" to={withReturnTo(`/admin/payments/${row.paymentId}`, location)}>{t("Related payment", "الدفعة المرتبطة")}</Link>}
            </div>
          </AdminCard>}
        </div>
      </div>
      {form && (
        <AdminForm
          {...form}
          onSubmit={form.submit}
          onClose={() => setForm(null)}
        />
      )}
      {reply && (
        <SupportReply
          caseId={id}
          revision={Number(row.revision)}
          admin
          ar={ar}
          onClose={() => setReply(false)}
        />
      )}
    </>
  );
}
