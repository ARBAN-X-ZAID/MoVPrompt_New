import { useState } from "react";
import { Building2, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { BrandKit } from "@/lib/marketing/brandKit";

export function BrandPickerPopover({
  kits,
  activeIds,
  max,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  trigger,
}: {
  kits: BrandKit[];
  activeIds: string[];
  max: number;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  trigger: React.ReactNode;
}) {
  const atCap = activeIds.length >= max;
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[300px] p-0 rounded-2xl border-border/60 bg-[hsl(240_6%_7%)]/95 backdrop-blur-xl shadow-2xl shadow-black/50"
      >
        <div className="px-3.5 pt-3 pb-2 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 font-semibold">
            Your products
          </span>
          <span className="text-[10px] text-muted-foreground/70 tabular-nums">
            {activeIds.length} / {max}
          </span>
        </div>

        {kits.length === 0 ? (
          <div className="px-3.5 py-4 text-xs text-muted-foreground">
            No products yet. Create your first one below.
          </div>
        ) : (
          <ul className="max-h-72 overflow-y-auto px-1.5">
            {kits.map((k) => {
              const pos = k.id ? activeIds.indexOf(k.id) : -1;
              const active = pos >= 0;
              const isHero = pos === 0;
              const disabled = !active && atCap;
              return (
                <li key={k.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => k.id && !disabled && (setOpen(false), onSelect(k.id))}
                    disabled={disabled}
                    title={disabled ? `Up to ${max} products per ad` : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 pl-2 pr-9 py-2 rounded-xl text-left text-sm transition-colors",
                      active
                        ? "bg-[#F5A524]/10 ring-1 ring-inset ring-[#F5A524]/40"
                        : "hover:bg-white/[0.04]",
                      disabled && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    <div className="w-9 h-9 rounded-lg border border-border/50 bg-white/[0.03] overflow-hidden flex items-center justify-center shrink-0">
                      {k.logo_url ? (
                        <img src={k.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-foreground font-medium leading-tight">
                          {k.name || "Untitled"}
                        </span>
                        {isHero && (
                          <span className="shrink-0 px-1.5 py-px rounded-full bg-[#F5A524]/15 text-[#F5A524] text-[9px] uppercase tracking-wider font-semibold leading-none">
                            Hero
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mt-0.5">
                        {k.subject}
                      </div>
                    </div>
                    {active && (
                      <Check className="w-3.5 h-3.5 text-[#F5A524] shrink-0 absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </button>

                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(240_6%_9%)] rounded-md border border-border/50 px-0.5">
                    <button
                      type="button"
                      onClick={() => { if (k.id) { setOpen(false); onEdit(k.id); } }}
                      className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label="Edit"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (k.id) setPendingDelete({ id: k.id, name: k.name || "Untitled" });
                      }}
                      className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-1 p-1.5 border-t border-border/40">
          <button
            type="button"
            onClick={() => { setOpen(false); onNew(); }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-sm hover:bg-white/[0.04] text-foreground transition-colors"
          >
            <span className="w-9 h-9 rounded-lg border border-dashed border-border/60 flex items-center justify-center text-muted-foreground">
              <Plus className="w-4 h-4" />
            </span>
            <span className="font-medium">New product</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
    <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this product?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <span className="font-medium text-foreground">{pendingDelete?.name}</span> from your product library. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (pendingDelete) onDelete(pendingDelete.id);
              setPendingDelete(null);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
