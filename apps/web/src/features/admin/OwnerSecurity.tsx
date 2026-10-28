import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  portableAuthClient,
  authErrorMessage,
} from "@/lib/auth/portableAuthClient";
import { adminApi } from "./api";
import { DataValue } from "./AdminDisplay";
export function OwnerSecurity() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const query = useQuery({
    queryKey: ["admin", "owner-security"],
    queryFn: () => adminApi.get("security"),
  });
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [uri, setUri] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const client = useQueryClient();
  async function factorAction(recover: boolean) {
    setPending(true);
    setMessage("");
    setUri("");
    setCodes([]);
    try {
      if (recover) {
        const result = await portableAuthClient.twoFactor.getTotpUri({
          password,
        });
        if (result.error) throw result.error;
        setUri(result.data?.totpURI ?? "");
      } else {
        const result = await portableAuthClient.twoFactor.generateBackupCodes({
          password,
        });
        if (result.error) throw result.error;
        setCodes(result.data?.backupCodes ?? []);
      }
      setPassword("");
    } catch (failure) {
      setMessage(authErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-panel mt-6 max-w-3xl space-y-5">
      <h2 className="font-semibold">
        {t("Owner security and recovery", "أمان المالك والاسترداد")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "MFA remains required. Use recent owner confirmation and your existing password to recover the current authenticator or replace recovery codes. New recovery codes invalidate the previous set.",
          "تبقى المصادقة الثنائية مطلوبة. استخدم تأكيداً حديثاً للمالك وكلمة المرور الحالية لاسترداد تطبيق المصادقة أو استبدال رموز الاسترداد. تلغي الرموز الجديدة المجموعة السابقة.",
        )}
      </p>
      <label className="grid gap-2 text-sm">
        {t("Current password", "كلمة المرور الحالية")}
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={!password || pending}
          onClick={() => void factorAction(true)}
        >
          {t("Recover authenticator setup", "استرداد إعداد المصادقة")}
        </Button>
        <Button
          variant="outline"
          disabled={!password || pending}
          onClick={() => void factorAction(false)}
        >
          {t("Replace recovery codes", "استبدال رموز الاسترداد")}
        </Button>
      </div>
      {uri && (
        <div className="rounded border p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            {t(
              "Open this private setup link only in your authenticator.",
              "افتح رابط الإعداد الخاص في تطبيق المصادقة فقط.",
            )}
          </p>
          <a className="break-all text-xs text-primary underline" href={uri}>
            {uri}
          </a>
        </div>
      )}
      {codes.length > 0 && (
        <div className="rounded border p-4">
          <p className="mb-3 text-sm">
            {t(
              "Save these unused codes privately. They are not stored in browser drafts.",
              "احفظ هذه الرموز غير المستخدمة بشكل خاص. لا تُحفظ في مسودات المتصفح.",
            )}
          </p>
          <pre className="select-all whitespace-pre-wrap text-sm" dir="ltr">
            {codes.join("\n")}
          </pre>
          <Button className="mt-3" variant="ghost" onClick={() => setCodes([])}>
            {t("I saved them · hide codes", "حفظتها · إخفاء الرموز")}
          </Button>
        </div>
      )}
      {query.error ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : (
        <details className="rounded border p-4">
          <summary className="cursor-pointer text-sm">
            {t("Your active owner sessions", "جلسات المالك النشطة")}
          </summary>
          <div className="mt-4">
            <DataValue value={query.data?.sessions} ar={ar} />
          </div>
        </details>
      )}
      <label className="grid gap-2 text-sm">
        {t("Reason for revoking other sessions", "سبب إنهاء الجلسات الأخرى")}
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <Button
        variant="outline"
        disabled={pending || reason.trim().length < 8}
        onClick={async () => {
          setPending(true);
          setMessage("");
          try {
            await adminApi.mutate(
              "security/revoke-other-sessions",
              { reason },
              crypto.randomUUID(),
            );
            await client.invalidateQueries({
              queryKey: ["admin", "owner-security"],
            });
            setMessage(
              t(
                "Other sessions revoked. Your current session remains active.",
                "تم إنهاء الجلسات الأخرى. تبقى جلستك الحالية نشطة.",
              ),
            );
          } catch (failure) {
            setMessage(authErrorMessage(failure));
          } finally {
            setPending(false);
          }
        }}
      >
        {t("Revoke other sessions", "إنهاء الجلسات الأخرى")}
      </Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </section>
  );
}
