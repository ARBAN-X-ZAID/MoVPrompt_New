import { lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, NavLink, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ChevronRight, CreditCard, Film, LayoutDashboard, LayoutTemplate, LifeBuoy, Megaphone,
  Menu, Moon, Receipt, Settings, ShieldCheck, Sun, Users,
} from "lucide-react";
import { AdminResourceSchema } from "@movprompt/contracts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { useTheme } from "@/components/ThemeProvider";
import { LanguageToggle } from "@/components/LanguageToggle";
import { useLanguage } from "@/i18n/LanguageContext";
import { PortableApiError } from "@/lib/api/portableApiClient";
import { AdminPageBoundary } from "./AdminPageBoundary";
import { AdminPageHeader } from "./AdminChrome";
import { Loading } from "./AdminDisplay";
import { adminApi } from "./api";
import { OwnerAccess } from "./OwnerAccess";
import { adminSections } from "./labels";
import { OwnerAccessLoading } from "./OwnerAccessFrame";
import { configureAdminQueries, invalidateAdminData } from "./adminQueries";
import AdminCreateAction from "./AdminCreateAction";
import "./admin.css";

const AdminOverview = lazy(() => import("./AdminOverview"));
const AdminRecordList = lazy(() => import("./AdminRecordList"));
const AdminRecordDetail = lazy(() => import("./AdminRecordDetail"));
const AdminSettings = lazy(() => import("./AdminSettings"));
const AdminTemplates = lazy(() => import("./AdminTemplateManager"));
const AdminCustomer = lazy(() => import("./AdminCustomer"));
const AdminPayments = lazy(() => import("./AdminPayments"));
const AdminGenerations = lazy(() => import("./AdminGenerations"));
const AdminSupport = lazy(() => import("./AdminSupport"));
const AdminCampaignDetail = lazy(() => import("./AdminCampaignDetail"));
const AdminFinanceDetail = lazy(() => import("./AdminFinanceDetail"));

const NAV_ICONS = {
  overview: LayoutDashboard, customers: Users, campaigns: Megaphone, generations: Film, templates: LayoutTemplate,
  payments: CreditCard, credits: Receipt, support: LifeBuoy, settings: Settings,
} as const;
const NAV_GROUPS: { en: string; ar: string; items: string[] }[] = [
  { en: "", ar: "", items: ["overview"] },
  { en: "Customers", ar: "العملاء", items: ["customers", "campaigns", "generations", "support"] },
  { en: "Catalog", ar: "الكتالوج", items: ["templates"] },
  { en: "Finance", ar: "المالية", items: ["payments", "credits"] },
  { en: "Workspace", ar: "مساحة العمل", items: ["settings"] },
];

function AdminNavigation({ ar, onNavigate }: { ar: boolean; onNavigate?: () => void }) {
  return <nav className="admin-sidebar-nav" aria-label={ar ? "إدارة المنصة" : "Administration"}>
    {NAV_GROUPS.map(group => <div key={group.en || "home"} className="admin-nav-group">
      {group.en && <p className="admin-nav-title">{ar ? group.ar : group.en}</p>}
      {group.items.map(id => {
        const item = adminSections.find(section => section.id === id);
        if (!item) return null;
        const Icon = NAV_ICONS[id as keyof typeof NAV_ICONS] ?? LayoutDashboard;
        return <NavLink key={id} to={id === "overview" ? "/admin" : `/admin/${id}`} end={id === "overview"} onClick={onNavigate}
          className={({ isActive }) => `admin-nav ${isActive ? "is-active" : ""}`}>
          <Icon aria-hidden="true" /><span>{ar ? item.ar : item.en}</span>
        </NavLink>;
      })}
    </div>)}
  </nav>;
}

