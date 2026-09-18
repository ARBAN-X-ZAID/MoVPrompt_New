import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Seo } from "@/components/Seo";
import { isFeatureEnabled } from "@/config/features";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { portableAuthActions } from "@/lib/auth/portableAuthActions";
import { authErrorMessage } from "@/lib/auth/portableAuthClient";
import { readAuthReturnIntent } from "@/lib/auth/returnPath";

const portableAuth = isFeatureEnabled("portableAuth");

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(() => portableAuth && Boolean(searchParams.get("token")));
  const [checking, setChecking] = useState(!portableAuth);
  const [formError, setFormError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const token = searchParams.get("token");

  useEffect(() => {
    if (portableAuth) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
      setChecking(false);
    });
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    const timeout = window.setTimeout(() => setChecking(false), 3000);
    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  async function handleReset(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (password !== confirmPassword) {
      setFormError(t("reset.passwordsMismatch"));
      return;
    }
    if (password.length < 10) {
      setFormError("Use at least 10 characters.");
      return;
    }

    setLoading(true);
    const result = portableAuth && token
      ? await portableAuthActions.resetPassword({ newPassword: password, token }) as { error?: unknown }
      : await supabase.auth.updateUser({ password });
    setLoading(false);

    if (result.error) {
      setFormError(authErrorMessage(result.error));
      return;
    }
    toast({ title: t("reset.success"), description: t("reset.successDesc") });
    const next = readAuthReturnIntent();
    navigate(`/auth?next=${encodeURIComponent(next)}`, { replace: true });
  }

  if (checking) {
    return <main className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite"><Loader2 aria-hidden className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Checking your reset link</span></main>;
  }

  if (!isRecovery) {
    return <main className="min-h-screen bg-background flex items-center justify-center px-4"><Seo title="Reset password — MovPrompt" description="Set a new password for your MovPrompt account." path="/reset-password" noindex /><motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4"><p className="text-muted-foreground">{t("reset.invalidLink")}</p><Button variant="outline" onClick={() => navigate("/auth")}>{t("reset.goSignIn")}</Button></motion.div></main>;
  }

  const fieldClass = "h-11 bg-background border-border text-foreground focus-visible:border-primary/60";
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <Seo title="Reset password — MovPrompt" description="Set a new password for your MovPrompt account." path="/reset-password" noindex />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 w-full max-w-sm">
        <button type="button" onClick={() => navigate("/auth")} className="min-h-11 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden className="w-4 h-4" /> {t("reset.backToApp")}</button>
        <h1 className="text-2xl font-display font-bold mb-1">Reset password — <span className="text-primary">MovPrompt</span></h1>
        <p className="text-sm text-muted-foreground mb-6">{t("reset.setNew")}</p>
        <Card className="bg-card border-border"><CardContent className="p-5"><form onSubmit={handleReset} className="space-y-4" aria-describedby="password-requirement reset-error">
          <div className="space-y-1.5"><Label htmlFor="new-password">{t("reset.newPassword")}</Label><Input className={fieldClass} id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} aria-invalid={Boolean(formError)} /></div>
          <div className="space-y-1.5"><Label htmlFor="confirm-password">{t("reset.confirmPassword")}</Label><Input className={fieldClass} id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={10} aria-invalid={Boolean(formError)} /></div>
          <p id="password-requirement" className="text-xs text-muted-foreground">Use at least 10 characters.</p>
          <p ref={errorRef} id="reset-error" role="alert" tabIndex={-1} className="min-h-5 text-sm text-destructive">{formError}</p>
          <Button type="submit" className="w-full min-h-11" disabled={loading}>{loading ? <Loader2 aria-hidden className="w-4 h-4 animate-spin me-2" /> : <KeyRound aria-hidden className="w-4 h-4 me-2" />}{t("reset.updatePassword")}</Button>
        </form></CardContent></Card>
      </motion.div>
    </main>
  );
}
