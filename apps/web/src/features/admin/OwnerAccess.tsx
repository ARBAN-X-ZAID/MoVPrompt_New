import { useState } from "react";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import type { AdminIdentity } from "@movprompt/contracts";
import { Link } from "react-router-dom";
import {
  portableAuthClient,
  authErrorMessage,
} from "@/lib/auth/portableAuthClient";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LanguageToggle } from "@/components/LanguageToggle";
import { adminApi } from "./api";
import { PortableApiError } from "@/lib/api/portableApiClient";
import { Seo } from "@/components/Seo";

export function OwnerAccess({
  identity,
  error,
  reload,
  compact = false,
}: {
  identity?: AdminIdentity;
  error?: Error | null;
  reload: () => void;
  compact?: boolean;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState(false);
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [setup, setSetup] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const needsSetup =
    identity && (!identity.mfaEnabled || !identity.recoveryReady);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    try {
      if (!identity) {
        if (challenge) {
          const response = backup
            ? await portableAuthClient.twoFactor.verifyBackupCode({
                code,
                trustDevice: false,
              })
            : await portableAuthClient.twoFactor.verifyTotp({
                code,
                trustDevice: false,
              });
          if (response.error) throw response.error;
          setChallenge(false);
          setCode("");
          reload();
        } else {
          const response = await portableAuthClient.signIn.email({
            email,
            password,
          });
          if (response.error) throw response.error;
          setPassword("");
          if (
            response.data &&
            "twoFactorRedirect" in response.data &&
            response.data.twoFactorRedirect
          )
            setChallenge(true);
          else reload();
        }
      } else if (needsSetup && !setup) {
        const result = await portableAuthClient.twoFactor.enable({
          password,
          issuer: "MovPrompt",
        });
        if (result.error || !result.data)
          throw result.error ?? new Error("MFA setup failed");
        if (!("totpURI" in result.data) || !("backupCodes" in result.data))
          throw new Error("Authenticator setup is unavailable. Try again.");
        setSetup(result.data);
        setPassword("");
      } else if (needsSetup && setup) {
        const result = await portableAuthClient.twoFactor.verifyTotp({
          code,
          trustDevice: false,
        });
        if (result.error) throw result.error;
        setSetup(null);
        setCode("");
        reload();
      } else {
        await adminApi.assure(code, backup ? "backup" : "totp");
        setCode("");
        reload();
      }
    } catch (failure) {
      setMessage(authErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      className={`${compact ? "" : "min-h-screen"} bg-background text-foreground`}
      dir={ar ? "rtl" : "ltr"}
    >
      <Seo
        title="Owner sign-in · MovPrompt"
        description="Private owner access"
        noindex
      />
      {!compact && (
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/templates" className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            MovPrompt
          </Link>
          <LanguageToggle />
        </header>
      )}
      <main
        className={`mx-auto max-w-md px-6 ${compact ? "py-8" : "pb-16 pt-14"}`}
      >
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl border bg-card">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[.16em] text-muted-foreground">
          MovPrompt · {ar ? "المالك" : "Owner workspace"}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {!identity
            ? ar
              ? "تسجيل دخول المالك"
              : "Owner sign-in"
            : needsSetup
              ? ar
                ? "تأمين حساب المالك"
                : "Secure your owner account"
              : ar
                ? "تأكيد هويتك"
                : "Confirm it’s you"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {!identity
            ? ar
              ? "استخدم الحساب المحدد كمالك أثناء الإعداد الآمن."
              : "Use the account designated as owner during deployment."
            : needsSetup
              ? ar
                ? "أضف حسابك إلى تطبيق المصادقة واحفظ رموز الاسترداد في مكان آمن."
                : "Add your account to an authenticator and keep the recovery codes somewhere safe."
              : ar
                ? "أدخل رمز المصادقة. الإجراءات الحساسة تتطلب تأكيداً حديثاً."
                : "Enter your authenticator code. Sensitive actions require a recent confirmation."}
        </p>
        <form className="mt-8 space-y-5" onSubmit={submit}>
          {!identity && !challenge && (
            <>
              <div className="space-y-2">
                <Label htmlFor="owner-email">
                  {ar ? "البريد الإلكتروني" : "Email"}
                </Label>
                <Input
                  id="owner-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-password">
                  {ar ? "كلمة المرور" : "Password"}
                </Label>
                <Input
                  id="owner-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </>
          )}
          {needsSetup && !setup && (
            <div className="space-y-2">
              <Label htmlFor="setup-password">
                {ar ? "كلمة المرور الحالية" : "Current password"}
              </Label>
              <Input
                id="setup-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
          )}
          {setup && (
            <section className="space-y-4 rounded-xl border bg-card p-4">
              <p className="text-sm">
                {ar
                  ? "افتح رابط الإعداد في تطبيق المصادقة أو أدخله يدوياً"
                  : "Open this setup link in your authenticator, or add it manually"}
              </p>
              <a
                className="block break-all text-xs text-primary underline"
                href={setup.totpURI}
              >
                {setup.totpURI}
              </a>
              <h2 className="font-medium">
                {ar ? "رموز الاسترداد" : "Recovery codes"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "احفظ هذه الرموز الآن قبل تأكيد الإعداد"
                  : "Save these codes now before confirming setup"}
              </p>
              <pre className="select-all whitespace-pre-wrap text-sm" dir="ltr">
                {setup.backupCodes.join("\n")}
              </pre>
            </section>
          )}
          {(challenge || (identity && (!needsSetup || setup))) && (
            <div className="space-y-2">
              <Label htmlFor="owner-code">
                {backup && (challenge || identity)
                  ? ar
                    ? "رمز الاسترداد"
                    : "Recovery code"
                  : ar
                    ? "رمز المصادقة"
                    : "Authenticator code"}
              </Label>
              <Input
                id="owner-code"
                inputMode={backup ? "text" : "numeric"}
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
                minLength={backup ? 8 : 6}
                maxLength={backup ? 40 : 6}
              />
            </div>
          )}
          {(message || error) && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive"
            >
              {message || error?.message}
            </p>
          )}
          <Button className="w-full" disabled={pending} type="submit">
            {pending
              ? ar
                ? "جارٍ التحقق…"
                : "Checking…"
              : needsSetup && !setup
                ? ar
                  ? "إعداد المصادقة"
                  : "Set up authenticator"
                : ar
                  ? "متابعة"
                  : "Continue"}
          </Button>
          {(challenge || (identity && !needsSetup)) && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => {
                setBackup(!backup);
                setCode("");
              }}
            >
              {backup
                ? ar
                  ? "استخدام تطبيق المصادقة"
                  : "Use authenticator"
                : ar
                  ? "استخدام رمز الاسترداد"
                  : "Use a recovery code"}
            </Button>
          )}
          {!identity &&
            error instanceof PortableApiError &&
            error.code === "owner_verification_required" && (
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={pending}
                onClick={async () => {
                  setPending(true);
                  setMessage("");
                  try {
                    const session = await portableAuthClient.getSession({
                      query: {},
                    });
                    if (!session.data?.user.email)
                      throw new Error("Sign in with your owner account first.");
                    const response =
                      await portableAuthClient.sendVerificationEmail({
                        email: session.data.user.email,
                        callbackURL: `${window.location.origin}/admin`,
                      });
                    if (response.error) throw response.error;
                    setMessage(
                      ar
                        ? "تم قبول طلب إرسال رابط التحقق. افتح بريد المالك لإكمال التحقق."
                        : "The verification email was accepted for sending. Open the owner inbox to verify the account.",
                    );
                  } catch (failure) {
                    setMessage(authErrorMessage(failure));
                  } finally {
                    setPending(false);
                  }
                }}
              >
                {ar ? "إرسال رابط تحقق المالك" : "Send owner verification link"}
              </Button>
            )}
          {(identity ||
            (error instanceof PortableApiError &&
              error.code === "owner_verification_required")) && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={async () => {
                await portableAuthClient.signOut({});
                reload();
              }}
            >
              {ar ? "تسجيل الخروج" : "Sign out"}
            </Button>
          )}
        </form>
      </main>
    </div>
  );
}
