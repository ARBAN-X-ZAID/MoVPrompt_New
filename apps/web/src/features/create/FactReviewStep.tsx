import { CheckCircle2, PencilLine } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { CampaignFactField, CampaignGoal, CampaignSource } from "@movprompt/contracts";

import { cn } from "@/lib/utils";

import { factsForReview, requiredFactsForOutcome } from "./sourceFacts";

type FactReviewStepProps = {
  source: CampaignSource;
  templateId?: string;
  goal: CampaignGoal;
  arabic?: boolean;
  hidePricing?: boolean;
  onEdit: (field: CampaignFactField, value: string) => void;
  onConfirm: (fields: CampaignFactField[]) => void;
  onContinue: () => void;
  onBack: () => void;
};

const FACT_META: Record<CampaignFactField, { en: string; ar: string; type?: "url" | "tel" }> = {
  name: { en: "Product name", ar: "اسم المنتج" },
  description: { en: "Description", ar: "الوصف" },
  brand: { en: "Brand", ar: "العلامة التجارية" },
  price: { en: "Price (KWD)", ar: "السعر (د.ك)" },
  offer: { en: "Offer", ar: "العرض" },
  location: { en: "Kuwait location", ar: "الموقع في الكويت" },
  booking_url: { en: "Booking link", ar: "رابط الحجز", type: "url" },
  whatsapp: { en: "WhatsApp number", ar: "رقم واتساب", type: "tel" },
  logo: { en: "Logo", ar: "الشعار" },
  brand_color: { en: "Brand colour", ar: "لون العلامة" },
  service_name: { en: "Business or service name", ar: "اسم النشاط أو الخدمة" },
  service_details: { en: "Service details", ar: "تفاصيل الخدمة" },
  media: { en: "Photos or footage", ar: "الصور أو الفيديو" },
};

function factMeta(field: CampaignFactField, templateId: string) {
  const base = FACT_META[field];
  if (field === "name" && /phone/u.test(templateId)) return { ...base, en: "Phone model or product name", ar: "اسم الهاتف أو المنتج" };
  if (field === "name" && /food/u.test(templateId)) return { ...base, en: "Dish name", ar: "اسم الطبق" };
  if (field === "name" && /fashion/u.test(templateId)) return { ...base, en: "Clothing or product name", ar: "اسم قطعة الأزياء أو المنتج" };
  if (field === "name" && /cosmetic|perfume/u.test(templateId)) return { ...base, en: "Cosmetic or fragrance name", ar: "اسم المستحضر أو العطر" };
  if (field === "service_name" && templateId === "real-estate-property") return { ...base, en: "Property or listing name", ar: "اسم العقار أو الإعلان" };
  if (field === "brand" && templateId === "real-estate-property") return { ...base, en: "Agency name", ar: "اسم الوكالة" };
  if (field === "service_name" && templateId === "business-service-promotion") return { ...base, en: "Service name", ar: "اسم الخدمة" };
  if (field === "brand" && templateId === "business-service-promotion") return { ...base, en: "Business name", ar: "اسم النشاط" };
  if (field === "description" && templateId === "real-estate-property") return { ...base, en: "Property description or tagline", ar: "وصف العقار أو العبارة التعريفية" };
  if (field === "description") return { ...base, en: "Description or tagline", ar: "الوصف أو العبارة التعريفية" };
  return base;
}

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

function provenanceCopy(arabic: boolean, provenance: CampaignSource["facts"][number]["provenance"]) {
  if (provenance === "imported") return copy(arabic, "Imported", "مستورد");
  if (provenance === "user_confirmed") return copy(arabic, "Confirmed by you", "أكدته بنفسك");
  return copy(arabic, "Added by you", "أضفته بنفسك");
}

