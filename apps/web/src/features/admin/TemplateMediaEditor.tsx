import { useQuery } from "@tanstack/react-query";
import type { AdminTemplateMedia } from "@movprompt/contracts";
import { adminApi } from "./api";
import { object } from "./adminData";
import { ErrorState, Loading } from "./AdminDisplay";

export function TemplateMediaEditor({
  value,
  onChange,
  rights,
  onRights,
  ar,
}: {
  value: AdminTemplateMedia;
  onChange: (value: AdminTemplateMedia) => void;
  rights: boolean;
  onRights: (value: boolean) => void;
  ar: boolean;
}) {
  const query = useQuery({
    queryKey: ["admin", "approved-template-media"],
    queryFn: () => adminApi.get("owned-media/approved"),
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const items = (Array.isArray(query.data.items) ? query.data.items : []).map(
    object,
  );
  const slots = [
    ["poster", "poster", "Poster", "صورة الغلاف"],
    ["preview", "video-preview", "Playable preview", "معاينة الفيديو"],
    ["productSamples", "product-sample", "Product samples", "أمثلة المنتج"],
    [
      "presenterSamples",
      "presenter-sample",
      "Presenter samples",
      "أمثلة الشخصيات",
    ],
  ] as const;
  return (
    <section className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {ar
          ? "اختر نسخاً مستقلة ومعتمدة من وسائط MovPrompt. تظهر هذه الملفات للعامة بعد نشر القالب ولا تضاف إلى صور العميل أو نصه. معاينة الفيديو تحتاج أيضاً إلى دليل جودة مطابق لوصفة القالب."
          : "Choose independent, approved MovPrompt media revisions. These become public when the template is published; they do not populate customer photos or copy. Video previews also require matching recipe-quality evidence."}
      </p>
      {slots.map(([slot, kind, en, arabic]) => {
        const selected = value[slot];
        const choices = Array.isArray(selected)
          ? selected
          : selected
            ? [selected]
            : [];
        return (
          <fieldset key={slot} className="space-y-3 rounded-lg border p-4">
            <legend className="px-2 font-medium text-sm">
              {ar ? arabic : en}
            </legend>
            <select
              multiple={slot.endsWith("Samples")}
              size={slot.endsWith("Samples") ? 4 : 1}
              className="w-full min-h-11 rounded border bg-background p-2"
              aria-label={ar ? arabic : en}
              value={
                slot.endsWith("Samples")
                  ? choices.map((item) => `${item.mediaId}/${item.revision}`)
                  : choices[0]
                    ? `${choices[0].mediaId}/${choices[0].revision}`
                    : ""
              }
              onChange={(event) => {
                const refs = Array.from(event.target.selectedOptions)
                  .map((option) => option.value)
                  .filter(Boolean)
                  .map((key) => {
                    const [mediaId, revision] = key.split("/");
                    return { mediaId: mediaId!, revision: Number(revision) };
                  });
                const next = { ...value };
                if (slot === "poster" || slot === "preview") {
                  delete next[slot];
                  if (refs[0]) next[slot] = refs[0];
                } else next[slot] = refs.slice(0, 3);
                onChange(next);
                onRights(false);
              }}
            >
              {!slot.endsWith("Samples") && (
                <option value="">
                  {ar ? "استخدام الافتراضي الحالي" : "Use existing default"}
                </option>
              )}
              {choices
                .filter(
                  (ref) =>
                    !items.some(
                      (item) =>
                        item.id === ref.mediaId &&
                        item.revision === ref.revision,
                    ),
                )
                .map((ref) => (
                  <option
                    key={`${ref.mediaId}/${ref.revision}`}
                    value={`${ref.mediaId}/${ref.revision}`}
                  >
                    {ar
                      ? "نسخة غير متاحة أو غير معتمدة"
                      : "Unavailable or unapproved revision"}{" "}
                    · v{ref.revision}
                  </option>
                ))}
              {items
                .filter((item) => item.kind === kind)
                .map((item) => (
                  <option
                    key={String(item.id)}
                    value={`${item.id}/${item.revision}`}
                  >
                    {String(item.name)} · v{String(item.revision)}
                  </option>
                ))}
            </select>
            {slot.endsWith("Samples") && (
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "حتى ثلاث صور ضمن حدود القالب. استخدم Ctrl أو ⌘ لتحديد عدة صور أو إلغاء التحديد."
                  : "Up to three photos within template limits. Use Ctrl or ⌘ to select or clear multiple items."}
              </p>
            )}
          </fieldset>
        );
      })}
      <label className="flex items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0"
          checked={rights}
          onChange={(event) => onRights(event.target.checked)}
        />
        <span>
          {ar
            ? "راجعت حقوق هذه النسخ وأوافق على عرضها للعامة كأمثلة ومعاينات لهذا القالب."
            : "I reviewed the rights to these revisions and approve public use as this template’s samples and previews."}
        </span>
      </label>
    </section>
  );
}
