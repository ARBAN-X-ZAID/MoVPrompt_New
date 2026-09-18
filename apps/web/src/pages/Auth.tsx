import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, Eye, EyeOff, History, Layers, Loader2, Mail, ShieldCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Seo } from "@/components/Seo";
import logoMark from "@/assets/logo-mark-white.svg";
import { enabledSocialAuthProviders } from "@/config/authProviders";
import { isEmailVerificationRequired } from "@/config/authPolicy";
import { isFeatureEnabled } from "@/config/features";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/auth/portableAuthClient";
import { portableAuthActions } from "@/lib/auth/portableAuthActions";
import { isAuthRequestTimeout, withAuthRequestTimeout } from "@/lib/auth/requestTimeout";
import { authCallbackUrl, rememberAuthReturnIntent, safeAuthReturnPath } from "@/lib/auth/returnPath";
import { portableCreatorApi } from "@/lib/api/portableApiClient";
import type { AuthCapability } from "@movprompt/contracts";
import "./auth.css";

const portableAuth = isFeatureEnabled("portableAuth");
const requireEmailVerification = isEmailVerificationRequired();

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextPath = safeAuthReturnPath(searchParams.get("next"));
  const callbackURL = useMemo(
    () => portableAuth ? authCallbackUrl(nextPath) : `${window.location.origin}${nextPath}`,
    [nextPath],
  );
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t, locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<"email" | "google" | "apple" | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [serverCapability, setServerCapability] = useState<AuthCapability | null>(null);
  const [formError, setFormError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signUpStatus, setSignUpStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [signUpSecondsRemaining, setSignUpSecondsRemaining] = useState(30);
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const errorRef = useRef<HTMLParagraphElement | null>(null);
  const socialProviders = enabledSocialAuthProviders(serverCapability);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!portableAuth) return;
    void portableCreatorApi.featureFlags()
      .then((result) => setServerCapability(result.auth))
      .catch(() => setServerCapability(null));
  }, []);

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  useEffect(() => {
    if (signUpStatus !== "loading") return;
    const countdown = window.setInterval(() => {
      setSignUpSecondsRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(countdown);
  }, [signUpStatus]);

  const features = [
    { icon: Camera, title: t("auth.feat.dop.title"), description: t("auth.feat.dop.desc") },
    { icon: Layers, title: t("auth.feat.workflows.title"), description: t("auth.feat.workflows.desc") },
    { icon: History, title: t("auth.feat.save.title"), description: t("auth.feat.save.desc") },
  ];

  useEffect(() => {
    if (user) navigate(nextPath, { replace: true });
  }, [navigate, nextPath, user]);

  async function emailSignIn(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setBusy("email");
    try {
      if (portableAuth) {
        const result = await withAuthRequestTimeout(
          portableAuthActions.signInEmail({ email, password, callbackURL }),
        );
        if ((result as { error?: unknown }).error) {
          throw new Error(authErrorMessage((result as { error?: unknown }).error));
        }
        navigate(nextPath, { replace: true });
        return;
      }
      const { error } = await withAuthRequestTimeout(
        supabase.auth.signInWithPassword({ email, password }),
      );
      if (error) throw error;
    } catch (error) {
      const message = isAuthRequestTimeout(error)
        ? `${t("auth.signInTimeout")} ${t("auth.draftStillSaved")}`
        : `${authErrorMessage(error)} ${t("auth.draftStillSaved")}`;
      setFormError(message);
      toast({ title: t("toast.signInFailed"), description: message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function emailSignUp(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setSignUpStatus("idle");
    if (!agreedToTerms) {
      setFormError(t("auth.mustAgreeTerms"));
      setSignUpStatus("error");
      toast({ title: t("auth.mustAgreeTerms"), variant: "destructive" });
      return;
    }
    setSignUpSecondsRemaining(30);
    setSignUpStatus("loading");
    setBusy("email");
    try {
      if (portableAuth) {
        const displayName = name.trim() || email.split("@")[0] || "Creator";
        const result = await withAuthRequestTimeout(
          portableAuthActions.signUpEmail({ email, password, name: displayName, callbackURL }),
        );
        if ((result as { error?: unknown }).error) {
          throw new Error(authErrorMessage((result as { error?: unknown }).error));
        }
        try { localStorage.setItem("first_signup_pending", "1"); } catch { /* optional welcome state */ }
        setSignUpStatus("success");
        if (requireEmailVerification) {
          toast({ title: t("auth.checkEmailTitle"), description: t("auth.checkEmailDesc") });
        } else {
          toast({ title: t("auth.accountReadyTitle"), description: t("auth.accountReadyDesc") });
          navigate(nextPath, { replace: true });
        }
        return;
      }
      const { error } = await withAuthRequestTimeout(
        supabase.auth.signUp({ email, password, options: { emailRedirectTo: callbackURL } }),
      );
      if (error) throw error;
      setSignUpStatus("success");
      toast({ title: t("auth.accountReadyTitle"), description: t("auth.accountReadyDesc") });
    } catch (error) {
      const message = isAuthRequestTimeout(error)
        ? `${t("auth.signUpTimeout")} ${t("auth.draftStillSaved")}`
        : `${authErrorMessage(error)} ${t("auth.draftStillSaved")}`;
      setSignUpStatus("error");
      setFormError(message);
      toast({ title: t("toast.signUpFailed"), description: message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function forgotPassword(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    setBusy("email");
    const redirectTo = `${window.location.origin}/reset-password`;
    try {
      const result = await withAuthRequestTimeout(portableAuth
        ? portableAuthActions.requestPasswordReset({ email, redirectTo }) as Promise<{ error?: unknown }>
        : supabase.auth.resetPasswordForEmail(email, { redirectTo }));
      if (result.error) throw new Error(authErrorMessage(result.error));
      toast({ title: t("toast.checkEmail"), description: t("auth.resetEmailDesc") });
      setForgotMode(false);
    } catch (error) {
      const message = isAuthRequestTimeout(error)
        ? `${t("auth.signInTimeout")} ${t("auth.draftStillSaved")}`
        : `${authErrorMessage(error)} ${t("auth.draftStillSaved")}`;
      setFormError(message);
      toast({ title: t("toast.resetFailed"), description: message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  async function socialSignIn(provider: "google" | "apple") {
    setBusy(provider);
    rememberAuthReturnIntent(nextPath);
    if (portableAuth) {
      const result = await portableAuthActions.signInSocial({ provider, callbackURL });
      if ((result as { error?: unknown }).error) {
        setBusy(null);
        toast({ title: t("auth.socialFailed").replace("{provider}", provider === "google" ? "Google" : "Apple"), description: `${authErrorMessage((result as { error?: unknown }).error)} ${t("auth.draftStillSaved")}`, variant: "destructive" });
      }
      return;
    }
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: callbackURL });
    if (result.error) {
      setBusy(null);
      toast({ title: t("auth.socialFailed").replace("{provider}", provider === "google" ? "Google" : "Apple"), description: `${String(result.error)} ${t("auth.draftStillSaved")}`, variant: "destructive" });
    }
  }

  if (authLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center" role="status" aria-live="polite"><Loader2 aria-hidden className="w-6 h-6 animate-spin text-primary" /><span className="sr-only">Checking your session</span></div>;
  }

  const fieldClass = "auth-field h-12 rounded-xl border-border bg-background px-4 text-foreground placeholder:text-muted-foreground focus-visible:border-primary/70";
  const enterTransition = reduceMotion ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const };
  return (
    <main className="auth-page min-h-[100dvh] bg-background text-foreground">
      <Seo title="Sign in or create an account - MovPrompt" description="Save your campaign and start creating with MovPrompt." path="/auth" />

      <header className="auth-topbar">
        <Link to="/" className="auth-brand rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="MovPrompt home">
          <img className="auth-brand-mark" src={logoMark} alt="" width="28" height="28" />
          <span>MovPrompt</span>
        </Link>
        <div className="[&_button]:min-h-11"><LanguageToggle /></div>
      </header>

      <div className="auth-layout">
        <motion.aside
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={enterTransition}
          className="auth-story"
          aria-labelledby="auth-benefits-title"
        >
          <img className="auth-story-image" src="/homepage/hero-creator.png" alt="" />
          <div className="auth-story-shade" aria-hidden="true" />
          <div className="auth-story-copy">
            <p className="auth-context"><ShieldCheck aria-hidden="true" /> {locale === "ar" ? "مسودتك محمية" : "Your draft is protected"}</p>
            <h2 id="auth-benefits-title">{t("auth.heroTitle")} <span>{t("auth.heroCinema")}</span></h2>
            <p className="auth-story-description">{t("auth.heroDesc")}</p>
            <div className="auth-benefits">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...enterTransition, delay: reduceMotion ? 0 : 0.12 + index * 0.07 }}
                  className="auth-benefit"
                >
                  <span><feature.icon aria-hidden="true" /></span>
                  <div><strong>{feature.title}</strong><p>{feature.description}</p></div>
                </motion.div>
              ))}
            </div>
          </div>
          <p className="auth-story-caption"><Camera aria-hidden="true" /> {locale === "ar" ? "حملة صانع محتوى، جاهزة من نفس المسودة" : "A creator campaign, built from the same saved draft"}</p>
        </motion.aside>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...enterTransition, delay: reduceMotion ? 0 : 0.08 }}
          className="auth-form-section"
          aria-labelledby="auth-title"
        >
          <div className="auth-form-shell">
            <Link to="/create" className="auth-back-link"><ArrowLeft aria-hidden="true" /> {locale === "ar" ? "العودة إلى حملتك" : "Back to your campaign"}</Link>
            <div className="auth-mobile-promise"><ShieldCheck aria-hidden="true" /><span>{t("auth.draftStillSaved")}</span></div>
            <div className="auth-form-heading">
              <h1 ref={headingRef} id="auth-title" tabIndex={-1}>{t("auth.continueTitle")}</h1>
              <p>{t("auth.continueDesc")}</p>
            </div>

            <Card className="auth-card border-border bg-card">
              <CardContent className="space-y-5 p-5 sm:p-7">
                <AnimatePresence initial={false}>
                  {formError && (
                    <motion.p
                      ref={errorRef}
                      role="alert"
                      tabIndex={-1}
                      initial={reduceMotion ? false : { opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                    >
                      {formError}
                    </motion.p>
                  )}
                </AnimatePresence>

                {socialProviders.map((provider) => (
                  <Button key={provider} variant="outline" className="h-12 w-full rounded-xl" onClick={() => void socialSignIn(provider)} disabled={busy !== null}>
                    {busy === provider && <Loader2 aria-hidden="true" className="me-2 h-4 w-4 animate-spin" />}
                    {t(provider === "google" ? "auth.continueGoogle" : "auth.continueApple")}
                  </Button>
                ))}
                {socialProviders.length > 0 && <div className="relative" aria-hidden><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div><div className="relative flex justify-center text-xs"><span className="bg-card px-3 text-muted-foreground">{t("auth.or")}</span></div></div>}

                <Tabs defaultValue="signin" onValueChange={() => { setFormError(""); if (signUpStatus !== "loading") setSignUpStatus("idle"); }}>
                  <TabsList className="auth-tabs grid h-12 w-full grid-cols-2 rounded-xl p-1">
                    <TabsTrigger className="h-10 rounded-lg" value="signin">{t("auth.signIn")}</TabsTrigger>
                    <TabsTrigger className="h-10 rounded-lg" value="signup">{t("auth.signUp")}</TabsTrigger>
                  </TabsList>
                  <TabsContent value="signin">
                    <AnimatePresence mode="wait" initial={false}>
                      {forgotMode ? (
                        <motion.form key="forgot" initial={reduceMotion ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} onSubmit={forgotPassword} className="mt-5 space-y-4">
                          <p className="text-sm leading-relaxed text-muted-foreground">{t("auth.resetDesc")}</p>
                          <div className="space-y-2"><Label htmlFor="forgot-email">{t("auth.email")}</Label><Input className={fieldClass} id="forgot-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                          <Button className="h-12 w-full rounded-xl" disabled={busy !== null}>{busy === "email" && <Loader2 aria-hidden="true" className="me-2 h-4 w-4 animate-spin" />}{t("auth.sendResetLink")}</Button>
                          <button type="button" onClick={() => setForgotMode(false)} className="min-h-11 w-full text-sm text-primary hover:underline">{t("auth.backToSignIn")}</button>
                        </motion.form>
                      ) : (
                        <motion.form key="signin" initial={reduceMotion ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} onSubmit={emailSignIn} className="mt-5 space-y-4">
                          <div className="space-y-2"><Label htmlFor="signin-email">{t("auth.email")}</Label><Input className={fieldClass} id="signin-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                          <div className="space-y-2"><Label htmlFor="signin-password">{t("auth.password")}</Label><div className="auth-password-field"><Input className={fieldClass} id="signin-password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div></div>
                          <Button className="auth-submit h-12 w-full rounded-xl" disabled={busy !== null}>{busy === "email" ? <Loader2 aria-hidden="true" className="me-2 h-4 w-4 animate-spin" /> : <Mail aria-hidden="true" className="me-2 h-4 w-4" />}{t("auth.signIn")}</Button>
                          <button type="button" onClick={() => setForgotMode(true)} className="min-h-11 w-full text-sm text-muted-foreground hover:text-primary">{t("auth.forgotPassword")}</button>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </TabsContent>
                  <TabsContent value="signup">
                    <form onSubmit={emailSignUp} className="mt-5 space-y-4" aria-busy={signUpStatus === "loading"}>
                      <div className="space-y-2"><Label htmlFor="signup-name">{t("auth.name")}</Label><Input className={fieldClass} id="signup-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("auth.namePlaceholder")} /></div>
                      <div className="space-y-2"><Label htmlFor="signup-email">{t("auth.email")}</Label><Input className={fieldClass} id="signup-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
                      <div className="space-y-2"><Label htmlFor="signup-password">{t("auth.password")}</Label><div className="auth-password-field"><Input className={fieldClass} id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} aria-describedby="password-help" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>{showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button></div><p id="password-help" className="text-xs leading-relaxed text-muted-foreground">{t("auth.passwordHelp")}</p></div>
                      {!requireEmailVerification && <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground" role="note">{t("auth.verificationLaterNotice")}</p>}
                      <div className="flex items-start gap-3"><Checkbox id="agree-terms" checked={agreedToTerms} onCheckedChange={(checked) => setAgreedToTerms(checked === true)} className="mt-0.5" /><label htmlFor="agree-terms" className="text-xs leading-relaxed text-muted-foreground">{t("auth.agreeTerms")} <Link to="/terms" className="text-primary underline-offset-4 hover:underline" target="_blank">{t("auth.termsLink")}</Link> &amp; <Link to="/privacy" className="text-primary underline-offset-4 hover:underline" target="_blank">{t("auth.privacyLink")}</Link></label></div>
                      <AnimatePresence mode="wait" initial={false}>
                        {signUpStatus === "loading" && (
                          <motion.div key="signup-loading" className="auth-request-status" role="status" aria-live="polite" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <Loader2 aria-hidden="true" className="auth-status-spinner" />
                            <div><strong>{t("auth.creatingAccount")}</strong><p>{t("auth.signUpCountdown").replace("{seconds}", String(signUpSecondsRemaining))}</p></div>
                            <span aria-hidden="true">{signUpSecondsRemaining}</span>
                          </motion.div>
                        )}
                        {signUpStatus === "success" && (
                          <motion.div key="signup-success" className="auth-request-status is-success" role="status" aria-live="polite" initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                            <CheckCircle2 aria-hidden="true" />
                            <div><strong>{requireEmailVerification ? t("auth.checkEmailTitle") : t("auth.accountReadyTitle")}</strong><p>{requireEmailVerification ? t("auth.checkEmailDesc") : t("auth.accountReadyDesc")}</p></div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <Button className="auth-submit h-12 w-full rounded-xl" disabled={busy !== null || !agreedToTerms || signUpStatus === "success"}>{busy === "email" ? <Loader2 aria-hidden="true" className="me-2 h-4 w-4 animate-spin" /> : <Mail aria-hidden="true" className="me-2 h-4 w-4" />}{busy === "email" ? `${t("auth.creatingAccount")} (${signUpSecondsRemaining}s)` : t("auth.createAccount")}</Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <p className="auth-price-note" aria-live="polite">{t("auth.finalPriceNotice")}</p>
          </div>
        </motion.section>
      </div>
      <InstallPrompt />
    </main>
  );
}
