import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import type { AdminResource } from "@movprompt/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { entryLabel } from "@/lib/credits/ledgerLabels";
import type { LedgerEntry } from "@/hooks/useCredits";
import { adminApi } from "./api";
import { compact, label, listFields, object, type RecordData } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { StatusBadge } from "./AdminChrome";
import { AdminPagination, AdminTable, type AdminColumn } from "./AdminTable";
import { withReturnTo } from "./adminNav";
import { adminEnum } from "./labels";

const STATUS_OPTIONS: Partial<Record<AdminResource, { key: string; values: string[] }>> = {
  customers: { key: "status", values: ["active", "inactive"] },
  campaigns: { key: "status", values: ["draft", "ready", "trashed"] },
  credits: { key: "kind", values: ["purchase", "charge", "refund", "cash_refund", "adjustment"] },
  support: { key: "status", values: ["open", "in-progress", "waiting-customer", "resolved", "closed"] },
};

const SEARCH_HINT: Partial<Record<AdminResource, [string, string]>> = {
  customers: ["Search name or email", "ابحث بالاسم أو البريد"],
  campaigns: ["Search campaign title", "ابحث بعنوان الحملة"],
  credits: ["Search customer", "ابحث عن عميل"],
  support: ["Search subject", "ابحث في الموضوع"],
};

function useColumns(resource: AdminResource, locale: string, ar: boolean, from: { pathname: string; search: string }) {
  return useMemo<AdminColumn<RecordData>[]>(() => {
    const t = (en: string, arabic: string) => ar ? arabic : en;
    const date = (value: unknown) => value ? new Date(String(value)).toLocaleDateString(ar ? "ar-KW-u-nu-latn" : "en-KW", { dateStyle: "medium" }) : "—";
    const customer = (row: RecordData) => row.userId
      ? <Link className="admin-link" to={withReturnTo(`/admin/customers/${row.userId}`, from)}>{compact(row.customerName, locale)}</Link>
      : compact(row.customerName, locale);
    if (resource === "customers") return [
      { key: "name", label: t("Customer", "العميل"), render: row => <><span className="admin-cell-title" dir="auto">{compact(row.name, locale)}</span><span className="admin-cell-sub" dir="auto">{compact(row.email, locale)}</span></> },
      { key: "status", label: t("Status", "الحالة"), render: row => <StatusBadge value={row.status} />, width: "140px" },
      { key: "createdAt", label: t("Joined", "تاريخ الانضمام"), render: row => date(row.createdAt), width: "160px" },
    ];
    if (resource === "campaigns") return [
      { key: "title", label: t("Campaign", "الحملة"), render: row => <><span className="admin-cell-title" dir="auto">{compact(row.title, locale) === "—" ? t("Untitled campaign", "حملة بدون عنوان") : compact(row.title, locale)}</span>{row.templateName ? <span className="admin-cell-sub" dir="auto">{String(object(row.templateName)[ar ? "ar" : "en"] ?? "")}</span> : null}</> },
      { key: "customer", label: t("Customer", "العميل"), render: customer },
      { key: "status", label: t("Status", "الحالة"), render: row => <StatusBadge value={row.status} />, width: "130px" },
      { key: "updatedAt", label: t("Updated", "آخر تحديث"), render: row => date(row.updatedAt), width: "150px" },
    ];
    if (resource === "credits") return [
      { key: "kind", label: t("Transaction", "المعاملة"), render: row => <span className="admin-cell-title">{entryLabel({ ...row, reason: String(row.reason ?? row.kind), kind: row.kind } as LedgerEntry, ar)}</span> },
      { key: "customer", label: t("Customer", "العميل"), render: customer },
      { key: "delta", label: t("Credits", "الرصيد"), align: "end", width: "110px", render: row => <span dir="ltr">{`${Number(row.delta) > 0 ? "+" : ""}${row.delta}`}</span> },
      { key: "balanceAfter", label: t("Balance after", "الرصيد بعد العملية"), align: "end", width: "150px", render: row => String(row.balanceAfter ?? "—") },
      { key: "createdAt", label: t("Date", "التاريخ"), width: "150px", render: row => date(row.createdAt) },
    ];
    if (resource === "support") return [
      { key: "subject", label: t("Subject", "الموضوع"), render: row => <><span className="admin-cell-title" dir="auto">{compact(row.subject, locale)}</span><span className="admin-cell-sub">{compact(row.category, locale, "category")}</span></> },
      { key: "status", label: t("Status", "الحالة"), render: row => <StatusBadge value={row.status} />, width: "170px" },
      { key: "priority", label: t("Priority", "الأولوية"), render: row => compact(row.priority, locale, "priority"), width: "120px" },
      { key: "createdAt", label: t("Opened", "تاريخ الفتح"), render: row => date(row.createdAt), width: "150px" },
    ];
    return listFields[resource].map((field, index) => ({
      key: field,
      label: label(field, ar),
      render: row => field === "status" || field === "publishingState"
        ? <StatusBadge value={row[field]} field={field} />
        : index === 0 ? <span className="admin-cell-title">{compact(row[field], locale, field)}</span> : compact(row[field], locale, field),
    }));
  }, [resource, locale, ar, from]);
}

