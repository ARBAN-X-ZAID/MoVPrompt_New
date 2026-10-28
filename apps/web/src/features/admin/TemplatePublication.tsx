import { useAdminCommandKey } from "./useAdminCommandKey";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";

export function TemplatePublication({
  id,
  data,
}: {
  id: string;
  data: Record<string, unknown>;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const commandKey = useAdminCommandKey();
  const [reason, setReason] = useState("");
  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [versionId, setVersionId] = useState(String(data.activeVersionId));
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [comparison, setComparison] = useState<Record<string, unknown> | null>(
    null,
  );
  const client = useQueryClient();
  const navigate = useNavigate();
  const head = data.head as Record<string, unknown>;
  const draft = data.draft as Record<string, unknown> | null;
  const publishing = data.publishing as Record<string, unknown>;
  const versions = data.versions as Record<string, unknown>[];
  async function mutate(action: string, body: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      const result = await adminApi.mutate(
        `templates/${id}/${action}`,
        { ...body, reason },
        commandKey({ id, action, body, reason }),
      );
      await client.invalidateQueries({ queryKey: ["admin"] });
      if (action === "duplicate") navigate(`/admin/templates/${result.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Request failed");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="admin-panel mt-6 space-y-4">
      <h2 className="font-semibold">
        {t("Publishing and versions", "النشر والنسخ")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "Existing campaigns retain their saved version. Publishing uses recent owner authentication and matching preview evidence.",
          "تحتفظ الحملات الحالية بنسختها المحفوظة. يتطلب النشر مصادقة حديثة للمالك ودليل معاينة مطابقاً.",
        )}
      </p>
      <label className="grid gap-2 text-sm">
        {t("Reason for this action", "سبب هذا الإجراء")}
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={
            pending ||
            reason.trim().length < 8 ||
            draft?.status !== "draft" ||
            publishing.runtimeMigrationReady !== true
          }
          onClick={() =>
            void mutate("publish", {
              expectedRevision: Number(head.revision ?? 0),
              draftRevision: Number(draft?.revision),
            })
          }
        >
          {t("Review and publish saved draft", "مراجعة ونشر المسودة المحفوظة")}
        </Button>
      </div>
      {publishing.runtimeMigrationReady !== true && (
        <p className="text-sm text-muted-foreground">
          {t(
            "New publication is disabled until rollout acceptance. Draft editing and comparison are available.",
            "النشر الجديد معطل حتى اجتياز اختبارات الإطلاق. تحرير المسودات ومقارنتها متاحان.",
          )}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <select
          aria-label={t("Template version", "نسخة القالب")}
          className="min-w-0 rounded border bg-background p-2"
          value={versionId}
          onChange={(event) => setVersionId(event.target.value)}
        >
          {versions.map((version) => (
            <option key={String(version.id)} value={String(version.id)}>
              v{Number(version.versionNumber)} ·{" "}
              {version.publishedAt
                ? t("Published", "منشورة")
                : t("Unpublished", "غير منشورة")}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          disabled={pending || !draft}
          onClick={async () => {
            try {
              setComparison(
                await adminApi.get(`templates/${id}/compare/${versionId}`),
              );
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure.message
                  : "Comparison failed",
              );
            }
          }}
        >
          {t("Compare draft", "مقارنة المسودة")}
        </Button>
        <Button
          variant="outline"
          disabled={
            pending ||
            reason.trim().length < 8 ||
            !versions.find((version) => String(version.id) === versionId)
              ?.publishedAt
          }
          onClick={() =>
            void mutate("rollback", {
              expectedRevision: Number(head.revision ?? 0),
              versionId,
            })
          }
        >
          {t("Restore version", "استعادة النسخة")}
        </Button>
      </div>
      {comparison && (
        <div className="rounded border p-4 text-sm">
          <p>
            {comparison.outputChanged
              ? t(
                  "Video-affecting changes require new output evidence.",
                  "تتطلب التغييرات المؤثرة في الفيديو دليلاً جديداً.",
                )
              : t(
                  "Video recipe unchanged. Form and identity changes listed below.",
                  "لم يتغير إخراج الفيديو. تغييرات النموذج والهوية أدناه.",
                )}
          </p>
          <ul className="mt-3 list-inside list-disc">
            {(comparison.changes as string[]).map((path) => (
              <li className="break-all" key={path}>
                {path}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="rounded border p-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t("Create a template from this family", "إنشاء قالب من هذه العائلة")}
        </summary>
        <p className="my-3 text-sm text-muted-foreground">
          {t(
            "Creates a private unpublished copy. Supported runtime and safety rules are preserved.",
            "ينشئ نسخة غير منشورة. تُحفظ إمكانات التشغيل وقواعد الأمان المدعومة.",
          )}
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            aria-label="Template address"
            placeholder="new-template-address"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
          <Input
            aria-label="English name"
            placeholder="Name · English"
            value={nameEn}
            onChange={(event) => setNameEn(event.target.value)}
          />
          <Input
            aria-label="الاسم بالعربية"
            placeholder="الاسم بالعربية"
            value={nameAr}
            onChange={(event) => setNameAr(event.target.value)}
          />
        </div>
        <Button
          className="mt-3"
          variant="outline"
          disabled={
            pending || reason.trim().length < 8 || !slug || !nameEn || !nameAr
          }
          onClick={() =>
            void mutate("duplicate", { slug, name: { en: nameEn, ar: nameAr } })
          }
        >
          {t("Create unpublished copy", "إنشاء نسخة غير منشورة")}
        </Button>
      </details>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
