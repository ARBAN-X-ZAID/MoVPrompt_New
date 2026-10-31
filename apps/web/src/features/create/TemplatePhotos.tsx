import { AssetUpload } from "../assets/AssetUpload";
import { AutomaticPhotoStatus } from "../assets/automaticAssets";
import { ReferencePhoto } from "../assets/ReferencePhoto";
import { useId } from "react";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import type { TemplatePhotoRole } from "@movprompt/contracts";
import type { CreatorAsset } from "./types";

const PHOTO_INSTRUCTIONS: Record<string, [string, string]> = {
  "premium-phone-reveal": ["Use 1–3 views of the same device.", "استخدم 1–3 صور للجهاز نفسه."],
  "phone-floating-ad": ["Use 1–3 views of the same device.", "استخدم 1–3 صور للجهاز نفسه."],
  "restaurant-food-hero": ["Use 1–3 photos of the same dish and plating. Different angles and close-ups make the video richer.", "استخدم 1–3 صور للطبق نفسه وتقديمه. الزوايا المختلفة واللقطات القريبة تجعل الفيديو أغنى."],
  "food-delivery-ad": ["Use 1–3 photos of the same dish, with packaging only if visible. Different angles make the video richer.", "استخدم 1–3 صور للطبق نفسه مع العبوة إن كانت ظاهرة. الزوايا المختلفة تجعل الفيديو أغنى."],
  "fashion-product-showcase": ["Use 1–3 photos of the same garment. Different angles and close-ups make the video richer.", "استخدم 1–3 صور لقطعة الملابس نفسها. الزوايا المختلفة واللقطات القريبة تجعل الفيديو أغنى."],
  "luxury-fashion-reveal": ["Use 1–3 photos of the same clothing item or accessory. Different angles and close-ups make the video richer.", "استخدم 1–3 صور لقطعة الملابس أو الإكسسوار نفسه. الزوايا المختلفة واللقطات القريبة تجعل الفيديو أغنى."],
  "jewelry-product-showcase": ["One photo of the exact jewelry item or complete set. Keep every piece clearly visible. The video is silent.", "صورة واحدة لقطعة المجوهرات أو الطقم الكامل نفسه، مع ظهور كل القطع بوضوح. الفيديو صامت."],
  "luxury-gift-reveal": ["One photo of the exact package and its arrangement. The video starts closed, then opens that same gift. It is silent.", "صورة واحدة للعلبة وترتيبها كما هو. يبدأ الفيديو مغلقاً ثم يفتح الهدية نفسها. الفيديو صامت."],
  "cosmetic-product-commercial": ["Use 1–3 photos of the same product and packaging. Different angles and close-ups make the video richer.", "استخدم 1–3 صور للمنتج نفسه وعبوته. الزوايا المختلفة واللقطات القريبة تجعل الفيديو أغنى."],
  "perfume-advertisement": ["One photo of the subject to feature in the splash.", "صورة واحدة للعنصر الذي سيظهر وسط رذاذ الماء."],
  "female-product-review": ["Use 1–3 views of the same product. Optional character photos must show one adult from different angles. Choose a generated character or approved character photos. Add optional speech in Character and speech.", "استخدم 1–3 صور للمنتج نفسه. صور الشخصية اختيارية لشخص بالغ واحد من زوايا مختلفة. اختر شخصية مولّدة أو صور شخصية معتمدة. أضف الكلام الاختياري في الشخصية والكلام."],
  "real-estate-property": ["Use 1–5 views of the same property. Every selected photo appears in order, then the video returns to the first view. Rooms are never joined by invented corridors.", "استخدم 1–5 صور للعقار نفسه. تظهر كل الصور المحددة بالترتيب ثم يعود الفيديو للمنظر الأول، دون اختراع ممرات بين الغرف."],
  "business-service-promotion": ["One photo of your supplied business artwork.", "صورة واحدة للتصميم الإعلاني لنشاطك."],
  "new-york-billboard-takeover": ["One artwork image to display unchanged on the billboard.", "تصميم واحد يظهر كما هو على اللوحة الإعلانية."],
};

export type TemplatePhotoActions = {
  onFiles: (files: readonly File[] | FileList | null, role?: TemplatePhotoRole, replace?: boolean, fromDeviceLibrary?: boolean) => void;
  onPhotoChange?: (id: string, changes: Partial<CreatorAsset>) => void;
  onMovePhoto?: (id: string, offset: -1 | 1) => void;
  onRemoveImage?: (id: string) => void;
};

export function TemplatePhotos({ templateId, images, arabic = false, busy = false, characterUploadDisabled = false, onFiles, onPhotoChange, onMovePhoto, onRemoveImage }: TemplatePhotoActions & {
  templateId: string; images: CreatorAsset[]; arabic?: boolean; busy?: boolean; characterUploadDisabled?: boolean;
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
        <AssetUpload role={group.role} onFiles={onFiles} replace={group.max === 1} multiple={group.max > 1} disabled={busy || (group.role === "character" && characterUploadDisabled)} className="creator-photo-add">{group.max === 1 && selected.length ? t("Replace photo", "استبدل الصورة") : t("Choose photos", "اختر الصور")}</AssetUpload>
        {group.role === "character" && characterUploadDisabled && <p className="creator-field-help">{t("Turn off Character speaks to use uploaded adult portraits. Speaking ads use a generated character.", "أوقف كلام الشخصية لاستخدام صور الأشخاص البالغين المرفوعة. الإعلانات الناطقة تستخدم شخصية مولّدة.")}</p>}
        <ul className="creator-photo-list" aria-label={label}>
          {grouped.map(image => {
            const order = selected.findIndex(item => item.id === image.id);
            return <li className="creator-photo-card" key={image.id}>
              <ReferencePhoto asset={image} className="creator-photo-frame" style={templateId === "jewelry-product-showcase" || templateId === "luxury-gift-reveal" ? { objectFit: "contain" } : undefined} />
              {(group.role === "subject" || group.role === "character") && <AutomaticPhotoStatus asset={image} checksum={image.checksum} kind={group.role === "character" ? "presenter" : "product"} failed={image.automaticSaveFailed} />}
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
