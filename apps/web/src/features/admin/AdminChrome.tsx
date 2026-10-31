import type { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Inbox } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { safeReturnTo } from "./adminNav";
import { adminEnum } from "./labels";

const TONES: Record<string, "success" | "warning" | "danger" | "info"> = {
  active: "success", completed: "success", credited: "success", published: "success", resolved: "success", accepted: "success", succeeded: "success", approved: "success", verified: "success",
  pending: "warning", processing: "warning", queued: "warning", created: "warning", draft: "warning", "in-progress": "warning", "waiting-customer": "warning", review: "warning",
  failed: "danger", suspended: "danger", inactive: "danger", rejected: "danger", expired: "danger", cancelled: "danger", disabled: "danger", refunded: "danger", unpublished: "danger",
  open: "info", ready: "info",
};

export function StatusBadge({ value, field = "status" }: { value: unknown; field?: string }) {
  const { locale } = useLanguage();
  const text = String(value ?? "");
  if (!text) return <span className="admin-muted">—</span>;
  return <span className="admin-badge" data-tone={TONES[text] ?? "neutral"}>{adminEnum(text, field, locale === "ar")}</span>;
}

export function AdminBack({ fallback, label }: { fallback: string; label: string }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const to = safeReturnTo(params.get("returnTo") ?? (location.state as { from?: string } | null)?.from, fallback);
  return <Link className="admin-back" to={to}><ArrowLeft aria-hidden="true" className="rtl:rotate-180" />{label}</Link>;
}

export function AdminPageHeader({ title, description, back, meta, actions }: {
  title: ReactNode; description?: ReactNode; back?: { fallback: string; label: string }; meta?: ReactNode; actions?: ReactNode;
}) {
  return <header className="admin-page-header">
    {back && <AdminBack {...back} />}
    <div className="admin-page-heading">
      <div className="min-w-0">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {meta && <div className="admin-page-meta">{meta}</div>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </div>
  </header>;
}

export function AdminCard({ title, description, actions, children, flush = false }: {
  title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; flush?: boolean;
}) {
  return <section className="admin-card" data-flush={flush || undefined}>
    {(title || actions) && <div className="admin-card-head">
      <div className="min-w-0">{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>
      {actions}
    </div>}
    {children}
  </section>;
}

export function AdminFacts({ items }: { items: { label: ReactNode; value: ReactNode; wide?: boolean }[] }) {
  return <dl className="admin-facts">
    {items.map((item, index) => <div key={index} data-wide={item.wide || undefined}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
  </dl>;
}

export function AdminEmpty({ title, hint, icon = <Inbox aria-hidden="true" /> }: { title: string; hint?: string; icon?: ReactNode }) {
  return <div className="admin-empty-state">{icon}<strong>{title}</strong>{hint && <p>{hint}</p>}</div>;
}
