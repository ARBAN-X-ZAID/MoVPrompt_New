import { AssetUploadContext } from "./assetUploadContext";
import { useContext, useRef, type ReactNode } from "react";
import type { TemplatePhotoRole } from "@movprompt/contracts";
import type { TemplatePhotoActions } from "../create/TemplatePhotos";

export function AssetUpload({ role, onFiles, replace = false, multiple = true, disabled = false, children, className = "creator-button creator-button-secondary" }: { role: TemplatePhotoRole; onFiles: TemplatePhotoActions["onFiles"]; replace?: boolean; multiple?: boolean; disabled?: boolean; children: ReactNode; className?: string }) {
  const input = useRef<HTMLInputElement>(null); const context = useContext(AssetUploadContext);
  return <><input ref={input} hidden aria-hidden="true" tabIndex={-1} type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={disabled} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; context?.close(); if (files.length) onFiles(files, role, replace); }} /><button type="button" className={className} disabled={disabled} onClick={() => {
    if (context?.enabled && (role === "subject" || role === "character")) context.open({ role, replace, upload: () => input.current?.click(), onFiles });
    else input.current?.click();
  }} onDragOver={event => { if (!disabled) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!disabled && event.dataTransfer.files.length) onFiles(Array.from(event.dataTransfer.files), role, replace); }}>{children}</button></>;
}
