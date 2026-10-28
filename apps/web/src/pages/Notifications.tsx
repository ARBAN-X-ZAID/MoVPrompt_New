import { EmailPreferences } from "@/features/admin/EmailPreferences";
import { SupportReply, SupportAttachments } from "@/features/admin/SupportReply";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { z } from "zod";
import { Bell } from "lucide-react";
import { Seo } from "@/components/Seo";
import { CreatorShell } from "@/features/create/CreatorShell";
import { useLanguage } from "@/i18n/LanguageContext";
import { request } from "@/lib/api/portableApiClient";
import { isFeatureEnabled } from "@/config/features";
import { AdminForm } from "@/features/admin/AdminForm";
import { Button } from "@/components/ui/button";
const FeedSchema = z.object({
  items: z.array(z.record(z.string(), z.unknown())),
});
export default function Notifications() {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const tr = (en: string, arabic: string) => (ar ? arabic : en);
  const {user} = useAuth();
  const [replyOpen,setReplyOpen]=useState(false);
  const [contact, setContact] = useState(false);
  const client = useQueryClient();
  const enabled = isFeatureEnabled("ownerAdmin");
  const feed = useQuery({
    queryKey: ["customer-notifications"],
    queryFn: () => request("/api/v1/notifications", FeedSchema),
    enabled:enabled&&Boolean(user),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  });
  const communications = useQuery({
    queryKey: ["communications", locale],
    queryFn: () => request("/api/v1/communications", FeedSchema),
    enabled:enabled&&Boolean(user),
  });
  const cases = useQuery({
    queryKey: ["customer-support"],
    queryFn: () => request("/api/v1/support", FeedSchema),
    enabled:enabled&&Boolean(user),
  });
  const [selected, setSelected] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["customer-support", selected],
    queryFn: () =>
      request(
        `/api/v1/support/${selected}`,
        z.object({
          record:z.object({revision:z.number().int()}),
          messages: z.array(
            z.object({ message: z.string(), attachments:z.array(z.unknown()).optional(),createdAt: z.string() }),
          ),
        }),
      ),
    enabled: enabled && Boolean(selected) && Boolean(user),
  });
  const localCopy = (value: unknown) =>
    typeof value === "object" && value !== null
      ? String((value as Record<string, unknown>)[locale] ?? "")
      : String(value ?? "");
  return (
    <CreatorShell>
      <Seo
        title={`${tr("Notifications", "الإشعارات")} · MovPrompt`}
        description={tr(
          "Account updates and support.",
          "تحديثات الحساب والدعم.",
        )}
        noindex
      />
      <div className="creator-page">
        <header className="creator-page-head">
          <div>
            <p className="creator-kicker">{tr("Updates", "التحديثات")}</p>
            <h1 className="creator-title creator-title-sm">
              {tr("Notifications & support", "الإشعارات والدعم")}
            </h1>
            <p className="creator-subtitle">
              {tr(
                "Your account updates, announcements and support cases.",
                "تحديثات حسابك والإعلانات وحالات الدعم.",
              )}
            </p>
          </div>
          {enabled && user && (
            <Button onClick={() => setContact(true)}>
              {tr("Report an issue", "الإبلاغ عن مشكلة")}
            </Button>
          )}
        </header>
        {!user && enabled ? <Link to="/auth?next=%2Fnotifications" className="creator-button creator-button-primary">{tr("Sign in to view private updates and support", "سجّل الدخول لعرض التحديثات والدعم الخاص")}</Link> : !enabled ? (
          <p className="text-sm text-muted-foreground">
            {tr(
              "Open Projects for generation progress. The support feed is not enabled yet.",
              "افتح المشاريع لمتابعة إنشاء الفيديو. سجل الدعم غير مفعل بعد.",
            )}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border bg-card p-6">
              <h2 className="mb-5 flex items-center gap-2 font-medium">
                <Bell className="h-4 w-4" />
                {tr("Latest updates", "آخر التحديثات")}
              </h2>
              {feed.isPending || communications.isPending ? (
                <p role="status">{tr("Loading…", "جارٍ التحميل…")}</p>
              ) : feed.error || communications.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {(feed.error ?? communications.error)?.message}
                </p>
              ) : (
                <div className="space-y-5">
                  {[
                    ...(feed.data?.items ?? []),
                    ...(communications.data?.items ?? []),
                  ].map((item) => (
                    <article
                      key={String(item.id)}
                      className="border-b pb-5 last:border-0"
                    >
                      <h3 className="text-sm font-medium" dir="auto">
                        {localCopy(item.title)}
                      </h3>
                      <p
                        className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground"
                        dir="auto"
                      >
                        {localCopy(item.body)}
                      </p>
                      {item.caseId ? (
                        <button
                          className="mt-2 text-sm text-primary underline"
                          onClick={() => setSelected(String(item.caseId))}
                        >
                          {tr("Read case", "قراءة الحالة")}
                        </button>
                      ) : null}
                    </article>
                  ))}
                  {!feed.data?.items.length &&
                    !communications.data?.items.length && (
                      <p className="text-sm text-muted-foreground">
                        {tr("No updates yet.", "لا توجد تحديثات بعد.")}
                      </p>
                    )}
                </div>
              )}
            </section>
            <section className="rounded-xl border bg-card p-6">
              <h2 className="mb-5 font-medium">
                {tr("Your support cases", "حالات الدعم الخاصة بك")}
              </h2>
              {cases.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {cases.error.message}
                </p>
              ) : (
                <div className="space-y-3">
                  {cases.data?.items.map((item) => (
                    <button
                      key={String(item.id)}
                      className="block w-full rounded-lg border p-4 text-start text-sm hover:bg-muted"
                      onClick={() => setSelected(String(item.id))}
                    >
                      <strong>{String(item.subject)}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {String(item.status)}
                      </span>
                    </button>
                  ))}
                  {!cases.isPending && !cases.data?.items.length && (
                    <p className="text-sm text-muted-foreground">
                      {tr("No support cases yet.", "لا توجد حالات دعم بعد.")}
                    </p>
                  )}
                </div>
              )}
              {selected && (
                <div className="mt-6 space-y-4 border-t pt-5">
                  <h3 className="text-sm font-medium">
                    {tr("Case messages", "رسائل الحالة")}
                  </h3>
                  {detail.error && (
                    <p role="alert" className="text-sm text-destructive">
                      {detail.error.message}
                    </p>
                  )}
                  {detail.data && <Button variant="outline" onClick={()=>setReplyOpen(true)}>{tr("Reply to support", "الرد على الدعم")}</Button>}
                  {detail.data?.messages.map((message, index) => (
                    <div
                      key={index}
                      className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm"
                      dir="auto"
                    >
                      {message.message}
                      <SupportAttachments attachments={message.attachments} caseId={selected!} ar={ar}/>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
        {user&&isFeatureEnabled("emailNotifications")&&<EmailPreferences ar={ar}/>}
        <Link
          to="/projects"
          className="mt-6 inline-block text-sm text-primary underline"
        >
          {tr("Open Projects", "فتح المشاريع")}
        </Link>
      </div>
      {replyOpen && selected && detail.data && <SupportReply caseId={selected} revision={detail.data.record.revision} ar={ar} onClose={()=>setReplyOpen(false)}/>}

      {contact && (
        <AdminForm
          title={tr("Report an issue", "الإبلاغ عن مشكلة")}
          description={tr(
            "Your message is private to you and MovPrompt support.",
            "رسالتك خاصة بك وبدعم MovPrompt.",
          )}
          fields={[
            {
              name: "subject",
              label: tr("Subject", "الموضوع"),
              required: true,
            },
            {
              name: "category",
              label: tr("Category", "الفئة"),
              type: "select",
              value: "generation",
              options: [
                ["payment", "Payment", "الدفع"],
                ["credits", "Credits", "الرصيد"],
                ["generation", "Video creation", "إنشاء الفيديو"],
                ["assets", "Assets", "الأصول"],
                ["account", "Account", "الحساب"],
                ["content", "Content", "المحتوى"],
              ].map(([value, en, arabic]) => ({
                value: value!,
                label: tr(en!, arabic!),
              })),
            },
            {
              name: "message",
              label: tr("What happened?", "ماذا حدث؟"),
              type: "textarea",
              required: true,
            },
          ]}
          onSubmit={async (values, key) => {
            await request(
              "/api/v1/support",
              z.record(z.string(), z.unknown()),
              { method: "POST", body: values, idempotencyKey: key },
            );
            await client.invalidateQueries({ queryKey: ["customer-support"] });
          }}
          onClose={() => setContact(false)}
          submitLabel={tr("Send to support", "إرسال للدعم")}
        />
      )}
    </CreatorShell>
  );
}
