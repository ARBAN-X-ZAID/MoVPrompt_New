import { isInternalAdminField } from "./displayFields";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { adminEnum } from "./labels";
import { label } from "./adminData";
export function DataValue({
  value,
  ar,
  depth = 0,
  field,
}: {
  value: unknown;
  ar: boolean;
  depth?: number;
  field?: string;
}) {
  if (field && isInternalAdminField(field)) return null;
  if (value === null || value === undefined || value === "")
    return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean")
    return <span>{value ? (ar ? "نعم" : "Yes") : ar ? "لا" : "No"}</span>;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value))
    return (
      <time dateTime={value}>
        {new Date(value).toLocaleString(ar ? "ar-KW-u-nu-latn" : "en-KW", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </time>
    );
  if (typeof value !== "object")
    return (
      <span className="whitespace-pre-wrap break-words" dir="auto">
        {adminEnum(String(value), field, ar)}
      </span>
    );
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index + 1), item] as const)
    : Object.entries(value).filter(([key]) => !isInternalAdminField(key));
  if (!entries.length)
    return (
      <span className="text-muted-foreground">
        {ar ? "لا توجد بيانات" : "No data"}
      </span>
    );
  const content = (
    <dl className="space-y-3">
      {entries.slice(0, 100).map(([key, item]) => (
        <div key={key} className="min-w-0">
          <dt className="mb-1 text-xs text-muted-foreground">
            {label(key, ar)}
          </dt>
          <dd className="min-w-0 break-words text-sm">
            <DataValue value={item} ar={ar} depth={depth + 1} field={key} />
          </dd>
        </div>
      ))}
    </dl>
  );
  return depth > 0 ? (
    <details className="rounded-md border p-3">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        {ar
          ? `عرض التفاصيل (${entries.length})`
          : `View details (${entries.length})`}
      </summary>
      <div className="pt-3">{content}</div>
    </details>
  ) : (
    content
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const { locale } = useLanguage();
  return (
    <div
      role="alert"
      className="rounded-xl border border-destructive/30 bg-destructive/5 p-5"
    >
      <p className="text-sm text-destructive">{error.message}</p>
      <Button variant="outline" className="mt-3" onClick={retry}>
        {locale === "ar" ? "إعادة المحاولة" : "Try again"}
      </Button>
    </div>
  );
}
export function Loading({
  variant = "table",
}: {
  variant?: "table" | "metrics" | "detail";
}) {
  const { locale } = useLanguage();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-48 flex-col items-center justify-center gap-4 py-12 text-sm text-muted-foreground"
    >
      <div
        aria-hidden="true"
        className={`w-full motion-safe:animate-pulse ${variant === "metrics" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}`}
      >
        {Array.from(
          { length: variant === "metrics" ? 6 : variant === "detail" ? 3 : 5 },
          (_, index) => (
            <div
              key={index}
              className={`rounded-xl border bg-card p-5 ${variant === "metrics" ? "h-32" : ""}`}
            >
              <div className="h-3 w-1/3 rounded bg-muted" />
              <div className="mt-4 h-3 w-2/3 rounded bg-muted" />
            </div>
          ),
        )}
      </div>
      <span>{locale === "ar" ? "جارٍ التحميل…" : "Loading…"}</span>
    </div>
  );
}
