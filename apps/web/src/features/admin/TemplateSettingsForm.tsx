import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { adminApi } from "./api";
import { object, type RecordData } from "./adminData";
import { AdminCard } from "./AdminChrome";
import { invalidateAdminData } from "./adminQueries";
import { useAdminCommandKey } from "./useAdminCommandKey";

const DISCOVERY_CATEGORIES = ["electronics", "food", "ecommerce", "advertising", "brand", "other"] as const;
type Discovery = (typeof DISCOVERY_CATEGORIES)[number];
export const discoveryLabel: Record<string, [string, string]> = {
  electronics: ["Electronics", "الإلكترونيات"], food: ["Food", "الطعام"], ecommerce: ["E-commerce", "التجارة الإلكترونية"],
  advertising: ["Advertising", "الإعلانات"], brand: ["Brand", "العلامة التجارية"], other: ["Other", "أخرى"],
};
const LANGUAGE_NAMES: Record<string, string> = { en: "English", ar: "العربية" };

type Draft = {
  nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string; outcomeEn: string; outcomeAr: string;
  discoveryCategory: string; tags: string; sortOrder: string; languages: string[]; durations: number[];
};
const text = (value: unknown, key: "en" | "ar") => String(object(value)[key] ?? "");
const numbers = (value: unknown) => (Array.isArray(value) ? value.map(Number) : []);
const strings = (value: unknown) => (Array.isArray(value) ? value.map(String) : []);
const sorted = <T,>(values: T[]) => [...values].sort();
const same = (a: unknown[], b: unknown[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

function draftFrom(row: RecordData): Draft {
  return {
    nameEn: text(row.name, "en"), nameAr: text(row.name, "ar"),
    descriptionEn: text(row.description, "en"), descriptionAr: text(row.description, "ar"),
    outcomeEn: text(row.outcome, "en"), outcomeAr: text(row.outcome, "ar"),
    discoveryCategory: String(row.discoveryCategory ?? "other"),
    tags: strings(row.tags).join(", "),
    sortOrder: String(row.sortOrder ?? 0),
    languages: strings(row.enabledLanguages),
    durations: numbers(row.enabledDurations ?? row.supportedDurations),
  };
}

function Toggle({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <label className="admin-switch-row">
    <span>{label}{hint && <small>{hint}</small>}</span>
    <Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </label>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className="admin-field" data-wide={wide || undefined}>{label}{children}</label>;
}

export function TemplateSettingsForm({ row, ar, readOnly, onSaved }: { row: RecordData; ar: boolean; readOnly: boolean; onSaved: () => void }) {
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const client = useQueryClient();
  const commandKey = useAdminCommandKey();
  const saved = useMemo(() => draftFrom(row), [row]);
  const [draft, setDraft] = useState(saved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => setDraft(saved), [saved]);
  const set = (patch: Partial<Draft>) => { setDraft(current => ({ ...current, ...patch })); setNotice(""); };
  const supportedDurations = numbers(row.supportedDurations);
  const languages = sorted(strings(row.selectableLanguages)).reverse();
  const tags = draft.tags.split(",").map(tag => tag.trim()).filter(Boolean);
  const order = Number(draft.sortOrder);

  const detailChanges = useMemo(() => {
    const body: Record<string, unknown> = {};
    if (draft.nameEn !== saved.nameEn || draft.nameAr !== saved.nameAr) body.displayName = { en: draft.nameEn.trim(), ar: draft.nameAr.trim() };
    if (draft.descriptionEn !== saved.descriptionEn || draft.descriptionAr !== saved.descriptionAr) body.displayDescription = { en: draft.descriptionEn.trim(), ar: draft.descriptionAr.trim() };
    if (draft.outcomeEn !== saved.outcomeEn || draft.outcomeAr !== saved.outcomeAr) body.displayOutcome = { en: draft.outcomeEn.trim(), ar: draft.outcomeAr.trim() };
    if (draft.discoveryCategory !== saved.discoveryCategory) body.discoveryCategory = draft.discoveryCategory as Discovery;
    if (draft.tags !== saved.tags) body.tags = tags;
    if (draft.sortOrder !== saved.sortOrder) body.sortOrder = order;
    if (!same(draft.languages, saved.languages)) body.enabledLanguages = draft.languages;
    return body;
  }, [draft, saved, tags, order]);
  const durationsChanged = !same(draft.durations, saved.durations);
  const dirty = Object.keys(detailChanges).length > 0 || durationsChanged;
  const invalid = !draft.nameEn.trim() || !draft.nameAr.trim() || !draft.descriptionEn.trim() || !draft.descriptionAr.trim()
    || !draft.outcomeEn.trim() || !draft.outcomeAr.trim() || !Number.isInteger(order) || order < 0 || order > 100000;

  async function save(changes: Record<string, unknown>, durations: number[] | null) {
    setPending(true); setError(""); setNotice("");
    try {
      let revision = Number(row.revision ?? 0);
      if (Object.keys(changes).length) {
        const body = { expectedRevision: revision, ...changes };
        revision = (await adminApi.updateTemplateDetails(String(row.id), body as never, commandKey(["details", row.id, body]))).revision;
      }
      if (durations) {
        const body = { expectedRevision: revision, enabledDurations: durations };
        await adminApi.mutate(`templates/${row.id}/availability`, body, commandKey(["availability", row.id, body]));
      }
      invalidateAdminData(client);
      void client.invalidateQueries({ queryKey: ["templates"] });
      onSaved();
      setNotice(t("Changes saved. Customers see them within a few minutes.", "تم الحفظ. تظهر التغييرات للعملاء خلال دقائق."));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t("Could not save. Try again.", "تعذر الحفظ. حاول مرة ثانية."));
    } finally {
      setPending(false);
    }
  }
  const resetTargets = { displayName: null, displayDescription: null, displayOutcome: null, category: null, discoveryCategory: null, tags: null, sortOrder: null, enabledLanguages: null };
  const hasOverrides = Object.values(object(row.overrides)).some(value => value !== null && value !== undefined);
  const locked = readOnly || pending;

  return <div className="admin-stack">
    <AdminCard title={t("Name and description", "الاسم والوصف")} description={t("What customers read on the template card and create page.", "ما يقرأه العملاء في بطاقة القالب وصفحة الإنشاء.")}>
      <div className="admin-form-grid">
        <Field label={t("English name", "الاسم بالإنجليزية")}><Input dir="ltr" maxLength={120} disabled={locked} value={draft.nameEn} onChange={event => set({ nameEn: event.target.value })} /></Field>
        <Field label={t("Arabic name", "الاسم بالعربية")}><Input dir="rtl" maxLength={120} disabled={locked} value={draft.nameAr} onChange={event => set({ nameAr: event.target.value })} /></Field>
        <Field label={t("English description", "الوصف بالإنجليزية")}><Textarea dir="ltr" rows={3} maxLength={240} disabled={locked} value={draft.descriptionEn} onChange={event => set({ descriptionEn: event.target.value })} /></Field>
        <Field label={t("Arabic description", "الوصف بالعربية")}><Textarea dir="rtl" rows={3} maxLength={240} disabled={locked} value={draft.descriptionAr} onChange={event => set({ descriptionAr: event.target.value })} /></Field>
        <Field label={t("Best for (English)", "مناسب لـ (بالإنجليزية)")}><Input dir="ltr" maxLength={240} disabled={locked} value={draft.outcomeEn} onChange={event => set({ outcomeEn: event.target.value })} /></Field>
        <Field label={t("Best for (Arabic)", "مناسب لـ (بالعربية)")}><Input dir="rtl" maxLength={240} disabled={locked} value={draft.outcomeAr} onChange={event => set({ outcomeAr: event.target.value })} /></Field>
      </div>
    </AdminCard>
    <AdminCard title={t("Video options", "خيارات الفيديو")} description={t("Keep at least one length and one language on.", "أبقِ مدة واحدة ولغة واحدة على الأقل.")}>
      <div className="admin-stack">
        <fieldset className="admin-stack !gap-2">
          <legend className="admin-field mb-2">{t("Video lengths", "مدد الفيديو")}</legend>
          <div className="admin-switch-grid">
            {supportedDurations.map(value => {
              const checked = draft.durations.includes(value);
              return <Toggle key={value} label={t(`${value} seconds`, `${value} ثانية`)} checked={checked} disabled={locked || (checked && draft.durations.length === 1)}
                onChange={next => set({ durations: next ? [...draft.durations, value].sort((a, b) => a - b) : draft.durations.filter(item => item !== value) })} />;
            })}
          </div>
        </fieldset>
        <fieldset className="admin-stack !gap-2">
          <legend className="admin-field mb-2">{t("Languages", "اللغات")}</legend>
          <div className="admin-switch-grid">
            {languages.map(value => {
              const checked = draft.languages.includes(value);
              return <Toggle key={value} label={LANGUAGE_NAMES[value] ?? value} checked={checked} disabled={locked || (checked && draft.languages.length === 1)}
                onChange={next => set({ languages: next ? [...draft.languages, value] : draft.languages.filter(item => item !== value) })} />;
            })}
          </div>
        </fieldset>
      </div>
    </AdminCard>
    <AdminCard title={t("Where it appears", "مكان الظهور")} description={t("How customers find this template.", "كيف يجد العملاء هذا القالب.")}>
      <div className="admin-form-grid">
        <Field label={t("Category", "الفئة")}>
          <select className="admin-select" disabled={locked} value={draft.discoveryCategory} onChange={event => set({ discoveryCategory: event.target.value })}>
            {DISCOVERY_CATEGORIES.map(value => <option key={value} value={value}>{discoveryLabel[value]![ar ? 1 : 0]}</option>)}
          </select>
        </Field>
        <Field label={t("Display order (lower shows first)", "ترتيب العرض (الأقل يظهر أولاً)")}><Input type="number" min={0} max={100000} step={1} disabled={locked} value={draft.sortOrder} onChange={event => set({ sortOrder: event.target.value })} /></Field>
        <Field label={t("Search tags, separated by commas", "كلمات البحث، مفصولة بفواصل")} wide><Input disabled={locked} value={draft.tags} onChange={event => set({ tags: event.target.value })} /></Field>
      </div>
    </AdminCard>
    {(error || notice) && <p role={error ? "alert" : "status"} className={error ? "text-sm text-destructive" : "admin-hint"}>{error || notice}</p>}
    {!readOnly && <div className="admin-savebar" data-dirty={dirty || undefined}>
      <p>{dirty ? t("You have unsaved changes", "لديك تغييرات غير محفوظة") : t("All changes saved", "تم حفظ كل التغييرات")}</p>
      {hasOverrides && <Button variant="ghost" disabled={pending} onClick={() => void save(resetTargets, null)}>{t("Reset to original", "إعادة إلى الأصل")}</Button>}
      <Button variant="outline" disabled={!dirty || pending} onClick={() => { setDraft(saved); setError(""); }}>{t("Discard", "تجاهل")}</Button>
      <Button disabled={!dirty || invalid || pending} onClick={() => void save(detailChanges, durationsChanged ? draft.durations : null)}>{pending ? t("Saving…", "جارٍ الحفظ…") : t("Save changes", "حفظ التغييرات")}</Button>
    </div>}
  </div>;
}
