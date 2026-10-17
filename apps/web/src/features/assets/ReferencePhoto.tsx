import { useEffect, useState, type CSSProperties } from "react";
import type { CreatorAsset } from "../create/types";
import { libraryApi } from "./libraryApi";
export function ReferencePhoto({ asset, className, style }: { asset: CreatorAsset; className?: string; style?: CSSProperties }) {
  const [url, setUrl] = useState(asset.url);
  const entryId = asset.librarySource?.entryId, photoId = asset.librarySource?.photoId, revision = asset.librarySource?.revision;
  useEffect(() => {
    if (asset.url && (!entryId || !photoId)) { setUrl(asset.url); return; }
    if (!entryId || !photoId) return;
    let disposed = false; let preview = "";
    void libraryApi.photo(entryId, photoId).then(blob => { preview = URL.createObjectURL(blob); if (!disposed) setUrl(preview); else URL.revokeObjectURL(preview); }).catch(() => setUrl(""));
    return () => { disposed = true; if (preview) URL.revokeObjectURL(preview); };
  }, [asset.url, asset.checksum, entryId, photoId, revision]);
  return url ? <img src={url} alt={asset.name} className={className} style={style} /> : <div className={className} style={style} role="img" aria-label={asset.name} />;
}
