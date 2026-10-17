import { useEffect, useId, useRef, useState } from "react";
import type { LibraryEntry, LibraryKind, SaveLibraryEntry } from "@movprompt/contracts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { libraryApi } from "./libraryApi";
import "./assets.css";

export function LibraryPhoto({ entry, photoId }: { entry: LibraryEntry; photoId: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let disposed = false; let preview = "";
    void libraryApi.photo(entry.id, photoId).then(blob => { preview = URL.createObjectURL(blob); if (!disposed) setUrl(preview); else URL.revokeObjectURL(preview); }).catch(() => setUrl(""));
    return () => { disposed = true; if (preview) URL.revokeObjectURL(preview); };
  }, [entry.id, entry.revision, photoId]);
  return url ? <img className="assets-photo" src={url} alt={entry.photos.find(photo => photo.id === photoId)?.name ?? entry.name} /> : <div className="assets-photo assets-placeholder" aria-label={entry.name} />;
}

type PhotoInput = SaveLibraryEntry["photos"][number];
export function LibraryEditor({ kind, entry, initialPhotos, ar, onClose, onSaved }: { kind: LibraryKind; entry?: LibraryEntry; initialPhotos?: PhotoInput[]; ar: boolean; onClose: () => void; onSaved: () => void }) {
  const id = useId(); const t = (en: string, arabic: string) => ar ? arabic : en;
  const [name, setName] = useState(entry?.name ?? "");
  const [photos, setPhotos] = useState<PhotoInput[]>(initialPhotos ?? entry?.photos.map(photo => ({ id: photo.id })) ?? []);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [approved, setApproved] = useState(entry?.approved ?? false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const operation = useRef(crypto.randomUUID()); const uploadKeys = useRef(new Map<string, string>());
  const change = () => { operation.current = crypto.randomUUID(); setError(""); };
  function add(list: FileList | null, replacement?: string) {
    if (!list?.length) return;
    const chosen = Array.from(list);
    if (chosen.length > (replacement ? 1 : 3 - photos.length)) { setError(t("Each entry holds up to three photos.", "كل عنصر يتسع لثلاث صور كحد أقصى.")); return; }
    change(); setApproved(false);
    if (replacement) { setFiles(previous => ({ ...previous, [replacement]: chosen[0]! })); setPhotos(previous => previous.map(photo => photo.id === replacement ? { id: photo.id } : photo)); }
    else {
      const added = chosen.map(file => ({ id: crypto.randomUUID(), file }));
      setFiles(previous => ({ ...previous, ...Object.fromEntries(added.map(item => [item.id, item.file])) }));
      setPhotos(previous => [...previous, ...added.map(item => ({ id: item.id }))]);
    }
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const resolved: PhotoInput[] = [];
      for (const photo of photos) {
        const file = files[photo.id];
        if (!file) { resolved.push(photo); continue; }
        const token = `${photo.id}:${file.name}:${file.size}:${file.lastModified}`;
        if (!uploadKeys.current.has(token)) uploadKeys.current.set(token, crypto.randomUUID());
        resolved.push({ id: photo.id, uploadId: await libraryApi.upload(file, uploadKeys.current.get(token)!) });
      }
      await libraryApi.save({ ...(entry ? { id: entry.id, expectedRevision: entry.revision } : {}), kind, name, photos: resolved, approved }, operation.current);
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not save your item.", "تعذر حفظ العنصر.")); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="assets-dialog" dir={ar ? "rtl" : "ltr"} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogTitle>{entry ? t("Edit saved item", "تعديل العنصر المحفوظ") : kind === "product" ? t("Save product", "حفظ المنتج") : t("Save presenter", "حفظ الشخصية")}</DialogTitle>
    <DialogDescription>{t("Private to your account. Save up to 3 photos of the same product or adult. Names only organize your library.", "خاص بحسابك. احفظ حتى 3 صور للمنتج نفسه أو الشخص البالغ نفسه. الاسم لتنظيم المكتبة فقط.")}</DialogDescription>
    <fieldset disabled={busy} className="assets-editor"><label className="assets-field" htmlFor={`${id}-name`}>{t("Library name", "الاسم في المكتبة")}<input id={`${id}-name`} maxLength={120} value={name} onChange={event => { change(); setName(event.target.value); }} /></label>
      <div className="assets-editor-photos">{photos.map((photo, index) => <div className="assets-edit-photo" key={photo.id}>
        {files[photo.id] ? <FilePreview file={files[photo.id]!} /> : entry?.photos.some(item => item.id === photo.id) ? <LibraryPhoto entry={entry} photoId={photo.id} /> : <div className="assets-photo assets-placeholder">{t("Campaign photo", "صورة الحملة")} {index + 1}</div>}
        <label className="assets-file-label" htmlFor={`${id}-${photo.id}`}>{t("Replace photo", "استبدال الصورة")}</label><input className="sr-only" id={`${id}-${photo.id}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => add(event.target.files, photo.id)} />
        <button type="button" className="assets-link" onClick={() => { change(); setApproved(false); setPhotos(previous => previous.filter(item => item.id !== photo.id)); }}>{t("Remove photo", "حذف الصورة")}</button>
      </div>)}</div>
      {photos.length < 3 && <label className="assets-upload">{t("Add photos · JPG, PNG, WebP · up to 12 MB each", "إضافة صور · JPG، PNG، WebP · حتى 12 ميغابايت للصورة")}<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={event => { add(event.target.files); event.target.value = ""; }} /></label>}
      <label className="assets-approval"><input type="checkbox" checked={approved} onChange={event => { change(); setApproved(event.target.checked); }} /><span>{kind === "presenter" ? t("These photos depict the same adult (18+). I have permission to save and use these images and this person's likeness in campaigns.", "هذه الصور للشخص البالغ نفسه (18+). لدي إذن بحفظ هذه الصور واستخدامها وهوية الشخص في الحملات.") : t("These photos show the same product. I approve this revision and have permission to save and use these images.", "هذه الصور للمنتج نفسه. أعتمد هذا الإصدار ولدي إذن بحفظ هذه الصور واستخدامها.")}</span></label>
      <p className="assets-help">{t("Unapproved items cannot be selected. Replacing or deleting photos updates linked editable drafts and requires review. Existing videos stay available.", "لا يمكن اختيار العناصر غير المعتمدة. يؤدي استبدال الصور أو حذفها إلى تحديث المسودات المرتبطة وطلب مراجعتها. تبقى الفيديوهات السابقة متاحة.")}</p>
      {error && <p role="alert" className="assets-error">{error}</p>}
      <div className="assets-actions"><button type="button" className="creator-button creator-button-secondary" onClick={onClose}>{t("Cancel", "إلغاء")}</button><button type="button" className="creator-button creator-button-primary" disabled={!name.trim() || !photos.length} onClick={() => void save()}>{busy ? t("Saving…", "جارٍ الحفظ…") : t("Save revision", "حفظ الإصدار")}</button></div>
    </fieldset>
  </DialogContent></Dialog>;
}
function FilePreview({ file }: { file: File }) { const [url, setUrl] = useState(""); useEffect(() => { const value = URL.createObjectURL(file); setUrl(value); return () => URL.revokeObjectURL(value); }, [file]); return <img className="assets-photo" src={url} alt={file.name} />; }

export function LibraryWorkspace({ kind, ar, onSelect, limit = 3 }: { kind: LibraryKind; ar: boolean; onSelect?: (entry: LibraryEntry, photoIds: string[]) => Promise<void>; limit?: number }) {
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const [search, setSearch] = useState(""); const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null); const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [editing, setEditing] = useState<LibraryEntry | "new" | null>(null);
  const [deleting, setDeleting] = useState<LibraryEntry | null>(null);
  const [selection, setSelection] = useState<{ entry: LibraryEntry; ids: string[] } | null>(null); const [busy, setBusy] = useState(false);
  const deletionKey = useRef(crypto.randomUUID());
  useEffect(() => { let disposed = false; setLoading(true); setError(""); setSelection(null); const timer = setTimeout(() => { void libraryApi.list(kind, search).then(result => { if (!disposed) { setEntries(result.entries.filter(entry => !entry.deleted)); setCursor(result.nextCursor); } }).catch(cause => { if (!disposed) setError(cause.message); }).finally(() => { if (!disposed) setLoading(false); }); }, 180); return () => { disposed = true; clearTimeout(timer); }; }, [kind, search, refresh]);
  const reload = () => { setEditing(null); setDeleting(null); setRefresh(value => value + 1); window.dispatchEvent(new Event("movprompt:library-changed")); };
  async function remove() { if (!deleting) return; setBusy(true); try { await libraryApi.remove(deleting, deletionKey.current); reload(); } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); } }
  return <div className="assets-workspace" dir={ar ? "rtl" : "ltr"}>
    <div className="assets-toolbar"><label className="assets-search"><span className="sr-only">{t("Search saved items", "بحث في العناصر المحفوظة")}</span><input type="search" placeholder={t("Search by name", "البحث بالاسم")} value={search} onChange={event => setSearch(event.target.value)} /></label><button type="button" className="creator-button creator-button-primary" onClick={() => setEditing("new")}>{kind === "product" ? t("Add product", "إضافة منتج") : t("Add presenter", "إضافة شخصية")}</button></div>
    {loading ? <p role="status">{t("Loading your assets…", "جارٍ تحميل أصولك…")}</p> : !entries.length && <div className="assets-empty"><h2>{t("Ready for your next campaign", "جاهز لحملتك القادمة")}</h2><p>{t("Save photos once, then choose them again when you create a campaign.", "احفظ صورك مرة واحدة، ثم اخترها مجدداً عند إنشاء حملة.")}</p></div>}
    {error && <p role="alert" className="assets-error">{error}</p>}
    <div className="assets-grid">{entries.map(entry => <article key={entry.id} className="assets-card"><div className="assets-card-heading"><h2>{entry.name}</h2><span className="assets-status" data-approved={entry.approved}>{entry.approved ? t("Approved", "معتمد") : t("Needs approval", "يحتاج اعتماداً")}</span></div><div className="assets-thumbnails">{entry.photos.map(photo => onSelect ? <label className="assets-select-photo" key={photo.id}><LibraryPhoto entry={entry} photoId={photo.id} /><span><input type="checkbox" disabled={!entry.approved || busy || (selection?.ids.length === limit && !selection.ids.includes(photo.id))} checked={selection?.entry.id === entry.id && selection.ids.includes(photo.id)} onChange={event => { const ids = selection?.entry.id === entry.id ? selection.ids : []; setSelection({ entry, ids: event.target.checked ? [...ids, photo.id] : ids.filter(id => id !== photo.id) }); }} />{photo.name}</span></label> : <LibraryPhoto key={photo.id} entry={entry} photoId={photo.id} />)}</div><div className="assets-card-footer"><span>{entry.photos.length}/3 · {t("Revision", "الإصدار")} {entry.revision}</span><button type="button" className="assets-link" onClick={() => setEditing(entry)}>{t("Edit & permissions", "التعديل والأذونات")}</button>{!onSelect && <button type="button" className="assets-link" onClick={() => { deletionKey.current = crypto.randomUUID(); setDeleting(entry); }}>{t("Delete", "حذف")}</button>}</div></article>)}</div>
    {cursor && <button className="creator-button creator-button-secondary" type="button" onClick={() => { setBusy(true); void libraryApi.list(kind, search, cursor).then(result => { setEntries(previous => [...previous, ...result.entries.filter(entry => !entry.deleted)]); setCursor(result.nextCursor); }).catch(cause => setError(cause.message)).finally(() => setBusy(false)); }} disabled={busy}>{t("Load more", "تحميل المزيد")}</button>}
    {onSelect && <div className="assets-picker-footer"><span>{t(`Choose up to ${limit} photos from one item.`, `اختر حتى ${limit} صور من عنصر واحد.`)}</span><button className="creator-button creator-button-primary" type="button" disabled={busy || !selection?.ids.length || !selection.entry.approved} onClick={() => { if (!selection) return; setBusy(true); void onSelect(selection.entry, selection.ids).catch(cause => setError(cause.message)).finally(() => setBusy(false)); }}>{busy ? t("Adding…", "جارٍ الإضافة…") : t("Use selected photos", "استخدام الصور المحددة")}</button></div>}
    {editing && <LibraryEditor key={typeof editing === "string" ? editing : `${editing.id}:${editing.revision}`} kind={kind} {...(editing === "new" ? {} : { entry: editing })} ar={ar} onClose={() => setEditing(null)} onSaved={reload} />}
    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><DialogContent dir={ar ? "rtl" : "ltr"}><DialogTitle>{t("Delete saved item?", "حذف العنصر المحفوظ؟")}</DialogTitle><DialogDescription>{t("Linked photos will be removed from editable drafts. Those drafts need review before generation. Completed videos remain available.", "ستُحذف الصور المرتبطة من المسودات القابلة للتعديل. تحتاج هذه المسودات إلى المراجعة قبل التوليد. تبقى الفيديوهات المكتملة متاحة.")}</DialogDescription><button type="button" className="creator-button creator-button-secondary" disabled={busy} onClick={() => setDeleting(null)}>{t("Keep item", "الاحتفاظ بالعنصر")}</button><button type="button" className="creator-button creator-button-primary" disabled={busy} onClick={() => void remove()}>{t("Delete item", "حذف العنصر")}</button></DialogContent></Dialog>
  </div>;
}
