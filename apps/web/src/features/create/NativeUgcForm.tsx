import { LibraryControls } from "../assets/LibraryCampaign";
import { ReferencePhoto } from "../assets/ReferencePhoto";
import { useId } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { nativeUgcScriptLimit, type NativeUgcSettings } from "@movprompt/contracts";
import { nativeUgcForProject, nativeUgcFeedback } from "./nativeUgcProject";
import type { CreatorProject } from "./types";
import type { TemplatePhotoActions } from "./TemplatePhotos";
import "./native-ugc.css";

export function NativeUgcForm({ project, onChange, onLanguageChange, onFiles, onPhotoChange, onRemoveImage, showCharacterUpload = false, arabic = false, disabled = false, singleLanguage = false }: TemplatePhotoActions & {
  project: CreatorProject;
  /** Hide the bilingual option for templates that speak one language. */
  singleLanguage?: boolean;
  onChange: (settings: NativeUgcSettings) => void;
  onLanguageChange?: (language: CreatorProject["language"]) => void;
  showCharacterUpload?: boolean;
  arabic?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const t = (en: string, ar: string) => arabic ? ar : en;
  const value = nativeUgcForProject(project);
  const update = (patch: Partial<NativeUgcSettings>) => onChange({ ...value, ...patch });
  const characters = project.product.images.filter(photo => photo.referenceRole === "character");
  const feedback = nativeUgcFeedback(project, arabic);
  const uploadedCharacter = value.characterStyle === "reference_adult";
  const words = value.script.trim().split(/\s+/u).filter(Boolean).length;
  const limit = nativeUgcScriptLimit(project.durationSeconds);
  return <section className="native-ugc" aria-labelledby={`${id}-heading`}>
    <h2 id={`${id}-heading`}>{t("Character and speech", "الشخصية والكلام")}</h2>
    <p>{t("Choose who presents your product. Add speech using the exact words you approve.", "اختر من يعرض منتجك. أضف الكلام باستخدام الكلمات التي تعتمدها بالضبط.")}</p>
    <fieldset className="native-ugc-choices" disabled={disabled}>
      <legend>{t("Character style", "أسلوب الشخصية")}</legend>
      {([
        ["realistic_adult", t("Realistic adult", "شخصية بالغة واقعية")],
        ["illustrated_adult", t("Illustrated adult", "شخصية بالغة مرسومة")],
        ["reference_adult", t("My uploaded character", "شخصيتي المرفوعة")],
      ] as const).map(([style, label]) => <label key={style}><input type="radio" name={`${id}-character`} checked={value.characterStyle === style} onChange={() => {
        // Uploaded people are never made to say words, so choosing one turns speech off instead of hiding the choice.
        update({ characterStyle: style, ...(style === "reference_adult" ? { enabled: false } : {}), scriptApproved: false, approvedLanguage: undefined });
        if (style !== "reference_adult") characters.filter(photo => photo.selected !== false).forEach(photo => onPhotoChange?.(photo.id, { selected: false }));
      }} /><span>{label}</span></label>)}
    </fieldset>
    {value.characterStyle === "reference_adult" && (showCharacterUpload ? <div className="native-ugc-upload">
      <div className="native-ugc-upload-head">
        <label htmlFor={`${id}-photos`}>{t("Character photos", "صور الشخصية")}</label>
        <small>{t(`${characters.length} of 3`, `${characters.length} من 3`)}</small>
      </div>
      <LibraryControls role="character" disabled={disabled || value.enabled} />
      <div className="native-ugc-character-grid">
        {characters.map(photo => <div className={photo.selected === false ? "native-ugc-character is-unselected" : "native-ugc-character"} key={photo.id}>
          <ReferencePhoto asset={photo} />
          <div className="native-ugc-character-body">
            <label><input type="checkbox" checked={photo.selected !== false} onChange={event => onPhotoChange?.(photo.id, { selected: event.target.checked })} />{t("Use this photo", "استخدم هذه الصورة")}</label>
            {photo.selected !== false && <label><input type="checkbox" checked={photo.personRightsConfirmed === true} onChange={event => onPhotoChange?.(photo.id, { personRightsConfirmed: event.target.checked ? true : undefined })} />{t("This is the same adult (18+) and I have permission to use their image and likeness.", "هذا الشخص البالغ نفسه (18+) ولدي إذن باستخدام صورته وهويته.")}</label>}
            <button type="button" className="native-ugc-remove" onClick={() => onRemoveImage?.(photo.id)}><Trash2 aria-hidden="true" />{t("Remove photo", "احذف الصورة")}</button>
          </div>
        </div>)}
        {characters.length < 3 && <label className="native-ugc-drop" htmlFor={`${id}-photos`}>
          <input id={`${id}-photos`} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={event => { const files = Array.from(event.target.files ?? []); if (files.length) onFiles(files, "character", false); event.target.value = ""; }} />
          <ImagePlus aria-hidden="true" />
          <span>{characters.length ? t("Add another angle", "أضف زاوية أخرى") : t("Add character photos", "أضف صور الشخصية")}</span>
          <small>{t("JPG, PNG or WebP", "JPG أو PNG أو WebP")}</small>
        </label>}
      </div>
      <small>{t("Up to 3 photos of the same consenting adult. Product photos stay separate.", "حتى 3 صور للشخص البالغ نفسه وبموافقته. تبقى صور المنتج منفصلة.")}</small>
    </div> : <p className="native-ugc-help">{t("Add your adult character in Character photos and confirm permission below each selected photo.", "أضف شخصيتك البالغة في صور الشخصية وأكد الإذن أسفل كل صورة محددة.")}</p>)}
    <label className="native-ugc-toggle"><input type="checkbox" role="switch" checked={value.enabled} disabled={disabled || (uploadedCharacter && !value.enabled)} aria-describedby={uploadedCharacter ? `${id}-speaks-help` : undefined} onChange={event => update({ enabled: event.target.checked, scriptApproved: false, approvedLanguage: undefined })} /><span>{t("Character speaks", "الشخصية تتحدث")}</span></label>
    {uploadedCharacter && <p id={`${id}-speaks-help`} className="native-ugc-help">{t("Your uploaded character appears without speech. To add a spoken script, choose Realistic adult or Illustrated adult.", "تظهر شخصيتك المرفوعة دون كلام. لإضافة نص منطوق، اختر شخصية بالغة واقعية أو مرسومة.")}</p>}
    {value.enabled && <div className="native-ugc-speech">
      <div className="native-ugc-two">
        <label htmlFor={`${id}-language`}>{t("Speech language", "لغة الكلام")}<select id={`${id}-language`} value={project.language} disabled={disabled} onChange={event => onLanguageChange?.(event.target.value as CreatorProject["language"])}><option value="en">English</option><option value="ar">العربية الكويتية</option>{!singleLanguage && <option value="bilingual">English + العربية</option>}</select></label>
        <label htmlFor={`${id}-delivery`}>{t("Voice delivery", "أسلوب الصوت")}<select id={`${id}-delivery`} value={value.delivery} disabled={disabled} onChange={event => update({ delivery: event.target.value as NativeUgcSettings["delivery"], scriptApproved: false, approvedLanguage: undefined })}><option value="warm">{t("Warm and friendly", "ودود ودافئ")}</option><option value="confident">{t("Confident", "واثق")}</option><option value="calm">{t("Calm", "هادئ")}</option></select></label>
      </div>
      <label className="native-ugc-script" htmlFor={`${id}-script`}>{t("Exact spoken script", "النص المنطوق بالضبط")}<textarea id={`${id}-script`} dir="auto" value={value.script} rows={3} maxLength={500} disabled={disabled} aria-describedby={`${id}-script-help`} onChange={event => update({ script: event.target.value, scriptApproved: false, approvedLanguage: undefined })} /></label>
      <small id={`${id}-script-help`}>{t(`${words}/${limit} words for ${project.durationSeconds} seconds. Use confirmed product facts. You will hear the generated voice in the video preview.`, `${words}/${limit} كلمة لمدة ${project.durationSeconds} ثانية. استخدم معلومات المنتج المؤكدة. ستسمع الصوت المولّد في معاينة الفيديو.`)}</small>
      <label className="native-ugc-approval"><input type="checkbox" checked={value.scriptApproved && value.approvedLanguage === project.language} disabled={disabled || !value.script.trim() || words > limit} onChange={event => update({ scriptApproved: event.target.checked, approvedLanguage: event.target.checked ? project.language : undefined })} /><span>{t("I approve these exact words and product claims in the selected language.", "أعتمد هذه الكلمات وادعاءات المنتج بالضبط باللغة المختارة.")}</span></label>
    </div>}
    {feedback && <p className="native-ugc-feedback" role="status">{feedback}</p>}
  </section>;
}
