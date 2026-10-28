import { useState } from "react";
import { ShieldCheck, Eye, EyeOff, AlertCircle } from "lucide-react";
import type { AdminIdentity } from "@movprompt/contracts";
import {
  portableAuthClient,
  authErrorMessage,
} from "@/lib/auth/portableAuthClient";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OwnerAccessFrame } from "./OwnerAccessFrame";
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
  const [showPassword, setShowPassword] = useState(false);
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
    <OwnerAccessFrame compact={compact}>
      <Seo
        title="Owner sign-in · MovPrompt"
        description="Private owner access"
        noindex
      />
      <div className="owner-access-heading-mark">
        <ShieldCheck className="h-5 w-5" aria-hidden="true" />
      </div>
      <h1>
        {challenge
          ? ar
            ? "تأكيد تسجيل الدخول"
            : "Verify your sign-in"
          : !identity
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
      <p className="owner-access-description" id="owner-access-description">
        {challenge
          ? backup
            ? ar
              ? "أدخل أحد رموز الاسترداد المحفوظة للمتابعة."
              : "Enter one of your saved recovery codes to continue."
            : ar
              ? "أدخل الرمز من تطبيق المصادقة للمتابعة."
              : "Enter the code from your authenticator to continue."
          : !identity
            ? ar
              ? "سجّل الدخول لإدارة مساحة عمل MovPrompt."
              : "Sign in to manage your MovPrompt workspace."
            : needsSetup
              ? ar
                ? "أضف حسابك إلى تطبيق المصادقة واحفظ رموز الاسترداد في مكان آمن."
                : "Add your account to an authenticator and keep the recovery codes somewhere safe."
              : ar
                ? "أدخل رمز المصادقة. الإجراءات الحساسة تتطلب تأكيداً حديثاً."
                : "Enter your authenticator code. Sensitive actions require a recent confirmation."}
      </p>
      <form
        className="space-y-5"
        onSubmit={submit}
        aria-describedby="owner-access-description"
        aria-busy={pending}
      >
        {!identity && !challenge && (
          <>
            <div className="space-y-2">
              <Label htmlFor="owner-email">
                {ar ? "البريد الإلكتروني" : "Email"}
              </Label>
              <Input
                id="owner-email"
                type="email"
                dir="ltr"
                autoCapitalize="none"
                spellCheck={false}
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
              <div className="relative">
                <Input
                  id="owner-password"
                  className="pe-12"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-0.5 top-0.5 h-11 w-11"
                  aria-label={
                    showPassword
                      ? ar
                        ? "إخفاء كلمة المرور"
                        : "Hide password"
                      : ar
                        ? "إظهار كلمة المرور"
                        : "Show password"
                  }
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
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
            className="owner-access-error flex items-start gap-2.5"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>
              {message ||
                (error instanceof PortableApiError &&
                error.code === "owner_required"
                  ? ar
                    ? "هذا الحساب لا يملك صلاحية الإدارة. استخدم حساب المالك لتسجيل الدخول."
                    : "This account does not have owner access. Sign in with your owner account."
                  : error?.message)}
            </span>
          </p>
        )}
        <Button
          className="owner-access-primary w-full"
          disabled={pending}
          type="submit"
        >
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
    </OwnerAccessFrame>
  );
}
