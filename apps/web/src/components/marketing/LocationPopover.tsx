import { useMemo, useRef, useState } from "react";
import { Loader2, Upload, X, Plus, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useBrandKit, type LocationInput } from "@/lib/marketing/brandKit";

type PresetGroup = { label: string; cities: string[] };

const TRENDING: string[] = ["Tokyo", "Dubai", "Paris", "LA", "Seoul"];

const REGIONS: PresetGroup[] = [
  { label: "MENA", cities: ["Dubai", "Riyadh", "Doha", "Istanbul", "Cairo", "Marrakech"] },
  { label: "Asia", cities: ["Tokyo", "Seoul", "Mumbai", "Bangkok", "Singapore", "Shanghai"] },
  { label: "Americas", cities: ["NYC", "LA", "Mexico City", "São Paulo", "Toronto"] },
  { label: "Europe", cities: ["London", "Paris", "Berlin", "Lisbon", "Rome"] },
  { label: "Africa", cities: ["Lagos", "Cape Town", "Nairobi"] },
];

export function LocationPopover({
  trigger,
  value,
  onChange,
}: {
  trigger: React.ReactNode;
  value: LocationInput;
  onChange: (v: LocationInput) => void;
}) {
  const { uploadLocationImage } = useBrandKit();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LocationInput>(value);
  const [uploading, setUploading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleOpen = (o: boolean) => {
    if (o) {
      setDraft(value);
      setShowAll(false);
    }
    setOpen(o);
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image must be under 25MB");
      return;
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      toast.error("Use PNG or JPG");
      return;
    }
    setUploading(true);
    try {
      const { path, url } = await uploadLocationImage(file);
      setDraft((d) => ({ ...d, imagePath: path, imageUrl: url }));
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const apply = () => {
    onChange(draft);
    setOpen(false);
  };

  const clear = () => {
    const empty = { place: "", imagePath: null, imageUrl: null };
    setDraft(empty);
    onChange(empty);
    setOpen(false);
  };

  const query = draft.place.trim().toLowerCase();
  const isFiltering = query.length > 0;

  const filteredTrending = useMemo(
    () => (isFiltering ? TRENDING.filter((c) => c.toLowerCase().includes(query)) : TRENDING),
    [query, isFiltering],
  );

  const filteredRegions = useMemo(() => {
    if (!isFiltering) return REGIONS;
    return REGIONS
      .map((g) => ({ ...g, cities: g.cities.filter((c) => c.toLowerCase().includes(query)) }))
      .filter((g) => g.cities.length > 0);
  }, [query, isFiltering]);

  const hasMatches = filteredTrending.length > 0 || filteredRegions.length > 0;
  const exactMatch =
    isFiltering &&
    [...TRENDING, ...REGIONS.flatMap((r) => r.cities)].some(
      (c) => c.toLowerCase() === query,
    );

  const Chip = ({ city }: { city: string }) => {
    const selected = draft.place === city;
    return (
      <button
        type="button"
        onClick={() => setDraft((d) => ({ ...d, place: city }))}
        className={cn(
          "px-2.5 h-7 rounded-full text-xs border transition-colors cursor-pointer",
          selected
            ? "border-[#F5A524] bg-[#F5A524] text-black font-medium"
            : "border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground hover:border-[#F5A524]/60 hover:bg-[#F5A524]/5",
        )}
      >
        {city}
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[380px] p-0 rounded-2xl border-border/60 bg-[hsl(240_6%_7%)]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
        align="start"
        sideOffset={8}
      >
        <Tabs defaultValue="place" className="w-full">
          <TabsList className="w-full rounded-none border-b border-border/50 bg-transparent p-0 h-auto">
            <TabsTrigger
              value="place"
              className="flex-1 rounded-none border-b-[3px] border-transparent data-[state=active]:border-[#F5A524] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground py-2.5"
            >
              Place
            </TabsTrigger>
            <TabsTrigger
              value="image"
              className="flex-1 rounded-none border-b-[3px] border-transparent data-[state=active]:border-[#F5A524] data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground py-2.5"
            >
              Image
            </TabsTrigger>
          </TabsList>

          <TabsContent value="place" className="p-3 space-y-3 mt-0">
            <Input
              autoFocus
              value={draft.place}
              onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))}
              placeholder="Tokyo, Marrakech, Dubai…"
            />

            <div className="max-h-[340px] overflow-y-auto pr-1 space-y-3">
              {filteredTrending.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
                    {isFiltering ? "Matches · Trending" : "Trending"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {filteredTrending.map((c) => (
                      <Chip key={`t-${c}`} city={c} />
                    ))}
                  </div>
                </div>
              )}

              {(isFiltering || showAll) &&
                filteredRegions.map((g) => (
                  <div key={g.label} className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">
                      {g.label}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.cities.map((c) => (
                        <Chip key={`${g.label}-${c}`} city={c} />
                      ))}
                    </div>
                  </div>
                ))}

              {!isFiltering && !showAll && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-xs text-[#F5A524] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> See all locations
                </button>
              )}

              {isFiltering && !hasMatches && (
                <button
                  type="button"
                  onClick={() => {
                    /* keep typed value as-is; user will Apply */
                  }}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-md border border-dashed border-[#F5A524]/50 bg-[#F5A524]/5 text-foreground inline-flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#F5A524]" />
                  Use “{draft.place}” as location
                </button>
              )}

              {isFiltering && hasMatches && !exactMatch && (
                <div className="text-[11px] text-muted-foreground">
                  Or press Apply to use “{draft.place}” as a custom location.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="image" className="p-3 space-y-3 mt-0">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {draft.imageUrl ? (
              <div className="space-y-2">
                <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border/60 bg-muted/10">
                  <img src={draft.imageUrl} alt="Location" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, imagePath: null, imageUrl: null }))
                    }
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-xs text-[#F5A524] hover:underline"
                >
                  Replace image
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full min-h-[180px] rounded-lg border border-dashed border-border/60 bg-muted/10 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-[#F5A524]/60 hover:bg-[#F5A524]/5 transition-colors px-4"
              >
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5" />
                )}
                <span className="text-xs">Drop a photo or click to upload</span>
                <span className="text-[10px] text-muted-foreground/70">PNG or JPG · max 25MB</span>
              </button>
            )}
            <p className="text-xs text-muted-foreground">
              We'll analyze this image for location characteristics, lighting, and mood.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 p-3 border-t border-border/40">
          <Button variant="ghost" size="sm" onClick={clear} className="flex-1">
            Clear
          </Button>
          <Button
            size="sm"
            onClick={apply}
            className="flex-1 bg-[#F5A524] text-black hover:bg-[#F5A524]/90"
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