export default function OwnerAdmin() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const client = useQueryClient();
  useState(() => configureAdminQueries(client));
  const [menuOpen, setMenuOpen] = useState(false);
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
    void client.invalidateQueries({ queryKey: ["admin", "identity"] });
    invalidateAdminData(client);
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
        <Brand ar={ar} />
        <AdminNavigation ar={ar} />
        <SidebarFoot ar={ar} email={identity.data.email} />
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side={ar ? "right" : "left"} className="admin-drawer admin-workspace w-[280px]" dir={ar ? "rtl" : "ltr"}>
          <SheetTitle className="sr-only">{ar ? "التنقل" : "Navigation"}</SheetTitle>
          <SheetDescription className="sr-only">{ar ? "أقسام إدارة المالك" : "Owner admin sections"}</SheetDescription>
          <Brand ar={ar} />
          <AdminNavigation ar={ar} onNavigate={() => setMenuOpen(false)} />
          <SidebarFoot ar={ar} email={identity.data.email} />
        </SheetContent>
      </Sheet>
      <div className="admin-body">
        {identity.data.readOnly && (
          <p role="status" className="admin-banner">
            {identity.data.capabilities?.walletManagement
              ? ar
                ? "إدارة المحفظة مفعّلة. يخضع الاسترداد النقدي للتحقق من بوابة الدفع."
                : "Wallet management is on. Cash refunds need verified gateway readiness."
              : identity.data.capabilities?.templateAvailability
                ? ar
                  ? "إدارة القوالب والعملاء مفعلة. تبقى الإجراءات المالية مقيّدة."
                  : "Template and customer management is on. Financial actions stay restricted."
                : ar
                  ? "وضع القراءة فقط حتى اكتمال إعداد الإنتاج."
                  : "Read-only until production setup is complete."}
          </p>
        )}
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={ar ? "فتح القائمة" : "Open menu"} onClick={() => setMenuOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="admin-crumbs">
              {id ? <>
                <Link to={`/admin/${section.id}`}>{ar ? section.ar : section.en}</Link>
                <ChevronRight aria-hidden="true" className="rtl:rotate-180" />
                <strong>{ar ? "التفاصيل" : "Details"}</strong>
              </> : <strong>{ar ? section.ar : section.en}</strong>}
            </div>
          </div>
          <div className="admin-topbar-actions">
            <LanguageToggle />
            <Button variant="ghost" size="icon" aria-label={ar ? "تغيير المظهر" : "Toggle theme"} onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>
        <main id="admin-main" className="admin-main" tabIndex={-1}>
          {!id && sectionId !== "templates" && (
            <AdminPageHeader
              title={ar ? section.ar : section.en}
              description={ar ? section.descriptionAr : section.description}
              actions={!identity.data.readOnly ? <AdminCreateAction resource={sectionId} /> : undefined}
            />
          )}
          <AdminPageBoundary key={`${sectionId}/${id ?? "list"}`} ar={ar}>
            <Suspense fallback={<Loading variant={id ? "detail" : "table"} />}>
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
                canManageWallet={identity.data.capabilities?.walletManagement ?? !identity.data.readOnly}
              />
            ) : sectionId === "generations" ? (
              <AdminGenerations id={id} />
            ) : sectionId === "payments" && !id ? (
              <AdminPayments />
            ) : sectionId === "campaigns" && id ? (
              <AdminCampaignDetail id={id} />
            ) : (sectionId === "payments" || sectionId === "credits") && id ? (
              <AdminFinanceDetail resource={sectionId} id={id} />
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
            </Suspense>
          </AdminPageBoundary>
        </main>
        <footer className="admin-foot">
          {ar ? "إجراءات المالك والوصول إلى الوسائط مسجلة" : "Owner actions and private media access are logged"}
        </footer>
      </div>
    </div>
  );
}

function Brand({ ar }: { ar: boolean }) {
  return <Link to="/admin" className="admin-brand">
    <span className="admin-brand-mark"><ShieldCheck aria-hidden="true" /></span>
    <span><strong>MovPrompt</strong><small>{ar ? "إدارة المالك" : "Owner admin"}</small></span>
  </Link>;
}

function SidebarFoot({ ar, email }: { ar: boolean; email: string }) {
  return <div className="admin-sidebar-foot">
    <Link to="/templates"><ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 rtl:rotate-180" />{ar ? "العودة للتطبيق" : "Back to app"}</Link>
    <span className="break-all">{email}</span>
  </div>;
}
