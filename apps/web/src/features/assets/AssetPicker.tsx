import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import type { LibraryEntry, LibraryKind } from "@movprompt/contracts";
import { useAuth } from "@/hooks/useAuth";
import { deviceLibrary, LIBRARY_DEVICE_EVENT, type DevicePhoto } from "./deviceLibrary";
import { DevicePhotoPreview } from "./DeviceLibraryWorkspace";
import { libraryApi } from "./libraryApi";
import { LibraryPhoto } from "./LibraryWorkspace";
import "./assets.css";

type Tile = { key: string; label: string; preview: ReactNode; account?: { entry: LibraryEntry; photoId: string }; device?: DevicePhoto };
type Props = {
  kind: LibraryKind; ar: boolean; limit: number; signedIn: boolean;
  onUpload: () => void;
  onSelectAccount: (choices: { entry: LibraryEntry; ids: string[] }[]) => Promise<void>;
  onSelectDevice: (rows: DevicePhoto[]) => Promise<void>;
};

// Tap photos, then Select. Product photos are the customer's own uploads, so choosing one
// records the library approval for them. Presenter photos show a real person and keep an
// explicit consent tick before an unapproved entry can be used.
export function AssetPicker({ kind, ar, limit, signedIn, onUpload, onSelectAccount, onSelectDevice }: Props) {
  const t = (en: string, arabic: string) => ar ? arabic : en;
  const { user } = useAuth();
  const [tiles, setTiles] = useState<Tile[]>([]); const [saving, setSaving] = useState<DevicePhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]); const [consent, setConsent] = useState(false);
  const approvalKeys = useRef(new Map<string, string>());
  const accountTiles = (entries: LibraryEntry[]) => entries.filter(entry => !entry.deleted).flatMap(entry => entry.photos.map(photo => ({ key: `${entry.id}:${photo.id}`, label: photo.name || entry.name, preview: <LibraryPhoto entry={entry} photoId={photo.id} />, account: { entry, photoId: photo.id } })));

  useEffect(() => {
    let live = true; setLoading(true); setError("");
    const load = signedIn
      ? libraryApi.list(kind).then(result => { if (live) { setTiles(accountTiles(result.entries)); setCursor(result.nextCursor); } })
      : deviceLibrary.all(null, kind).then(rows => { if (live) setTiles(rows.filter(row => row.blob).map(row => ({ key: row.id, label: row.name, preview: <DevicePhotoPreview row={row} />, device: row }))); });
    void load.catch(() => { if (live) setError(t("Your saved photos could not load. Upload a photo instead.", "تعذر تحميل صورك المحفوظة. ارفع صورة بدلاً من ذلك.")); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  // Language changes only relabel; they must not reload or clear the selection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, signedIn]);
  useEffect(() => {
    if (!signedIn || !user?.id) return;
    let live = true;
    const refresh = () => { void deviceLibrary.all(user.id, kind).then(rows => { if (live) setSaving(rows.filter(row => row.blob && row.status !== "saved")); }).catch(() => {}); };
    refresh(); window.addEventListener(LIBRARY_DEVICE_EVENT, refresh);
    return () => { live = false; window.removeEventListener(LIBRARY_DEVICE_EVENT, refresh); };
  }, [kind, signedIn, user?.id]);

  const chosen = tiles.filter(tile => selected.includes(tile.key));
  const needsConsent = kind === "presenter" && chosen.some(tile => !(tile.account?.entry.approved ?? tile.device?.approved));
  function toggle(key: string) {
    setError("");
    setSelected(previous => previous.includes(key) ? previous.filter(item => item !== key) : limit === 1 ? [key] : previous.length >= limit ? previous : [...previous, key]);
  }
  async function select() {
    setBusy(true); setError("");
    try {
      if (signedIn) {
        const groups = new Map<string, { entry: LibraryEntry; ids: string[] }>();
        for (const tile of chosen) {
          const { entry, photoId } = tile.account!;
          groups.set(entry.id, { entry, ids: [...(groups.get(entry.id)?.ids ?? []), photoId] });
        }
        const choices = [];
        for (const group of groups.values()) {
          let entry = group.entry;
          if (!entry.approved) {
            const token = `${entry.id}:${entry.revision}`;
            if (!approvalKeys.current.has(token)) approvalKeys.current.set(token, crypto.randomUUID());
            entry = await libraryApi.save({ id: entry.id, expectedRevision: entry.revision, name: entry.name, kind: entry.kind, photos: entry.photos.map(photo => ({ id: photo.id })), approved: true }, approvalKeys.current.get(token)!);
            // Keep the approved revision so a retry after a failed attach does not re-approve a stale one.
            const approved = entry;
            setTiles(previous => previous.map(tile => tile.account?.entry.id === approved.id ? { ...tile, account: { ...tile.account, entry: approved } } : tile));
          }
          choices.push({ entry, ids: group.ids });
        }
        await onSelectAccount(choices);
      } else {
        const rows = chosen.map(tile => tile.device!);
        for (const row of rows) if (!row.approved) await deviceLibrary.put({ ...row, approved: true });
        await onSelectDevice(rows);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("Could not use these photos.", "تعذر استخدام هذه الصور.")); }
    finally { setBusy(false); }
  }
  async function more() {
    if (!cursor) return;
    setBusy(true);
    try { const result = await libraryApi.list(kind, "", cursor); setTiles(previous => [...previous, ...accountTiles(result.entries)]); setCursor(result.nextCursor); }
    catch { setError(t("More photos could not load.", "تعذر تحميل المزيد من الصور.")); }
    finally { setBusy(false); }
  }

  return <div className="asset-picker" dir={ar ? "rtl" : "ltr"}>
    <div className="asset-picker-grid" role="group" aria-label={t("Your photos", "صورك")} aria-busy={loading}>
      <button type="button" className="asset-picker-upload" onClick={onUpload} disabled={busy || limit < 1}><ImagePlus aria-hidden="true" /><span>{t("Upload new", "رفع صورة")}</span></button>
      {saving.map(row => <div key={row.id} className="asset-picker-tile is-saving" aria-label={t(`${row.name}, saving`, `${row.name}، جارٍ الحفظ`)}><DevicePhotoPreview row={row} /><span className="asset-picker-saving"><Loader2 aria-hidden="true" />{t("Saving…", "جارٍ الحفظ…")}</span></div>)}
      {tiles.map(tile => {
        const on = selected.includes(tile.key); const order = selected.indexOf(tile.key) + 1;
        return <button key={tile.key} type="button" className="asset-picker-tile" aria-pressed={on} aria-label={tile.label} disabled={busy || limit < 1 || (!on && limit > 1 && selected.length >= limit)} onClick={() => toggle(tile.key)}>
          {tile.preview}
          {on && <span className="asset-picker-check" aria-hidden="true">{limit > 1 ? order : <Check />}</span>}
        </button>;
      })}
      {loading && Array.from({ length: 3 }, (_, index) => <div key={index} className="asset-picker-tile is-loading" aria-hidden="true" />)}
    </div>
    {loading && <p className="sr-only" role="status">{t("Loading your photos…", "جارٍ تحميل صورك…")}</p>}
    {!loading && !tiles.length && !saving.length && !error && <p className="asset-picker-empty">{t("No saved photos yet. Photos you upload are kept here for next time.", "لا توجد صور محفوظة بعد. تُحفظ الصور التي ترفعها هنا للمرة القادمة.")}</p>}
    {cursor && <button type="button" className="asset-picker-more" disabled={busy} onClick={() => void more()}>{t("Show more photos", "عرض المزيد من الصور")}</button>}
    {error && <p role="alert" className="assets-error">{error}</p>}
    <div className="asset-picker-footer">
      {needsConsent && <label className="assets-approval"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>{t("This adult (18+) agreed to appear in my videos.", "وافق هذا الشخص البالغ (18+) على الظهور في فيديوهاتي.")}</span></label>}
      <button type="button" className="creator-button creator-button-primary asset-picker-select" disabled={busy || !chosen.length || (needsConsent && !consent)} onClick={() => void select()}>
        {busy ? t("Adding…", "جارٍ الإضافة…") : limit < 1 ? t("All photo slots are full. Remove one first.", "كل خانات الصور ممتلئة. احذف صورة أولاً.") : !chosen.length ? limit > 1 ? t(`Tap up to ${limit} photos`, `اختر حتى ${limit} صور`) : t("Tap a photo", "اختر صورة") : chosen.length > 1 ? t(`Select ${chosen.length} photos`, `اختيار ${chosen.length} صور`) : t("Select photo", "اختيار الصورة")}
      </button>
    </div>
  </div>;
}
