import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, CreditCard, Download, FolderOpen, Globe2, LayoutTemplate, Loader2, LogOut, Menu, Moon, Settings, Sparkles, Sun, UserRoundCog, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/ThemeProvider";
import { useAuth } from "@/hooks/useAuth";
import { CreditBadge } from "@/components/credits/CreditBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.svg";
import "./creator.css";
import { useLanguage } from "@/i18n/LanguageContext";
import { isFeatureEnabled } from "@/config/features";
import { DRAFT_SAVE_EVENT, type DraftSaveEventDetail } from "./guestDraftStore";
import { SaveStatusIndicator, type SaveLifecycleState } from "./SaveStatusIndicator";

const NAVIGATION = [
  { to: "/create", label: "Create", icon: Sparkles },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/projects", label: "Projects", icon: FolderOpen },
  // Advanced Mode stays implemented but is intentionally absent from public navigation for this release.
];

type StudioChrome = {
  title: string;
  templatePath: string;
  onExport?: () => void;
};

export function CreatorShell({ children, qaMode = false, studio }: { children: ReactNode; qaMode?: boolean; studio?: StudioChrome }) {
  const { theme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLanguage();
  const ar = locale === "ar";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [studioSaveState, setStudioSaveState] = useState<SaveLifecycleState>("idle");
  const [signingOut, setSigningOut] = useState(false);
  const studioActive = Boolean(studio);
  const qaPrefix = qaMode ? "/qa/create" : "";
  const developmentFreeGeneration = import.meta.env.DEV && isFeatureEnabled("developmentFreeGeneration");

  useEffect(() => {
    if (!studioActive) return;
    setStudioSaveState("idle");
    const handleDraftSave = (event: Event) => {
      const detail = (event as CustomEvent<DraftSaveEventDetail>).detail;
      if (detail?.state) setStudioSaveState(detail.state);
    };
    window.addEventListener(DRAFT_SAVE_EVENT, handleDraftSave);
    return () => window.removeEventListener(DRAFT_SAVE_EVENT, handleDraftSave);
  }, [location.pathname, location.search, studio?.templatePath, studioActive]);

  const routeFor = (to: string) => {
    if (!qaMode) return to;
    if (to === "/create") return "/qa/create";
    if (to === "/templates") return "/qa/create?view=templates";
    if (to === "/projects") return "/qa/create?view=projects";
    return to;
  };

  const isActive = (to: string) => {
    if (qaMode) {
      const view = new URLSearchParams(location.search).get("view");
      if (to === "/templates") return view === "templates";
      if (to === "/projects") return view === "projects";
      if (to === "/create") return !view;
      return false;
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch {
      toast.error(ar ? "تعذر تسجيل الخروج. حاول مرة ثانية." : "We couldn’t sign you out. Try again.");
      setSigningOut(false);
    }
  };

  return (
    <div className="creator-app min-h-[100dvh] bg-background text-foreground">
      <a className="creator-skip-link" href="#creator-main">{ar ? "انتقل إلى مساحة العمل" : "Skip to workspace"}</a>
      <header className={cn("creator-header", studio && "creator-studio-header")}>
        <div className="creator-header-inner">
          <Link to={qaPrefix || "/"} className="creator-brand" aria-label="MovPrompt home">
            <span className="creator-brand-mark"><img src={logoMark} alt="" /></span>
            <span>MovPrompt</span>
          </Link>

          {studio ? (
            <>
              <div className="creator-studio-project">
                <span>{studio.title}</span>
              </div>
              <nav className="creator-mode-tabs" aria-label="Creation mode">
                <Link to={studio.templatePath}>{ar ? "القالب" : "Template"}</Link>
                <span aria-current="page">{ar ? "متقدم" : "Advanced"}</span>
              </nav>
              <SaveStatusIndicator state={studioSaveState} arabic={ar} className="creator-saved-state" />
            </>
          ) : (
            <nav className="creator-desktop-nav" aria-label="Creator workspace">
              {NAVIGATION.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={routeFor(item.to)}
                    className={cn("creator-nav-link", isActive(item.to) && "is-active")}
                  >
                    <Icon aria-hidden="true" />
                    {ar ? ({ Create: "إنشاء", Templates: "القوالب", Projects: "المشاريع" } as const)[item.label] : item.label}
                  </NavLink>
                );
              })}
            </nav>
          )}

          <div className="creator-header-actions">
            {qaMode && <span className="creator-demo-badge">Local preview</span>}
            {!qaMode && !developmentFreeGeneration && user && <CreditBadge className="creator-credit-pill" />}
            {studio?.onExport && <button className="creator-studio-export" type="button" onClick={studio.onExport}><Download aria-hidden="true" /> {ar ? "تصدير" : "Export"}</button>}
            {user && <Link className="creator-icon-button" to="/notifications" aria-label={ar ? "الإشعارات" : "Notifications"}><Bell aria-hidden="true" /></Link>}
            <button className="creator-language-button" type="button" onClick={() => setLocale(locale === "en" ? "ar" : "en")} aria-label={locale === "en" ? "Use Arabic interface" : "Use English interface"}><Globe2 aria-hidden="true" /><span>{locale === "en" ? "العربية" : "English"}</span></button>
            <button className="creator-icon-button" type="button" onClick={toggleTheme} aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`}>
              {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </button>
            <button className="creator-icon-button creator-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="creator-mobile-nav" aria-label={menuOpen ? "Close menu" : "Open menu"}>
              {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
            {!qaMode && !user ? <Link className="creator-button creator-button-secondary creator-sign-in" to={studio ? `/auth?next=${encodeURIComponent(location.pathname + location.search)}` : "/auth?next=/create"}>{ar ? "تسجيل الدخول" : "Sign in"}</Link> : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="creator-avatar" type="button" aria-label={user.email ? `${ar ? "قائمة الحساب" : "Account menu"}: ${user.email}` : ar ? "قائمة الحساب" : "Account menu"}>
                    {(user.name || user.email || "MP").slice(0, 2).toUpperCase()}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="min-w-0 px-3 py-2">
                    <span className="block truncate text-sm">{user.name || (ar ? "الحساب" : "Account")}</span>
                    {user.email && <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">{user.email}</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="min-h-11 gap-3">
                    <Link to="/account/settings"><Settings aria-hidden="true" className="h-4 w-4" />{ar ? "إعدادات الحساب" : "Account settings"}</Link>
                  </DropdownMenuItem>
                  {!developmentFreeGeneration && <DropdownMenuItem asChild className="min-h-11 gap-3">
                    <Link to="/account/billing"><CreditCard aria-hidden="true" className="h-4 w-4" />{ar ? "الرصيد والتسعير" : "Credits & pricing"}</Link>
                  </DropdownMenuItem>}
                  <DropdownMenuItem asChild className="min-h-11 gap-3">
                    <Link to="/account/preferences"><UserRoundCog aria-hidden="true" className="h-4 w-4" />{ar ? "التفضيلات" : "Preferences"}</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="min-h-11 gap-3 text-muted-foreground focus:bg-destructive/10 focus:text-destructive"
                    disabled={signingOut}
                    onSelect={() => void handleSignOut()}
                  >
                    {signingOut ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <LogOut aria-hidden="true" className="h-4 w-4" />}
                    {signingOut ? (ar ? "جارٍ تسجيل الخروج…" : "Signing out…") : (ar ? "تسجيل الخروج" : "Sign out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="creator-avatar" aria-label={ar ? "مستخدم المعاينة" : "Preview user"}>MP</div>
            )}
          </div>
        </div>

        {menuOpen && (
          <nav id="creator-mobile-nav" className="creator-mobile-nav" aria-label="Mobile creator workspace">
            {NAVIGATION.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink key={item.to} to={routeFor(item.to)} onClick={() => setMenuOpen(false)} className={cn("creator-nav-link", isActive(item.to) && "is-active")}>
                  <Icon aria-hidden="true" />
                  {ar ? ({ Create: "إنشاء", Templates: "القوالب", Projects: "المشاريع" } as const)[item.label] : item.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>
      <main id="creator-main">{children}</main>
    </div>
  );
}
