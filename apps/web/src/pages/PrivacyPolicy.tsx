import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Seo } from "@/components/Seo";

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Privacy policy — MovPrompt"
        description="How MovPrompt collects, uses, and protects your data."
        path="/privacy"
      />

      <div className="relative z-10 container max-w-3xl mx-auto px-4 py-6 sm:py-12">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t("terms.back")}</span>
          </Button>
          <LanguageToggle />
        </div>

        <article className="prose prose-invert prose-sm max-w-none space-y-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-foreground">
            {t("privacy.title")}
          </h1>
          <p className="text-muted-foreground text-xs">
            {t("terms.lastUpdated")}: April 16, 2026
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.collect.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.collect.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.use.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.use.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.storage.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.storage.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.sharing.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.sharing.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.cookies.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.cookies.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.rights.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.rights.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.children.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.children.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.changes.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.changes.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("privacy.contact.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("privacy.contact.body")}</p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
