import { useState } from "react";
import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: (dontShowAgain: boolean) => void;
};

export function ConfirmRightsDialog({ open, onCancel, onConfirm }: Props) {
  const [dontShow, setDontShow] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent
        className="max-w-xl rounded-3xl border border-border/60 bg-[hsl(240_5%_8%)] p-7 sm:p-8 [&>button]:hidden"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onCancel}
          className="absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full border border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-foreground text-background mb-3">
          <Info className="w-4 h-4" />
        </div>

        <DialogTitle className="font-display text-3xl tracking-tight">
          Confirm rights
        </DialogTitle>
        <DialogDescription className="text-base text-muted-foreground leading-relaxed mt-2">
          By continuing, you confirm you have rights to use this content and
          accept responsibility for any copyright or likeness claims tied to it.
        </DialogDescription>

        <div className="flex items-center justify-between gap-3 pt-6">
          <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="accent-primary"
            />
            Don't show again this session
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              className="rounded-full border-primary/40 text-foreground hover:bg-muted/40 px-6"
            >
              Cancel
            </Button>
            <Button
              onClick={() => onConfirm(dontShow)}
              className="rounded-full bg-foreground text-background hover:bg-foreground/90 px-6"
            >
              I confirm
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
