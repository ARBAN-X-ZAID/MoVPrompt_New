import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LibraryEntry, LibraryKind, TemplatePhotoRole } from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { libraryApi } from "./libraryApi";
import { LibraryEditor, LibraryWorkspace } from "./LibraryWorkspace";
import { reconcileLibraryProject } from "./libraryReconciliation";
import { getGuestAsset } from "../create/guestDraftStore";
import { useLanguage } from "@/i18n/LanguageContext";
import type { CreatorProject } from "../create/types";

const CampaignContext = createContext<{ enabled: boolean; open: (role: "subject" | "character", save: boolean) => void } | null>(null);
export function LibraryControls({ role, disabled = false }: { role: TemplatePhotoRole; disabled?: boolean }) {
  const context = useContext(CampaignContext); const { locale } = useLanguage(); const ar = locale === "ar";
  if (!context?.enabled || (role !== "subject" && role !== "character")) return null;
  return <div className="assets-inline-actions"><button className="creator-button creator-button-secondary" type="button" disabled={disabled} onClick={() => context.open(role, false)}>{ar ? "اختر من المكتبة" : "Choose from library"}</button><button className="assets-link" type="button" disabled={disabled} onClick={() => context.open(role, true)}>{ar ? "حفظ الصور المحددة" : "Save selected photos"}</button></div>;
}

