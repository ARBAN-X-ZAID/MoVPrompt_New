import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageOff, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCreatorTemplate } from "@/features/create/templates";
import { TemplatePreviewDialog } from "@/features/create/TemplatePreviewDialog";
import type { CreatorTemplate } from "@/features/create/types";
import { adminApi } from "./api";
import { object, type RecordData } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminCard, AdminFacts, AdminPageHeader, StatusBadge } from "./AdminChrome";
import { AdminTable, AdminPagination, type AdminColumn } from "./AdminTable";
import { invalidateAdminData } from "./adminQueries";
import { withReturnTo } from "./adminNav";
import { discoveryLabel, TemplateSettingsForm } from "./TemplateSettingsForm";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", ar: "العربية" };

function TemplateImage({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={`${className} admin-image-missing`}><ImageOff aria-hidden="true" /></span>;
  return <img className={className} src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export default function AdminTemplateManager({
  readOnly = false,
  id,
}: {
  readOnly?: boolean;
  id?: string;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const urlSearch = params.get("search") ?? "";
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => {
    if (id) return;
    const timer = window.setTimeout(() => {
      if (search === urlSearch) return;
      const next = new URLSearchParams(params);
      if (search) next.set("search", search); else next.delete("search");
      next.delete("page");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [id, search, urlSearch, params, setParams]);
  const [pending, setPending] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<CreatorTemplate | null>(null);
  const [confirmation, setConfirmation] = useState<{ row: RecordData; key: string } | null>(null);
  const keys = useRef(new Map<string, string>());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = useQuery({
    queryKey: ["admin", "templates", params.toString()],
    queryFn: () => adminApi.list("templates", new URLSearchParams({ search: params.get("search") ?? "", page: String(page), limit: "25" })),
    placeholderData: keepPreviousData,
    enabled: !id,
  });
  const single = useQuery({
    queryKey: ["admin", "templates", "record", id],
    queryFn: () => adminApi.get(`templates/${id}`),
    enabled: Boolean(id),
  });
  function media(row: Record<string, unknown>) {
    const base = getCreatorTemplate(String(row.familyId ?? row.slug));
    const refs = object(row.templateMedia);
    return {
      ...base,
      id: String(row.slug),
      name: String(object(row.name).en ?? base.name),
      nameAr: String(object(row.name).ar ?? base.nameAr),
      description: String(object(row.description).en ?? base.description),
      descriptionAr: String(object(row.description).ar ?? base.descriptionAr),
      ...(object(refs.poster).mediaId
        ? {
            poster: adminApi.media(
              "owned",
              String(object(refs.poster).mediaId),
            ),
          }
        : {}),
      ...(object(refs.preview).mediaId
        ? {
            previewVideo: adminApi.media(
              "owned",
              String(object(refs.preview).mediaId),
            ),
            managedPreview: true,
          }
        : {}),
    };
  }
  function ask(row: RecordData) {
    const operation = JSON.stringify([row.id, row.revision, row.publishingState]);
    const key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    setError(null);
    setConfirmation({ row, key });
  }
  async function confirm() {
    if (!confirmation || pending || readOnly) return;
    setPending(true);
    setError(null);
    const { row, key } = confirmation;
    try {
      await adminApi.mutate(
        `templates/${row.id}/state`,
        {
          expectedRevision: row.revision ?? 0,
          action: row.publishingState === "published" ? "unpublish" : "restore-publication",
          reason: "Owner confirmed template availability change",
        },
        key,
      );
      invalidateAdminData(client);
      setConfirmation(null);
      setNotice(t("Template availability updated", "تم تحديث حالة القالب"));
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error("Update failed"));
    } finally {
      setPending(false);
    }
  }
  const toggle = (row: RecordData) => (
    <Button
      variant="outline"
      size="sm"
      disabled={readOnly || pending || !row.currentPublishedVersionId}
      aria-label={`${row.publishingState === "published" ? t("Disable", "إيقاف") : t("Enable", "تفعيل")} ${media(row)[ar ? "nameAr" : "name"]}`}
      onClick={() => ask(row)}
    >
      {row.publishingState === "published" ? t("Disable", "إيقاف") : t("Enable", "تفعيل")}
    </Button>
  );
  const from = useMemo(() => ({ pathname: location.pathname, search: location.search }), [location.pathname, location.search]);
  const lengths = (row: RecordData) => ((row.enabledDurations ?? row.supportedDurations) as number[] | undefined ?? []).map(value => `${value} ${t("s", "ث")}`).join(", ");
  const languageList = (row: RecordData) => (Array.isArray(row.enabledLanguages) ? [...row.enabledLanguages].sort().reverse() : []).map(value => LANGUAGE_NAMES[String(value)] ?? String(value)).join(ar ? "، " : ", ");
  const category = (row: RecordData) => discoveryLabel[String(row.discoveryCategory)]?.[ar ? 1 : 0] ?? String(row.category ?? "—");
  const columns: AdminColumn<RecordData>[] = [
    { key: "name", label: t("Template", "القالب"), render: row => <div className="flex items-center gap-3">
      <TemplateImage className="admin-thumbnail" src={media(row).poster} />
      <span className="min-w-0"><span className="admin-cell-title" dir="auto">{media(row)[ar ? "nameAr" : "name"]}</span><span className="admin-cell-sub">{category(row)}</span></span>
    </div> },
    { key: "lengths", label: t("Lengths", "المدد"), width: "150px", render: lengths },
    { key: "languages", label: t("Languages", "اللغات"), width: "150px", render: languageList },
    { key: "status", label: t("Status", "الحالة"), width: "120px", render: row => <StatusBadge value={row.publishingState === "published" ? "active" : "inactive"} /> },
    { key: "actions", label: t("Actions", "الإجراءات"), width: "190px", render: row => <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setPreview(media(row))}>{t("Preview", "معاينة")}</Button>
      {toggle(row)}
    </div> },
  ];
  const rows = query.data?.items ?? [];
  const detail = single.data ? (object(single.data.record) as RecordData) : undefined;
  return (
    <>
      {id ? (
        single.isPending ? <Loading variant="detail" /> : single.error ? <ErrorState error={single.error} retry={() => void single.refetch()} /> : detail ? <>
          <AdminPageHeader
            back={{ fallback: "/admin/templates", label: t("Back to templates", "العودة إلى القوالب") }}
            title={<span dir="auto">{media(detail)[ar ? "nameAr" : "name"]}</span>}
            meta={<><StatusBadge value={detail.publishingState === "published" ? "active" : "inactive"} /><span>{category(detail)}</span></>}
            actions={<>
              <Button variant="outline" onClick={() => setPreview(media(detail))}>{t("Preview", "معاينة")}</Button>
              {toggle(detail)}
            </>}
          />
          {notice && <p role="status" className="admin-hint mb-4">{notice}</p>}
          <div className="admin-template-layout">
            <div className="admin-stack">
              <AdminCard><TemplateImage className="admin-template-poster" src={media(detail).poster} /></AdminCard>
              <AdminCard title={t("Fixed by the template", "ثابت في القالب")} description={t("The video prompt and preview cannot be edited here.", "لا يمكن تعديل وصف الفيديو والمعاينة هنا.")}>
                <AdminFacts items={[
                  { label: t("Formats", "المقاسات"), value: (detail.supportedRatios as string[] | undefined)?.join(", ") ?? "—" },
                  { label: t("Sound", "الصوت"), value: detail.speechSupported ? t("Optional speech", "كلام اختياري") : t("Silent", "صامت") },
                ]} />
              </AdminCard>
            </div>
            <TemplateSettingsForm key={String(detail.id)} row={detail} ar={ar} readOnly={readOnly} onSaved={() => void single.refetch()} />
          </div>
        </> : <p className="admin-empty">{t("Template not found", "القالب غير موجود")}</p>
      ) : <>
        <AdminPageHeader title={t("Templates", "القوالب")} description={t("Names, lengths, languages and availability", "الأسماء والمدد واللغات والإتاحة")} />
        <div className="admin-toolbar">
          <div className="admin-search"><Search aria-hidden="true" /><Input aria-label={t("Search templates", "البحث في القوالب")} placeholder={t("Search templates", "البحث في القوالب")} value={search} onChange={event => setSearch(event.target.value)} /></div>
        </div>
        {notice && <p role="status" className="admin-hint mb-3">{notice}</p>}
        {query.isPending ? <Loading /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
          <AdminTable
            rows={rows as RecordData[]}
            columns={columns}
            rowHref={row => withReturnTo(`/admin/templates/${row.id}`, from)}
            rowLabel={row => `${t("Open", "فتح")} ${media(row)[ar ? "nameAr" : "name"]}`}
            empty={t("No templates found", "لم يتم العثور على قوالب")}
          />
          <AdminPagination page={page} total={query.data.total} ar={ar} onPage={value => {
            const next = new URLSearchParams(params);
            next.set("page", String(value));
            setParams(next);
          }} />
        </>}
      </>}
      <TemplatePreviewDialog
        template={preview}
        locale={ar ? "ar" : "en"}
        selectionEnabled={false}
        onOpenChange={(open) => !open && setPreview(null)}
      />
      <Dialog
        open={Boolean(confirmation)}
        onOpenChange={(open) => !open && !pending && setConfirmation(null)}
      >
        <DialogContent dir={ar ? "rtl" : "ltr"}>
          <DialogTitle>
            {t("Change availability?", "تغيير الإتاحة؟")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "This affects new videos only. Running and completed videos stay as they are.",
              "هل أنت متأكد؟ يؤثر هذا على عمليات التوليد الجديدة. تبقى الفيديوهات الجارية والمكتملة كما هي.",
            )}
          </DialogDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error.message}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => setConfirmation(null)}
            >
              {t("Cancel", "إلغاء")}
            </Button>
            <Button
              disabled={pending || readOnly}
              onClick={() => void confirm()}
            >
              {pending ? t("Saving…", "جارٍ الحفظ…") : t("Confirm", "تأكيد")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
