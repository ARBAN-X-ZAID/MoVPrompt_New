import { useId } from "react";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import type { TemplatePhotoRole } from "@movprompt/contracts";
import type { CreatorAsset } from "./types";

const PHOTO_INSTRUCTIONS: Record<string, [string, string]> = {
  "premium-phone-reveal": ["Use 1–3 views of the same device.", "استخدم 1–3 صور للجهاز نفسه."],
  "phone-floating-ad": ["Use 1–3 views of the same device.", "استخدم 1–3 صور للجهاز نفسه."],
  "restaurant-food-hero": ["One photo of the exact dish and plating.", "صورة واحدة للطبق وتقديمه كما هو."],
  "food-delivery-ad": ["One photo of the dish, with packaging only if visible.", "صورة واحدة للطبق مع العبوة إن كانت ظاهرة."],
  "fashion-product-showcase": ["One photo of the exact garment.", "صورة واحدة لقطعة الملابس نفسها."],
  "luxury-fashion-reveal": ["One photo of the clothing item or accessory.", "صورة واحدة لقطعة الملابس أو الإكسسوار."],
  "cosmetic-product-commercial": ["One photo of the product and its packaging.", "صورة واحدة للمنتج وعبوته."],
  "perfume-advertisement": ["One photo of the subject to feature in the splash.", "صورة واحدة للعنصر الذي سيظهر وسط رذاذ الماء."],
  "female-product-review": ["Use 1–3 views of the same product. Optional character photos must show one adult from different angles. Without them, a generic adult presenter is used. The video is silent.", "استخدم 1–3 صور للمنتج نفسه. صور الشخصية اختيارية لشخص بالغ واحد من زوايا مختلفة. بدونها تظهر مقدّمة عامة بالغة. الفيديو صامت."],
  "real-estate-property": ["Use 1–5 views of the same property. Every selected photo appears in order, then the video returns to the first view. Rooms are never joined by invented corridors.", "استخدم 1–5 صور للعقار نفسه. تظهر كل الصور المحددة بالترتيب ثم يعود الفيديو للمنظر الأول، دون اختراع ممرات بين الغرف."],
  "business-service-promotion": ["One photo of your supplied business artwork.", "صورة واحدة للتصميم الإعلاني لنشاطك."],
  "new-york-billboard-takeover": ["One artwork image to display unchanged on the billboard.", "تصميم واحد يظهر كما هو على اللوحة الإعلانية."],
};

export type TemplatePhotoActions = {
  onFiles: (files: readonly File[] | FileList | null, role?: TemplatePhotoRole, replace?: boolean) => void;
  onPhotoChange?: (id: string, changes: Partial<CreatorAsset>) => void;
  onMovePhoto?: (id: string, offset: -1 | 1) => void;
  onRemoveImage?: (id: string) => void;
};

export function TemplatePhotos({ templateId, images, arabic = false, busy = false, onFiles, onPhotoChange, onMovePhoto, onRemoveImage }: TemplatePhotoActions & {
  templateId: string; images: CreatorAsset[]; arabic?: boolean; busy?: boolean;
}) {
  const inputId = useId();
  const t = (en: string, ar: string) => arabic ? ar : en;
  const policy = LAUNCH_PHOTO_POLICIES[templateId] ?? { groups: [{ role: "subject" as const, min: 1, max: 1 }] };
  const primaryRole = policy.groups[0]!.role;
  const roleOf = (image: CreatorAsset) => image.referenceRole ?? primaryRole;
  const unsupported = images.filter(image => !policy.groups.some(group => group.role === roleOf(image)));
  return <div className="creator-template-photos">
    <h2>{t("Photos", "الصور")}</h2>
    <p className="creator-field-help">{PHOTO_INSTRUCTIONS[templateId]?.[arabic ? 1 : 0]}</p>
    <p className="creator-field-help">{t("JPG, PNG or WebP only. Saved photos stay available when you change templates.", "صور JPG أو PNG أو WebP فقط. تبقى صورك محفوظة عند تغيير القالب.")}</p>
    {policy.groups.map(group => {
      const grouped = images.filter(image => roleOf(image) === group.role);
      const selected = grouped.filter(image => image.selected !== false);
      const label = group.role === "character" ? t("Character photos (optional)", "صور الشخصية (اختياري)") : templateId === "female-product-review" ? t("Product photos", "صور المنتج") : t("Selected photos", "الصور المحددة");
      const id = `${inputId}-${group.role}`;
      return <fieldset key={group.role} className="creator-photo-group">
        <legend>{label} — {selected.length}/{group.max}</legend>
        <input id={id} className="creator-create-file" aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" multiple={group.max > 1} disabled={busy}
          onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; onFiles(files, group.role, group.max === 1); }} />
        <label className="creator-photo-add" htmlFor={id}>{group.max === 1 && selected.length ? t("Replace photo", "استبدل الصورة") : t("Choose photos", "اختر الصور")}</label>
        <ul className="creator-photo-list" aria-label={label}>
          {grouped.map(image => {
            const order = selected.findIndex(item => item.id === image.id);
            return <li className="creator-photo-card" key={image.id}>
              <img className="creator-photo-frame" src={image.url} alt={image.name} />
              <label className="creator-photo-selection"><input type="checkbox" checked={image.selected !== false} onChange={event => onPhotoChange?.(image.id, { selected: event.target.checked })} /> {t("Use photo", "استخدم الصورة")} {order >= 0 ? order + 1 : ""}</label>
              {group.role === "property" && order >= 0 && <div className="creator-photo-order">
                <button type="button" className="creator-photo-action" disabled={order === 0} aria-label={t(`Move photo ${order + 1} earlier`, `قدّم الصورة ${order + 1}`)} onClick={() => onMovePhoto?.(image.id, -1)}>{t("Earlier", "قبل")}</button>
                <button type="button" className="creator-photo-action" disabled={order === selected.length - 1} aria-label={t(`Move photo ${order + 1} later`, `أخّر الصورة ${order + 1}`)} onClick={() => onMovePhoto?.(image.id, 1)}>{t("Later", "بعد")}</button>
              </div>}
              {group.role === "character" && image.selected !== false && <label className="creator-photo-selection"><input type="checkbox" checked={image.personRightsConfirmed === true} onChange={event => onPhotoChange?.(image.id, { personRightsConfirmed: event.target.checked ? true : undefined })} /> {t("This is the same adult (18+); I have permission to use this photo and likeness.", "هذا الشخص البالغ نفسه (18+) ولدي إذن لاستخدام هذه الصورة وهويته.")}</label>}
              {onRemoveImage && <button type="button" className="creator-photo-action" aria-label={t(`Remove saved photo ${image.name}`, `احذف الصورة المحفوظة ${image.name}`)} onClick={() => onRemoveImage(image.id)}>{t("Remove saved photo", "احذف الصورة المحفوظة")}</button>}
            </li>;
          })}
        </ul>
      </fieldset>;
    })}
    {unsupported.length > 0 && <fieldset className="creator-photo-group"><legend>{t("Other saved photos — unselect to continue", "صور محفوظة أخرى — ألغِ تحديدها للمتابعة")}</legend>{unsupported.map(image => <label className="creator-photo-selection" key={image.id}><input type="checkbox" checked={image.selected !== false} onChange={event => onPhotoChange?.(image.id, { selected: event.target.checked })} /> {image.name}</label>)}</fieldset>}
  </div>;
}
