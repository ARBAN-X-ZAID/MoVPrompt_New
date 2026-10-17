import { configureAutomaticAssets, drainAutomaticPhotos, queueAutomaticPhoto } from "./automaticAssetQueue";
import { useEffect, useState } from "react";
import type { LibraryKind } from "@movprompt/contracts";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageContext";
import { isFeatureEnabled } from "@/config/features";
import { libraryApi } from "./libraryApi";
import { deviceLibrary, LIBRARY_DEVICE_EVENT, type DevicePhoto } from "./deviceLibrary";
import type { CreatorAsset } from "../create/types";
import { getGuestAsset } from "../create/guestDraftStore";
import { DevicePhotoPreview } from "./DeviceLibraryWorkspace";

export function AutomaticAssetsRuntime() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (!isFeatureEnabled("referenceLibrary")) return;
    configureAutomaticAssets({ ownerId: loading ? undefined : user?.id ?? null });
    let disposed = false;
    const resume = () => { if (!loading) void drainAutomaticPhotos(true); };
    void libraryApi.status().then(enabled => { if (!disposed) { configureAutomaticAssets({ available: enabled }); resume(); } }).catch(() => { configureAutomaticAssets({ available: false }); });
    const tick = setInterval(resume, 30_000);
    window.addEventListener("online", resume); window.addEventListener("focus", resume);
    return () => { disposed = true; clearInterval(tick); window.removeEventListener("online", resume); window.removeEventListener("focus", resume); };
  }, [user?.id, loading]);
  return null;
}
export function AutomaticPhotoStatus({ asset, checksum = asset?.checksum, kind, failed = asset?.automaticSaveFailed ?? false }: { asset?: CreatorAsset; checksum?: string; kind: LibraryKind; failed?: boolean }) {
  const { user } = useAuth(); const { locale } = useLanguage(); const ar = locale === "ar";
  const [row, setRow] = useState<DevicePhoto | null>(null);
  const [retrying, setRetrying] = useState(false);
  async function retry() {
    setRetrying(true);
    try {
      if (!row && asset?.assetKey) {
        const stored = await getGuestAsset(asset.assetKey);
        if (stored?.blob && checksum) await queueAutomaticPhoto(new File([stored.blob], asset.name, { type: asset.mimeType }), kind, checksum, user?.id ?? null);
      }
      await drainAutomaticPhotos(true);
    } finally { setRetrying(false); }
  }
  useEffect(() => {
    let live = true;
    const refresh = () => { void deviceLibrary.all(user?.id ?? null, kind).then(rows => { if (live) setRow(rows.find(item => item.checksumSha256 === checksum) ?? null); }).catch(() => {}); };
    if (isFeatureEnabled("referenceLibrary") && checksum) refresh();
    window.addEventListener(LIBRARY_DEVICE_EVENT, refresh); return () => { live = false; window.removeEventListener(LIBRARY_DEVICE_EVENT, refresh); };
  }, [checksum, kind, user?.id]);
  if (!isFeatureEnabled("referenceLibrary") || (!row && !failed)) return null;
  const error = (!row && failed) || row?.status === "failed";
  return <small className="assets-auto-status" role="status">{error ? ar ? "تعذر الحفظ" : "Save failed" : row?.ownerId === null ? ar ? "محفوظ على هذا المتصفح" : "Saved on this browser" : row?.status === "saved" ? ar ? "محفوظ في أصولي" : "Saved to My assets" : ar ? "جارٍ الحفظ في أصولي…" : "Saving to My assets…"}{error && <button type="button" disabled={retrying} className="assets-link" onClick={() => void retry().catch(() => {})}>{ar ? "إعادة المحاولة" : "Retry"}</button>}</small>;
}

export function AccountAssetTransfers({ kind }: { kind: LibraryKind }) {
  const { user } = useAuth(); const { locale } = useLanguage(); const ar = locale === "ar";
  const [rows, setRows] = useState<DevicePhoto[]>([]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      if (!user?.id) { setRows([]); return; }
      void deviceLibrary.all(user.id, kind).then(rows => { if (live) setRows(rows.filter(row => row.blob && row.status !== "saved")); }).catch(() => {});
    };
    refresh(); window.addEventListener(LIBRARY_DEVICE_EVENT, refresh);
    return () => { live = false; window.removeEventListener(LIBRARY_DEVICE_EVENT, refresh); };
  }, [user?.id, kind]);
  if (!user || !rows.length) return null;
  return <section className="assets-transfers" aria-label={ar ? "حفظ الصور" : "Saving photos"}>
    {rows.map(row => <div className="assets-transfer" key={row.id}><DevicePhotoPreview row={row} /><div><strong>{row.name}</strong><AutomaticPhotoStatus checksum={row.checksumSha256} kind={kind} /></div></div>)}
  </section>;
}
