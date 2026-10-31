import { useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { TemplateNameEditor } from "./TemplateNameEditor";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCreatorTemplate } from "@/features/create/templates";
import { TemplatePreviewDialog } from "@/features/create/TemplatePreviewDialog";
import type { CreatorTemplate } from "@/features/create/types";
import { adminApi } from "./api";
import { object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";
import { AdminTable, AdminPagination } from "./AdminTable";

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
  const category = (value: unknown) => ({ "mobile-electronics": t("Electronics", "الإلكترونيات"), "food-restaurants": t("Food & restaurants", "المأكولات والمطاعم"), advertising: t("Advertising", "الإعلانات"), "clothing-fashion": t("Fashion", "الأزياء"), "jewelry-accessories": t("Jewelry & accessories", "المجوهرات والإكسسوارات"), gifting: t("Gifting", "الهدايا"), "beauty-cosmetics": t("Beauty", "التجميل"), brand: t("Brand", "العلامة التجارية"), "ugc-review": t("UGC", "محتوى الشخصيات"), "property-services": t("Property", "العقارات") })[String(value)] ?? String(value ?? "").replaceAll("-", " ");
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [pending, setPending] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<CreatorTemplate | null>(null);
  const [confirmation, setConfirmation] = useState<{
    row: Record<string, unknown>;
    durations?: number[];
    key: string;
  } | null>(null);
  const keys = useRef(new Map<string, string>());
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = useQuery({
    queryKey: ["admin", "templates", id ?? params.toString()],
    queryFn: () =>
      adminApi.list(
        "templates",
        new URLSearchParams({
          search: id ?? params.get("search") ?? "",
          page: id ? "1" : String(page),
          limit: "25",
        }),
      ),
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
  function ask(row: Record<string, unknown>, durations?: number[]) {
    const operation = JSON.stringify([
      row.id,
      row.revision,
      durations ?? row.publishingState,
    ]);
    const key = keys.current.get(operation) ?? crypto.randomUUID();
    keys.current.set(operation, key);
    setError(null);
    setConfirmation({ row, durations, key });
  }
  async function confirm() {
    if (!confirmation || pending || readOnly) return;
    setPending(true);
    setError(null);
    const { row, durations, key } = confirmation;
    try {
      await adminApi.mutate(
        `templates/${row.id}/${durations ? "availability" : "state"}`,
        durations
          ? { expectedRevision: row.revision ?? 0, enabledDurations: durations }
          : {
              expectedRevision: row.revision ?? 0,
              action:
                row.publishingState === "published"
                  ? "unpublish"
                  : "restore-publication",
              reason: "Owner confirmed template availability change",
            },
        key,
      );
      await client.invalidateQueries({ queryKey: ["admin"] });
      setConfirmation(null);
      setNotice(t("Template availability updated", "تم تحديث حالة القالب"));
    } catch (failure) {
      setError(failure instanceof Error ? failure : new Error("Update failed"));
    } finally {
      setPending(false);
    }
  }
  const toggle = (row: Record<string, unknown>) => (
    <Button
      variant="outline"
      disabled={readOnly || pending || !row.currentPublishedVersionId}
      aria-label={`${row.publishingState === "published" ? t("Disable", "إيقاف") : t("Enable", "تفعيل")} ${media(row)[ar ? "nameAr" : "name"]}`}
      onClick={() => ask(row)}
    >
      {row.publishingState === "published"
        ? t("Disable", "إيقاف")
        : t("Enable", "تفعيل")}
    </Button>
  );
  const rows = query.data?.items ?? [],
    detail = id ? rows.find((row) => row.id === id) : undefined;
  return (
    <div className="admin-template-manager space-y-6">
      {id ? (
        <Link to={`/admin/templates${params.size ? `?${params}` : ""}`} className="admin-back admin-template-back">
          <ArrowLeft size={18} aria-hidden="true" />
          {t("Back to templates", "العودة للقوالب")}
        </Link>
      ) : (
        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setParams(search.trim() ? { search: search.trim() } : {});
          }}
        >
          <Input
            aria-label={t("Search templates", "بحث عن قالب")}
            placeholder={t("Search templates", "بحث عن قالب")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outline">
            {t("Search", "بحث")}
          </Button>
        </form>
      )}
      {readOnly && (
        <p className="text-sm text-muted-foreground">
          {t(
            "Template changes are disabled in read-only mode.",
            "تعديلات القوالب متوقفة في وضع القراءة فقط.",
          )}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : id ? (
        detail ? (
          <>
            <div className="admin-template-heading">
              <div>
                <p className="admin-template-eyebrow">{t("Template details", "تفاصيل القالب")}</p>
                <h1 className="text-3xl font-semibold tracking-tight">
                  {media(detail)[ar ? "nameAr" : "name"]}
                </h1>
                <p className="mt-2 text-muted-foreground max-w-2xl">
                  {media(detail)[ar ? "descriptionAr" : "description"]}
                </p>
              </div>
              {toggle(detail)}
            </div>
            <div className="admin-template-layout">
              <section className="admin-panel admin-template-preview space-y-4" aria-label={t("Template preview", "معاينة القالب")}>
                <img
                  className="admin-template-poster"
                  src={media(detail).poster}
                  alt={media(detail)[ar ? "nameAr" : "name"]}
                />
                <Button
                  variant="outline"
                  onClick={() => setPreview(media(detail))}
                >
                  {t("Preview", "معاينة")}
                </Button>
              </section>
              <section className="admin-panel space-y-6">
                <TemplateNameEditor key={`${detail.id}/${detail.revision}`} id={String(detail.id)} revision={Number(detail.revision ?? 0)} initial={{ en: media(detail).name, ar: media(detail).nameAr }} readOnly={readOnly} ar={ar} onSaved={() => setNotice(t("Template name saved", "تم حفظ اسم القالب"))} />
                <div>
                  <h3 className="font-semibold">
                    {t("Available video lengths", "مدد الفيديو المتاحة")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(
                      "Keep at least one length selected. Disable the template to hide all lengths.",
                      "احتفظ بمدة واحدة على الأقل. أوقف القالب لإخفاء جميع المدد.",
                    )}
                  </p>
                  <div className="flex gap-3 flex-wrap mt-4">
                    {((detail.supportedDurations as number[]) ?? []).map(
                      (seconds) => {
                        const enabled = (detail.enabledDurations ??
                          detail.supportedDurations) as number[];
                        const checked = enabled.includes(seconds);
                        return (
                          <label className="admin-duration" key={seconds}>
                            <span>
                              {seconds} {t("seconds", "ثانية")}
                            </span>
                            <input
                              type="checkbox"
                              role="switch"
                              checked={checked}
                              disabled={
                                readOnly ||
                                pending ||
                                (checked && enabled.length === 1)
                              }
                              onChange={() =>
                                ask(
                                  detail,
                                  checked
                                    ? enabled.filter(
                                        (value) => value !== seconds,
                                      )
                                    : [...enabled, seconds],
                                )
                              }
                            />
                          </label>
                        );
                      },
                    )}
                  </div>
                </div>
                <dl className="grid gap-5 sm:grid-cols-2">
                  {[
                    [
                      t("Audio", "الصوت"),
                      detail.speechSupported
                        ? t(
                            "Approved speech and lip sync",
                            "كلام معتمد ومزامنة الشفاه",
                          )
                        : t("Silent video", "فيديو صامت"),
                    ],
                    [
                      t("Category", "الفئة"),
                      category(detail.category),
                    ],
                    [
                      t("Formats", "الأبعاد"),
                      ((detail.supportedRatios as string[]) ?? []).join(", "),
                    ],
                    [
                      t("Languages", "اللغات"),
                      ((detail.supportedLanguages as string[]) ?? [])
                        .map(
                          (value) =>
                            ({
                              en: t("English", "الإنجليزية"),
                              ar: t("Arabic", "العربية"),
                              bilingual: t("Bilingual", "ثنائي اللغة"),
                            })[value] ?? value,
                        )
                        .join(", "),
                    ],
                    [
                      t("Presenter options", "خيارات الشخصية"),
                      ((detail.presenterModes as string[]) ?? [])
                        .map(
                          (value) =>
                            ({
                              none: t("No presenter", "بدون شخصية"),
                              ai_ugc: t("UGC character", "شخصية UGC"),
                              uploaded_spokesperson: t(
                                "Uploaded presenter",
                                "شخصية مرفوعة",
                              ),
                              digital_twin: t(
                                "Digital presenter",
                                "شخصية رقمية",
                              ),
                            })[value] ?? value.replaceAll("_", " "),
                        )
                        .join(", "),
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="mt-1">{value || t("None", "لا يوجد")}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h3 className="font-semibold mb-2">
                    {t("Reference photos", "الصور المرجعية")}
                  </h3>
                  {(
                    (object(detail.photoPolicy).groups as Record<
                      string,
                      unknown
                    >[]) ?? []
                  ).map((group) => (
                    <p key={String(group.role)} className="text-sm">
                      {group.role === "subject"
                        ? t("Product", "المنتج")
                        : group.role === "character"
                          ? t("Presenter", "الشخصية")
                          : t("Reference", "مرجع")}
                      : {String(group.min)} - {String(group.max)}
                    </p>
                  ))}
                </div>
              </section>
            </div>
          </>
        ) : (
          <p className="admin-empty">
            {t("Template not found", "القالب غير موجود")}
          </p>
        )
      ) : (
        <>
          <AdminTable
            rows={rows}
            empty={t("No templates found", "لم يتم العثور على قوالب")}
            columns={[
              {
                key: "thumbnail",
                label: t("Thumbnail", "الصورة"),
                render: (row) => (
                  <img
                    className="admin-thumbnail"
                    src={media(row).poster}
                    alt=""
                    loading="lazy"
                  />
                ),
              },
              {
                key: "name",
                label: t("Template", "القالب"),
                render: (row) => (
                  <Link
                    className="admin-link font-medium"
                    to={`/admin/templates/${row.id}${params.size ? `?${params}` : ""}`}
                  >
                    {media(row)[ar ? "nameAr" : "name"]}
                  </Link>
                ),
              },
              {
                key: "category",
                label: t("Category", "الفئة"),
                render: (row) =>
                  category(row.category),
              },
              {
                key: "lengths",
                label: t("Lengths", "المدد"),
                render: (row) =>
                  (
                    ((row.enabledDurations ??
                      row.supportedDurations) as number[]) ?? []
                  )
                    .map((value) => `${value} ${t("s", "ث")}`)
                    .join(", "),
              },
              {
                key: "status",
                label: t("Status", "الحالة"),
                render: (row) =>
                  row.publishingState === "published"
                    ? t("Enabled", "مفعّل")
                    : t("Disabled", "متوقف"),
              },
              {
                key: "preview",
                label: t("Preview", "معاينة"),
                render: (row) => (
                  <Button
                    variant="outline"
                    onClick={() => setPreview(media(row))}
                  >
                    {t("Preview", "معاينة")}
                  </Button>
                ),
              },
              {
                key: "availability",
                label: t("Availability", "الإتاحة"),
                render: toggle,
              },
            ]}
          />
          <AdminPagination
            page={page}
            total={query.data.total}
            ar={ar}
            onPage={(value) => {
              const next = new URLSearchParams(params);
              next.set("page", String(value));
              setParams(next);
            }}
          />
        </>
      )}
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
              "Are you sure? This affects new generations. Running and completed videos remain unchanged.",
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
    </div>
  );
}
