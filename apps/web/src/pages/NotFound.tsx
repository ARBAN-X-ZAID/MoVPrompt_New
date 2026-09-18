import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="text-center relative z-10">
        <h1 className="mb-4 text-5xl font-display font-bold text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">{t("notFound.title")}</p>
        <a href="/" className="text-primary hover:text-primary/80 underline underline-offset-4 transition-colors">
          {t("notFound.home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;
