import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/i18n/LanguageContext";
import { Input } from "@/components/ui/input";
import { adminApi } from "./api";
import { object } from "./adminData";
import { Loading, ErrorState } from "./AdminDisplay";
import { AdminTable, AdminPagination } from "./AdminTable";
import { adminEnum } from "./labels";

export default function AdminPayments() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [params, setParams] = useSearchParams();
  const period = params.get("period") ?? "week";
  const customReady =
    period !== "custom" || Boolean(params.get("start") && params.get("end"));
  const query = useQuery({
    queryKey: ["admin", "payment-history", params.toString()],
    queryFn: () => adminApi.payments(params),
    enabled: customReady,
  });
  function change(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { replace: true });
  }
  const money = (value: unknown) =>
    `${(Number(value ?? 0) / 1000).toFixed(3)} KWD`;
  const totals = object(query.data?.totals);
  return (
    <div className="space-y-6">
      <div className="admin-filter-grid">
        <label className="admin-field">
          {t("Period", "الفترة")}
          <select
            className="admin-select"
            value={period}
            onChange={(event) => change("period", event.target.value)}
          >
            {[
              ["today", t("Today", "اليوم")],
              ["week", t("Week", "الأسبوع")],
              ["month", t("Month", "الشهر")],
              ["custom", t("Custom", "مخصص")],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field md:col-span-2">
          {t("Customer name or email", "اسم العميل أو بريده")}
          <Input
            value={params.get("search") ?? ""}
            onChange={(event) => change("search", event.target.value)}
          />
        </label>
        <label className="admin-field">
          {t("Payment status", "حالة الدفع")}
          <select
            className="admin-select"
            value={params.get("status") ?? ""}
            onChange={(event) => change("status", event.target.value)}
          >
            {[
              "",
              "created",
              "pending",
              "credited",
              "failed",
              "cancelled",
              "expired",
            ].map((status) => (
              <option key={status} value={status}>
                {status
                  ? adminEnum(status, "status", ar)
                  : t("All statuses", "كل الحالات")}
              </option>
            ))}
          </select>
        </label>
        {period === "custom" && (
          <>
            {[
              ["start", t("Start date", "تاريخ البداية")],
              ["end", t("End date", "تاريخ النهاية")],
            ].map(([key, label]) => (
              <label key={key} className="admin-field">
                {label}
                <Input
                  type="date"
                  value={params.get(key) ?? ""}
                  onChange={(event) => change(key, event.target.value)}
                />
              </label>
            ))}
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Dates use Kuwait time. Totals show confirmed collections and refunds during this period, across all payment statuses.",
          "التواريخ بتوقيت الكويت. تشمل الإجماليات التحصيل والاسترداد المؤكد خلال الفترة عبر جميع حالات الدفع.",
        )}
      </p>
      {!customReady ? (
        <p className="admin-empty">
          {t(
            "Choose both dates to view payments.",
            "اختر التاريخين لعرض المدفوعات.",
          )}
        </p>
      ) : query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="admin-stat-strip">
            {[
              ["collected", t("Collected", "المحصّل")],
              ["refunded", t("Refunded", "المسترد")],
              ["net", t("Net collected", "صافي التحصيل")],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>{money(totals[key])}</strong>
              </div>
            ))}
          </div>
          <AdminTable
            rows={query.data.items as Record<string, unknown>[]}
            empty={t("No matching payments", "لا توجد مدفوعات مطابقة")}
            columns={[
              {
                key: "customer",
                label: t("Customer", "العميل"),
                render: (row) => (
                  <Link
                    className="admin-link"
                    to={`/admin/customers/${row.userId}?tab=wallet&wallet=payments`}
                  >
                    <strong className="block">
                      {String(row.customerName ?? t("Customer", "العميل"))}
                    </strong>
                    <span className="text-xs break-all">
                      {String(row.customerEmail ?? "")}
                    </span>
                  </Link>
                ),
              },
              {
                key: "amount",
                label: t("Amount", "المبلغ"),
                render: (row) => money(row.amountMinor),
              },
              {
                key: "credits",
                label: t("Credits", "الرصيد"),
                render: (row) => String(row.credits),
              },
              {
                key: "status",
                label: t("Status", "الحالة"),
                render: (row) => adminEnum(String(row.status), "status", ar),
              },
              {
                key: "date",
                label: t("Date", "التاريخ"),
                render: (row) =>
                  new Date(String(row.createdAt)).toLocaleString(locale, {
                    timeZone: "Asia/Kuwait",
                  }),
              },
              {
                key: "reference",
                label: t("Payment reference", "مرجع الدفع"),
                render: (row) => (
                  <Link
                    className="admin-link break-all"
                    to={`/admin/payments/${row.id}?returnTo=${encodeURIComponent(`/admin/payments?${params}`)}`}
                  >
                    {String(
                      row.providerReference ?? t("View payment", "عرض الدفعة"),
                    )}
                  </Link>
                ),
              },
            ]}
          />
          <AdminPagination
            page={Number(query.data.page)}
            total={Number(query.data.total)}
            ar={ar}
            onPage={(page) => {
              const next = new URLSearchParams(params);
              next.set("page", String(page));
              setParams(next);
            }}
          />
        </>
      )}
    </div>
  );
}
