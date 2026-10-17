import { displayCopyForProject } from "./displayCopyProject";
import { useId, useState } from "react";
import { ProductModelAdSettingsSchema, templatePhotoIssues, type BrandKitSnapshot, type ProductModelAdSettings } from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import type { CreateScreenProps } from "./CreateScreen";
import type { CreatorProject } from "./types";
import { useCapabilities } from "./useCapabilities";
import { modelAdSettingsForProject } from "./productModelAdProject";
import "./product-model-ad.css";
import { templateMediaFor } from "./templateMedia";

export type ProductModelAdScreenProps = CreateScreenProps & {
  signedIn: boolean;
  onSettingsChange: (settings: ProductModelAdSettings) => void;
  onDescriptionChange: (value: string) => void;
  onLanguageChange: (language: CreatorProject["language"]) => void;
  onSecureCampaign: () => Promise<CreatorProject>;
  onLibraryLogo: (file: File, settings: ProductModelAdSettings) => Promise<void>;
};

export function ProductModelAdScreen(props: ProductModelAdScreenProps) {
  const { project, arabic = false, onSettingsChange } = props;
  const id = useId();
  const t = (en: string, ar: string) => arabic ? ar : en;
  const value = modelAdSettingsForProject(project);
  const kit = value.brandKit;
  const displayCopy = displayCopyForProject(project);
  const [attempted, setAttempted] = useState(false);
  const capabilities = useCapabilities();
  const update = (patch: Partial<ProductModelAdSettings>) => onSettingsChange({ ...value, ...patch });
  const updateKit = (patch: Partial<BrandKitSnapshot>) => update({ brandKit: { ...kit, ...patch } });
  const selected = project.product.images.filter(photo => photo.selected !== false);
  const policy = LAUNCH_PHOTO_POLICIES[project.templateId]!;
  const photoIssues = templatePhotoIssues(policy, selected);
  const settingsResult = ProductModelAdSettingsSchema.safeParse(value);
  const modelMissing = value.modelChoice === "reference_adult" && !selected.some(photo => photo.referenceRole === "character");
  const modelExtra = value.modelChoice !== "reference_adult" && selected.some(photo => photo.referenceRole === "character");
  const invalid = !project.product.name.trim() || photoIssues.length > 0 || modelMissing || modelExtra || !settingsResult.success;
  const unavailable = !capabilities.templateReady || !capabilities.active.durations.includes(props.durationSeconds);
  const feedback = props.generationError || props.error || (invalid ? t("Add a product name and 1–3 product photos. Check model selection, photo permissions and brand details.", "أضف اسم المنتج و1–3 صور له. راجع اختيار الشخصية وأذونات الصور وتفاصيل العلامة.") : "") || props.quoteError || (unavailable ? t("Generation is temporarily unavailable. Your campaign is saved.", "التوليد غير متاح مؤقتاً. حملتك محفوظة.") : "");
  const logo = project.product.images.find(photo => photo.referenceRole === "artwork" && photo.checksum === kit.logoChecksum);
  const textField = (key: string, label: string, current: string, onChange: (text: string) => void, maxLength: number, multiline = false) => <label className="model-ad-field" key={key} htmlFor={`${id}-${key}`}><span>{label}</span>{multiline ? <textarea id={`${id}-${key}`} value={current} maxLength={maxLength} rows={3} onChange={event => onChange(event.target.value)} /> : <input id={`${id}-${key}`} value={current} maxLength={maxLength} onChange={event => onChange(event.target.value)} />}</label>;
  return <section className="model-ad" dir={arabic ? "rtl" : "ltr"} aria-labelledby={`${id}-heading`}>
    <header className="model-ad-header"><button type="button" className="creator-button creator-button-secondary" onClick={props.onChangeTemplate}>{t("Change template", "غيّر القالب")}</button><div><p className="model-ad-eyebrow">{t("Your product. Your brand.", "منتجك. علامتك.")}</p><h1 id={`${id}-heading`}>{t("Product With Model Ad", "إعلان منتج مع عارض")}</h1><p>{t("Create a car-arrival commercial with your product, model and instrumental music.", "أنشئ إعلان وصول بالسيارة مع منتجك وشخصيتك وموسيقى.")}</p></div><span className="model-ad-format">9:16 · {t("Music included", "مع موسيقى")}</span></header>
    <div className="model-ad-layout"><fieldset className="model-ad-fields">
      <section className="model-ad-section"><h2>{t("01 · Product & model", "01 · المنتج والشخصية")}</h2>
        {textField("name", t("Product name *", "اسم المنتج *"), project.product.name, text => props.onNameChange?.(text), 240)}
      <details className="model-ad-options"><summary>{t("Product details (optional)", "تفاصيل المنتج (اختياري)")}</summary>{textField("description", t("Confirmed product details (optional)", "تفاصيل المنتج المؤكدة (اختياري)"), project.product.description, props.onDescriptionChange, 500, true)}</details>
        <p>{t("Upload 1–3 views of the same product. Only visible details will be used.", "ارفع 1–3 صور للمنتج نفسه. تُستخدم التفاصيل الظاهرة فقط.")}</p>
        <PhotoGroup props={props} role="subject" label={t("Product photos", "صور المنتج")} id={`${id}-product`} />
      <div className="model-ad-model"><label className="model-ad-field"><span>{t("Who presents the product?", "من يعرض المنتج؟")}</span><select value={value.modelChoice} onChange={event => update({ modelChoice: event.target.value as ProductModelAdSettings["modelChoice"] })}><option value="realistic_adult">{t("Fictional realistic adult", "شخصية واقعية خيالية بالغة")}</option><option value="illustrated_adult">{t("Consistent illustrated adult", "شخصية مرسومة بالغة ثابتة")}</option><option value="reference_adult">{t("Adult from my photos", "شخص بالغ من صوري")}</option></select></label>
        {value.modelChoice === "reference_adult" && <><p>{t("Use 1–3 angles of one adult with permission. These photos define the presenter. Some real-face photos may be rejected by the video service; we will not replace them with another person.", "استخدم 1–3 صور لشخص بالغ واحد بإذن استخدام هويته. تحدد الصور الشخصية؛ قد ترفض خدمة الفيديو بعض صور الوجوه الحقيقية ولن نستبدلها بشخص آخر.")}</p><PhotoGroup props={props} role="character" label={t("Model photos", "صور الشخصية")} id={`${id}-model`} /></>}
        {modelExtra && <p role="alert">{t("Unselect saved model photos to use a generated adult. They stay saved.", "ألغِ تحديد صور الشخصية لاستخدام الشخصية المرسومة. تبقى الصور محفوظة.")} <button type="button" onClick={() => project.product.images.filter(photo => photo.referenceRole === "character").forEach(photo => props.onPhotoChange?.(photo.id, { selected: false }))}>{t("Unselect model photos", "إلغاء تحديد صور الشخصية")}</button></p>}
      </div></section>
      <section className="model-ad-section"><h2>{t("02 · Brand", "02 · العلامة")}</h2>
        {textField("brand", t("Brand name", "اسم العلامة"), kit.name, text => updateKit({ name: text }), 240)}
        <div className="model-ad-two">{(["primaryColor", "secondaryColor"] as const).map((key, index) => <label className="model-ad-field" key={key}><span>{index === 0 ? t("Primary color", "اللون الأساسي") : t("Secondary color", "اللون الثانوي")}</span><input type="color" value={kit[key]} onChange={event => updateKit({ [key]: event.target.value })} /></label>)}</div>
        <label className="model-ad-field"><span>{t("Logo (optional)", "الشعار (اختياري)")}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={props.busy} onChange={event => { props.onFiles(Array.from(event.target.files ?? []), "artwork", true); event.target.value = ""; }} /></label>
        {logo && <div className="model-ad-logo"><img src={logo.url} alt={t("Your brand logo", "شعار علامتك")} /><button type="button" onClick={() => updateKit({ logoChecksum: undefined })}>{t("Remove logo from this ad", "إزالة الشعار من الإعلان")}</button></div>}
      </section>
      <section className="model-ad-section"><h2>{t("03 · Direction & message", "03 · الأسلوب والرسالة")}</h2><div className="model-ad-two"><label className="model-ad-field"><span>{t("Setting", "المكان")}</span><select value={value.setting} onChange={event => update({ setting: event.target.value as ProductModelAdSettings["setting"] })}><option value="car_arrival">{t("Car arrival (preview style)", "وصول بالسيارة (أسلوب المعاينة)")}</option><option value="studio">{t("Commercial studio", "استوديو إعلاني")}</option><option value="lifestyle">{t("Simple lifestyle setting", "مكان يومي بسيط")}</option></select></label><label className="model-ad-field"><span>{t("Model action", "حركة الشخصية")}</span><select value={value.action === "wear" ? `wear-${value.category}` : value.action} onChange={event => {
        const action = event.target.value;
        // Wearing needs a category; other actions retain the saved category unchanged.
        update(action === "wear-clothing" ? { action: "wear", category: "clothing" } : action === "wear-accessory" ? { action: "wear", category: "accessory" } : { action: action as "present" | "hold" });
      }}><option value="present">{t("Present beside the product", "العرض بجانب المنتج")}</option><option value="hold">{t("Hold the product", "حمل المنتج")}</option><option value="wear-clothing">{t("Wear the uploaded clothing", "ارتداء الملابس المرفقة")}</option><option value="wear-accessory">{t("Wear the uploaded accessory", "ارتداء الإكسسوار المرفق")}</option></select></label></div>
        {textField("cta", t("Closing message (optional)", "رسالة الختام (اختياري)"), displayCopy.closingMessage, text => props.onActionChange?.(text), 240)}
        <details className="model-ad-options"><summary>{t("Ad messages (optional)", "رسائل الإعلان (اختياري)")}</summary>
        {textField("opening-message", t("Opening message (optional)", "رسالة البداية (اختياري)"), displayCopy.openingMessage, text => update({ openingMessage: text }), 120)}{textField("selling-point", t("Main confirmed selling point (optional)", "الميزة الرئيسية المؤكدة (اختياري)"), value.sellingPoint, text => update({ sellingPoint: text }), 240)}
        {textField("offer", t("Real offer (optional)", "العرض الحقيقي (اختياري)"), displayCopy.offer, props.onMessageChange, 500)}</details>
        <label className="model-ad-field"><span>{t("Message language", "لغة الرسالة")}</span><select value={project.language} onChange={event => props.onLanguageChange(event.target.value as CreatorProject["language"])}><option value="en">English</option><option value="ar">العربية</option><option value="bilingual">English + العربية</option></select></label>
        <fieldset className="model-ad-duration"><legend>{t("Video length", "مدة الفيديو")}</legend>{[8, 15, 20].map(seconds => <label key={seconds}><input type="radio" name={`${id}-duration`} checked={props.durationSeconds === seconds} onChange={() => props.onDurationChange(seconds)} />{seconds} {t("seconds", "ثانية")}</label>)}</fieldset>
      </section>
    </fieldset><aside className="model-ad-review"><h2>{t("Your commercial", "إعلانك")}</h2>{selected.find(photo => photo.referenceRole !== "character")?.url && <img className="model-ad-product" src={selected.find(photo => photo.referenceRole !== "character")!.url} alt={project.product.name || t("Selected product", "المنتج المحدد")} />}<p>{props.durationSeconds} {t("seconds · Portrait · Music", "ثانية · عمودي · موسيقى")}</p><ol>{project.scenes.map(scene => <li key={scene.id}><strong>{arabic ? scene.titleAr ?? scene.title : scene.title}</strong><span>{scene.duration} {t("seconds", "ثانية")}</span></li>)}</ol><p>{t("Photos define your product. Branding and your exact messages are placed after the video is made.", "تحدد الصور منتجك. تُضاف الهوية ورسائلك الدقيقة بعد إنشاء الفيديو.")}</p><video controls playsInline preload="none" style={{ width: "100%", aspectRatio: "9 / 16", borderRadius: 16 }} poster={templateMediaFor(project.templateId, 0, project.goal).poster} src={templateMediaFor(project.templateId, 0, project.goal).previewVideo ?? undefined} aria-label={t("15-second example with music", "مثال 15 ثانية مع موسيقى")} /><p className="model-ad-preview-note">{t("15-second example. Your uploads define the product and selected model; results vary.", "مثال 15 ثانية. تحدد صورك المنتج والشخصية المختارة؛ تختلف النتائج.")}</p>
      {!props.hidePricing && props.quote && <p>{props.quote.credits} {t("credits", "رصيد")}</p>}
      <button ref={props.generateButtonRef} type="button" className="creator-button creator-button-primary" aria-describedby={feedback ? `${id}-feedback` : undefined} disabled={Boolean(props.busy) || invalid || unavailable || props.quoteState !== "ready" || (!props.hidePricing && !props.quote)} onClick={() => { setAttempted(true); if (!invalid) props.onGenerate(); }}>{t("Generate video", "إنشاء الفيديو")}</button>
      {feedback && <p id={`${id}-feedback`} role={attempted || props.generationError || props.error ? "alert" : "status"} className="model-ad-feedback">{feedback}</p>}{props.onRetryQuote && <button className="creator-button creator-button-quiet" type="button" onClick={props.onRetryQuote}>{t("Refresh generation check", "تحديث فحص التوليد")}</button>}
    </aside></div>
  </section>;
}

