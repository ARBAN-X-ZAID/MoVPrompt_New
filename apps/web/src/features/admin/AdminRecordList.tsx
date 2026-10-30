import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  RefreshCw,
  ArrowUpRight,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { AdminResource } from "@movprompt/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { compact, label, listFields } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
export default function AdminRecordList({
  resource,
}: {
  resource: AdminResource;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const urlSearch = params.get("search") ?? "";
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (search !== (params.get("search") ?? "")) {
        const next = new URLSearchParams(params);
        next.set("search", search);
        next.delete("page");
        setParams(next, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params, setParams]);
  const query = useQuery({
    queryKey: ["admin", resource, params.toString()],
    queryFn: () => adminApi.list(resource, params),
    refetchInterval:
      resource === "generations" || resource === "operations" ? 30000 : false,
    refetchIntervalInBackground: false,
  });
  const fields = listFields[resource];
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label={ar ? "بحث" : "Search records"}
            placeholder={
              ar
                ? "البحث بالاسم أو المرجع أو المعرّف"
                : "Search by name, reference or ID"
            }
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="ps-10"
          />
        </div>
        {resource === "customers" || resource === "support" ? (
          <select
            className="admin-select w-48"
            aria-label={ar ? "تصفية الحالة" : "Status filter"}
            value={params.get("status") ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              next.set("status", event.target.value);
              next.delete("page");
              setParams(next);
            }}
          >
            <option value="">{ar ? "كل الحالات" : "All statuses"}</option>
            {(resource === "customers"
              ? ["active", "inactive"]
              : [
                  "open",
                  "in-progress",
                  "waiting-customer",
                  "resolved",
                  "closed",
                ]
            ).map((value) => (
              <option key={value} value={value}>
                {compact(value, locale, "status")}
              </option>
            ))}
          </select>
        ) : (
          <Input
            className="w-40"
            aria-label={ar ? "تصفية الحالة" : "Status filter"}
            placeholder={ar ? "تصفية الحالة" : "Status filter"}
            value={params.get("status") ?? ""}
            onChange={(event) => {
              const next = new URLSearchParams(params);
              if (event.target.value) next.set("status", event.target.value);
              else next.delete("status");
              next.delete("page");
              setParams(next, { replace: true });
            }}
          />
        )}
        <Button
          variant="outline"
          size="icon"
          aria-label={ar ? "تحديث" : "Refresh records"}
          onClick={() => void query.refetch()}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {params.get("userId") && (
        <p className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
          {ar ? "العميل" : "Customer"}: {params.get("userId")}
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("userId");
              setParams(next);
            }}
          >
            {ar ? "إزالة التصفية" : "Clear filter"}
          </Button>
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {query.data.items.length ? (
            <div className="admin-record-list overflow-hidden rounded-xl border bg-card">
              <table className="hidden w-full text-start text-sm md:table">
                <thead className="border-b bg-muted/30">
                  <tr>
                    {fields.map((field) => (
                      <th
                        key={field}
                        className="px-5 py-3 text-start text-xs font-medium text-muted-foreground"
                      >
                        {label(field, ar)}
                      </th>
                    ))}
                    <th className="w-12">
                      <span className="sr-only">{ar ? "فتح" : "Open"}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.items.map((row) => (
                    <tr
                      key={String(row.id)}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      {fields.map((field, index) => (
                        <td key={field} className="max-w-64 truncate px-5 py-4">
                          {index === 0 ? (
                            <Link
                              className="font-medium underline-offset-4 hover:underline"
                              to={`/admin/${resource}/${row.id}`}
                            >
                              {compact(row[field], locale, field)}
                            </Link>
                          ) : field === "status" ||
                            field === "publishingState" ? (
                            <span className="admin-status">
                              {compact(row[field], locale, field)}
                            </span>
                          ) : (
                            compact(row[field], locale, field)
                          )}
                        </td>
                      ))}
                      <td className="pe-4">
                        <Link
                          to={`/admin/${resource}/${row.id}`}
                          aria-label={`${ar ? "فتح" : "Open"} ${compact(row[fields[0]!], locale)}`}
                        >
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="divide-y md:hidden">
                {query.data.items.map((row) => (
                  <Link
                    key={String(row.id)}
                    className="block space-y-3 p-5 hover:bg-muted/20"
                    to={`/admin/${resource}/${row.id}`}
                  >
                    <div className="flex justify-between gap-3">
                      <strong className="min-w-0 break-words text-sm">
                        {compact(row[fields[0]!], locale)}
                      </strong>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                    <dl className="grid grid-cols-2 gap-3">
                      {fields.slice(1).map((field) => (
                        <div key={field} className="min-w-0">
                          <dt className="text-[11px] text-muted-foreground">
                            {label(field, ar)}
                          </dt>
                          <dd className="mt-1 break-words text-xs">
                            {compact(row[field], locale, field)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed px-6 py-16 text-center">
              <FileText className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
              <h2 className="font-medium">
                {ar ? "لا توجد سجلات مطابقة" : "No matching records"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {ar
                  ? "جرّب تغيير البحث أو المرشحات"
                  : "Try adjusting your search or filters"}
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>
              {query.data.total.toLocaleString()} {ar ? "سجل" : "records"}
              <br />
              {ar ? "آخر تحديث" : "Updated"}{" "}
              {new Date(query.data.evaluatedAt).toLocaleTimeString()}
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                disabled={query.data.page <= 1}
                aria-label={ar ? "الصفحة السابقة" : "Previous page"}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(query.data.page - 1));
                  setParams(next);
                }}
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </Button>
              <span>{query.data.page}</span>
              <Button
                variant="outline"
                size="icon"
                disabled={
                  query.data.page * query.data.limit >= query.data.total
                }
                aria-label={ar ? "الصفحة التالية" : "Next page"}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("page", String(query.data.page + 1));
                  setParams(next);
                }}
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
