import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";

interface ImageUploadZoneProps {
  label: string;
  onImageSelect: (file: File) => void;
  onImageRemove: () => void;
  preview: string | null;
  disabled?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ImageUploadZone = ({ label, onImageSelect, onImageRemove, preview, disabled = false }: ImageUploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [meta, setMeta] = useState<{ name: string; size: number } | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    if (!preview) setMeta(null);
  }, [preview]);

  const select = useCallback((file: File) => {
    setMeta({ name: file.name, size: file.size });
    onImageSelect(file);
  }, [onImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) select(file);
  }, [select]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) select(file);
    e.target.value = "";
  }, [select]);

  return (
    <div className="relative w-full h-full min-w-0 flex" data-tour="image-upload">
      <AnimatePresence mode="wait">
        {preview ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col gap-2 w-full h-full"
          >
            <div
              className="relative rounded-xl flex items-center justify-center flex-1 min-h-0"
              style={{ background: "#0F0F11", border: "1px solid #27272A", padding: 12, minHeight: 240 }}
            >
              <img
                src={preview}
                alt={label}
                loading="lazy"
                decoding="async"
                className="max-w-full max-h-[380px] w-auto h-auto object-contain rounded-md"
              />
              <button
                onClick={() => { if (disabled) return; setMeta(null); onImageRemove(); }}
                aria-label="Remove image"
                disabled={disabled}
                className="absolute top-3 right-3 inline-flex items-center justify-center w-8 h-8 rounded-full text-white transition-all"
                style={{
                  background: "rgba(0,0,0,0.6)",
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                  pointerEvents: disabled ? "none" : "auto",
                }}
                onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(245,165,36,0.2)"; }}
                onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = "rgba(0,0,0,0.6)"; }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex justify-center">
              <input
                ref={replaceInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileInput}
                className="hidden"
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => { if (!disabled) replaceInputRef.current?.click(); }}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-opacity"
                style={{
                  color: "#F5A524",
                  opacity: disabled ? 0.4 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                  pointerEvents: disabled ? "none" : "auto",
                }}
                onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.opacity = "0.8"; }}
                onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.opacity = "1"; }}
              >
                <RefreshCw size={13} /> Replace image
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.label
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`upload-zone-empty group w-full flex flex-col items-center justify-center gap-2 p-4 sm:p-5 rounded-xl cursor-pointer transition-all duration-200 min-h-[140px] sm:min-h-[200px] sm:max-h-[220px] ${
              isDragging ? "upload-zone-dragging" : "upload-zone-idle"
            }`}
          >
            <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
            {isDragging ? (
              <ImageIcon className="w-12 h-12 text-foreground" />
            ) : (
              <Upload className="w-12 h-12 text-muted-foreground" />
            )}
            <div className="text-center">
              {isDragging ? (
                <p className="text-base font-semibold text-foreground">
                  {t("upload.release" as any)}
                </p>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">
                    {t("upload.title" as any)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("upload.subtitle" as any)}
                  </p>
                </>
              )}
            </div>
          </motion.label>
        )}
      </AnimatePresence>
    </div>
  );
};
