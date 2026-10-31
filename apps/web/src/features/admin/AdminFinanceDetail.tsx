import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { entryLabel } from "@/lib/credits/ledgerLabels";
import type { LedgerEntry } from "@/hooks/useCredits";
import { adminApi } from "./api";
import { formatKwd, object, type RecordData } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard, AdminFacts, AdminPageHeader, StatusBadge } from "./AdminChrome";
import { AdminTable } from "./AdminTable";
import { withReturnTo } from "./adminNav";

/** Payment and credit-ledger records. Only owner-readable facts; ids and gateway payloads stay out. */
export default function AdminFinanceDetail({ resource, id }: { resource: "payments" | "credits"; id: string }) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const location = useLocation();
  const query = useQuery({ queryKey: ["admin", resource, id], queryFn: () => adminApi.get(`${resource}/${id}`) });
  if (query.isPending) return <Loading variant="detail" />;
  if (query.error) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  const row = object(query.data.record);
  const related = object(query.data.related);
  const when = (value: unknown) => value ? new Date(String(value)).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuwait" }) : "—";
  const customer = row.userId
    ? <Link className="admin-link" to={withReturnTo(`/admin/customers/${row.userId}?tab=wallet`, location)} dir="auto">{String(row.customerName ?? t("Open customer", "فتح العميل"))}</Link>
    : "—";
  const customerAction = row.userId
    ? <Button variant="outline" asChild><Link to={withReturnTo(`/admin/customers/${row.userId}?tab=wallet`, location)}>{t("Open customer", "فتح العميل")}</Link></Button>
    : undefined;
  if (resource === "credits") {
    const delta = Number(row.delta ?? 0);
    const label = entryLabel({ ...row, reason: String(row.reason ?? row.kind), kind: row.kind } as LedgerEntry, ar);
    const linked = row.referenceId && ["render_run", "payment_order"].includes(String(row.referenceType))
      ? `/admin/${row.referenceType === "payment_order" ? "payments" : "generations"}/${row.referenceId}` : null;
    return <>
      <AdminPageHeader back={{ fallback: "/admin/credits", label: t("Back to credit ledger", "العودة إلى سجل الرصيد") }} title={label}
        meta={<span>{when(row.createdAt)}</span>} actions={customerAction} />
      <AdminCard title={t("Transaction details", "تفاصيل المعاملة")}>
        <AdminFacts items={[
          { label: t("Credits", "الرصيد"), value: <span dir="ltr">{`${delta > 0 ? "+" : ""}${delta}`}</span> },
          { label: t("Balance after", "الرصيد بعد العملية"), value: String(row.balanceAfter ?? "—") },
          { label: t("Customer", "العميل"), value: customer },
          { label: t("Date", "التاريخ"), value: when(row.createdAt) },
          ...(linked ? [{ label: t("Related record", "السجل المرتبط"), value: <Link className="admin-link" to={withReturnTo(linked, location)}>{row.referenceType === "payment_order" ? t("View payment", "عرض الدفعة") : t("View generation", "عرض التوليد")}</Link> }] : []),
        ]} />
      </AdminCard>
    </>;
  }
  const money = formatKwd(row.amountMinor);
  const events = (Array.isArray(related.events) ? related.events : []) as RecordData[];
  return <>
    <AdminPageHeader back={{ fallback: "/admin/payments", label: t("Back to payments", "العودة إلى المدفوعات") }} title={money}
      meta={<><StatusBadge value={row.status} /><span>{when(row.createdAt)}</span></>} actions={customerAction} />
    <div className="admin-stack">
      <AdminCard title={t("Payment details", "تفاصيل الدفعة")}>
        <AdminFacts items={[
          { label: t("Customer", "العميل"), value: customer },
          { label: t("Credits", "الرصيد"), value: String(row.credits ?? "—") },
          { label: t("Payment provider", "مزود الدفع"), value: String(row.provider ?? "—") },
          { label: t("Payment reference", "مرجع الدفع"), value: <span className="break-all">{String(row.providerReference ?? "—")}</span> },
          { label: t("Created", "تاريخ الإنشاء"), value: when(row.createdAt) },
          { label: t("Credited", "تاريخ الإضافة"), value: when(row.creditedAt) },
        ]} />
      </AdminCard>
      <AdminCard title={t("Payment activity", "نشاط الدفع")} flush>
        <AdminTable rows={events} empty={t("No gateway activity recorded", "لا يوجد نشاط مسجل من بوابة الدفع")} columns={[
          { key: "type", label: t("Event", "الحدث"), render: event => String(event.type ?? "—").replaceAll(".", " ").replaceAll("_", " ") },
          { key: "createdAt", label: t("Date", "التاريخ"), width: "220px", render: event => when(event.createdAt) },
        ]} />
      </AdminCard>
    </div>
  </>;
}
