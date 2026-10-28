import {
  getCreativeTemplate,
  type CreativeTemplateRecipe,
} from "@movprompt/creative-engine";
import { Input } from "@/components/ui/input";

export function TemplateOptionsEditor({
  definition,
  onChange,
  ar,
}: {
  definition: CreativeTemplateRecipe;
  onChange: (definition: CreativeTemplateRecipe) => void;
  ar: boolean;
}) {
  const family = getCreativeTemplate(definition.id);
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const groups = [
    ["supportedLanguages", family.supportedLanguages, t("Languages", "اللغات")],
    [
      "supportedRatios",
      family.supportedRatios,
      t("Aspect ratios", "نسب الأبعاد"),
    ],
    [
      "supportedDurations",
      family.supportedDurations ?? [family.durationSeconds],
      t("Video lengths", "مدة الفيديو"),
    ],
  ] as const;
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t(
          "Choose a subset of the supported family options. Every published version keeps its own limits. Changes to reference counts or video options require matching output evidence.",
          "اختر من إعدادات العائلة المدعومة. تحتفظ كل نسخة منشورة بقيودها. تتطلب تغييرات عدد الصور أو إعدادات الفيديو دليلاً مطابقاً.",
        )}
      </p>
      {groups.map(([key, choices, label]) => (
        <fieldset key={key} className="rounded-xl border p-4">
          <legend className="px-2 text-sm font-medium">{label}</legend>
          <div className="flex flex-wrap gap-5">
            {choices.map((value) => {
              const selected = (definition[key] ?? [
                definition.durationSeconds,
              ]) as readonly (string | number)[];
              return (
                <label className="flex items-center gap-2 text-sm" key={value}>
                  <input
                    type="checkbox"
                    checked={selected.includes(value)}
                    disabled={selected.length === 1 && selected.includes(value)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selected, value]
                        : selected.filter((item) => item !== value);
                      const updated = { ...definition, [key]: next };
                      if (
                        key === "supportedDurations" &&
                        !next.includes(definition.durationSeconds)
                      ) {
                        updated.durationSeconds = Number(next[0]);
                        updated.scenes =
                          updated.durationRecipes?.[String(next[0])]?.scenes ??
                          updated.scenes;
                      }
                      onChange(updated);
                    }}
                  />
                  {value === "en"
                    ? "English"
                    : value === "ar"
                      ? "العربية"
                      : value === "bilingual"
                        ? "English + العربية"
                        : value}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      <fieldset className="rounded-xl border p-4">
        <legend className="px-2 text-sm font-medium">
          {t("Available resolutions", "جودة الفيديو المتاحة")}
        </legend>
        <p className="mb-4 text-xs text-muted-foreground">
          {t(
            "Provider readiness and reviewed pricing still apply. New limits affect only newly published versions.",
            "تظل جاهزية المزود والتسعيرة المعتمدة مطلوبة. تؤثر القيود الجديدة على الإصدارات المنشورة الجديدة فقط.",
          )}
        </p>
        <div className="flex flex-wrap gap-4">
          {(["480p", "720p"] as const).map((value) => (
            <label
              key={value}
              className="flex min-h-11 items-center gap-3 text-sm"
            >
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={(
                  definition.supportedResolutions ?? ["480p", "720p"]
                ).includes(value)}
                onChange={(event) => {
                  const current = definition.supportedResolutions ?? [
                    "480p",
                    "720p",
                  ];
                  const supportedResolutions = event.target.checked
                    ? [...current, value]
                    : current.filter((item) => item !== value);
                  onChange({ ...definition, supportedResolutions });
                }}
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="rounded-xl border p-4">
        <legend className="px-2 text-sm font-medium">
          {t("Reference limits", "قيود الصور المرجعية")}
        </legend>
        <p className="mb-4 text-xs text-muted-foreground">
          {t(
            "Roles stay separate. Permission checks and supported upload types cannot be disabled.",
            "تبقى الأدوار منفصلة. لا يمكن تعطيل الأذونات أو أنواع الملفات المدعومة.",
          )}
        </p>
        {definition.photoPolicy?.groups.map((group, index) => {
          const supported = family.photoPolicy?.groups.find(
            (item) => item.role === group.role,
          );
          return (
            <div key={group.role} className="mb-4 grid gap-3 sm:grid-cols-3">
              <span className="text-sm">
                {group.role === "character"
                  ? t("Adult presenter", "شخصية بالغة")
                  : group.role === "subject"
                    ? t("Product", "المنتج")
                    : group.role}
              </span>
              <label className="grid gap-2 text-xs">
                {t("Minimum", "الحد الأدنى")}
                <Input
                  type="number"
                  min={supported?.min ?? group.min}
                  max={group.max}
                  value={group.min}
                  onChange={(event) =>
                    onChange({
                      ...definition,
                      photoPolicy: {
                        ...definition.photoPolicy!,
                        groups: definition.photoPolicy!.groups.map((item, i) =>
                          i === index
                            ? { ...item, min: Number(event.target.value) }
                            : item,
                        ),
                      },
                    })
                  }
                />
              </label>
              <label className="grid gap-2 text-xs">
                {t("Maximum", "الحد الأقصى")}
                <Input
                  type="number"
                  min={group.min || 1}
                  max={supported?.max ?? group.max}
                  value={group.max}
                  onChange={(event) =>
                    onChange({
                      ...definition,
                      photoPolicy: {
                        ...definition.photoPolicy!,
                        groups: definition.photoPolicy!.groups.map((item, i) =>
                          i === index
                            ? { ...item, max: Number(event.target.value) }
                            : item,
                        ),
                      },
                    })
                  }
                />
              </label>
            </div>
          );
        })}
      </fieldset>
      <div className="rounded border p-4 text-sm">
        <h3 className="mb-2 font-medium">
          {t("Protected runtime requirements", "متطلبات التشغيل المحمية")}
        </h3>
        <p className="break-words text-muted-foreground">
          {definition.requiredInputs.join(" · ")}
        </p>
      </div>
    </div>
  );
}
