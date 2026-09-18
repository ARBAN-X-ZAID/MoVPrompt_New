import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Upload, Wand2 } from "lucide-react";

interface Popup {
  id: string;
  title: string;
  title_ar: string | null;
  message: string;
  message_ar: string | null;
  image_url: string | null;
  link_url: string | null;
  link_text: string | null;
  link_text_ar: string | null;
}

const ONBOARDING_SEEN_KEY = "welcome_onboarding_seen";
const FIRST_SIGNUP_FLAG = "first_signup_pending";

const WelcomePopup = () => {
  const { user } = useAuth();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [open, setOpen] = useState(false);
  const { locale, t } = useLanguage();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("welcome_popups_public")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (cancelled) return;

      if (data) {
        const key = `welcome_popup_seen_${data.id}`;
        if (sessionStorage.getItem(key)) {
          try { sessionStorage.setItem("movprompt.welcomeChecked", "1"); } catch { /* ignore */ }
          return;
        }
        setPopup(data as Popup);
        setOpen(true);
        return;
      }

      // No admin popup — show onboarding once for first-time signups.
      const isFirstSignup = localStorage.getItem(FIRST_SIGNUP_FLAG) === "1";
      const onboardingKey = `${ONBOARDING_SEEN_KEY}_${user.id}`;
      const alreadySeen = localStorage.getItem(onboardingKey) === "1";
      if (isFirstSignup && !alreadySeen) {
        setShowOnboarding(true);
        setOpen(true);
      } else {
        try { sessionStorage.setItem("movprompt.welcomeChecked", "1"); } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleClose = () => {
    if (popup) {
      sessionStorage.setItem(`welcome_popup_seen_${popup.id}`, "1");
    }
    if (showOnboarding && user) {
      localStorage.setItem(`${ONBOARDING_SEEN_KEY}_${user.id}`, "1");
      localStorage.removeItem(FIRST_SIGNUP_FLAG);
    }
    // Signal the tour can start now that the welcome popup is dismissed
    try {
      sessionStorage.setItem("movprompt.welcomeDismissed", "1");
      sessionStorage.setItem("movprompt.welcomeChecked", "1");
    } catch { /* ignore */ }
    setOpen(false);
  };

  if (!popup && !showOnboarding) return null;

  const isAr = locale === "ar";

  if (showOnboarding && !popup) {
    const steps = [
      { icon: Upload, title: t("onboarding.step1.title"), desc: t("onboarding.step1.desc") },
      { icon: Sparkles, title: t("onboarding.step2.title"), desc: t("onboarding.step2.desc") },
      { icon: Wand2, title: t("onboarding.step3.title"), desc: t("onboarding.step3.desc") },
    ];
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md" dir={isAr ? "rtl" : "ltr"}>
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <img src="/logo-mark.svg" alt="" className="w-7 h-7" />
              <DialogTitle className="text-xl">{t("onboarding.title")}</DialogTitle>
            </div>
            <DialogDescription className="text-sm">{t("onboarding.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-3">
            <Button size="sm" onClick={handleClose}>{t("onboarding.cta")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Admin-configured popup
  const title = (isAr && popup!.title_ar) || popup!.title;
  const message = (isAr && popup!.message_ar) || popup!.message;
  const linkText = (isAr && popup!.link_text_ar) || popup!.link_text || t("welcomePopup.learnMore");

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.svg" alt="" className="w-7 h-7" />
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
        </DialogHeader>
        {popup!.image_url && (
          /\.(mp4|webm|mov|ogg)(\?|$)/i.test(popup!.image_url) ? (
            <video src={popup!.image_url} className="w-full rounded-md max-h-48 object-cover" controls autoPlay muted loop />
          ) : (
            <img src={popup!.image_url} alt="" className="w-full rounded-md max-h-48 object-cover" />
          )
        )}
        <DialogDescription className="text-sm whitespace-pre-wrap">{message}</DialogDescription>
        <div className="flex justify-end gap-2 mt-2">
          {popup!.link_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={popup!.link_url} target="_blank" rel="noopener noreferrer">{linkText}</a>
            </Button>
          )}
          <Button size="sm" onClick={handleClose}>OK</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomePopup;