function PhotoGroup({ props, role, label, id }: { props: ProductModelAdScreenProps; role: "subject" | "character"; label: string; id: string }) {
  const t = (en: string, ar: string) => props.arabic ? ar : en;
  const images = props.project.product.images.filter(image => (image.referenceRole ?? "subject") === role);
  return <fieldset className="model-ad-photo-group"><legend>{label} · {images.filter(image => image.selected !== false).length}/3</legend><input id={id} type="file" aria-label={label} accept="image/jpeg,image/png,image/webp" multiple disabled={props.busy} onChange={event => { props.onFiles(Array.from(event.target.files ?? []), role, false); event.target.value = ""; }} /><ul className="model-ad-photos">{images.map(image => <li key={image.id}><img src={image.url} alt={image.name} /><label><input type="checkbox" checked={image.selected !== false} onChange={event => props.onPhotoChange?.(image.id, { selected: event.target.checked })} />{t("Use photo", "استخدم الصورة")}</label>{role === "character" && image.selected !== false && <label><input type="checkbox" checked={image.personRightsConfirmed === true} onChange={event => props.onPhotoChange?.(image.id, { personRightsConfirmed: event.target.checked ? true : undefined })} />{t("Same adult (18+); I have permission to use their photo and likeness.", "الشخص البالغ نفسه (18+) ولدي إذن استخدام صورته وهويته.")}</label>}<button type="button" onClick={() => props.onRemoveImage?.(image.id)}>{t("Remove saved photo", "حذف الصورة المحفوظة")}</button></li>)}</ul></fieldset>;
}
