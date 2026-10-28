import {
  ManagedTemplateBindingSchema,
  type ManagedTemplateField,
} from "@movprompt/contracts";
import {
  defaultManagedTemplateForm,
  supportsManagedTemplateBinding,
  managedTemplateDefinitionIssues,
  type CreativeTemplateRecipe,
} from "@movprompt/creative-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TemplateFormEditor({
  definition,
  onChange,
  ar,
}: {
  definition: CreativeTemplateRecipe;
  onChange: (definition: CreativeTemplateRecipe) => void;
  ar: boolean;
}) {
  const form = definition.managedForm;
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  if (!form)
    return (
      <div className="space-y-4">
        <p>
          {t(
            "This version uses the existing family form. Enable a guided form to customize supported controls.",
            "تستخدم هذه النسخة نموذج العائلة الحالي. فعّل نموذجاً موجهاً لتخصيص عناصر التحكم المدعومة.",
          )}
        </p>
        <Button
          onClick={() =>
            onChange({
              ...definition,
              managedForm: defaultManagedTemplateForm(definition),
            })
          }
        >
          {t("Configure supported fields", "إعداد الحقول المدعومة")}
        </Button>
      </div>
    );
  const update = (fields: ManagedTemplateField[]) =>
    onChange({ ...definition, managedForm: { version: 1, fields } });
  const issues = managedTemplateDefinitionIssues(definition);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t(
          "Order controls with Earlier and Later. Labels and help text never become customer facts or video copy. Permission controls and required family inputs cannot be removed.",
          "رتّب العناصر باستخدام قبل وبعد. لا تصبح التسميات ونصوص المساعدة معلومات للعميل أو نصاً للفيديو. لا يمكن إزالة الأذونات والمدخلات الإلزامية للعائلة.",
        )}
      </p>
      {form.fields.map((field, index) => (
        <fieldset className="rounded-xl border p-4" key={field.binding}>
          <legend className="px-2 text-sm font-medium">
            {index + 1} · {ar ? field.label.ar : field.label.en}
          </legend>
          <p className="mb-4 break-all font-mono text-xs text-muted-foreground">
            {field.binding}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {(["en", "ar"] as const).map((locale) => (
              <div className="space-y-3" key={locale}>
                <Label htmlFor={`form-${index}-${locale}`}>
                  {locale === "en" ? "Label · English" : "التسمية · العربية"}
                </Label>
                <Input
                  id={`form-${index}-${locale}`}
                  value={field.label[locale]}
                  onChange={(event) =>
                    update(
                      form.fields.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              label: {
                                ...item.label,
                                [locale]: event.target.value,
                              },
                            }
                          : item,
                      ),
                    )
                  }
                />
                <Label htmlFor={`help-${index}-${locale}`}>
                  {locale === "en" ? "Help · English" : "المساعدة · العربية"}
                </Label>
                <Input
                  id={`help-${index}-${locale}`}
                  value={field.help?.[locale] ?? ""}
                  onChange={(event) =>
                    update(
                      form.fields.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              help: {
                                en: item.help?.en ?? "",
                                ar: item.help?.ar ?? "",
                                [locale]: event.target.value,
                              },
                            }
                          : item,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={field.required}
                disabled={field.binding.startsWith("display.")}
                onChange={(event) =>
                  update(
                    form.fields.map((item, i) =>
                      i === index
                        ? { ...item, required: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              {t("Required", "إلزامي")}
            </label>
            <label className="grid gap-2">
              {t("Visibility", "الظهور")}
              <select
                className="rounded border bg-background p-2"
                value={field.visibleWhen}
                onChange={(event) =>
                  update(
                    form.fields.map((item, i) =>
                      i === index
                        ? {
                            ...item,
                            visibleWhen: event.target
                              .value as ManagedTemplateField["visibleWhen"],
                          }
                        : item,
                    ),
                  )
                }
              >
                <option value="always">{t("Always", "دائماً")}</option>
                <option value="speaking">
                  {t("When speaking", "عند الكلام")}
                </option>
                <option value="silent">{t("When silent", "عند الصمت")}</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {([-1, 1] as const).map((offset) => (
              <Button
                key={offset}
                variant="outline"
                size="sm"
                disabled={
                  index + offset < 0 || index + offset >= form.fields.length
                }
                onClick={() => {
                  const next = [...form.fields];
                  [next[index], next[index + offset]] = [
                    next[index + offset]!,
                    next[index]!,
                  ];
                  update(next);
                }}
              >
                {offset < 0 ? t("Earlier", "قبل") : t("Later", "بعد")}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => update(form.fields.filter((_, i) => i !== index))}
            >
              {t("Remove field", "إزالة الحقل")}
            </Button>
          </div>
        </fieldset>
      ))}
      <label className="grid gap-2 text-sm">
        {t("Add supported control", "أضف عنصراً مدعوماً")}
        <select
          className="rounded border bg-background p-3"
          value=""
          onChange={(event) => {
            const binding = ManagedTemplateBindingSchema.parse(
              event.target.value,
            );
            update([
              ...form.fields,
              {
                binding,
                label: { en: binding, ar: binding },
                required: false,
                visibleWhen: "always",
              },
            ]);
          }}
        >
          <option value="" disabled>
            {t("Choose a binding", "اختر الربط")}
          </option>
          {ManagedTemplateBindingSchema.options
            .filter(
              (binding) =>
                supportsManagedTemplateBinding(definition.id, binding) &&
                !form.fields.some((field) => field.binding === binding),
            )
            .map((binding) => (
              <option key={binding}>{binding}</option>
            ))}
        </select>
      </label>
      {issues.length > 0 && (
        <div
          className="rounded border border-destructive p-4 text-sm"
          role="status"
        >
          <p>
            {t(
              "Resolve these constraints before publishing:",
              "عالج هذه القيود قبل النشر:",
            )}
          </p>
          <ul className="mt-2 list-inside list-disc">
            {issues.map((issue) => (
              <li className="break-words" key={issue}>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
