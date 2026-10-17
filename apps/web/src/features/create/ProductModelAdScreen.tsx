import { LibraryControls } from "../assets/LibraryCampaign";
import { ReferencePhoto } from "../assets/ReferencePhoto";
import { displayCopyForProject } from "./displayCopyProject";
import { useId, useState } from "react";
import { ProductModelAdSettingsSchema, templatePhotoIssues, type BrandKitSnapshot, type ProductModelAdSettings } from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import type { CreateScreenProps } from "./CreateScreen";
import type { CreatorProject } from "./types";
import { useCapabilities } from "./useCapabilities";
import { modelAdSettingsForProject } from "./productModelAdProject";
import { templateMediaFor } from "./templateMedia";
import "./product-model-ad.css";

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
  const selected = project.product.images.filter(photo => photo.selected !== false);
  const productPhoto = selected.find(photo => (photo.referenceRole ?? "subject") === "subject");
  const characterPhoto = selected.find(photo => photo.referenceRole === "character");
  const logo = project.product.images.find(photo => photo.referenceRole === "artwork" && photo.checksum === kit.logoChecksum);
  const photoIssues = templatePhotoIssues(LAUNCH_PHOTO_POLICIES[project.templateId]!, selected);
  const settingsValid = ProductModelAdSettingsSchema.safeParse(value).success;
  const modelMissing = value.modelChoice === "reference_adult" && !characterPhoto;
  const modelExtra = value.modelChoice !== "reference_adult" && Boolean(characterPhoto);
  const closingLines = [displayCopy.openingMessage, displayCopy.offer, displayCopy.closingMessage].filter(Boolean);
  const closingTooLong = closingLines.join(" ").length > 300 || closingLines.reduce((sum, line) => sum + Math.ceil(Array.from(line).length / 24), 0) > 8;
  const invalid = photoIssues.length > 0 || modelMissing || modelExtra || !settingsValid || closingTooLong;
  const unavailable = !capabilities.templateReady || !capabilities.active.durations.includes(props.durationSeconds);
  const formIssue = !productPhoto
    ? t("Upload at least one product image.", "ارفع صورة واحدة على الأقل للمنتج.")
    : modelMissing
      ? t("Upload a character image or choose a generated presenter.", "ارفع صورة للشخصية أو اختر شخصية مولّدة.")
      : modelExtra
        ? t("Unselect saved character images to use a generated presenter.", "ألغِ تحديد صور الشخصية المحفوظة لاستخدام شخصية مولّدة.")
        : photoIssues.includes("character_rights_required")
          ? t("Confirm permission for each selected character image.", "أكد إذن استخدام كل صورة شخصية محددة.")
          : closingTooLong
            ? t("Shorten the brand and ad messages so the ending stays readable.", "اختصر العلامة ورسائل الإعلان حتى تبقى النهاية واضحة.")
            : invalid
              ? t("Review the selected images and ad details.", "راجع الصور المحددة وتفاصيل الإعلان.")
              : "";
  const feedback = props.generationError || props.error || formIssue || props.quoteError || (unavailable ? t("Generation is temporarily unavailable. Your campaign is saved.", "التوليد غير متاح مؤقتاً. حملتك محفوظة.") : "");
  const preview = templateMediaFor(project.templateId, 0, project.goal);
  const update = (patch: Partial<ProductModelAdSettings>) => onSettingsChange({ ...value, ...patch });
  const updateKit = (patch: Partial<BrandKitSnapshot>) => update({ brandKit: { ...kit, ...patch } });
  const choosePresenter = (choice: ProductModelAdSettings["modelChoice"]) => {
    update({ modelChoice: choice });
    if (choice !== "reference_adult") {
      project.product.images.filter(photo => photo.referenceRole === "character" && photo.selected !== false).forEach(photo => props.onPhotoChange?.(photo.id, { selected: false }));
    }
  };
  return <section className="model-ad" dir={arabic ? "rtl" : "ltr"} aria-labelledby={id + "-heading"}>
    <header className="model-ad-header">
      <button type="button" className="creator-button creator-button-secondary" onClick={props.onChangeTemplate}>{t("Change template", "غيّر القالب")}</button>
      <div>
        <p className="model-ad-eyebrow">{t("Ad Studio", "استوديو الإعلانات")}</p>
        <h1 id={id + "-heading"}>{t("Product With Model Ad", "إعلان منتج مع عارض")}</h1>
        <p>{t("Add product images, choose a presenter, and finish your ad.", "أضف صور المنتج واختر الشخصية وأكمل إعلانك.")}</p>
      </div>
      <span className="model-ad-format">9:16 · {t("Music included", "مع موسيقى")}</span>
    </header>

    <div className="model-ad-layout">
      <div className="model-ad-fields">
        <section className="model-ad-section" aria-labelledby={id + "-product-heading"}>
          <h2 id={id + "-product-heading"}>{t("Product", "المنتج")}</h2>
          <PhotoGroup props={props} role="subject" label={t("Product images", "صور المنتج")} id={id + "-product"} />
        </section>

        <section className="model-ad-section" aria-labelledby={id + "-presenter-heading"}>
          <h2 id={id + "-presenter-heading"}>{t("Presenter", "الشخصية")}</h2>
          <fieldset className="model-ad-presenter-choices">
            <legend>{t("Character style", "أسلوب الشخصية")}</legend>
            {([
              ["realistic_adult", t("Generated realistic adult", "شخصية بالغة واقعية مولّدة"), t("A natural presenter created for this ad", "شخصية واقعية تُنشأ لهذا الإعلان")],
              ["illustrated_adult", t("Generated illustrated adult", "شخصية بالغة مرسومة مولّدة"), t("A drawn presenter created for this ad", "شخصية مرسومة تُنشأ لهذا الإعلان")],
              ["reference_adult", t("Upload my character image", "ارفع صورة شخصيتي"), t("Use an adult you have permission to show", "استخدم صورة شخص بالغ لديك إذن بعرضها")],
            ] as const).map(([choice, title, detail]) => <label className="model-ad-presenter-choice" key={choice}>
              <input type="radio" name={id + "-presenter"} value={choice} checked={value.modelChoice === choice} onChange={() => choosePresenter(choice)} />
              <span><strong>{title}</strong><small>{detail}</small></span>
            </label>)}
          </fieldset>
          {value.modelChoice === "reference_adult" && <div className="model-ad-character-upload">
            <p>{t("Use photos of one adult whose image and likeness you have permission to use.", "استخدم صور شخص بالغ واحد لديك إذن باستخدام صورته وهويته.")}</p>
            <PhotoGroup props={props} role="character" label={t("Character images", "صور الشخصية")} id={id + "-character"} />
          </div>}
          {modelExtra && <button type="button" className="creator-button creator-button-quiet" onClick={() => choosePresenter("realistic_adult")}>{t("Use generated presenter", "استخدم شخصية مولّدة")}</button>}
          <div className="model-ad-logo-field">
            <span className="model-ad-control-label">{t("Logo (optional)", "الشعار (اختياري)")}</span>
            <div className="model-ad-logo-row">
              {logo && <img className="model-ad-logo-preview" src={logo.url} alt={t("Your logo", "شعارك")} />}
              <label className="model-ad-logo-upload" htmlFor={id + "-logo"}>
                <input id={id + "-logo"} type="file" aria-label={t("Logo (optional)", "الشعار (اختياري)")} accept="image/jpeg,image/png,image/webp" disabled={props.busy} onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) props.onFiles(files, "artwork", true); event.target.value = ""; }} />
                <strong>{logo ? t("Replace logo", "استبدل الشعار") : t("Choose logo", "اختر الشعار")}</strong>
                <small>{t("JPG, PNG or WebP", "JPG أو PNG أو WebP")}</small>
              </label>
            </div>
            {logo && <button className="model-ad-logo-remove" type="button" onClick={() => updateKit({ logoChecksum: undefined })}>{t("Remove logo from this ad", "إزالة الشعار من الإعلان")}</button>}
          </div>
        </section>

        <section className="model-ad-section" aria-labelledby={id + "-finish-heading"}>
          <h2 id={id + "-finish-heading"}>{t("Finish your ad", "أكمل إعلانك")}</h2>
          <label className="model-ad-field model-ad-closing-field" htmlFor={id + "-cta"}>
            <span>{t("Closing action", "دعوة الختام")}</span>
            <input id={id + "-cta"} value={displayCopy.closingMessage} maxLength={240} aria-describedby={id + "-cta-help"} onChange={event => props.onActionChange?.(event.target.value)} />
            <small id={id + "-cta-help"}>{t("The action viewers should take at the end", "الإجراء المطلوب من المشاهدين في الختام")}</small>
          </label>
          <fieldset className="model-ad-choice-group">
            <legend>{t("Message language", "لغة الرسالة")}</legend>
            <div className="model-ad-option-grid">{([ ["en", "English"], ["ar", "العربية"], ["bilingual", "English + العربية"] ] as const).map(([language, label]) => <label className="model-ad-option" key={language}><input type="radio" name={id + "-language"} value={language} checked={project.language === language} onChange={() => props.onLanguageChange(language)} /><span>{label}</span></label>)}</div>
          </fieldset>
          <fieldset className="model-ad-choice-group model-ad-duration"><legend>{t("Video length", "مدة الفيديو")}</legend><div className="model-ad-option-grid">{[8, 15, 20].map(seconds => <label className="model-ad-option" key={seconds}><input type="radio" name={id + "-duration"} checked={props.durationSeconds === seconds} onChange={() => props.onDurationChange(seconds)} /><span>{seconds} {t("seconds", "ثانية")}</span></label>)}</div></fieldset>
        </section>
      </div>

      <aside className="model-ad-review">
        <h2>{t("Your ad setup", "إعداد إعلانك")}</h2>
        {productPhoto && <ReferencePhoto asset={productPhoto} className="model-ad-product" />}
        <dl className="model-ad-summary">
          <div><dt>{t("Presenter", "الشخصية")}</dt><dd>{value.modelChoice === "reference_adult" ? characterPhoto ? t("Your uploaded character", "شخصيتك المرفوعة") : t("Add a character image", "أضف صورة للشخصية") : value.modelChoice === "illustrated_adult" ? t("Illustrated adult", "شخصية بالغة مرسومة") : t("Realistic adult", "شخصية بالغة واقعية")}</dd></div>
          {logo && <div><dt>{t("Logo", "الشعار")}</dt><dd>{t("Included", "مضاف")}</dd></div>}
          <div><dt>{t("Format", "التنسيق")}</dt><dd>{props.durationSeconds} {t("seconds · Portrait · Music", "ثانية · عمودي · موسيقى")}</dd></div>
        </dl>
        <video controls playsInline preload="none" className="model-ad-example" poster={preview.poster} src={preview.previewVideo ?? undefined} aria-label={t("Example ad with music", "مثال إعلان مع موسيقى")} />
        <p className="model-ad-preview-note">{t("This is a sample. Your images and choices guide the generated ad.", "هذا مثال. توجه صورك واختياراتك الإعلان الناتج.")}</p>
        {!props.hidePricing && props.quote && <p>{props.quote.credits} {t("credits", "رصيد")}</p>}
        <button ref={props.generateButtonRef} type="button" className="creator-button creator-button-primary" aria-describedby={feedback ? id + "-feedback" : undefined} disabled={Boolean(props.busy) || invalid || unavailable || props.quoteState !== "ready" || (!props.hidePricing && !props.quote)} onClick={() => { setAttempted(true); if (!invalid) props.onGenerate(); }}>{t("Generate video", "إنشاء الفيديو")}</button>
        {feedback && <p id={id + "-feedback"} role={attempted || props.generationError || props.error ? "alert" : "status"} className="model-ad-feedback">{feedback}</p>}
        {props.onRetryQuote && <button className="creator-button creator-button-quiet" type="button" onClick={props.onRetryQuote}>{t("Refresh generation check", "تحديث فحص التوليد")}</button>}
      </aside>
    </div>
  </section>;
}

