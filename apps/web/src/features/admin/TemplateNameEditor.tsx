import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminApi } from "./api";

export function TemplateNameEditor({ id, revision, initial, readOnly, ar, onSaved }: { id: string; revision: number; initial: { en: string; ar: string }; readOnly: boolean; ar: boolean; onSaved: () => void }) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const keys = useRef(new Map<string, string>());
  const client = useQueryClient();
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const dirty = name.en.trim() !== initial.en || name.ar.trim() !== initial.ar;
  return <form className="admin-template-name" onSubmit={async event => {
    event.preventDefault();
    if (readOnly || pending || !dirty) return;
    const body = { expectedRevision: revision, name: { en: name.en.trim(), ar: name.ar.trim() } };
    const signature = JSON.stringify(body);
    const key = keys.current.get(signature) ?? crypto.randomUUID();
    keys.current.set(signature, key);
    setPending(true); setError(""); setSaved(false);
    try {
      await adminApi.mutate(`templates/${id}/name`, body, key);
      setSaved(true);
      onSaved();
      await client.invalidateQueries({ queryKey: ["admin", "templates"] });
      await client.invalidateQueries({ queryKey: ["templates"] });
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("Could not save. Please try again.", "تعذر الحفظ. حاول مرة أخرى.")); }
    finally { setPending(false); }
  }}>
    <div><h2 className="font-semibold">{t("Template name", "اسم القالب")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Shown in the template catalog. Existing videos stay unchanged.", "يظهر في قائمة القوالب. تبقى الفيديوهات السابقة كما هي.")}</p></div>
    <div className="admin-template-name-fields">{(["en", "ar"] as const).map(language => <label key={language} className="grid gap-2 text-sm" htmlFor={`template-name-${language}`}>
      {language === "en" ? t("English name", "الاسم بالإنجليزية") : t("Arabic name", "الاسم بالعربية")}
      <Input id={`template-name-${language}`} dir={language === "ar" ? "rtl" : "ltr"} required maxLength={120} value={name[language]} disabled={readOnly || pending} onChange={event => { setName(current => ({ ...current, [language]: event.target.value })); setSaved(false); }} aria-describedby={error ? "template-name-error" : undefined} />
    </label>)}</div>
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={readOnly || pending || !dirty || !name.en.trim() || !name.ar.trim()}>{pending ? t("Saving…", "جارٍ الحفظ…") : t("Save name", "حفظ الاسم")}</Button>{dirty && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setName(initial); setError(""); }}>{t("Cancel", "إلغاء")}</Button>}{saved && <p role="status">{t("Name saved", "تم حفظ الاسم")}</p>}</div>
    {error && <p id="template-name-error" role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}