/** A controlled fact editor; the parent applies exact source and legacy-project transitions. */
export function FactReviewStep({ source, templateId = "", goal, arabic = false, hidePricing = false, onEdit, onConfirm, onContinue, onBack }: FactReviewStepProps) {
  const [validation, setValidation] = useState<CampaignFactField[]>([]);
  const fieldRefs = useRef(new Map<CampaignFactField, HTMLInputElement>());
  const rows = useMemo(
    () => factsForReview(source, goal).filter((row) => !hidePricing || row.field !== "price"),
    [goal, hidePricing, source],
  );
  const importedFields = source.facts
    .filter((fact) => fact.provenance === "imported" && (!hidePricing || fact.field !== "price"))
    .map((fact) => fact.field);
  const required = new Set(requiredFactsForOutcome(goal, source.subject));
  const summary = source.kind === "product_url"
    ? copy(arabic, "Product link", "رابط المنتج")
    : source.kind === "business_url"
      ? copy(arabic, "Business or service link", "رابط النشاط أو الخدمة")
      : source.kind === "real_footage"
        ? copy(arabic, "Real footage", "فيديو حقيقي")
        : source.kind === "product_upload"
          ? copy(arabic, "Uploaded media", "وسائط مرفوعة")
          : copy(arabic, "Entered manually", "معلومات مدخلة يدوياً");

  const validateAndContinue = () => {
    const missing = rows.filter((row) => row.state === "required_missing").map((row) => row.field);
    setValidation(missing);
    if (missing.length) {
      fieldRefs.current.get(missing[0]!)?.focus();
      return;
    }
    onContinue();
  };

  return (
    <section className="creator-fact-review" aria-labelledby="fact-review-heading" dir={arabic ? "rtl" : undefined}>
      <div className="creator-source-choice-heading">
        <p className="creator-kicker">{copy(arabic, "Review the facts", "راجع المعلومات")}</p>
        <h2 id="fact-review-heading">{copy(arabic, "Check the details we’ll use", "تأكد من التفاصيل التي سنستخدمها")}</h2>
        <p>{copy(arabic, "Correct anything that is wrong. Your changes stay visible and never replace the original silently.", "صحح أي معلومة غير دقيقة. تعديلاتك تبقى واضحة ولا تستبدل الأصل بدون علمك.")}</p>
        <p className="creator-field-help"><span className="creator-required">*</span> {copy(arabic, "Required. All other details are optional.", "مطلوب. باقي التفاصيل اختيارية.")}</p>
      </div>

      <div className="creator-fact-source-summary" role="note">
        <span>{copy(arabic, "Source", "المصدر")}</span>
        <strong>{summary}</strong>
      </div>

      <div className="creator-fact-list">
        {rows.map((row) => {
          const meta = factMeta(row.field, templateId);
          const fact = row.fact;
          const invalid = validation.includes(row.field);
          const inputId = `campaign-fact-${row.field}`;
          const errorId = `${inputId}-error`;
          return (
            <div key={row.field} className={cn("creator-fact-row", invalid && "has-error", !fact && "is-empty")}>
              <div className="creator-fact-row-heading">
                <label htmlFor={inputId}>{meta[arabic ? "ar" : "en"]}{required.has(row.field) && <span className="creator-required" aria-hidden="true"> *</span>}</label>
                {fact && <span className={cn("creator-fact-provenance", `is-${fact.provenance}`)}>
                  {fact?.provenance === "user_confirmed" ? <CheckCircle2 aria-hidden="true" /> : <PencilLine aria-hidden="true" />}
                  {provenanceCopy(arabic, fact.provenance)}
                </span>}
              </div>
              <input
                ref={(node) => { if (node) fieldRefs.current.set(row.field, node); }}
                id={inputId}
                aria-label={meta[arabic ? "ar" : "en"]}
                className="creator-input"
                value={fact?.value ?? ""}
                type={meta.type ?? "text"}
                inputMode={meta.type === "tel" ? "tel" : meta.type === "url" ? "url" : undefined}
                aria-invalid={invalid || undefined}
                aria-required={required.has(row.field)}
                aria-describedby={invalid ? errorId : undefined}
                onChange={(event) => {
                  onEdit(row.field, event.target.value);
                  if (invalid) setValidation((current) => current.filter((field) => field !== row.field));
                }}
              />
              {invalid && <p id={errorId} className="creator-field-error" role="alert">{copy(arabic, `Add ${meta.en.toLocaleLowerCase()} to continue.`, `أضف ${meta.ar} للمتابعة.`)}</p>}
            </div>
          );
        })}
      </div>

      <div className="creator-fact-review-actions">
        <button className="creator-button creator-button-quiet" type="button" onClick={onBack}>{copy(arabic, "Back", "رجوع")}</button>
        <div className="creator-actions-row">
          {importedFields.length > 0 && <button className="creator-button creator-button-secondary" type="button" onClick={() => onConfirm(importedFields)}>{copy(arabic, "Confirm details", "أكد التفاصيل")}</button>}
          <button className="creator-button creator-button-primary" type="button" onClick={validateAndContinue}>{copy(arabic, "Continue", "متابعة")}</button>
        </div>
      </div>
    </section>
  );
}
