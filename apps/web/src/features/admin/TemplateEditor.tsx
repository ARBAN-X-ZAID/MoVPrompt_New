import { BusinessRenderRequest } from "./BusinessRenderRequest";
import {
  AdminTemplateMediaSchema,
  type AdminTemplateMedia,
} from "@movprompt/contracts";
import { TemplateMediaEditor } from "./TemplateMediaEditor";
import { useAdminCommandKey } from "./useAdminCommandKey";
import { TemplateOptionsEditor } from "./TemplateOptionsEditor";
import { TemplateFormPreview } from "./TemplateFormPreview";
import { TemplateFormEditor } from "./TemplateFormEditor";
import { TemplatePublication } from "./TemplatePublication";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreativeTemplateRecipeSchema,
  type CreativeTemplateRecipe,
  type TemplateSceneRecipe,
} from "@movprompt/creative-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { adminApi } from "./api";

function Editor({
  id,
  initial,
  revision,
  baseVersionId,
  initialMedia,
}: {
  id: string;
  initial: CreativeTemplateRecipe;
  revision: number;
  baseVersionId: string;
  initialMedia: AdminTemplateMedia;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const client = useQueryClient();
  const commandKey = useAdminCommandKey();
  const [definition, setDefinition] = useState(initial);
  const [tagsText, setTagsText] = useState(initial.tags.join(", "));
  const [templateMedia, setTemplateMedia] = useState(initialMedia);
  const [publicMediaRightsConfirmed, setPublicMediaRightsConfirmed] =
    useState(false);
  const [tab, setTab] = useState("identity");
  const [sceneDuration, setSceneDuration] = useState(
    String(initial.durationSeconds),
  );
  const activeScenes =
    definition.durationRecipes?.[sceneDuration]?.scenes ?? definition.scenes;
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const tabs = [
    ["identity", "Identity", "الهوية"],
    ["form", "Customer form", "نموذج العميل"],
    ["scenes", "Scenes & direction", "المشاهد والإخراج"],
    ["options", "Supported settings", "الإعدادات المدعومة"],
    ["media", "Public samples & previews", "الأمثلة والمعاينات العامة"],
    ["preview", "Form preview", "معاينة النموذج"],
    ["review", "Review & save", "المراجعة والحفظ"],
  ];
  const text = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    multiline = false,
  ) => (
    <div key={id} className="space-y-2">
      <Label htmlFor={`template-${id}`}>{label}</Label>
      {multiline ? (
        <Textarea
          id={`template-${id}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
        />
      ) : (
        <Input
          id={`template-${id}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
  const updateScene = (
    index: number,
    key: keyof TemplateSceneRecipe,
    value: string | { en: string; ar: string },
  ) =>
    setDefinition((current) => ({
      ...current,
      ...(Number(sceneDuration) === current.durationSeconds
        ? {
            scenes: current.scenes.map((scene, i) =>
              i === index ? { ...scene, [key]: value } : scene,
            ),
          }
        : {}),
      ...(current.durationRecipes?.[sceneDuration]
        ? {
            durationRecipes: {
              ...current.durationRecipes,
              [sceneDuration]: {
                ...current.durationRecipes[sceneDuration]!,
                scenes: current.durationRecipes[sceneDuration]!.scenes.map(
                  (scene, i) =>
                    i === index ? { ...scene, [key]: value } : scene,
                ),
              },
            },
          }
        : {}),
    }));
  return (
    <section className="admin-panel mt-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {ar ? "محرر مسودة القالب" : "Template draft editor"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {ar
              ? "التغييرات محفوظة في مسودة منفصلة عن النسخة المنشورة"
              : "Changes are saved separately from the published version"}
          </p>
        </div>
        <span className="admin-status">
          {ar ? "المراجعة" : "Revision"} {revision}
        </span>
      </div>
      <nav
        className="mb-7 flex flex-wrap gap-2"
        aria-label={ar ? "أقسام المحرر" : "Editor sections"}
      >
        {tabs.map(([value, en, arabic]) => (
          <Button
            key={value}
            variant={tab === value ? "default" : "outline"}
            onClick={() => setTab(value!)}
            aria-pressed={tab === value}
          >
            {ar ? arabic : en}
          </Button>
        ))}
      </nav>
      {tab === "identity" && (
        <div className="grid gap-5 md:grid-cols-2">
          {text(
            "name-en",
            "Name · English",
            definition.localizedName.en,
            (value) =>
              setDefinition((current) => ({
                ...current,
                localizedName: { ...current.localizedName, en: value },
              })),
          )}
          {text(
            "name-ar",
            "الاسم · العربية",
            definition.localizedName.ar,
            (value) =>
              setDefinition((current) => ({
                ...current,
                localizedName: { ...current.localizedName, ar: value },
              })),
          )}
          {text(
            "description-en",
            "Description · English",
            definition.localizedDescription.en,
            (value) =>
              setDefinition((current) => ({
                ...current,
                localizedDescription: {
                  ...current.localizedDescription,
                  en: value,
                },
              })),
            true,
          )}
          {text(
            "description-ar",
            "الوصف · العربية",
            definition.localizedDescription.ar,
            (value) =>
              setDefinition((current) => ({
                ...current,
                localizedDescription: {
                  ...current.localizedDescription,
                  ar: value,
                },
              })),
            true,
          )}
          {text(
            "category",
            ar ? "الفئة" : "Category",
            definition.category,
            (value) =>
              setDefinition((current) => ({ ...current, category: value })),
          )}
          {text(
            "tags",
            ar ? "وسوم البحث (افصل بفاصلة)" : "Search tags (comma separated)",
            tagsText,
            (value) => {
              setTagsText(value);
              setDefinition((current) => ({
                ...current,
                tags: value
                  .split(/[,،]/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              }));
            },
          )}
          <label className="grid gap-2 text-sm">
            {ar
              ? "ترتيب العرض داخل الفئة (الأقل أولاً)"
              : "Display order within category (lower first)"}
            <Input
              type="number"
              min={0}
              max={100000}
              value={definition.sortOrder ?? 1000}
              onChange={(event) =>
                setDefinition((current) => ({
                  ...current,
                  sortOrder: Number(event.target.value),
                }))
              }
            />
          </label>
          {text(
            "outcome",
            ar ? "النتيجة" : "Outcome",
            definition.outcome,
            (value) =>
              setDefinition((current) => ({ ...current, outcome: value })),
          )}
          {text(
            "visual",
            ar ? "الاتجاه البصري" : "Visual system",
            definition.visualSystem,
            (value) =>
              setDefinition((current) => ({ ...current, visualSystem: value })),
            true,
          )}
          {text(
            "sound",
            ar ? "اتجاه الصوت" : "Sound direction",
            definition.soundDirection,
            (value) =>
              setDefinition((current) => ({
                ...current,
                soundDirection: value,
              })),
            true,
          )}
        </div>
      )}
      {tab === "media" && (
        <TemplateMediaEditor
          value={templateMedia}
          onChange={setTemplateMedia}
          rights={publicMediaRightsConfirmed}
          onRights={setPublicMediaRightsConfirmed}
          ar={ar}
        />
      )}
      {tab === "form" && (
        <TemplateFormEditor
          definition={definition}
          onChange={setDefinition}
          ar={ar}
        />
      )}
      {tab === "preview" && (
        <TemplateFormPreview
          key={JSON.stringify(definition)}
          definition={definition}
          ar={ar}
        />
      )}
      {tab === "scenes" && (
        <div className="space-y-6">
          <label className="grid gap-2 text-sm">
            {ar ? "توقيت المشاهد" : "Scene timing variant"}
            <select
              className="rounded border bg-background p-3"
              value={sceneDuration}
              onChange={(event) => setSceneDuration(event.target.value)}
            >
              {(
                definition.supportedDurations ?? [definition.durationSeconds]
              ).map((duration) => (
                <option key={duration} value={duration}>
                  {duration}s
                </option>
              ))}
            </select>
          </label>
          {activeScenes.map((scene, index) => (
            <fieldset key={scene.id} className="rounded-xl border p-5">
              <legend className="px-2 text-sm font-medium">
                {index + 1} · {ar ? scene.title.ar : scene.title.en}
              </legend>
              <div className="grid gap-5 md:grid-cols-2">
                {text(
                  `${index}-title-en`,
                  "Scene title · English",
                  scene.title.en,
                  (value) =>
                    updateScene(index, "title", { ...scene.title, en: value }),
                )}
                {text(
                  `${index}-title-ar`,
                  "عنوان المشهد · العربية",
                  scene.title.ar,
                  (value) =>
                    updateScene(index, "title", { ...scene.title, ar: value }),
                )}
                {(
                  [
                    "direction",
                    "shot",
                    "camera",
                    "lighting",
                    "continuityAnchor",
                  ] as const
                ).map((key) =>
                  text(
                    `${index}-${key}`,
                    {
                      direction: ar ? "وصف المشهد" : "Scene direction",
                      shot: ar ? "الكادر" : "Framing",
                      camera: ar ? "الكاميرا" : "Camera",
                      lighting: ar ? "الإضاءة" : "Lighting",
                      continuityAnchor: ar ? "استمرارية المشهد" : "Continuity",
                    }[key],
                    scene[key],
                    (value) => updateScene(index, key, value),
                    key === "direction",
                  ),
                )}
              </div>
            </fieldset>
          ))}
        </div>
      )}
      {tab === "options" && (
        <TemplateOptionsEditor
          definition={definition}
          onChange={setDefinition}
          ar={ar}
        />
      )}
      {tab === "review" && (
        <div className="max-w-2xl space-y-5">
          <p className="text-sm leading-6 text-muted-foreground">
            {ar
              ? "حفظ المسودة لا يغير النسخة المنشورة أو الفيديوهات المكتملة. يتطلب النشر مراجعة منفصلة للمالك ودليل جودة مطابقاً."
              : "Saving this draft does not change the published version or completed videos. Publishing requires a separate owner review and matching quality evidence."}
          </p>
          {text(
            "reason",
            ar ? "ملخص التغييرات" : "Change summary",
            reason,
            setReason,
            true,
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            disabled={pending || reason.trim().length < 8}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                const parsed = CreativeTemplateRecipeSchema.parse(definition);
                await adminApi.mutate(
                  `templates/${id}/draft`,
                  {
                    expectedRevision: revision,
                    baseVersionId,
                    definition: parsed,
                    templateMedia,
                    ...(publicMediaRightsConfirmed
                      ? { publicMediaRightsConfirmed: true }
                      : {}),
                    reason,
                  },
                  commandKey({
                    id,
                    definition,
                    templateMedia,
                    publicMediaRightsConfirmed,
                    revision,
                    baseVersionId,
                    reason,
                  }),
                );
                await client.invalidateQueries({
                  queryKey: ["admin", "template-editor", id],
                });
              } catch (failure) {
                setError(
                  failure instanceof Error ? failure.message : "Save failed",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending
              ? ar
                ? "جارٍ الحفظ…"
                : "Saving…"
              : ar
                ? "التحقق وحفظ المسودة"
                : "Validate & save draft"}
          </Button>
        </div>
      )}
    </section>
  );
}
export function TemplateEditor({ id }: { id: string }) {
  const { locale } = useLanguage();
  const query = useQuery({
    queryKey: ["admin", "template-editor", id],
    queryFn: () => adminApi.get(`templates/${id}/editor`),
  });
  if (query.isPending) return null;
  if (query.error)
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {query.error.message}
      </p>
    );
  const draft = query.data.draft as Record<string, unknown> | null;
  const definition = CreativeTemplateRecipeSchema.safeParse(
    draft?.definition ?? query.data.definition,
  );
  if (!definition.success)
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        Template definition unavailable
      </p>
    );
  return (
    <>
      <TemplatePublication id={id} data={query.data} />
      <div className="mt-4">
        <BusinessRenderRequest
          templateId={id}
          {...(draft?.status === "draft"
            ? { draftRevision: Number(draft.revision) }
            : {})}
          ar={locale === "ar"}
        />
      </div>
      <Editor
        key={`${id}/${draft?.revision ?? 0}`}
        id={id}
        initial={definition.data}
        initialMedia={AdminTemplateMediaSchema.parse(
          draft?.templateMedia ?? query.data.templateMedia ?? {},
        )}
        revision={Number(draft?.revision ?? 0)}
        baseVersionId={String(
          draft?.baseVersionId ?? query.data.activeVersionId,
        )}
      />
    </>
  );
}
