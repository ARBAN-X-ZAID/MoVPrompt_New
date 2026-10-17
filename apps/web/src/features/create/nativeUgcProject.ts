import { defaultNativeUgcSettings, nativeUgcIssues, supportsNativeUgc } from "@movprompt/contracts";
import { campaignAudioForProject } from "./adStudioBrandAdProject";
import type { CreatorProject } from "./types";

export function nativeUgcForProject(project: CreatorProject) {
  return project.nativeUgc ?? { ...defaultNativeUgcSettings(), characterStyle: project.product.images.some(photo => photo.selected !== false && photo.referenceRole === "character") ? "reference_adult" as const : "realistic_adult" as const };
}

export function nativeUgcFeedback(project: CreatorProject, arabic = false): string {
  if (!supportsNativeUgc(project.templateId)) return "";
  const issue = nativeUgcIssues({ templateId: project.templateId, ...(project.nativeUgc ? { settings: project.nativeUgc } : {}), language: project.language, durationSeconds: project.durationSeconds, audio: campaignAudioForProject(project), characterCount: project.product.images.filter(photo => photo.selected !== false && photo.referenceRole === "character").length })[0];
  const copy: Record<string, [string, string]> = {
    native_ugc_person_reference_unavailable: ["Speaking ads support generated characters. Choose a generated style and unselect character photos before generating.", "الإعلانات الناطقة تدعم الشخصيات المولّدة. اختر أسلوباً مولّداً وألغِ تحديد صور الشخصية قبل الإنشاء."],
    native_ugc_character_required: ["Add an adult character photo or choose a generated character.", "أضف صورة شخصية بالغة أو اختر شخصية مولّدة."],
    native_ugc_unselect_character: ["Unselect saved character photos to use a generated character.", "ألغِ تحديد صور الشخصية المحفوظة لاستخدام شخصية مولّدة."],
    native_ugc_audio_required: ["Turn on sound to use character speech.", "فعّل الصوت لاستخدام كلام الشخصية."],
    native_ugc_script_required: ["Enter the exact words your character should say.", "اكتب الكلمات التي ستقولها الشخصية بالضبط."],
    native_ugc_script_approval_required: ["Approve the script in the selected language before generating.", "اعتمد النص باللغة المختارة قبل الإنشاء."],
    native_ugc_script_too_long: ["Shorten the script or choose a longer video so the speech fits naturally.", "اختصر النص أو اختر فيديو أطول ليلائم الكلام المدة بشكل طبيعي."],
  };
  return issue ? copy[issue]?.[arabic ? 1 : 0] ?? issue : "";
}
