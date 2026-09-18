import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

export const InstallPrompt = () => {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (isIOS() && !isStandalone()) {
      const iosDismissed = sessionStorage.getItem("ios-install-dismissed");
      if (!iosDismissed) setShowIOSPrompt(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIOSPrompt(false);
    sessionStorage.setItem("ios-install-dismissed", "1");
  };

  if (!isMobile || isStandalone() || dismissed) return null;

  const showBanner = deferredPrompt || showIOSPrompt;
  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="fixed bottom-4 left-4 right-4 z-50"
      >
        <div className="bg-card border border-border/60 rounded-xl p-4 shadow-lg shadow-black/30 backdrop-blur-sm">
          <button
            onClick={handleDismiss}
            aria-label="Dismiss install prompt"
            className="absolute top-2 end-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {deferredPrompt ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/logo-mark.svg" alt="" className="w-7 h-7" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("install.title")}</p>
                <p className="text-xs text-muted-foreground">{t("install.desc")}</p>
              </div>
              <Button size="sm" onClick={handleInstall} className="shrink-0">
                {t("install.btn")}
              </Button>
            </div>
          ) : (
            <div className="flex items-start gap-3 pe-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Share className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{t("install.title")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap <span className="inline-flex items-center"><Share className="w-3 h-3 mx-0.5" /></span> then <strong>"Add to Home Screen"</strong>
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
