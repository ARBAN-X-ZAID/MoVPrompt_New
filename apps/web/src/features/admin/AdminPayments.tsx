import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { adminApi } from "./api";
import { formatKwd, object, type RecordData } from "./adminData";
import { Loading, ErrorState } from "./AdminDisplay";
import { StatusBadge } from "./AdminChrome";
import { AdminTable, AdminPagination, type AdminColumn } from "./AdminTable";
import { withReturnTo } from "./adminNav";
import { adminEnum } from "./labels";

export default function AdminPayments() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const period = params.get("period") ?? "week";
  const customReady = period !== "custom" || Boolean(params.get("start") && params.get("end"));
  const urlSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => { if (search !== urlSearch) change("search", search); }, 300);
    return () => clearTimeout(timer);
    // change only reads the current params, which are listed through urlSearch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, urlSearch]);
  const query = useQuery({
    queryKey: ["admin", "payment-history", params.toString()],
    queryFn: () => adminApi.payments(params),
    enabled: customReady,
    placeholderData: keepPreviousData,
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }
  const money = formatKwd;
  const totals = object(query.data?.totals);
  const from = useMemo(() => ({ pathname: location.pathname, search: location.search }), [location.pathname, location.search]);
  const columns = useMemo<AdminColumn<RecordData>[]>(() => [
    { key: "customer", label: t("Customer", "العميل"), render: row => <>
      <span className="admin-cell-title" dir="auto">{String(row.customerName ?? t("Customer", "العميل"))}</span>
      <span className="admin-cell-sub break-all" dir="auto">{String(row.customerEmail ?? "")}</span>
    </> },
    { key: "amount", label: t("Amount", "المبلغ"), align: "end", width: "130px", render: row => money(row.amountMinor) },
    { key: "credits", label: t("Credits", "الرصيد"), align: "end", width: "100px", render: row => String(row.credits) },
    { key: "status", label: t("Status", "الحالة"), width: "130px", render: row => <StatusBadge value={row.status} /> },
    { key: "date", label: t("Date", "التاريخ"), width: "190px", render: row => new Date(String(row.createdAt)).toLocaleString(locale, { timeZone: "Asia/Kuwait", dateStyle: "medium", timeStyle: "short" }) },
  ], [ar, from, locale]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="admin-stack">
      <div className="admin-toolbar !mb-0">
        <div className="admin-search">
          <Search aria-hidden="true" />
          <Input aria-label={t("Customer name or email", "اسم العميل أو بريده")} placeholder={t("Search customer name or email", "ابحث باسم العميل أو بريده")} value={search} onChange={event => setSearch(event.target.value)} />
        </div>
        <select className="admin-select" aria-label={t("Period", "الفترة")} value={period} onChange={event => change("period", event.target.value)}>
          {[["today", t("Today", "اليوم")], ["week", t("This week", "هذا الأسبوع")], ["month", t("This month", "هذا الشهر")], ["custom", t("Custom dates", "تواريخ مخصصة")]].map(([value, name]) => <option key={value} value={value}>{name}</option>)}
        </select>
        <select className="admin-select" aria-label={t("Payment status", "حالة الدفع")} value={params.get("status") ?? ""} onChange={event => change("status", event.target.value)}>
          {["", "created", "pending", "credited", "failed", "cancelled", "expired"].map(status => <option key={status} value={status}>{status ? adminEnum(status, "status", ar) : t("All statuses", "كل الحالات")}</option>)}
        </select>
        {period === "custom" && [["start", t("Start date", "تاريخ البداية")], ["end", t("End date", "تاريخ النهاية")]].map(([key, name]) => <label key={key} className="admin-field">{name}<Input type="date" value={params.get(key) ?? ""} onChange={event => change(key, event.target.value)} /></label>)}
      </div>
      {!customReady ? <p className="admin-empty">{t("Choose both dates to view payments.", "اختر التاريخين لعرض المدفوعات.")}</p>
        : query.isPending ? <Loading />
        : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} />
        : <>
          <div className="admin-stat-strip">
            {[["collected", t("Collected", "المحصّل")], ["refunded", t("Refunded", "المسترد")], ["net", t("Net collected", "صافي التحصيل")]].map(([key, name]) => <div key={key}><span>{name}</span><strong>{money(totals[key])}</strong></div>)}
          </div>
          <div>
            <AdminTable
              rows={query.data.items as RecordData[]}
              columns={columns}
              rowHref={row => withReturnTo(`/admin/payments/${row.id}`, from)}
              rowLabel={row => `${t("Open payment", "فتح الدفعة")} ${money(row.amountMinor)}`}
              empty={t("No matching payments", "لا توجد مدفوعات مطابقة")}
              emptyHint={t("Try a wider period or clear your search", "جرّب فترة أوسع أو امسح البحث")}
            />
            <AdminPagination page={Number(query.data.page)} total={Number(query.data.total)} ar={ar} onPage={page => {
              const next = new URLSearchParams(params);
              next.set("page", String(page));
              setParams(next);
            }} />
          </div>
          <p className="admin-hint">{t("Dates use Kuwait time. Totals show confirmed collections and refunds in this period.", "التواريخ بتوقيت الكويت. تعرض الإجماليات التحصيل والاسترداد المؤكد خلال الفترة.")}</p>
        </>}
    </div>
  );
}
