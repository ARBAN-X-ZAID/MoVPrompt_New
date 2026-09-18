import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Seo } from "@/components/Seo";

const About = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="About us — MovPrompt"
        description="Learn more about MovPrompt, the AI Director of Photography for cinematic video prompts."
        path="/about"
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
            {t("about.title")}
          </h1>

          <section className="space-y-3">
            <p className="text-sm text-muted-foreground leading-relaxed">{t("about.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("about.mission.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("about.mission.body")}</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{t("about.contact.title")}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("about.contact.body")}</p>
          </section>
        </article>
      </div>
    </div>
  );
};

export default About;