export default function AdminRecordList({ resource }: { resource: AdminResource }) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search === urlSearch) return;
      const next = new URLSearchParams(params);
      if (search) next.set("search", search); else next.delete("search");
      next.delete("page");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, urlSearch, params, setParams]);
  const query = useQuery({
    queryKey: ["admin", resource, params.toString()],
    queryFn: () => adminApi.list(resource, params),
    placeholderData: keepPreviousData,
  });
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    next.delete("page");
    setParams(next);
  };
  const filter = STATUS_OPTIONS[resource];
  const from = useMemo(() => ({ pathname: location.pathname, search: location.search }), [location.pathname, location.search]);
  const columns = useColumns(resource, locale, ar, from);
  const titleField = listFields[resource][0]!;
  return <>
    <div className="admin-toolbar">
      <div className="admin-search">
        <Search aria-hidden="true" />
        <Input
          aria-label={ar ? "بحث" : "Search records"}
          placeholder={SEARCH_HINT[resource]?.[ar ? 1 : 0] ?? (ar ? "بحث" : "Search")}
          value={search}
          onChange={event => setSearch(event.target.value)}
        />
      </div>
      {filter && <select className="admin-select" aria-label={ar ? "تصفية الحالة" : "Status filter"} value={params.get(filter.key) ?? ""} onChange={event => change(filter.key, event.target.value)}>
        <option value="">{ar ? "الكل" : resource === "credits" ? "All transactions" : "All statuses"}</option>
        {filter.values.map(value => <option key={value} value={value}>{adminEnum(value, filter.key === "kind" ? "kind" : "status", ar)}</option>)}
      </select>}
      <Button variant="outline" size="icon" aria-label={ar ? "تحديث" : "Refresh records"} onClick={() => void query.refetch()}>
        <RefreshCw className={`h-4 w-4 ${query.isFetching ? "motion-safe:animate-spin" : ""}`} />
      </Button>
    </div>
    {params.get("userId") && <p className="admin-hint mb-3">
      {ar ? "تصفية حسب العميل" : "Filtered by customer"}{" "}
      <button type="button" className="admin-link" onClick={() => change("userId", "")}>{ar ? "إزالة التصفية" : "Clear filter"}</button>
    </p>}
    {query.isPending ? <Loading /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
      <AdminTable
        columns={columns}
        rows={query.data.items as RecordData[]}
        rowHref={row => withReturnTo(`/admin/${resource}/${row.id}`, from)}
        rowLabel={row => `${ar ? "فتح" : "Open"} ${compact(row[titleField], locale)}`}
        empty={ar ? "لا توجد سجلات مطابقة" : "No matching records"}
        emptyHint={ar ? "جرّب تغيير البحث أو المرشحات" : "Try adjusting your search or filters"}
      />
      <AdminPagination page={query.data.page} total={query.data.total} limit={query.data.limit} ar={ar}
        totalCapped={Boolean((query.data as { totalCapped?: boolean }).totalCapped)} onPage={page => {
          const next = new URLSearchParams(params);
          next.set("page", String(page));
          setParams(next);
        }} />
    </>}
  </>;
}
