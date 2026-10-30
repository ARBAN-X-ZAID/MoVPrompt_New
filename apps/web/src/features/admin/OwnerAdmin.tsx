import { AdminPageBoundary } from "./AdminPageBoundary";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import {
  Link,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  FileText,
  LayoutDashboard,
  LockKeyhole,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  Video,
} from "lucide-react";
import { AdminResourceSchema } from "@movprompt/contracts";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useTheme } from "@/components/ThemeProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";
import { PortableApiError } from "@/lib/api/portableApiClient";
import { OwnerAccess } from "./OwnerAccess";
import { adminSections } from "./labels";
import { OwnerAccessLoading } from "./OwnerAccessFrame";
import AdminOverview from "./AdminOverview";
import AdminRecordList from "./AdminRecordList";
import AdminRecordDetail from "./AdminRecordDetail";
import AdminSettings from "./AdminSettings";
import AdminTemplates from "./AdminTemplateManager";
import AdminCustomer from "./AdminCustomer";
import AdminPayments from "./AdminPayments";
import AdminGenerations from "./AdminGenerations";
import AdminSupport from "./AdminSupport";
import AdminCreateAction from "./AdminCreateAction";
import "./admin.css";
export default function OwnerAdmin() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const client = useQueryClient();
  const identity = useQuery({
    queryKey: ["admin", "identity"],
    queryFn: adminApi.identity,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    const confirmIdentity = () => setConfirm(true);
    window.addEventListener(
      "movprompt:admin-confirmation-required",
      confirmIdentity,
    );
    return () =>
      window.removeEventListener(
        "movprompt:admin-confirmation-required",
        confirmIdentity,
      );
  }, []);
  const parts = location.pathname.replace(/^\/admin\/?/, "").split("/");
  const sectionId = parts[0] || "overview";
  const id = parts[1];
  const section =
    adminSections.find((item) => item.id === sectionId) ??
    (sectionId === "assets"
      ? {
          id: "customers",
          en: "Customer asset",
          ar: "أصل العميل",
          description: "Reference photos and permissions",
          descriptionAr: "الصور المرجعية والأذونات",
        }
      : adminSections[0]!);
  const resource = AdminResourceSchema.safeParse(sectionId);
  function reload() {
    setConfirm(false);
    void client.invalidateQueries({ queryKey: ["admin"] });
  }
  if (identity.isPending) return <OwnerAccessLoading />;
  const accessDenied =
    identity.error instanceof PortableApiError &&
    [401, 403].includes(identity.error.status);
  if (accessDenied || !identity.data?.assuredUntil)
    return (
      <OwnerAccess
        identity={accessDenied ? undefined : identity.data}
        error={
          identity.error instanceof PortableApiError &&
          identity.error.status === 401
            ? null
            : identity.error
        }
        reload={reload}
      />
    );
  if (sectionId === "assets" && !id)
    return (
      <Navigate
        to={
          new URLSearchParams(location.search).get("userId")
            ? `/admin/customers/${new URLSearchParams(location.search).get("userId")}?tab=assets`
            : "/admin/customers"
        }
        replace
      />
    );
  if (
    sectionId !== "assets" &&
    !adminSections.some((item) => item.id === sectionId)
  )
    return <Navigate to="/admin" replace />;

  return (
    <div
      className="admin-workspace min-h-screen bg-background text-foreground"
      dir={ar ? "rtl" : "ltr"}
    >
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">
            {ar ? "تأكيد هوية المالك" : "Confirm owner identity"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {ar
              ? "تبقى تعديلاتك مفتوحة أثناء التأكيد."
              : "Your unfinished edits remain open while you confirm."}
          </DialogDescription>
          <OwnerAccess compact identity={identity.data} reload={reload} />
        </DialogContent>
      </Dialog>
      <Seo
        title="Owner administration · MovPrompt"
        description="Private MovPrompt owner workspace"
        noindex
      />
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        {ar ? "انتقل إلى المحتوى" : "Skip to content"}
      </a>
      <aside className="admin-sidebar">
        <Link to="/admin" className="mb-7 flex items-center gap-3 px-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <strong className="text-base tracking-tight">MovPrompt</strong>
            <span className="mt-0.5 block text-[10px] uppercase tracking-[.15em] text-muted-foreground">
              {ar ? "إدارة المالك" : "Owner administration"}
            </span>
          </div>
        </Link>
        <nav
          aria-label={ar ? "إدارة المنصة" : "Administration"}
          className="space-y-1"
        >
          {adminSections.map((item) => {
            const Icon =
              item.id === "overview"
                ? LayoutDashboard
                : item.id === "customers"
                  ? Users
                  : item.id === "generations" || item.id === "campaigns"
                    ? Video
                    : FileText;
            return (
              <NavLink
                key={item.id}
                to={item.id === "overview" ? "/admin" : `/admin/${item.id}`}
                end={item.id === "overview"}
                className={({ isActive }) =>
                  `admin-nav ${isActive ? "is-active" : ""}`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{ar ? item.ar : item.en}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="mt-auto border-t px-3 pt-5">
          <Link
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            to="/templates"
          >
            <ArrowLeft className="h-3 w-3 rtl:rotate-180" />
            {ar ? "العودة للتطبيق" : "Back to app"}
          </Link>
          <p className="mt-3 break-all text-[11px] text-muted-foreground">
            {identity.data.email}
          </p>
        </div>
      </aside>
      <div className="admin-body">
        {identity.data.readOnly && (
          <p role="status" className="border-b bg-muted px-6 py-3 text-sm">
            {identity.data.capabilities?.templateAvailability
              ? ar
                ? "إدارة القوالب والعملاء مفعلة. تبقى الإجراءات المالية والمتقدمة مقيّدة."
                : "Template and customer management enabled. Financial and advanced actions remain restricted."
              : ar
                ? "وضع القراءة فقط. التغييرات متوقفة حتى اكتمال إعداد الإنتاج والنسخ الاحتياطي."
                : "Read-only access. Changes are disabled until production backup and activation checks are complete."}
          </p>
        )}
        <header className="admin-topbar">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>{ar ? "مساحة خاصة بالمالك" : "Private owner workspace"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={ar ? "تأكيد كلمة المرور" : "Confirm password"}
              onClick={() => setConfirm(true)}
            >
              <ShieldCheck className="me-1.5 h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {ar ? "تأكيد كلمة المرور" : "Confirm password"}
              </span>
            </Button>
            <LanguageToggle />
            <Button
              variant="ghost"
              size="icon"
              aria-label={ar ? "تغيير المظهر" : "Toggle theme"}
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>
        <div className="border-b px-5 py-3 lg:hidden">
          <label className="sr-only" htmlFor="admin-navigation">
            {ar ? "التنقل" : "Navigation"}
          </label>
          <select
            id="admin-navigation"
            className="admin-select"
            value={section.id}
            onChange={(event) =>
              navigate(
                event.target.value === "overview"
                  ? "/admin"
                  : `/admin/${event.target.value}`,
              )
            }
          >
            {adminSections.map((item) => (
              <option key={item.id} value={item.id}>
                {ar ? item.ar : item.en}
              </option>
            ))}
          </select>
        </div>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[.16em] text-muted-foreground">
                {ar ? "إدارة المنصة" : "Platform management"}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight">
                {ar ? section.ar : section.en}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {ar ? section.descriptionAr : section.description}
              </p>
            </div>
            {!id && sectionId !== "templates" && !identity.data.readOnly && (
              <AdminCreateAction resource={sectionId} />
            )}
          </div>
          <AdminPageBoundary key={`${sectionId}/${id ?? "list"}`} ar={ar}>
            {sectionId === "overview" ? (
              <AdminOverview />
            ) : sectionId === "templates" ? (
              <AdminTemplates id={id} readOnly={!(identity.data.capabilities?.templateAvailability ?? !identity.data.readOnly)} />
            ) : sectionId === "customers" && id ? (
              <AdminCustomer
                id={id}
                readOnly={Boolean(identity.data.readOnly)}
                canEditProfile={identity.data.capabilities?.customerProfile ?? !identity.data.readOnly}
                canChangeStatus={identity.data.capabilities?.customerStatus ?? !identity.data.readOnly}
              />
            ) : sectionId === "generations" ? (
              <AdminGenerations id={id} />
            ) : sectionId === "payments" && !id ? (
              <AdminPayments />
            ) : sectionId === "support" && id ? (
              <AdminSupport
                id={id}
                readOnly={Boolean(identity.data.readOnly)}
              />
            ) : sectionId === "settings" ? (
              <AdminSettings />
            ) : resource.success ? (
              id ? (
                <AdminRecordDetail
                  key={`${sectionId}/${id}`}
                  resource={resource.data}
                  id={id}
                />
              ) : (
                <AdminRecordList key={sectionId} resource={resource.data} />
              )
            ) : (
              <p>{ar ? "الصفحة غير موجودة" : "Page not found"}</p>
            )}
          </AdminPageBoundary>
        </main>
        <footer className="px-5 py-5 text-xs text-muted-foreground lg:px-10">
          {ar
            ? "إجراءات المالك والوصول إلى الوسائط مسجلة"
            : "Owner actions and private media access are logged"}
        </footer>
      </div>
    </div>
  );
}
