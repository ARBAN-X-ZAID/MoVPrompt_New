import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  portableAuthClient,
  authErrorMessage,
} from "@/lib/auth/portableAuthClient";
import { safeAuthReturnPath } from "@/lib/auth/returnPath";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TwoFactorChallenge() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section className="mx-auto max-w-sm">
        <h1 className="text-2xl font-semibold">
          {ar ? "تأكيد تسجيل الدخول" : "Confirm sign-in"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {ar
            ? "أدخل رمز تطبيق المصادقة أو أحد رموز الاسترداد الخاصة بك."
            : "Enter your authenticator code or one of your recovery codes."}
        </p>
        <form
          className="mt-7 space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError("");
            try {
              const result = backup
                ? await portableAuthClient.twoFactor.verifyBackupCode({
                    code,
                    trustDevice: false,
                  })
                : await portableAuthClient.twoFactor.verifyTotp({
                    code,
                    trustDevice: false,
                  });
              if (result.error) throw result.error;
              navigate(safeAuthReturnPath(params.get("next")), {
                replace: true,
              });
            } catch (failure) {
              setError(authErrorMessage(failure));
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="mfa-code">
              {backup
                ? ar
                  ? "رمز الاسترداد"
                  : "Recovery code"
                : ar
                  ? "رمز المصادقة"
                  : "Authenticator code"}
            </Label>
            <Input
              id="mfa-code"
              autoComplete="one-time-code"
              inputMode={backup ? "text" : "numeric"}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              minLength={backup ? 8 : 6}
              maxLength={backup ? 40 : 6}
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? ar
                ? "جارٍ التحقق…"
                : "Checking…"
              : ar
                ? "متابعة"
                : "Continue"}
          </Button>
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
                : "Use recovery code"}
          </Button>
          <Link
            className="block text-center text-sm text-muted-foreground underline"
            to="/auth"
          >
            {ar ? "العودة لتسجيل الدخول" : "Back to sign-in"}
          </Link>
        </form>
      </section>
    </main>
  );
}
