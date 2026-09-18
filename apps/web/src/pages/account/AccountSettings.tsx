import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, User, Mail, Lock, Loader2, BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { isFeatureEnabled } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, portableAuthClient } from "@/lib/auth/portableAuthClient";
import { portableAuthActions } from "@/lib/auth/portableAuthActions";
import { useLanguage } from "@/i18n/LanguageContext";

const AccountSettings = () => {
  const { user, refresh } = useAuth();
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (english: string, arabic: string) => ar ? arabic : english;
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const userId = user?.id;
  const savedName = user?.name || user?.user_metadata?.full_name || "";
  const emailVerified = user?.emailVerified === true || Boolean(user?.email_confirmed_at);

  useEffect(() => {
    setDisplayName(savedName);
  }, [userId, savedName]);

  const saveProfile = async () => {
    const name = displayName.trim();
    if (!name || name === savedName) return;
    setSaving(true);
    try {
      const result = isFeatureEnabled("portableAuth")
        ? await portableAuthClient.updateUser({ name })
        : await supabase.auth.updateUser({ data: { full_name: name } });
      if (result.error) throw result.error;
      await refresh();
      toast.success(tr("Profile updated.", "تم تحديث الملف الشخصي."));
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSendingReset(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = isFeatureEnabled("portableAuth")
        ? await portableAuthActions.requestPasswordReset({ email: user.email, redirectTo }) as { error?: unknown }
        : await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
      if (result.error) throw result.error;
      toast.success(tr("Secure reset link sent. Check your email.", "تم إرسال رابط آمن لإعادة التعيين. راجع بريدك."));
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSendingReset(false);
    }
  };

  const sendEmailVerification = async () => {
    if (!user?.email || emailVerified) return;
    setSendingVerification(true);
    try {
      const callbackURL = `${window.location.origin}/account/settings`;
      const result = isFeatureEnabled("portableAuth")
        ? await portableAuthActions.sendVerificationEmail({ email: user.email, callbackURL }) as { error?: unknown }
        : await supabase.auth.resend({ type: "signup", email: user.email, options: { emailRedirectTo: callbackURL } });
      if (result.error) throw result.error;
      toast.success(tr("Verification link sent. You can continue using MovPrompt now.", "تم إرسال رابط التأكيد. تقدر تواصل استخدام MovPrompt الآن."));
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSendingVerification(false);
    }
  };

  return (
    <CreatorShell>
      <Seo title={`${tr("Account settings", "إعدادات الحساب")} · MovPrompt`} description={tr("Manage your profile, email, and password.", "أدر ملفك الشخصي وبريدك وكلمة المرور.")} noindex />
      <div className="creator-page max-w-3xl">
        <Button variant="ghost" size="sm" asChild className="mb-4 min-h-11 gap-2">
          <Link to="/create"><ArrowLeft aria-hidden="true" className="w-4 h-4" /> {tr("Back to workspace", "العودة لمساحة العمل")}</Link>
        </Button>
        <h1 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
          <User aria-hidden="true" className="w-5 h-5 text-accent" /> {tr("Account settings", "إعدادات الحساب")}
        </h1>
        <div className="space-y-4">
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">{tr("Profile", "الملف الشخصي")}</h2>
            <div className="space-y-2">
              <Label htmlFor="account-display-name">{tr("Display name", "الاسم المعروض")}</Label>
              <Input id="account-display-name" className="min-h-11" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={tr("Your name", "اسمك")} autoComplete="name" maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-email" className="flex items-center gap-1.5"><Mail aria-hidden="true" className="w-3.5 h-3.5" /> {tr("Email", "البريد الإلكتروني")}</Label>
              <Input id="account-email" className="min-h-11" value={user?.email || ""} disabled readOnly />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/35 px-3 py-2" role="status">
                <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <BadgeCheck aria-hidden="true" className={`h-4 w-4 ${emailVerified ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} />
                  {emailVerified
                    ? tr("Email verified", "البريد مؤكد")
                    : tr("Verification is optional for now", "تأكيد البريد اختياري حالياً")}
                </span>
                {!emailVerified && <Button variant="outline" size="sm" className="min-h-11" onClick={() => void sendEmailVerification()} disabled={sendingVerification || !user?.email}>{sendingVerification && <Loader2 className="w-4 h-4 animate-spin me-2" aria-hidden="true" />}{sendingVerification ? tr("Sending…", "جارٍ الإرسال…") : tr("Send verification link", "إرسال رابط التأكيد")}</Button>}
              </div>
            </div>
            <Button variant="default" size="sm" className="min-h-11" onClick={() => void saveProfile()} disabled={saving || !displayName.trim() || displayName.trim() === savedName}>{saving && <Loader2 className="w-4 h-4 animate-spin me-2" aria-hidden="true" />}{saving ? tr("Saving…", "جارٍ الحفظ…") : tr("Save changes", "حفظ التغييرات")}</Button>
          </Card>
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Lock aria-hidden="true" className="w-3.5 h-3.5" /> {tr("Password", "كلمة المرور")}
            </h2>
            <p className="text-sm text-muted-foreground">{tr("Send yourself a reset link to change your password.", "أرسل لنفسك رابطاً آمناً لتغيير كلمة المرور.")}</p>
            <Button variant="outline" size="sm" className="min-h-11" onClick={() => void sendPasswordReset()} disabled={sendingReset || !user?.email}>{sendingReset && <Loader2 className="w-4 h-4 animate-spin me-2" aria-hidden="true" />}{sendingReset ? tr("Sending…", "جارٍ الإرسال…") : tr("Send reset link", "إرسال رابط إعادة التعيين")}</Button>
          </Card>
        </div>
      </div>
    </CreatorShell>
  );
};

export default AccountSettings;
