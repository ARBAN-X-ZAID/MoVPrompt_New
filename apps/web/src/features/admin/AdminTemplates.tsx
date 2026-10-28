import { useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { findCreativeTemplate } from "@movprompt/creative-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { ErrorState, Loading } from "./AdminDisplay";

export default function AdminTemplates({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const keys = useRef(new Map<string, string>());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = useQuery({
    queryKey: ["admin", "templates", params.toString()],
    queryFn: () =>
      adminApi.list(
        "templates",
        new URLSearchParams({
          search: params.get("search") ?? "",
          page: String(page),
          limit: "25",
        }),
      ),
  });
  async function toggle(row: Record<string, unknown>) {
    if (readOnly || pending) return;
    const id = String(row.id);
    const action =
      row.publishingState === "published" ? "unpublish" : "restore-publication";
    const operation = `${id}/${row.revision ?? 0}/${action}`;
    const key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    setPending(id);
    setError(null);
    setNotice(false);
    try {
      await adminApi.mutate(
        `templates/${id}/state`,
        {
          action,
          expectedRevision: row.revision ?? 0,
          reason:
            action === "unpublish"
              ? "Owner disabled template from the template list"
              : "Owner enabled the existing template from the template list",
        },
        key,
      );
      await client.invalidateQueries({ queryKey: ["admin"] });
      keys.current.delete(operation);
      setNotice(true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("Template update failed"),
      );
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="space-y-5">
      <form
        className="flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set("search", search.trim());
          setParams(next, { replace: true });
        }}
      >
        <Input
          className="min-w-0 flex-1 basis-48"
          aria-label={ar ? "بحث عن قالب" : "Search templates"}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={ar ? "البحث عن قالب" : "Search templates"}
        />
        <Button className="min-h-11" variant="outline" type="submit">
          {ar ? "بحث" : "Search"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {ar
          ? "فعّل القالب أو أوقفه للعملاء. تبقى إعدادات الفيديو كما هي."
          : "Enable or disable templates for customers. Video settings stay unchanged."}
      </p>
      {readOnly && (
        <p className="text-sm text-muted-foreground">
          {ar
            ? "التحكم بالحالة متوقف في وضع القراءة فقط."
            : "Availability changes are disabled in read-only mode."}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {ar ? "تم تحديث حالة القالب" : "Template availability updated"}
        </p>
      )}
      {error && (
        <ErrorState
          error={error}
          retry={() => {
            setError(null);
            void query.refetch();
          }}
        />
      )}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card">
            {query.data.items.map((row) => {
              const id = String(row.id);
              const recipe = findCreativeTemplate(String(row.slug));
              const name =
                recipe?.localizedName[ar ? "ar" : "en"] ??
                String(row.slug ?? id).replaceAll("-", " ");
              const enabled = row.publishingState === "published";
              const available =
                enabled || Boolean(row.currentPublishedVersionId);
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0 flex-1 basis-44">
                    <h2 className="break-words font-medium">{name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {enabled
                        ? ar
                          ? "متاح للعملاء"
                          : "Available to customers"
                        : ar
                          ? "غير متاح للعملاء"
                          : "Hidden from customers"}
                    </p>
                  </div>
                  <Button
                    className="min-h-11 min-w-28"
                    variant={enabled ? "outline" : "default"}
                    disabled={readOnly || pending !== null || !available}
                    aria-label={`${enabled ? (ar ? "إيقاف" : "Disable") : ar ? "تفعيل" : "Enable"} ${name}`}
                    onClick={() => void toggle(row)}
                  >
                    {pending === id
                      ? ar
                        ? "جارٍ الحفظ…"
                        : "Saving…"
                      : enabled
                        ? ar
                          ? "إيقاف"
                          : "Disable"
                        : ar
                          ? "تفعيل"
                          : "Enable"}
                  </Button>
                </li>
              );
            })}
            {query.data.items.length === 0 && (
              <li className="p-6 text-sm text-muted-foreground">
                {ar ? "لم يتم العثور على قوالب" : "No templates found"}
              </li>
            )}
          </ul>
          <div className="flex items-center justify-between gap-3 text-sm">
            <Button
              className="min-h-11"
              variant="outline"
              disabled={page <= 1}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("page", String(page - 1));
                setParams(next);
              }}
            >
              {ar ? "السابق" : "Previous"}
            </Button>
            <span>{ar ? `الصفحة ${page}` : `Page ${page}`}</span>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={page * 25 >= query.data.total}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("page", String(page + 1));
                setParams(next);
              }}
            >
              {ar ? "التالي" : "Next"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
