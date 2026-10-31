import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { authErrorMessage, portableAuthClient } from "@/lib/auth/portableAuthClient";
import { AdminCard } from "./AdminChrome";

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;
const EMPTY_FORM = { current: "", next: "", repeat: "" };

const requestConfirmation = () => window.dispatchEvent(new Event("movprompt:admin-confirmation-required"));

export function OwnerPasswordCard() {
  const { locale } = useLanguage();
  const t = (en: string, arabic: string) => (locale === "ar" ? arabic : en);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ tone: "status" | "alert"; text: string } | null>(null);
  const field = (name: keyof typeof EMPTY_FORM) => ({
    value: form[name],
    onChange: (event: { target: { value: string } }) => setForm(values => ({ ...values, [name]: event.target.value })),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (form.next !== form.repeat)
      return setNotice({ tone: "alert", text: t("The new passwords do not match.", "كلمتا المرور الجديدتان غير متطابقتين.") });
    setPending(true);
    setNotice(null);
    try {
      const result = await portableAuthClient.changePassword({
        currentPassword: form.current,
        newPassword: form.next,
        revokeOtherSessions: true,
      });
      if (result.error) {
        if (result.error.code === "OWNER_STEP_UP_REQUIRED") {
          requestConfirmation();
          return setNotice({ tone: "alert", text: t("Confirm your password, then choose Change password again.", "أكد كلمة المرور، ثم اختر تغيير كلمة المرور مرة أخرى.") });
        }
        return setNotice({
          tone: "alert",
          text: result.error.code === "INVALID_PASSWORD"
            ? t("Your current password is not correct.", "كلمة المرور الحالية غير صحيحة.")
            : authErrorMessage(result.error),
        });
      }
      setForm(EMPTY_FORM);
      setNotice({ tone: "status", text: t("Password changed. Other devices are signed out.", "تم تغيير كلمة المرور. تم تسجيل الخروج من الأجهزة الأخرى.") });
    } catch (failure) {
      setNotice({ tone: "alert", text: authErrorMessage(failure) });
    } finally {
      setPending(false);
    }
  }

  return <AdminCard title={t("Security", "الأمان")}>
    <div className="admin-stack">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="admin-hint min-w-0 flex-1 basis-60">
          {t("Sensitive actions ask for this automatically. Confirm now to skip the prompt for 5 minutes.", "تطلب الإجراءات الحساسة هذا تلقائياً. أكد الآن لتخطي الطلب لمدة ٥ دقائق.")}
        </p>
        <Button type="button" variant="outline" onClick={requestConfirmation}>{t("Confirm password", "تأكيد كلمة المرور")}</Button>
      </div>
      <form className="admin-stack border-t pt-4" onSubmit={submit} aria-busy={pending}>
        <label className="admin-field">
          {t("Current password", "كلمة المرور الحالية")}
          <Input type="password" autoComplete="current-password" maxLength={MAX_PASSWORD_LENGTH} required {...field("current")} />
        </label>
        <label className="admin-field">
          {t("New password", "كلمة المرور الجديدة")}
          <Input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} required {...field("next")} />
        </label>
        <label className="admin-field">
          {t("Repeat new password", "أعد إدخال كلمة المرور الجديدة")}
          <Input type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} required {...field("repeat")} />
        </label>
        <p className="admin-hint">{t(`At least ${MIN_PASSWORD_LENGTH} characters. Other devices are signed out after the change.`, "١٠ أحرف على الأقل. يتم تسجيل الخروج من الأجهزة الأخرى بعد التغيير.")}</p>
        {notice && <p role={notice.tone} className={notice.tone === "alert" ? "admin-hint text-destructive" : "admin-hint"}>{notice.text}</p>}
        <div><Button type="submit" disabled={pending}>{pending ? t("Changing…", "جارٍ التغيير…") : t("Change password", "تغيير كلمة المرور")}</Button></div>
      </form>
    </div>
  </AdminCard>;
}
