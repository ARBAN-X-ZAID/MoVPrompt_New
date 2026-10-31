import { useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AdminCustomerSummarySchema,
  type AdminResource,
} from "@movprompt/contracts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { request } from "@/lib/api/portableApiClient";
import { entryLabel } from "@/lib/credits/ledgerLabels";
import type { LedgerEntry } from "@/hooks/useCredits";
import { adminApi } from "./api";
import { formatKwd, object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminTable, AdminPagination, type AdminColumn } from "./AdminTable";
import { AdminCard, AdminFacts, AdminPageHeader, StatusBadge } from "./AdminChrome";
import { withReturnTo } from "./adminNav";
import { AdminForm } from "./AdminForm";
import { useAdminActions } from "./useAdminActions";
import { RefundDialog } from "./RefundDialog";
import { adminEnum } from "./labels";

const tabs = [
  ["overview", "Overview", "نظرة عامة"],
  ["wallet", "Wallet", "المحفظة"],
  ["campaigns", "Campaigns", "الحملات"],
  ["generations", "Generations", "التوليد"],
  ["assets", "Assets", "الأصول"],
  ["support", "Support", "الدعم"],
];
export default function AdminCustomer({
  id,
  readOnly,
  canEditProfile = !readOnly,
  canChangeStatus = !readOnly,
  canManageWallet = !readOnly,
}: {
  id: string;
  readOnly: boolean;
  canEditProfile?: boolean;
  canChangeStatus?: boolean;
  canManageWallet?: boolean;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [params, setParams] = useSearchParams();
  const selected = tabs.some(([key]) => key === params.get("tab"))
    ? params.get("tab")!
    : "overview";
  const [refund, setRefund] = useState<{
    source: Record<string, unknown>;
    kind: "cash-refund" | "generation-restoration" | "credit-adjustment";
  } | null>(null);
  const { run, form, setForm, notice } = useAdminActions();
  const query = useQuery({
    queryKey: ["admin", "customer-summary", id],
    queryFn: () =>
      request(
        `/api/v1/admin/customers/${id}/summary`,
        AdminCustomerSummarySchema,
      ),
  });
  if (query.isPending) return <Loading variant="detail" />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const customer = query.data;
  return (
    <>
      <AdminPageHeader
        back={{ fallback: "/admin/customers", label: t("Back to customers", "العودة للعملاء") }}
        title={<span dir="auto">{customer.name}</span>}
        description={<span dir="auto" className="break-all">{customer.email}</span>}
        meta={<>
          <StatusBadge value={customer.inactive ? "inactive" : "active"} />
          <span>{customer.locale === "ar" ? "العربية" : "English"}</span>
          <span>{t("Joined", "تاريخ الانضمام")} {new Date(customer.createdAt).toLocaleDateString(locale, { dateStyle: "medium" })}</span>
        </>}
        actions={<>
          <Button
            variant="outline"
            disabled={!canEditProfile}
            onClick={() =>
              run(
                t("Edit profile", "تعديل الملف"),
                `customers/${id}/actions`,
                [
                  { name: "name", label: t("Name", "الاسم"), required: true, value: customer.name },
                  {
                    name: "locale",
                    label: t("Language", "اللغة"),
                    type: "select",
                    value: customer.locale,
                    options: [
                      { value: "en", label: "English" },
                      { value: "ar", label: "العربية" },
                    ],
                  },
                ],
                { action: "profile" },
              )
            }
          >
            {t("Edit profile", "تعديل الملف")}
          </Button>
          <Button
            variant="outline"
            disabled={!canChangeStatus}
            onClick={() =>
              run(
                customer.inactive ? t("Reactivate account", "إعادة تفعيل الحساب") : t("Make inactive", "إلغاء تنشيط الحساب"),
                `customers/${id}/actions`,
                [],
                { action: customer.inactive ? "restore" : "suspend" },
                t(
                  "Customer data and balances remain saved. An inactive customer cannot sign in or use the account.",
                  "تبقى بيانات العميل ورصيده محفوظة. لا يمكن للعميل غير النشط تسجيل الدخول أو استخدام الحساب.",
                ),
              )
            }
          >
            {customer.inactive ? t("Reactivate account", "إعادة تفعيل الحساب") : t("Make inactive", "إلغاء تنشيط الحساب")}
          </Button>
          {customer.emailDeliveryAvailable && (
            <Button
              variant="outline"
              disabled={readOnly}
              onClick={() => run(t("Send password reset", "إرسال إعادة تعيين كلمة المرور"), `customers/${id}/actions`, [], { action: "password-reset" })}
            >
              {t("Send password reset", "إعادة تعيين كلمة المرور")}
            </Button>
          )}
        </>}
      />
      {notice && <p role="status" className="admin-hint mb-4">{notice}</p>}
      <div
        role="tablist"
        aria-label={t("Customer details", "تفاصيل العميل")}
        className="admin-tabs"
      >
        {tabs.map(([key, en, arabic], index) => (
          <button
            key={key}
            role="tab"
            id={`customer-tab-${key}`}
            aria-controls="customer-panel"
            aria-selected={selected === key}
            tabIndex={selected === key ? 0 : -1}
            onKeyDown={(event) => {
              if (
                !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
              )
                return;
              event.preventDefault();
              const step =
                (event.key === "ArrowRight" ? 1 : -1) * (ar ? -1 : 1);
              const nextIndex =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : (index + step + tabs.length) % tabs.length;
              setParams({ tab: tabs[nextIndex][0] });
              document
                .getElementById(`customer-tab-${tabs[nextIndex][0]}`)
                ?.focus();
            }}
            onClick={() => setParams({ tab: key })}
          >
            {ar ? arabic : en}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id="customer-panel"
        aria-labelledby={`customer-tab-${selected}`}
      >
        {selected === "overview" ? (
          <div className="admin-stack">
            <div className="admin-metric-grid" data-cols="5">
              {[
                ["balance", t("Credit balance", "رصيد الحساب"), String(customer.wallet.available), "wallet"],
                ["projects", t("Campaigns", "الحملات"), String(customer.counts.projects ?? 0), "campaigns"],
                ["generations", t("Generations", "عمليات التوليد"), String(customer.counts.generations ?? 0), "generations"],
                ["assets", t("Saved assets", "الأصول المحفوظة"), String(customer.counts.assets ?? 0), "assets"],
                ["support", t("Support cases", "حالات الدعم"), String(customer.counts.support ?? 0), "support"],
              ].map(([key, name, value, tab]) => (
                <button key={key} type="button" className="admin-metric text-start" onClick={() => setParams({ tab: tab! })}>
                  <span>{name}</span>
                  <strong>{value}</strong>
                </button>
              ))}
            </div>
            <AdminCard title={t("Customer details", "تفاصيل العميل")}>
              <AdminFacts items={[
                { label: t("Name", "الاسم"), value: <span dir="auto">{customer.name}</span> },
                { label: t("Email", "البريد الإلكتروني"), value: <span dir="auto">{customer.email}</span> },
                { label: t("Language", "اللغة"), value: customer.locale === "ar" ? "العربية" : "English" },
                { label: t("Joined", "تاريخ الانضمام"), value: new Date(customer.createdAt).toLocaleDateString(locale, { dateStyle: "medium" }) },
              ]} />
            </AdminCard>
          </div>
        ) : (
          <>
            {selected === "wallet" && (
              <>
                <div className="admin-stat-strip">
                  {[
                    ["available", t("Available credits", "الرصيد المتاح")],
                    ["reserved", t("Reserved credits", "الرصيد المحجوز")],
                    ["balance", t("Total balance", "الرصيد الكلي")],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <span>{label}</span>
                      <strong>{customer.wallet[key]}</strong>
                    </div>
                  ))}
                </div>
                <div className="my-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="admin-segment" role="group" aria-label={t("Wallet records", "سجلات المحفظة")}>
                    {[
                      ["credits", t("Transactions", "المعاملات")],
                      ["payments", t("Purchases", "المشتريات")],
                      ["financial-requests", t("Requests", "الطلبات")],
                    ].map(([key, label]) => (
                      <button key={key} type="button" aria-pressed={(params.get("wallet") ?? "credits") === key} onClick={() => setParams({ tab: "wallet", wallet: key! })}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <Button variant="outline" disabled={!canManageWallet} onClick={() => setRefund({ source: {}, kind: "credit-adjustment" })}>
                    {t("Adjust credits", "تعديل الرصيد")}
                  </Button>
                </div>
              </>
            )}
            <CustomerRecords
              key={`${id}/${selected}/${params.get("wallet")}`}
              id={id}
              resource={
                (selected === "wallet"
                  ? params.get("wallet") === "payments"
                    ? "payments"
                    : params.get("wallet") === "financial-requests"
                      ? "financial-requests"
                      : "credits"
                  : selected) as AdminResource
              }
              readOnly={!canManageWallet}
              onRefund={(source, kind) => setRefund({ source, kind })}
            />
          </>
        )}
      </section>
      {form && (
        <AdminForm
          {...form}
          onSubmit={form.submit}
          onClose={() => setForm(null)}
        />
      )}
      {refund && (
        <RefundDialog
          userId={id}
          {...refund}
          ar={ar}
          onClose={() => setRefund(null)}
        />
      )}
    </>
  );
}

function CustomerRecords({
  id,
  resource,
  readOnly,
  onRefund,
}: {
  id: string;
  resource: AdminResource;
  readOnly: boolean;
  onRefund: (
    row: Record<string, unknown>,
    kind: "cash-refund" | "generation-restoration",
  ) => void;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [preview, setPreview] = useState<string | null>(null);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page")) || 1;
  const query = useQuery({
    queryKey: ["admin", "customer-records", id, resource, params.toString()],
    queryFn: () =>
      adminApi.customerRecords(
        id,
        resource,
        new URLSearchParams({
          userId: id,
          page: String(page),
          limit: "25",
          ...(params.get("status") ? { status: params.get("status")! } : {}),
        }),
      ),
    placeholderData: keepPreviousData,
  });
  const from = useMemo(() => ({ pathname: location.pathname, search: location.search }), [location.pathname, location.search]);
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const detailHref = (row: Record<string, unknown>) => {
    if (resource === "financial-requests" || resource === "payments") return resource === "payments" ? withReturnTo(`/admin/payments/${row.id}`, from) : undefined;
    if (resource === "credits") {
      if (!row.referenceId || !["render_run", "payment_order"].includes(String(row.referenceType))) return undefined;
      return withReturnTo(`/admin/${row.referenceType === "payment_order" ? "payments" : "generations"}/${row.referenceId}`, from);
    }
    return withReturnTo(`/admin/${resource}/${row.id}`, from);
  };
  const columns: AdminColumn<Record<string, unknown>>[] =
    resource === "credits"
      ? [
          {
            key: "reason",
            label: t("Transaction", "المعاملة"),
            render: (row) =>
              entryLabel(
                {
                  ...row,
                  reason: String(row.reason ?? row.kind),
                  kind: row.kind,
                } as LedgerEntry,
                ar,
              ),
          },
          {
            key: "delta",
            label: t("Credits", "الرصيد"),
            align: "end",
            render: (row) => <span dir="ltr">{`${Number(row.delta) > 0 ? "+" : ""}${row.delta}`}</span>,
          },
          {
            key: "balanceAfter",
            label: t("Balance after", "الرصيد بعد العملية"),
            align: "end",
            render: (row) => String(row.balanceAfter ?? ""),
          },
        ]
      : resource === "payments"
        ? [
            {
              key: "amount",
              label: t("Amount", "المبلغ"),
              render: (row) =>
                formatKwd(row.amountMinor),
            },
            {
              key: "credits",
              label: t("Credits", "الرصيد"),
              render: (row) => String(row.credits),
            },
            {
              key: "status",
              label: t("Status", "الحالة"),
              render: (row) => <StatusBadge value={row.status} />,
            },
            {
              key: "refund",
              label: t("Refund", "استرداد"),
              render: (row) => (
                <Button
                  variant="outline"
                  disabled={readOnly || row.status !== "credited"}
                  onClick={() => onRefund(row, "cash-refund")}
                >
                  {t("Refund", "استرداد")}
                </Button>
              ),
            },
          ]
        : [
            {
              key: "title",
              label: resource === "campaigns" ? t("Campaign", "الحملة") : resource === "generations" ? t("Generation", "التوليد") : resource === "support" ? t("Subject", "الموضوع") : t("Request", "الطلب"),
              render: (row) =>
                <span className="admin-cell-title" dir="auto">{String(
                  row.title ??
                    row.subject ??
                    object(row.value).name ??
                    (row.kind === "cash-refund"
                      ? t("Cash refund", "استرداد نقدي")
                      : row.kind === "generation-restoration"
                        ? t("Credit restoration", "استعادة الرصيد")
                        : row.kind) ??
                    t("Generation", "توليد"),
                )}</span>,
            },
            {
              key: "status",
              label: t("Status", "الحالة"),
              render: (row) => <StatusBadge value={row.status ?? (row.deleted ? "trashed" : "active")} />,
            },
            {
              key: "actions",
              label: t("Actions", "الإجراءات"),
              render: (row) => (
                <div className="flex flex-wrap gap-2 items-center">
                  {((resource === "generations" &&
                    row.status === "completed") ||
                    (resource === "campaigns" && row.acceptedRunId)) && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        setPreview(
                          String(
                            resource === "campaigns"
                              ? row.acceptedRunId
                              : row.id,
                          ),
                        )
                      }
                    >
                      {t("Preview", "معاينة")}
                    </Button>
                  )}
                  {resource === "generations" &&
                    ["failed", "cancelled"].includes(String(row.status)) && (
                      <Button
                        variant="outline"
                        disabled={readOnly || row.refundStatus === "refunded"}
                        onClick={() => onRefund(row, "generation-restoration")}
                      >
                        {t("Restore credits", "استعادة الرصيد")}
                      </Button>
                    )}
                </div>
              ),
            },
          ];
  const dateColumn = {
    key: "date",
    label: t("Date", "التاريخ"),
    render: (row: Record<string, unknown>) =>
      new Date(String(row.createdAt)).toLocaleDateString(locale, { dateStyle: "medium" }),
  };
  return (
    <div className="space-y-4">
      {resource === "generations" && (
        <label className="admin-field max-w-xs">
          {t("Status", "الحالة")}
          <select
            className="admin-select"
            value={params.get("status") ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.set("status", event.target.value);
              next.delete("page");
              setParams(next);
            }}
          >
            {[
              "",
              "queued",
              "processing",
              "completed",
              "failed",
              "cancelled",
            ].map((value) => (
              <option key={value} value={value}>
                {value
                  ? adminEnum(value, "status", ar)
                  : t("All statuses", "كل الحالات")}
              </option>
            ))}
          </select>
        </label>
      )}
      {resource === "assets" ? (
        ["product", "presenter"].map((kind) => (
          <section key={kind}>
            <h3 className="font-semibold mb-3">
              {kind === "product"
                ? t("Products", "المنتجات")
                : t("Presenters", "الشخصيات")}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {query.data.items
                .filter((row) => (row.kind ?? object(row.value).kind) === kind)
                .map((row) => (
                  <article className="admin-panel relative hover:border-[var(--a-line-strong)]" key={String(row.id)}>
                    <div className="flex gap-2 overflow-hidden mb-3">
                      {(Array.isArray(object(row.value).photos)
                        ? (object(row.value).photos as Record<
                            string,
                            unknown
                          >[])
                        : []
                      ).map((photo) => (
                        <img
                          className="h-20 w-20 rounded-lg object-contain bg-muted"
                          key={String(photo.id)}
                          alt={String(photo.name ?? "")}
                          loading="lazy"
                          src={adminApi.media(
                            "asset",
                            String(row.id),
                            String(photo.id),
                          )}
                        />
                      ))}
                    </div>
                    <h4 className="font-medium">
                      <Link className="after:absolute after:inset-0" to={detailHref(row) ?? "#"}>{String(object(row.value).name ?? "")}</Link>
                    </h4>
                  </article>
                ))}
            </div>
          </section>
        ))
      ) : (
        <AdminTable
          rows={query.data.items}
          columns={[...columns, dateColumn]}
          rowHref={detailHref}
          rowLabel={row => `${t("Open", "فتح")} ${String(row.title ?? row.subject ?? row.reason ?? row.kind ?? "")}`}
          empty={t("No records yet", "لا توجد سجلات بعد")}
        />
      )}
      {resource === "assets" && !query.data.total && (
        <p className="admin-empty">
          {t("No saved assets", "لا توجد أصول محفوظة")}
        </p>
      )}
      <Dialog
        open={Boolean(preview)}
        onOpenChange={(open) => !open && setPreview(null)}
      >
        <DialogContent>
          <DialogTitle>{t("Video preview", "معاينة الفيديو")}</DialogTitle>
          <DialogDescription>
            {t("Accepted campaign output", "الفيديو المعتمد للحملة")}
          </DialogDescription>
          {preview && (
            <video
              className="w-full max-h-[70dvh]"
              src={adminApi.media("generation", preview)}
              controls
              playsInline
            />
          )}
        </DialogContent>
      </Dialog>
      {query.data.total > 25 && <AdminPagination
        page={page}
        total={query.data.total}
        ar={ar}
        onPage={(value) => {
          const next = new URLSearchParams(params);
          next.set("page", String(value));
          setParams(next);
        }}
      />}
    </div>
  );
}