export function LibraryCampaign({ project, signedIn, onProjectChange, onSignIn, children }: { project: CreatorProject; signedIn: boolean; onProjectChange: (project: CreatorProject) => void; onSignIn: () => Promise<void>; children: ReactNode }) {
  const { locale } = useLanguage(); const ar = locale === "ar"; const t = (en: string, arabic: string) => ar ? arabic : en;
  const [enabled, setEnabled] = useState(false); const [picker, setPicker] = useState<"subject" | "character" | null>(null);
  const [saving, setSaving] = useState<{ kind: LibraryKind; photos: { id: string; uploadId?: string; projectSource?: { projectId: string; assetId: string } }[] } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [checking, setChecking] = useState(false);
  const projectRef = useRef(project); projectRef.current = project;
  const changeRef = useRef(onProjectChange); changeRef.current = onProjectChange;
  const operation = useRef(0);
  useEffect(() => { let live = true; void libraryApi.status().then(value => { if (live) setEnabled(value); }).catch(() => {}); return () => { live = false; }; }, []);
  async function reconcile() {
    if (!signedIn || !projectRef.current.product.images.some(image => image.librarySource)) return;
    const current = ++operation.current; setChecking(true); setError("");
    try {
      const original = projectRef.current; const next = await reconcileLibraryProject(original);
      if (current !== operation.current || original.id !== projectRef.current.id) return;
      if (next !== original) {
        // Apply only linked photo deltas over the latest form, preserving edits made during the request.
        const originalKeys = new Set(original.product.images.flatMap(image => image.librarySource ? [`${image.librarySource.entryId}:${image.librarySource.photoId}`] : []));
        const byId = new Map(next.product.images.map(image => [image.librarySource ? `${image.librarySource.entryId}:${image.librarySource.photoId}` : image.id, image]));
        const images = projectRef.current.product.images.flatMap(image => {
          if (!image.librarySource) return [image];
          const key = `${image.librarySource.entryId}:${image.librarySource.photoId}`;
          if (!originalKeys.has(key)) return [image];
          const value = byId.get(key); return value ? [{ ...value, selected: image.selected }] : [];
        });
        changeRef.current({ ...projectRef.current, libraryReviewRequired: true, product: { ...projectRef.current.product, images } });
      }
    } catch (cause) { if (current === operation.current) setError((cause as Error).message); }
    finally { if (current === operation.current) setChecking(false); }
  }
  const referencesKey = project.product.images.filter(image => image.librarySource).map(image => `${image.librarySource!.entryId}:${image.librarySource!.photoId}:${image.checksum}`).join("|");
  useEffect(() => {
    void reconcile();
    const handle = () => { void reconcile(); };
    window.addEventListener("online", handle); window.addEventListener("focus", handle); window.addEventListener("movprompt:library-changed", handle);
    // Cancel in-flight reconciliation when switching campaigns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { operation.current++; window.removeEventListener("online", handle); window.removeEventListener("focus", handle); window.removeEventListener("movprompt:library-changed", handle); };
  // Reconcile identity changes, not every keystroke in the campaign.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, referencesKey, signedIn]);
  async function open(role: "subject" | "character", save: boolean) {
    setError(""); if (!signedIn) { await onSignIn(); return; }
    if (role === "character" && project.nativeUgc?.enabled) return;
    if (!save) { setPicker(role); return; }
    const photos = project.product.images.filter(image => (image.referenceRole ?? "subject") === role && image.selected !== false);
    if (!photos.length || photos.length > 3) { setError(t("Select between 1 and 3 photos of the same item to save.", "حدد من صورة إلى 3 صور للعنصر نفسه لحفظه.")); return; }
    setBusy(true);
    try {
      const sources = [];
      for (const image of photos) {
        const id = crypto.randomUUID();
        if (image.storagePath && project.versionId) sources.push({ id, projectSource: { projectId: project.id, assetId: image.id } });
        else {
          const blob = image.assetKey ? (await getGuestAsset(image.assetKey))?.blob : image.librarySource ? await libraryApi.photo(image.librarySource.entryId, image.librarySource.photoId) : await fetch(image.url).then(response => { if (!response.ok) throw new Error("Photo unavailable."); return response.blob(); });
          if (!blob) throw new Error(t("Add this photo again before saving it.", "أضف الصورة مرة أخرى قبل حفظها."));
          const file = new File([blob], image.name, { type: blob.type || image.mimeType });
          sources.push({ id, uploadId: await libraryApi.upload(file, crypto.randomUUID()) });
        }
      }
      setSaving({ kind: role === "subject" ? "product" : "presenter", photos: sources });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  const policy = LAUNCH_PHOTO_POLICIES[project.templateId];
  const max = policy?.groups.find(group => group.role === picker)?.max ?? 1;
  const selected = project.product.images.filter(image => (image.referenceRole ?? "subject") === picker && image.selected !== false);
  const remaining = max === 1 ? 1 : Math.max(0, max - selected.length);
  async function choose(entry: LibraryEntry, ids: string[]) {
    if (!picker || ids.length > remaining) throw new Error(t("Remove or unselect photos to stay within this template's limit.", "احذف صوراً أو ألغِ تحديدها للالتزام بحد القالب."));
    // Re-read approval immediately before selection. The server verifies it again before copying and rendering.
    const current = await libraryApi.find(entry.id);
    if (!current.approved || current.deleted || current.revision !== entry.revision) throw new Error(t("This saved item changed. Reopen the library to review it.", "تغير هذا العنصر المحفوظ. افتح المكتبة مجدداً لمراجعته."));
    const images = ids.map(id => {
      const photo = current.photos.find(photo => photo.id === id)!;
      const existing = projectRef.current.product.images.find(image => image.librarySource?.entryId === current.id && image.librarySource.photoId === photo.id && image.checksum === photo.checksumSha256);
      return { ...(existing ?? {}), id: existing?.id ?? crypto.randomUUID(), name: photo.name, url: "", checksum: photo.checksumSha256, mimeType: photo.mimeType, source: "upload" as const, selected: true, referenceRole: picker, librarySource: { entryId: entry.id, photoId: id, revision: entry.revision, kind: entry.kind, sizeBytes: photo.sizeBytes }, ...(picker === "character" ? { personRightsConfirmed: true as const } : {}) };
    });
    const previous = projectRef.current;
    const retained = previous.product.images.filter(image => !(image.librarySource?.entryId === current.id && ids.includes(image.librarySource.photoId)));
    if (retained.length + images.length > 16) throw new Error(t("Remove a saved photo before adding more.", "احذف صورة محفوظة قبل إضافة المزيد."));
    const existing = max === 1 ? retained.map(image => (image.referenceRole ?? "subject") === picker ? { ...image, selected: false } : image) : retained;
    changeRef.current({ ...previous, product: { ...previous.product, images: [...existing, ...images] } }); setPicker(null);
  }
  async function confirm() {
    setBusy(true); setError("");
    try {
      const latest = await reconcileLibraryProject(projectRef.current);
      for (const image of latest.product.images) {
        if (!image.librarySource) continue;
        const entry = await libraryApi.find(image.librarySource.entryId);
        if (!entry.approved || entry.deleted) throw new Error(t("Renew permission in My assets or remove the unapproved reference.", "جدد الإذن في أصولي أو احذف الصورة غير المعتمدة."));
        if (image.referenceRole === "character" && !image.personRightsConfirmed) throw new Error(t("Confirm the adult's permission under each character photo.", "أكد إذن الشخص البالغ أسفل كل صورة شخصية."));
      }
      const { libraryReviewRequired: _review, ...rest } = latest;
      const images = rest.product.images.map(({ libraryReviewRequired: _photoReview, ...image }) => image);
      changeRef.current({ ...rest, product: { ...rest.product, images } });
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  }
  return <CampaignContext.Provider value={{ enabled, open: (role, save) => { void open(role, save); } }}>
    {(project.libraryReviewRequired || error || checking || busy) && <aside className="assets-review" role="status"><strong>{checking ? t("Checking saved references…", "جارٍ التحقق من الصور المحفوظة…") : t("Review saved references", "مراجعة الصور المحفوظة")}</strong><p>{error || t("Saved photos changed or need permission review. Check the current photos before requesting a quote or generating. Your facts and messages are unchanged.", "تغيرت الصور المحفوظة أو تحتاج مراجعة الإذن. راجع الصور الحالية قبل طلب السعر أو التوليد. لم تتغير معلوماتك ورسائلك.")}</p>{project.libraryReviewRequired && <button className="creator-button creator-button-secondary" type="button" disabled={busy || checking} onClick={() => void confirm()}>{t("I reviewed the current photos", "راجعت الصور الحالية")}</button>}</aside>}
    {children}
    <Dialog open={Boolean(picker)} onOpenChange={open => { if (!open) setPicker(null); }}><DialogContent className="assets-dialog assets-picker" dir={ar ? "rtl" : "ltr"}><DialogTitle>{picker === "character" ? t("Choose presenter photos", "اختر صور الشخصية") : t("Choose product photos", "اختر صور المنتج")}</DialogTitle><DialogDescription>{max === 1 ? t("Choosing a photo replaces the current selection.", "اختيار صورة يستبدل التحديد الحالي.") : t(`You can add ${remaining} more photos.`, `يمكنك إضافة ${remaining} صور أخرى.`)}</DialogDescription>{picker && <LibraryWorkspace kind={picker === "character" ? "presenter" : "product"} ar={ar} limit={remaining} onSelect={choose} />}</DialogContent></Dialog>
    {saving && <LibraryEditor kind={saving.kind} initialPhotos={saving.photos} ar={ar} onClose={() => setSaving(null)} onSaved={() => { setSaving(null); window.dispatchEvent(new Event("movprompt:library-changed")); }} />}
  </CampaignContext.Provider>;
}
