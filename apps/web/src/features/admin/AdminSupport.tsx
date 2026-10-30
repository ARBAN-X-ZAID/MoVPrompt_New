import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { adminApi } from "./api";
import { object } from "./adminData";
import { Loading, ErrorState } from "./AdminDisplay";
import { SupportReply, SupportAttachments } from "./SupportReply";
import { AdminForm } from "./AdminForm";
import { useAdminActions } from "./useAdminActions";
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
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo");
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
    <div className="space-y-6">
      <Link
        className="admin-back"
        to={
          returnTo?.startsWith("/admin/customers/")
            ? returnTo
            : "/admin/support"
        }
      >
        {returnTo?.startsWith("/admin/customers/") ? t("Back to customer", "العودة للعميل") : t("Back to support", "العودة للدعم")}
      </Link>
      <div className="admin-customer-header">
        <div>
          <h2 className="text-2xl font-semibold">{String(row.subject)}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {t("Submitted", "تم الإرسال")}{" "}
            {new Date(String(row.createdAt)).toLocaleString(locale)} ·{" "}
            {t("Updated", "آخر تحديث")}{" "}
            {new Date(String(row.updatedAt ?? row.createdAt)).toLocaleString(
              locale,
            )}{" "}
            · {adminEnum(String(row.status), "status", ar)}
          </p>
        </div>
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
                await client.invalidateQueries({ queryKey: ["admin"] });
              },
            })
          }
        >
          {t("Update status", "تحديث الحالة")}
        </Button>
      </div>
      {notice && <p role="status">{notice}</p>}
      {customer.data && (
        <Link
          className="admin-panel block"
          to={`/admin/customers/${row.userId}?tab=support`}
        >
          <strong>{String(customer.data.name)}</strong>
          <p className="text-sm text-muted-foreground break-all">
            {String(customer.data.email)}
          </p>
        </Link>
      )}
      <div className="flex flex-wrap gap-3">
        {row.projectId && (
          <Link
            className="admin-link"
            to={`/admin/campaigns/${row.projectId}?returnTo=${encodeURIComponent(`/admin/support/${id}`)}`}
          >
            {t("Related project", "المشروع المرتبط")}
          </Link>
        )}
        {row.paymentId && (
          <Link
            className="admin-link"
            to={`/admin/payments/${row.paymentId}?returnTo=${encodeURIComponent(`/admin/support/${id}`)}`}
          >
            {t("Related payment", "الدفعة المرتبطة")}
          </Link>
        )}
      </div>
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">
            {t("Issue and replies", "المشكلة والردود")}
          </h3>
          <Button disabled={readOnly} onClick={() => setReply(true)}>
            {t("Reply", "رد")}
          </Button>
        </div>
        {(Array.isArray(related.messages) ? related.messages : [])
          .map(object)
          .map((message) => (
            <article
              key={String(message.id)}
              className={`admin-panel ${message.visibility === "private" ? "bg-muted/40" : ""}`}
            >
              <p className="text-xs text-muted-foreground mb-3">
                {message.visibility === "private"
                  ? t("Private owner note", "ملاحظة خاصة")
                  : t("Customer conversation", "محادثة العميل")}{" "}
                · {new Date(String(message.createdAt)).toLocaleString(locale)}
              </p>
              <p className="whitespace-pre-wrap break-words" dir="auto">
                {String(message.message ?? "")}
              </p>
              <SupportAttachments
                attachments={message.attachments}
                caseId={id}
                admin
                ar={ar}
              />
              {message.emailStatus && (
                <p className="text-xs text-muted-foreground mt-3">
                  {adminEnum(String(message.emailStatus), "emailStatus", ar)}
                </p>
              )}
            </article>
          ))}
      </section>
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
    </div>
  );
}