function PhotoGroup({ props, role, label, id }: { props: ProductModelAdScreenProps; role: "subject" | "character"; label: string; id: string }) {
  const t = (en: string, ar: string) => props.arabic ? ar : en;
  const images = props.project.product.images.filter(image => (image.referenceRole ?? "subject") === role);
  const selectedCount = images.filter(image => image.selected !== false).length;
  const [dragging, setDragging] = useState(false);
  const addFiles = (files: File[]) => { if (files.length) props.onFiles(files, role, false); };
  return <fieldset className={`model-ad-photo-group model-ad-${role}-upload`}>
    <legend>{label}{role === "character" && ` · ${selectedCount}/3`}</legend>
    <label className={`model-ad-dropzone${dragging ? " is-dragging" : ""}${props.busy ? " is-busy" : ""}`} htmlFor={id}
          onDragEnter={event => { event.preventDefault(); setDragging(true); }}
          onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true); }}
          onDragLeave={event => { event.preventDefault(); if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
          onDrop={event => { event.preventDefault(); setDragging(false); if (!props.busy) addFiles(Array.from(event.dataTransfer.files)); }}>
          <input id={id} type="file" aria-label={label} accept="image/jpeg,image/png,image/webp" multiple disabled={props.busy} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <span className="model-ad-dropzone-title">{role === "subject" ? t("Drag product images here", "اسحب صور المنتج إلى هنا") : t("Drag character images here", "اسحب صور الشخصية إلى هنا")}</span>
          <span className="model-ad-dropzone-or">{t("or", "أو")}</span>
          <span className="model-ad-dropzone-choose">{t("Choose images", "اختر الصور")}</span>
          <span className="model-ad-dropzone-note">{role === "subject" ? t("JPG, PNG or WebP · up to 3 views of one product", "JPG أو PNG أو WebP · حتى 3 صور لمنتج واحد") : t("JPG, PNG or WebP · up to 3 images of one adult", "JPG أو PNG أو WebP · حتى 3 صور لشخص بالغ واحد")}</span>
        </label>
    <LibraryControls role={role} disabled={props.busy} />
    {role === "subject" && selectedCount > 0 && <p className="model-ad-selected-count">{t(`${selectedCount} of 3 product images selected`, `تم اختيار ${selectedCount} من 3 صور للمنتج`)}</p>}
    {images.length > 0 && <ul className="model-ad-photos">{images.map(image => <li key={image.id}>
      <ReferencePhoto asset={image} />
      <label><input type="checkbox" checked={image.selected !== false} onChange={event => props.onPhotoChange?.(image.id, { selected: event.target.checked })} />{t("Use image", "استخدم الصورة")}</label>
      {role === "character" && image.selected !== false && <label><input type="checkbox" checked={image.personRightsConfirmed === true} onChange={event => props.onPhotoChange?.(image.id, { personRightsConfirmed: event.target.checked ? true : undefined })} />{t("This is the same adult, and I have permission to use their image.", "هذا الشخص البالغ نفسه ولدي إذن باستخدام صورته.")}</label>}
      <button type="button" onClick={() => props.onRemoveImage?.(image.id)}>{t("Remove image", "احذف الصورة")}</button>
    </li>)}</ul>}
  </fieldset>;
}
