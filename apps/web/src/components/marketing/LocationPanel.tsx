import { useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useBrandKit, type LocationInput, EMPTY_LOCATION } from "@/lib/marketing/brandKit";

export function LocationPanel({
  value,
  onChange,
}: {
  value: LocationInput;
  onChange: (v: LocationInput) => void;
}) {
  const { uploadLocationImage } = useBrandKit();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) return toast.error("Image must be under 25MB");
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) return toast.error("Use PNG or JPG");
    setUploading(true);
    try {
      const { path, url } = await uploadLocationImage(file);
      onChange({ ...value, imagePath: path, imageUrl: url });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const hasImage = !!value.imagePath;

  return (
    <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Location reference</div>
          <div className="text-[11px] text-muted-foreground">
            Optional — upload a reference photo of where the scene takes place.
          </div>
        </div>
        {hasImage && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_LOCATION)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {value.imageUrl ? (
        <div className="space-y-1.5">
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/60 bg-muted/10">
            <img src={value.imageUrl} alt="Location" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange({ ...value, imagePath: null, imageUrl: null })}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-[11px] text-[#F5A524] hover:underline"
          >
            Replace image
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full min-h-[180px] rounded-lg border border-dashed border-border/60 bg-muted/10 flex flex-col items-center justify-center gap-2 px-4",
            "text-muted-foreground hover:text-foreground hover:border-[#F5A524]/60 hover:bg-[#F5A524]/5 transition-colors",
          )}
        >
          {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
          <span className="text-xs font-medium">Drop a photo or click to upload</span>
          <span className="text-[10px] text-muted-foreground/70">PNG/JPG · ≤25MB</span>
        </button>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug">
        We'll match the architecture, lighting and mood in your generated ad.
      </p>
    </div>
  );
}
