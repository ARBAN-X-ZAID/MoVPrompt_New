import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ProductImagePickerResult = {
  hero: string;
  angles: string[];
};

export function ProductImagePickerDialog({
  open,
  onOpenChange,
  images,
  maxAngles,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  /** How many angle photos the user can still add. */
  maxAngles: number;
  busy?: boolean;
  onConfirm: (result: ProductImagePickerResult) => void | Promise<void>;
}) {
  const [heroIdx, setHeroIdx] = useState(0);
  const [angleSet, setAngleSet] = useState<Set<number>>(new Set());
  const [errored, setErrored] = useState<Set<number>>(new Set());

  // Reset when dialog opens with a fresh image set.
  useEffect(() => {
    if (!open) return;
    setHeroIdx(0);
    // Pre-select up to `maxAngles` non-hero images so users can confirm with one click.
    const next = new Set<number>();
    for (let i = 1; i < images.length && next.size < maxAngles; i++) next.add(i);
    setAngleSet(next);
    setErrored(new Set());
  }, [open, images, maxAngles]);

  const toggleAngle = (i: number) => {
    if (i === heroIdx) return;
    setAngleSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        if (next.size >= maxAngles) return prev;
        next.add(i);
      }
      return next;
    });
  };

  const promoteToHero = (i: number) => {
    setHeroIdx(i);
    // If the new hero was in angle set, remove it.
    setAngleSet((prev) => {
      if (!prev.has(i)) return prev;
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  };

  const heroUrl = images[heroIdx];
  const angles = useMemo(
    () => [...angleSet].sort((a, b) => a - b).map((i) => images[i]).filter(Boolean),
    [angleSet, images],
  );

  const handleConfirm = async () => {
    if (!heroUrl) return;
    await onConfirm({ hero: heroUrl, angles });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl bg-[hsl(240_8%_6%)] border-border/60">
        <DialogTitle className="text-base font-display tracking-tight">
          Pick your product photos
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Choose one main image (the hero) and up to {maxAngles} extra angles. More angles = stronger
          3D lock so the product looks identical across every shot.
        </DialogDescription>

        <div className="mt-3">
          {images.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No images found on that page.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[55vh] overflow-y-auto pr-1">
              {images.map((url, i) => {
                const isHero = i === heroIdx;
                const isAngle = angleSet.has(i);
                const isErr = errored.has(i);
                const angleIdx = isAngle ? [...angleSet].sort((a, b) => a - b).indexOf(i) + 1 : null;
                return (
                  <button
                    key={url + i}
                    type="button"
                    onClick={() => (isHero ? null : isAngle ? promoteToHero(i) : toggleAngle(i))}
                    onDoubleClick={() => promoteToHero(i)}
                    className={cn(
                      "group relative aspect-square rounded-xl overflow-hidden border bg-white/5 transition-all",
                      isHero
                        ? "border-[#F5A524] ring-2 ring-[#F5A524]/40"
                        : isAngle
                          ? "border-cyan-400/60 ring-1 ring-cyan-400/30"
                          : "border-border/40 hover:border-border",
                      isErr && "opacity-40",
                    )}
                    aria-label={isHero ? "Hero image" : isAngle ? `Angle ${angleIdx}` : "Add as angle"}
                  >
                    {!isErr ? (
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-contain bg-black/30"
                        onError={() =>
                          setErrored((prev) => {
                            const next = new Set(prev);
                            next.add(i);
                            return next;
                          })
                        }
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground p-2 text-center">
                        Couldn't load
                      </div>
                    )}

                    {/* Hero badge */}
                    {isHero && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F5A524] text-black text-[9px] font-bold uppercase tracking-wider">
                        <Star className="w-2.5 h-2.5 fill-current" />
                        Hero
                      </span>
                    )}
                    {/* Angle badge */}
                    {isAngle && (
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500 text-black text-[10px] font-bold">
                        {angleIdx}
                      </span>
                    )}

                    {/* Promote-to-hero hint (on hover for angles + un-picked) */}
                    {!isHero && !isErr && (
                      <span className="absolute inset-x-0 bottom-0 px-1.5 py-1 text-[9px] text-white font-medium bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity text-center">
                        {isAngle ? "Click → make hero" : "Click → add"}
                      </span>
                    )}

                    {/* Toggle off button for selected angles (top-right) */}
                    {isAngle && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAngle(i);
                        }}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black"
                        aria-label="Remove angle"
                      >
                        ×
                      </button>
                    )}

                    {/* Checkmark for hero */}
                    {isHero && (
                      <Check className="absolute bottom-1.5 right-1.5 w-4 h-4 text-[#F5A524]" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between">
          <span>
            {angles.length} of {maxAngles} angles selected
          </span>
          <span>Tip: click an image to add/promote. × removes an angle.</span>
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={busy || !heroUrl}
            className="bg-[#F5A524] text-black hover:bg-[#F5A524]/90"
          >
            {busy ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Saving…
              </>
            ) : (
              <>
                Use {angles.length > 0 ? `hero + ${angles.length} angle${angles.length === 1 ? "" : "s"}` : "this image"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
