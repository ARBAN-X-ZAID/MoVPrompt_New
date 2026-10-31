import { invalidateAdminData } from "./adminQueries";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "./api";
import { object, type RecordData } from "./adminData";
import { useAdminCommandKey } from "./useAdminCommandKey";
import { DataValue } from "./AdminDisplay";

export function EmailDeliveryPanel({
  id,
  content,
  ar,
}: {
  id: string;
  content: RecordData;
  ar: boolean;
}) {
  const [preview, setPreview] = useState<RecordData | null>(null);
  const [review, setReview] = useState(false);
  const [reason, setReason] = useState("");
  const [schedule, setSchedule] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const key = useAdminCommandKey();
  const client = useQueryClient();
  const readiness = useQuery({
    queryKey: ["admin", "email-status"],
    queryFn: () => adminApi.get("email/status"),
  });
  const delivery = useQuery({
    queryKey: ["admin", "email-deliveries", id],
    queryFn: () => adminApi.get(`content/${id}/email-deliveries`),
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const enabled =
    readiness.data?.enabled === true && readiness.data?.smtpConfigured === true;
  async function action(name: string, body: RecordData) {
    setPending(true);
    setError("");
    try {
      const result = await adminApi.mutate(
        `content/${id}/${name}`,
        body,
        key({ id, name, body }),
      );
      if (name === "email-audience") {
        setPreview(result);
        setReview(false);
      } else {
        setPreview(null);
        setReview(false);
        invalidateAdminData(client);
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Email action failed",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-panel mb-6 space-y-5">
      <h2 className="font-semibold">
        {t("Email review and delivery", "مراجعة البريد وتسليمه")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "SMTP acceptance does not confirm delivery or reading. Interrupted sends are marked uncertain and are not automatically resent. Test delivery goes only to the verified owner.",
          "قبول SMTP لا يؤكد وصول البريد أو قراءته. الإرسال المنقطع يسجل كغير مؤكد ولا يعاد تلقائياً. تصل الرسالة التجريبية إلى المالك الموثق فقط.",
        )}
      </p>
      {!enabled && (
        <p className="rounded border p-3 text-sm" role="status">
          {t(
            "Delivery is disabled. Configure SMTP, the public API URL and signing secret, then enable the email rollout flag after local acceptance.",
            "الإرسال معطل. اضبط SMTP ورابط API العام ومفتاح التوقيع ثم فعّل إطلاق البريد بعد الاختبارات المحلية.",
          )}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {(["en", "ar"] as const).map((locale) => (
          <Button
            key={locale}
            variant="outline"
            disabled={pending || !enabled}
            onClick={() => void action("email-test", { locale })}
          >
            {t("Send owner test", "إرسال تجربة للمالك")} ·{" "}
            {locale === "ar" ? "العربية" : "English"}
          </Button>
        ))}
        {content.kind === "promotional-email" && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => void action("email-audience", {})}
          >
            {t("Preview opted-in audience", "معاينة الجمهور المشترك")}
          </Button>
        )}
      </div>
      {preview && (
        <section className="space-y-4 rounded-lg border p-4">
          <p className="font-medium">
            {t("Eligible recipients", "المستلمون المؤهلون")}:{" "}
            {String(preview.count)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t(
              "Verified, opted-in accounts only. Withdrawn consent, suppressed and suspended accounts are excluded. The reviewed list expires after 15 minutes and is checked again before sending.",
              "الحسابات الموثقة والموافقة فقط. تستبعد حالات سحب الموافقة والإلغاء والإيقاف. تنتهي المراجعة بعد ١٥ دقيقة وتفحص الموافقة ثانية قبل الإرسال.",
            )}
          </p>
          {(["en", "ar"] as const).map((locale) => (
            <article
              key={locale}
              dir={locale === "ar" ? "rtl" : "ltr"}
              className="rounded border p-3"
            >
              <h3 className="font-medium">
                {String(object(preview.title)[locale])}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">
                {String(object(preview.body)[locale])}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {locale === "ar"
                  ? "يضاف رابط إلغاء الاشتراك."
                  : "An unsubscribe link is appended."}
              </p>
            </article>
          ))}
          <label className="grid gap-2 text-sm">
            {t(
              "Schedule (optional, device time)",
              "موعد الإرسال (اختياري، توقيت الجهاز)",
            )}
            <Input
              type="datetime-local"
              value={schedule}
              onChange={(event) => setSchedule(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm">
            {t("Approval reason", "سبب الاعتماد")}
            <Input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={1000}
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={review}
              onChange={(event) => setReview(event.target.checked)}
            />
            <span>
              {t(
                "I reviewed both messages, the recipient count and the unsubscribe footer, and approve this delivery.",
                "راجعت الرسالتين وعدد المستلمين وتذييل إلغاء الاشتراك وأوافق على الإرسال.",
              )}
            </span>
          </label>
          <Button
            disabled={
              !enabled ||
              pending ||
              !review ||
              reason.trim().length < 8 ||
              Number(preview.count) === 0 ||
              preview.contentRevision !== content.revision
            }
            onClick={() =>
              void action("email-approve", {
                expectedRevision: content.revision,
                audienceId: preview.id,
                reason,
                ...(schedule
                  ? { scheduledAt: new Date(schedule).toISOString() }
                  : {}),
              })
            }
          >
            {t("Approve reviewed delivery", "اعتماد الإرسال بعد المراجعة")}
          </Button>
        </section>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {delivery.error && <p role="alert">{delivery.error.message}</p>}
      {delivery.data && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">
            {t("Recorded delivery outcomes", "نتائج الإرسال المسجلة")}
          </h3>
          <DataValue value={delivery.data} ar={ar} />
        </div>
      )}
    </section>
  );
}
