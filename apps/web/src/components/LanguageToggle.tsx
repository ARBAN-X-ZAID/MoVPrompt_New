import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

export const LanguageToggle = () => {
  const { locale, setLocale } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(locale === "en" ? "ar" : "en")}
      className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Globe className="w-3.5 h-3.5" />
      {locale === "en" ? "عربي" : "EN"}
    </Button>
  );
};
