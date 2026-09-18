import { Link } from "react-router-dom";
import { ArrowLeft, Globe, Bell, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useTheme } from "@/components/ThemeProvider";
import { useLanguage } from "@/i18n/LanguageContext";

const AccountPreferences = () => {
  const { theme, setTheme } = useTheme();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  return (
    <CreatorShell>
      <Seo title={`${tr("Preferences", "التفضيلات")} · MovPrompt`} description={tr("Language, theme, and notification preferences.", "تفضيلات اللغة والمظهر والإشعارات.")} noindex />
      <div className="creator-page max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 min-h-11 gap-2">
          <Link to="/create"><ArrowLeft aria-hidden="true" className="w-4 h-4" /> {tr("Back to workspace", "العودة لمساحة العمل")}</Link>
        </Button>
        <h1 className="text-2xl font-display font-bold mb-6">{tr("Preferences", "التفضيلات")}</h1>
        <div className="space-y-4">
          <Card className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Globe aria-hidden="true" className="w-4 h-4 text-accent" />
              <div>
                <p className="font-medium text-sm">{tr("Language", "اللغة")}</p>
                <p className="text-xs text-muted-foreground">{tr("Choose your interface language", "اختر لغة واجهة الاستخدام")}</p>
              </div>
            </div>
            <LanguageToggle />
          </Card>
          <Card className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon aria-hidden="true" className="w-4 h-4 text-accent" /> : <Sun aria-hidden="true" className="w-4 h-4 text-accent" />}
              <div>
                <p className="font-medium text-sm">{tr("Appearance", "المظهر")}</p>
                <p className="text-xs text-muted-foreground">{tr("Choose dark or light mode", "اختر الوضع الداكن أو الفاتح")}</p>
              </div>
            </div>
            <div className="inline-flex self-start rounded-md border border-border p-0.5 sm:self-auto" role="group" aria-label={tr("Choose color theme", "اختر مظهر الألوان")}>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                aria-pressed={theme === "dark"}
                className={`min-h-11 px-3 py-1.5 text-xs rounded-[4px] transition-colors ${theme === "dark" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tr("Dark", "داكن")}
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                aria-pressed={theme === "light"}
                className={`min-h-11 px-3 py-1.5 text-xs rounded-[4px] transition-colors ${theme === "light" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {tr("Light", "فاتح")}
              </button>
            </div>
          </Card>
          <Card className="p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Bell aria-hidden="true" className="w-4 h-4 text-accent" />
              <div>
                <p className="font-medium text-sm">{tr("Notifications", "الإشعارات")}</p>
                <p className="text-xs text-muted-foreground">{tr("Review generation, export, and account alerts", "راجع إشعارات التوليد والتصدير والحساب")}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="min-h-11" asChild><Link to="/notifications">{tr("View notifications", "عرض الإشعارات")}</Link></Button>
          </Card>
        </div>
      </div>
    </CreatorShell>
  );
};

export default AccountPreferences;
