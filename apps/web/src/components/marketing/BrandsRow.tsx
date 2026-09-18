import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandKit } from "@/lib/marketing/brandKit";

export function BrandsRow({
  kits,
  activeId,
  onSelect,
  onNew,
  onEdit,
  onDelete,
}: {
  kits: BrandKit[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (kits.length === 0) {
    return (
      <section className="mb-6">
        <SectionHeader count={0} />
        <button
          type="button"
          onClick={onNew}
          className="w-full rounded-2xl border border-dashed border-border/60 bg-secondary/10 hover:border-[#F5A524]/60 hover:bg-[#F5A524]/5 transition-all px-5 py-6 flex items-center justify-between gap-4 text-left group"
        >
          <div>
            <p className="text-sm font-medium text-foreground">Add your first product</p>
            <p className="text-xs text-muted-foreground mt-1">
              We'll reuse the logo, tagline & description on every ad.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#F5A524] text-black text-xs font-semibold group-hover:bg-[#F5A524]/90">
            <Plus className="w-3.5 h-3.5" />
            New product
          </span>
        </button>
      </section>
    );
  }

  return (
    <section className="mb-6">
      <SectionHeader count={kits.length} />
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {kits.map((k) => {
          const active = k.id === activeId;
          return (
            <div
              key={k.id}
              className={cn(
                "group relative shrink-0 w-[200px] h-[84px] rounded-2xl border bg-[hsl(240_5%_8%)]/70 backdrop-blur transition-all overflow-hidden",
                active
                  ? "border-[#F5A524] ring-1 ring-[#F5A524]/40"
                  : "border-border/60 hover:border-[#F5A524]/50",
              )}
            >
              <button
                type="button"
                onClick={() => k.id && onSelect(k.id)}
                className="w-full h-full text-left p-3 flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-lg border border-border/40 bg-white/5 overflow-hidden flex items-center justify-center shrink-0">
                  {k.logo_url ? (
                    <img
                      src={k.logo_url}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">
                      {k.name || "Untitled"}
                    </span>
                    {active && (
                      <span className="shrink-0 px-1.5 py-px rounded-full bg-[#F5A524]/15 text-[#F5A524] text-[9px] uppercase tracking-wider font-semibold leading-none">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                    {k.subject}
                  </div>
                </div>
              </button>

              <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[hsl(240_6%_9%)]/95 backdrop-blur rounded-lg border border-border/60 px-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (k.id) onEdit(k.id);
                  }}
                  className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Edit"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (k.id) onDelete(k.id);
                  }}
                  className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}

        {/* New brand tile */}
        <button
          type="button"
          onClick={onNew}
          className="shrink-0 w-[140px] h-[84px] rounded-2xl border border-dashed border-border/60 bg-secondary/10 hover:border-[#F5A524]/60 hover:bg-[#F5A524]/5 transition-all flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-medium">New product</span>
        </button>
      </div>
    </section>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[11px] uppercase tracking-[0.15em] font-semibold text-muted-foreground">
        Your products
      </h2>
      {count > 0 && (
        <span className="text-[10px] text-muted-foreground/70 tabular-nums">
          {count} saved
        </span>
      )}
    </div>
  );
}
