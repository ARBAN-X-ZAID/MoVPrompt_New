import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminTable, AdminPagination } from "./AdminTable";
import { AdminForm } from "./AdminForm";
import { useAdminActions } from "./useAdminActions";
import { RefundDialog } from "./RefundDialog";
import { adminEnum } from "./labels";

const tabs = [
  ["overview", "Overview", "نظرة عامة"],
  ["wallet", "Wallet", "المحفظة"],
  ["campaigns", "Projects", "المشاريع"],
  ["generations", "Generations", "التوليد"],
  ["assets", "Assets", "الأصول"],
  ["support", "Support", "الدعم"],
];
export default function AdminCustomer({
  id,
  readOnly,
  canEditProfile = !readOnly,
  canChangeStatus = !readOnly,
}: {
  id: string;
  readOnly: boolean;
  canEditProfile?: boolean;
  canChangeStatus?: boolean;
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
    kind: "cash-refund" | "generation-restoration";
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
    <div className="space-y-6">
      <Link className="admin-back" to="/admin/customers">
        {t("Back to customers", "العودة للعملاء")}
      </Link>
      <section className="admin-customer-header">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {customer.name}
          </h2>
          <p className="mt-1 text-muted-foreground break-all" dir="auto">
            {customer.email}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{customer.locale === "ar" ? "العربية" : "English"} · {t("Joined", "تاريخ الانضمام")} {new Date(customer.createdAt).toLocaleDateString(locale)}</p>
          <span className="admin-status mt-3 inline-block">
            {customer.inactive ? t("Inactive", "غير نشط") : t("Active", "نشط")}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!canEditProfile}
            onClick={() =>
              run(
                t("Edit profile", "تعديل الملف"),
                `customers/${id}/actions`,
                [
                  {
                    name: "name",
                    label: t("Name", "الاسم"),
                    required: true,
                    value: customer.name,
                  },
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
                customer.inactive
                  ? t("Reactivate account", "إعادة تفعيل الحساب")
                  : t("Make inactive", "إلغاء تنشيط الحساب"),
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
            {customer.inactive
              ? t("Reactivate account", "إعادة تفعيل الحساب")
              : t("Make inactive", "إلغاء تنشيط الحساب")}
          </Button>
          {customer.emailDeliveryAvailable && (
            <Button
              variant="outline"
              disabled={readOnly}
              onClick={() =>
                run(
                  t("Send password reset", "إرسال إعادة تعيين كلمة المرور"),
                  `customers/${id}/actions`,
                  [],
                  { action: "password-reset" },
                )
              }
            >
              {t("Send password reset", "إعادة تعيين كلمة المرور")}
            </Button>
          )}
        </div>
      </section>
      {notice && <p role="status">{notice}</p>}
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
          <div className="grid gap-6 md:grid-cols-2">
            <section className="admin-panel">
              <h3 className="font-medium mb-4">
                {t("Customer details", "تفاصيل العميل")}
              </h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t("Joined", "تاريخ الانضمام")}
                  </dt>
                  <dd>
                    {new Date(customer.createdAt).toLocaleDateString(locale)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t("Language", "اللغة")}
                  </dt>
                  <dd>{customer.locale === "ar" ? "العربية" : "English"}</dd>
                </div>
              </dl>
            </section>
            <section className="admin-panel">
              <h3 className="font-medium mb-4">{t("Activity", "النشاط")}</h3>
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(customer.counts).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-sm text-muted-foreground">
                      {
                        {
                          projects: t("Projects", "المشاريع"),
                          generations: t("Generations", "التوليد"),
                          assets: t("Saved assets", "الأصول المحفوظة"),
                          support: t("Support cases", "حالات الدعم"),
                        }[key]
                      }
                    </p>
                    <p className="text-2xl font-semibold mt-1">{value}</p>
                  </div>
                ))}
              </div>
            </section>
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
                <div className="my-5 flex gap-2 flex-wrap">
                  {[
                    ["credits", t("Transactions", "المعاملات")],
                    ["payments", t("Purchases", "المشتريات")],
                    [
                      "financial-requests",
                      t("Refund requests", "طلبات الاسترداد"),
                    ],
                  ].map(([key, label]) => (
                    <Button
                      key={key}
                      variant={
                        (params.get("wallet") ?? "credits") === key
                          ? "default"
                          : "outline"
                      }
                      onClick={() => setParams({ tab: "wallet", wallet: key })}
                    >
                      {label}
                    </Button>
                  ))}
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
              readOnly={readOnly}
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
    </div>
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
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const returnTo = `/admin/customers/${id}?${params}`;
  const open = (row: Record<string, unknown>) => (
    <Link
      className="admin-link"
      to={`/admin/${resource}/${row.id}?returnTo=${encodeURIComponent(returnTo)}`}
    >
      {t("View details", "عرض التفاصيل")}
    </Link>
  );
  const columns =
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
            render: (row) => `${Number(row.delta) > 0 ? "+" : ""}${row.delta}`,
          },
          {
            key: "balanceAfter",
            label: t("Balance after", "الرصيد بعد العملية"),
            render: (row) => String(row.balanceAfter ?? ""),
          },
          {
            key: "reference",
            label: t("Related record", "السجل المرتبط"),
            render: (row) =>
              row.referenceId &&
              ["render_run", "payment_order"].includes(
                String(row.referenceType),
              ) ? (
                <Link
                  className="admin-link"
                  to={`/admin/${row.referenceType === "payment_order" ? "payments" : "generations"}/${row.referenceId}?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  {t("View", "عرض")}
                </Link>
              ) : (
                t("Account", "الحساب")
              ),
          },
        ]
      : resource === "payments"
        ? [
            {
              key: "amount",
              label: t("Amount", "المبلغ"),
              render: (row) =>
                `${(Number(row.amountMinor) / 1000).toFixed(3)} KWD`,
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
              label: t("Details", "التفاصيل"),
              render: (row) =>
                String(
                  row.title ??
                    row.subject ??
                    object(row.value).name ??
                    (row.kind === "cash-refund"
                      ? t("Cash refund", "استرداد نقدي")
                      : row.kind === "generation-restoration"
                        ? t("Credit restoration", "استعادة الرصيد")
                        : row.kind) ??
                    t("Generation", "توليد"),
                ),
            },
            {
              key: "status",
              label: t("Status", "الحالة"),
              render: (row) =>
                adminEnum(
                  String(row.status ?? (row.deleted ? "trashed" : "active")),
                  "status",
                  ar,
                ),
            },
            {
              key: "open",
              label: t("Actions", "الإجراءات"),
              render: (row) => (
                <div className="flex flex-wrap gap-2 items-center">
                  {resource !== "financial-requests" && open(row)}
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
      new Date(String(row.createdAt)).toLocaleString(locale),
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
                  <article className="admin-panel" key={String(row.id)}>
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
                    <h4 className="font-medium mb-2">
                      {String(object(row.value).name ?? "")}
                    </h4>
                    {open(row)}
                  </article>
                ))}
            </div>
          </section>
        ))
      ) : (
        <AdminTable
          rows={query.data.items}
          columns={[...columns, dateColumn]}
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
      <AdminPagination
        page={page}
        total={query.data.total}
        ar={ar}
        onPage={(value) => {
          const next = new URLSearchParams(params);
          next.set("page", String(value));
          setParams(next);
        }}
      />
    </div>
  );
}
