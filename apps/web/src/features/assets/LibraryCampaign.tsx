import { AccountAssetTransfers } from "./automaticAssets";
import { AssetUploadContext, type UploadChoice } from "./assetUploadContext";
import { useAuth } from "@/hooks/useAuth";
import { deviceLibrary, LIBRARY_DEVICE_EVENT } from "./deviceLibrary";
import { DeviceLibraryWorkspace } from "./DeviceLibraryWorkspace";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LibraryEntry } from "@movprompt/contracts";
import { LAUNCH_PHOTO_POLICIES } from "@movprompt/creative-engine";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { libraryApi } from "./libraryApi";
import { LibraryWorkspace } from "./LibraryWorkspace";
import { reconcileLibraryProject } from "./libraryReconciliation";
import { useLanguage } from "@/i18n/LanguageContext";
import type { CreatorProject } from "../create/types";

export function LibraryCampaign({ project, signedIn, onProjectChange, onSignIn, children }: { project: CreatorProject; signedIn: boolean; onProjectChange: (project: CreatorProject) => void; onSignIn: () => Promise<void>; children: ReactNode }) {
  const { user } = useAuth();
  const { locale } = useLanguage(); const ar = locale === "ar"; const t = (en: string, arabic: string) => ar ? arabic : en;
  const [enabled, setEnabled] = useState(false); const [picker, setPicker] = useState<"subject" | "character" | null>(null);
  const [uploadChoice, setUploadChoice] = useState<UploadChoice | null>(null);
  const [uploadTab, setUploadTab] = useState<"assets" | "new">("assets");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [checking, setChecking] = useState(false);
  const projectRef = useRef(project); projectRef.current = project;
  const changeRef = useRef(onProjectChange); changeRef.current = onProjectChange;
  const operation = useRef(0);
  const transferReview = useRef<string | null>(null);
  const deviceSourcesKey = project.product.images.filter(image => image.deviceLibrarySource).map(image => image.id).join("|");
  useEffect(() => {
    if (!signedIn || !user?.id || !project.product.images.some(image => image.deviceLibrarySource)) return;
    let disposed = false;
    const ownerId = user.id, projectId = project.id;
    async function upgrade() {
      const original = projectRef.current;
      const converted = new Map<string, CreatorProject["product"]["images"][number]>();
      let waiting = false;
      for (const image of original.product.images) {
        if (!image.deviceLibrarySource) continue;
        const row = await deviceLibrary.get(image.deviceLibrarySource.id);
        if (!row || row.ownerId !== ownerId || row.status !== "saved" || !row.receipt) { waiting = true; continue; }
        const entry = await libraryApi.find(row.receipt.entryId);
        const photo = entry.photos.find(photo => photo.id === row.receipt!.photoId);
        if (!entry.approved || entry.deleted || !photo || photo.checksumSha256 !== image.checksum || row.checksumSha256 !== image.deviceLibrarySource.checksumSha256) { waiting = true; continue; }
        const { deviceLibrarySource: _device, ...rest } = image;
        converted.set(image.id, { ...rest, librarySource: { entryId: entry.id, photoId: photo.id, revision: entry.revision, kind: entry.kind, sizeBytes: photo.sizeBytes } });
      }
      if (disposed || projectRef.current.id !== projectId) return;
      if (waiting || converted.size) {
        const current = projectRef.current;
        const images = current.product.images.map(image => {
          const replacement = converted.get(image.id);
          if (!replacement || replacement.checksum !== image.checksum) return image;
          const { deviceLibrarySource: _device, ...rest } = image;
          return { ...rest, librarySource: replacement.librarySource };
        });
        waiting = images.some(image => image.deviceLibrarySource);
        if (waiting && !current.libraryReviewRequired) transferReview.current = projectId;
        const review = waiting ? true as const : transferReview.current === projectId ? undefined : current.libraryReviewRequired;
        changeRef.current({ ...current, libraryReviewRequired: review, product: { ...current.product, images } });
        if (!waiting) { transferReview.current = null; setError(""); }
      }
    }
    const handle = () => { void upgrade().catch(() => { if (!disposed) setError(t("Selected device photos are still transferring. Retry saving in My assets before generating.", "الصور المحددة ما زالت قيد النقل. أعد محاولة الحفظ في أصولي قبل التوليد.")); }); };
    const events = [LIBRARY_DEVICE_EVENT, "movprompt:library-changed", "online", "focus"];
    handle(); events.forEach(event => window.addEventListener(event, handle));
    return () => { disposed = true; events.forEach(event => window.removeEventListener(event, handle)); };
  // Read current photos from projectRef; edits to campaign copy do not restart transfers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, deviceSourcesKey, signedIn, user?.id]);
  useEffect(() => {
    let live = true; let attempts = 0; let retry: ReturnType<typeof setTimeout> | undefined;
    const check = () => { attempts++; void libraryApi.status().then(value => { if (live) setEnabled(value); }).catch(cause => {
      if (attempts === 1) console.warn("reference_library_availability_failed", cause instanceof Error ? cause.message : "availability_check_failed");
      if (live && attempts < 7) retry = setTimeout(check, Math.min(30_000, 5_000 * 2 ** (attempts - 1)));
    }); };
    check(); return () => { live = false; clearTimeout(retry); };
  }, []);
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
  const policy = LAUNCH_PHOTO_POLICIES[project.templateId];
  const max = policy?.groups.find(group => group.role === picker)?.max ?? 1;
  const selected = project.product.images.filter(image => (image.referenceRole ?? "subject") === picker && image.selected !== false);
  const remaining = max === 1 || uploadChoice?.replace ? max : Math.max(0, max - selected.length);
  async function chooseMany(choices: { entry: LibraryEntry; ids: string[] }[]) {
    const projectId = projectRef.current.id;
    const role = picker;
    if (!role || (role === "character" && projectRef.current.nativeUgc?.enabled) || choices.reduce((sum, choice) => sum + choice.ids.length, 0) > remaining) throw new Error(t("Check this template's photo limit.", "تحقق من حد الصور لهذا القالب."));
    const images: CreatorProject["product"]["images"] = [];
    for (const { entry, ids } of choices) {
      const current = await libraryApi.find(entry.id);
      if (!current.approved || current.deleted || current.revision !== entry.revision || current.kind !== (role === "character" ? "presenter" : "product")) throw new Error(t("This saved item changed. Reopen the library to review it.", "تغير هذا العنصر المحفوظ. افتح المكتبة مجدداً لمراجعته."));
      for (const id of ids) {
        const photo = current.photos.find(photo => photo.id === id);
        if (!photo) throw new Error(t("Photo unavailable.", "الصورة غير متاحة."));
        if (images.some(image => image.checksum === photo.checksumSha256)) continue;
        const existing = projectRef.current.product.images.find(image => (image.referenceRole ?? "subject") === role && image.checksum === photo.checksumSha256);
        const { deviceLibrarySource: _device, ...existingFields } = existing ?? {};
        images.push({ ...existingFields, id: existing?.id ?? crypto.randomUUID(), name: photo.name, url: "", checksum: photo.checksumSha256, mimeType: photo.mimeType, source: "upload", selected: true, referenceRole: role, librarySource: { entryId: current.id, photoId: id, revision: current.revision, kind: current.kind, sizeBytes: photo.sizeBytes }, ...(role === "character" ? { personRightsConfirmed: true as const } : {}) });
      }
    }
    const previous = projectRef.current;
    if (previous.id !== projectId) throw new Error(t("The campaign changed. Open the photo picker again.", "تغيرت الحملة. افتح اختيار الصور مجدداً."));
    const retained = previous.product.images.filter(image => !images.some(next => next.id === image.id || (next.librarySource?.entryId === image.librarySource?.entryId && next.librarySource?.photoId === image.librarySource?.photoId)));
    if (retained.length + images.length > 16) throw new Error(t("Remove a saved photo before adding more.", "احذف صورة محفوظة قبل إضافة المزيد."));
    const existing = max === 1 || uploadChoice?.replace ? retained.map(image => (image.referenceRole ?? "subject") === role ? { ...image, selected: false } : image) : retained;
    changeRef.current({ ...previous, product: { ...previous.product, images: [...existing, ...images] } }); setPicker(null); setUploadChoice(null);
  }
  async function confirm() {
    setBusy(true); setError("");
    try {
      if (signedIn && projectRef.current.product.images.some(image => image.deviceLibrarySource)) throw new Error(t("Wait for the selected photos to finish saving to your account.", "انتظر اكتمال حفظ الصور المحددة في حسابك."));
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
  return <AssetUploadContext.Provider value={{ enabled, open: choice => { if (choice.role === "character" && projectRef.current.nativeUgc?.enabled) return; setUploadChoice(choice); setPicker(choice.role); setUploadTab("assets"); }, close: () => { setPicker(null); setUploadChoice(null); } }}>
    {(project.libraryReviewRequired || error || checking || busy) && <aside className="assets-review" role="status"><strong>{checking ? t("Checking saved references…", "جارٍ التحقق من الصور المحفوظة…") : t("Review saved references", "مراجعة الصور المحفوظة")}</strong><p>{error || t("Saved photos changed or need permission review. Check the current photos before requesting a quote or generating. Your facts and messages are unchanged.", "تغيرت الصور المحفوظة أو تحتاج مراجعة الإذن. راجع الصور الحالية قبل طلب السعر أو التوليد. لم تتغير معلوماتك ورسائلك.")}</p>{project.libraryReviewRequired && <button className="creator-button creator-button-secondary" type="button" disabled={busy || checking} onClick={() => void confirm()}>{t("I reviewed the current photos", "راجعت الصور الحالية")}</button>}</aside>}
    {children}
    <Dialog open={Boolean(picker)} onOpenChange={open => { if (!open) { setPicker(null); setUploadChoice(null); } }}><DialogContent closeLabel={ar ? "إغلاق" : "Close"} className="assets-dialog assets-picker" dir={ar ? "rtl" : "ltr"}><DialogTitle>{picker === "character" ? t("Choose presenter photos", "اختر صور الشخصية") : t("Choose product photos", "اختر صور المنتج")}</DialogTitle><DialogDescription>{t("Reuse a saved photo or upload a new one. New uploads save automatically.", "استخدم صورة محفوظة أو ارفع صورة جديدة. تُحفظ الصور الجديدة تلقائياً.")}</DialogDescription>
      <div className="assets-tabs" role="tablist" aria-label={t("Photo source", "مصدر الصورة")}>{(["assets", "new"] as const).map((tab, index) => <button type="button" key={tab} role="tab" id={`upload-tab-${tab}`} aria-controls="upload-panel" aria-selected={uploadTab === tab} tabIndex={uploadTab === tab ? 0 : -1} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "assets" : event.key === "End" ? "new" : index ? "assets" : "new"; setUploadTab(next); document.getElementById(`upload-tab-${next}`)?.focus(); } }} onClick={() => setUploadTab(tab)}>{tab === "assets" ? t("My assets", "أصولي") : t("Upload new", "رفع جديد")}</button>)}</div>
      <div id="upload-panel" role="tabpanel" aria-labelledby={`upload-tab-${uploadTab}`}>
      {uploadTab === "new" ? <button className="assets-upload-choice" type="button" onClick={() => uploadChoice?.upload()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (uploadChoice) { uploadChoice.onFiles(Array.from(event.dataTransfer.files), uploadChoice.role, uploadChoice.replace); setPicker(null); setUploadChoice(null); } }}>{t("Drag photos here or choose from device", "اسحب الصور هنا أو اختر من جهازك")}<small>JPG · PNG · WebP · 12 MB</small></button> : picker && (signedIn ? <><AccountAssetTransfers kind={picker === "character" ? "presenter" : "product"} /><LibraryWorkspace key={`${user?.id ?? "account"}:${picker}`} kind={picker === "character" ? "presenter" : "product"} ar={ar} limit={remaining} onSelectBatch={chooseMany} /></> : <DeviceLibraryWorkspace kind={picker === "character" ? "presenter" : "product"} ar={ar} limit={remaining} onSelect={async rows => { if (!uploadChoice) return; const files = rows.map(row => { if (!row.blob) throw new Error(t("Photo unavailable.", "الصورة غير متاحة.")); return new File([row.blob], row.name, { type: row.mimeType }); }); uploadChoice.onFiles(files, uploadChoice.role, uploadChoice.replace, true); setPicker(null); setUploadChoice(null); }} />)}
      </div>
    </DialogContent></Dialog>
  </AssetUploadContext.Provider>;
}
