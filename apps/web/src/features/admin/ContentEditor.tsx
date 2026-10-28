import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AdminContentSchema } from "@movprompt/contracts";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { adminApi } from "./api";
import { object, type RecordData } from "./adminData";
import { useAdminCommandKey } from "./useAdminCommandKey";

export function ContentEditor({
  id,
  initial,
}: {
  id?: string;
  initial?: RecordData;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState(String(initial?.kind ?? "announcement"));
  const [emailPurpose, setEmailPurpose] = useState(
    String(initial?.emailPurpose ?? "verify-email"),
  );
  const [audience, setAudience] = useState(String(initial?.audience ?? "all"));
  const [status, setStatus] = useState(
    String(
      initial?.kind === "promotional-email"
        ? "draft"
        : (initial?.status ?? "draft"),
    ),
  );
  const [title, setTitle] = useState({
    en: String(object(initial?.title).en ?? ""),
    ar: String(object(initial?.title).ar ?? ""),
  });
  const [body, setBody] = useState({
    en: String(object(initial?.body).en ?? ""),
    ar: String(object(initial?.body).ar ?? ""),
  });
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduledAt
      ? new Date(String(initial.scheduledAt))
          .toLocaleString("sv-SE")
          .replace(" ", "T")
          .slice(0, 16)
      : "",
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const audienceQuery = useQuery({
    queryKey: ["admin", "content-audience", audience],
    queryFn: () => adminApi.get(`content/audience?audience=${audience}`),
    enabled: open,
  });
  const client = useQueryClient();
  const navigate = useNavigate();
  const key = useAdminCommandKey();
  const email = kind.endsWith("email");
  const emailStatus = useQuery({
    queryKey: ["admin", "email-status"],
    queryFn: () => adminApi.get("email/status"),
    enabled: open && email,
  });
  const emailReady =
    emailStatus.data?.enabled === true &&
    emailStatus.data?.smtpConfigured === true;
  return (
    <>
      <Button
        variant={id ? "outline" : "default"}
        onClick={() => setOpen(true)}
      >
        {id
          ? t("Edit communication", "تعديل الرسالة")
          : t("New communication", "رسالة جديدة")}
      </Button>
      <Dialog open={open} onOpenChange={(value) => !pending && setOpen(value)}>
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"
          dir={ar ? "rtl" : "ltr"}
        >
          <DialogHeader>
            <DialogTitle>
              {t("Review customer communication", "مراجعة رسالة العملاء")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "English and Arabic text is published as entered. Authentication emails support only the named placeholders below. Promotional delivery requires a separate audience review.",
                "يُنشر النص الإنجليزي والعربي كما أُدخل. يدعم بريد المصادقة المتغيرات المحددة أدناه فقط. يتطلب البريد الترويجي مراجعة منفصلة للجمهور.",
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending) return;
              setPending(true);
              setError("");
              try {
                const input = AdminContentSchema.parse({
                  expectedRevision: Number(initial?.revision ?? 0),
                  kind,
                  ...(kind === "transactional-email" ? { emailPurpose } : {}),
                  title,
                  body,
                  audience,
                  status,
                  ...(status === "scheduled"
                    ? { scheduledAt: new Date(scheduledAt).toISOString() }
                    : {}),
                  reason,
                });
                const result = await adminApi.mutate(
                  id ? `content/${id}` : "content",
                  input,
                  key({ id, input }),
                );
                await client.invalidateQueries({ queryKey: ["admin"] });
                setOpen(false);
                navigate(`/admin/content/${result.id}`);
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : t("Could not save communication", "تعذر حفظ الرسالة"),
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                {t("Kind", "النوع")}
                <select
                  className="admin-select"
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                >
                  {[
                    ["announcement", "Announcement", "إعلان"],
                    ["welcome", "Welcome notice", "رسالة ترحيب"],
                    ["maintenance", "Maintenance notice", "إشعار صيانة"],
                    [
                      "notification",
                      "In-app notification",
                      "إشعار داخل التطبيق",
                    ],
                    [
                      "transactional-email",
                      "Transactional email draft",
                      "مسودة بريد معاملات",
                    ],
                    [
                      "promotional-email",
                      "Promotional email draft",
                      "مسودة بريد ترويجي",
                    ],
                  ].map(([value, en, arabic]) => (
                    <option key={value} value={value}>
                      {t(en!, arabic!)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm">
                {t("Audience", "الجمهور")}
                <select
                  className="admin-select"
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                >
                  {[
                    ["all", "All visitors", "كل الزوار"],
                    ["verified", "Verified accounts", "الحسابات الموثقة"],
                    [
                      "active",
                      "Accounts with active sessions",
                      "الحسابات ذات الجلسات النشطة",
                    ],
                  ].map(([value, en, arabic]) => (
                    <option key={value} value={value}>
                      {t(en!, arabic!)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p
              className="rounded border bg-muted/20 p-3 text-xs text-muted-foreground"
              role="status"
            >
              {audienceQuery.isPending
                ? t(
                    "Counting eligible accounts…",
                    "جارٍ حساب الحسابات المؤهلة…",
                  )
                : audienceQuery.error
                  ? t(
                      "Audience count unavailable. Retry before publishing.",
                      "عدد الجمهور غير متوفر. أعد المحاولة قبل النشر.",
                    )
                  : `${t("Eligible accounts", "الحسابات المؤهلة")}: ${audienceQuery.data?.accounts ?? "—"} · ${t("Source: users / current sessions. Guest reach and delivery are unknown.", "المصدر: المستخدمون والجلسات الحالية. عدد الضيوف والتسليم غير معروفين.")}`}
            </p>
            {kind === "transactional-email" && (
              <section className="space-y-3 rounded border p-4">
                <label className="grid gap-2 text-sm">
                  {t("Authentication action", "إجراء المصادقة")}
                  <select
                    className="admin-select"
                    value={emailPurpose}
                    onChange={(event) => setEmailPurpose(event.target.value)}
                  >
                    <option value="verify-email">
                      {t("Email verification", "تأكيد البريد")}
                    </option>
                    <option value="reset-password">
                      {t("Password reset", "إعادة تعيين كلمة المرور")}
                    </option>
                  </select>
                </label>
                <p className="text-sm text-muted-foreground" dir="auto">
                  {t(
                    "Include {{actionUrl}} in both languages. {{name}} is optional. HTML and code are displayed as plain text. The existing authentication system creates the secure link. This is not a broadcast.",
                    "أضف {{actionUrl}} باللغتين. {{name}} اختياري. يعرض HTML والكود كنص عادي. ينشئ نظام المصادقة الحالي الرابط الآمن. لا يتم إرسال حملة جماعية.",
                  )}
                </p>
                {!emailReady && (
                  <p role="status">
                    {t(
                      "Publishing is disabled until email delivery is configured and the rollout flag is enabled.",
                      "النشر معطل حتى إعداد البريد وتفعيل إطلاقه.",
                    )}
                  </p>
                )}
              </section>
            )}
            <div className="grid gap-5 md:grid-cols-2">
              {(["en", "ar"] as const).map((language) => (
                <fieldset
                  key={language}
                  className="space-y-4 rounded-lg border p-4"
                  dir={language === "ar" ? "rtl" : "ltr"}
                >
                  <legend className="px-2 text-sm font-medium">
                    {language === "ar" ? "العربية" : "English"}
                  </legend>
                  <label className="grid gap-2 text-sm">
                    {language === "ar" ? "العنوان" : "Title"}
                    <Input
                      value={title[language]}
                      required
                      maxLength={160}
                      onChange={(event) =>
                        setTitle((current) => ({
                          ...current,
                          [language]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-2 text-sm">
                    {language === "ar" ? "الرسالة" : "Message"}
                    <Textarea
                      rows={6}
                      value={body[language]}
                      maxLength={10000}
                      onChange={(event) =>
                        setBody((current) => ({
                          ...current,
                          [language]: event.target.value,
                        }))
                      }
                    />
                  </label>
                </fieldset>
              ))}
            </div>
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer text-sm font-medium">
                {t("Preview both languages", "معاينة اللغتين")}
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(["en", "ar"] as const).map((language) => (
                  <article
                    key={language}
                    dir={language === "ar" ? "rtl" : "ltr"}
                    className="min-w-0 rounded bg-muted/20 p-4"
                  >
                    <strong className="break-words">
                      {title[language] || "—"}
                    </strong>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                      {body[language] || "—"}
                    </p>
                  </article>
                ))}
              </div>
            </details>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm">
                {t("State", "الحالة")}
                <select
                  className="admin-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {[
                    ["draft", "Draft", "مسودة"],
                    ["scheduled", "Schedule", "جدولة"],
                    ["published", "Publish now", "نشر الآن"],
                    ["archived", "Archive", "أرشفة"],
                  ].map(([value, en, arabic]) => (
                    <option
                      key={value}
                      value={value}
                      disabled={
                        (kind === "promotional-email" ||
                          (kind === "transactional-email" && !emailReady)) &&
                        ["scheduled", "published"].includes(value!)
                      }
                    >
                      {t(en!, arabic!)}
                    </option>
                  ))}
                </select>
              </label>
              {status === "scheduled" && (
                <label className="grid gap-2 text-sm">
                  {t(
                    "Publication time · device timezone",
                    "وقت النشر · توقيت الجهاز",
                  )}
                  <Input
                    type="datetime-local"
                    value={scheduledAt}
                    required
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </label>
              )}
            </div>
            <label className="grid gap-2 text-sm">
              {t("Reason for this revision", "سبب هذه النسخة")}
              <Textarea
                value={reason}
                minLength={8}
                maxLength={1000}
                required
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={
                pending ||
                reason.trim().length < 8 ||
                (["published", "scheduled"].includes(status) &&
                  (email ||
                    audienceQuery.isPending ||
                    Boolean(audienceQuery.error)))
              }
            >
              {pending
                ? t("Saving…", "جارٍ الحفظ…")
                : t("Review and save revision", "مراجعة وحفظ النسخة")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
