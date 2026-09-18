import { useState, useEffect } from "react";
import { trackPageVisit } from "@/lib/analytics";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { WorkflowPanel } from "@/components/WorkflowPanel";
import { motion } from "framer-motion";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import WelcomePopup from "@/components/WelcomePopup";
import { TopNav } from "@/components/TopNav";

const Index = () => {
  const [model, setModel] = useState("any");
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    trackPageVisit("/");
  }, []);

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">

      <TopNav />

      <div className="relative z-10 container max-w-[1400px] mx-auto px-4 py-3 sm:py-4">
        <AnnouncementBanner />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <WorkflowPanel selectedModel={model} onSwitchModel={setModel} />
        </motion.div>

        <footer className="mt-3 text-center">
          <p className="text-xs text-muted-foreground/60 font-light">
            {t("footer")}
          </p>
        </footer>
      </div>
      <InstallPrompt />
      {!loading && user && <WelcomePopup />}
      
    </div>
  );
};

export default Index;

