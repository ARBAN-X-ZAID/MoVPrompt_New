import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { PRESET_GROUPS, type PresetGroupId, type Preset, useAllPresets } from "@/lib/presets";
import { PresetCard } from "@/components/PresetCard";

interface PresetPickerPanelProps {
  description: string;
  onDescriptionChange: (v: string) => void;
  defaultOpen?: boolean;
}

const isPresetSelected = (description: string, label: string) => {
  const tokens = description.split(",").map((t) => t.trim().toLowerCase());
  return tokens.includes(label.toLowerCase());
};

export const PresetPickerPanel = ({ description, onDescriptionChange, defaultOpen = false }: PresetPickerPanelProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<PresetGroupId>("basic");
  const [search, setSearch] = useState("");
  const { t } = useLanguage();
  const { presets } = useAllPresets();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return presets.filter((p) => p.group === activeTab);
    return presets.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.bestFor.toLowerCase().includes(q),
    );
  }, [activeTab, search, presets]);

  const togglePreset = (preset: Preset) => {
    const tokens = description.split(",").map((t) => t.trim()).filter(Boolean);
    const idx = tokens.findIndex((t) => t.toLowerCase() === preset.label.toLowerCase());
    if (idx >= 0) tokens.splice(idx, 1);
    else tokens.push(preset.label);
    onDescriptionChange(tokens.join(", "));
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-border/50 bg-card/40 p-3 sm:p-4 space-y-3">
        <CollapsibleTrigger className="group w-full flex items-center justify-between gap-3 text-start hover:bg-secondary/30 -m-2 p-2 rounded-md transition-colors">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-semibold font-display text-foreground">
              {t("config.augmentWithPresets")}
            </h3>
          </div>
          <ChevronDown
            size={18}
            className="text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90"
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out overflow-hidden">
          <div className="relative">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("presets.search.placeholder")}
              className="ps-9 h-9 bg-secondary/60 border-border/50 text-sm"
            />
          </div>

          {search.trim() ? (
            <div>
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  {t("presets.empty")}
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {filtered.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      selected={isPresetSelected(description, preset.label)}
                      onToggle={togglePreset}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PresetGroupId)}>
              <TabsList className="w-full h-auto flex-wrap justify-start gap-1 bg-secondary/40 p-1">
                {PRESET_GROUPS.map((g) => (
                  <TabsTrigger
                    key={g.id}
                    value={g.id}
                    className="text-xs gap-1.5 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                  >
                    <span>{g.icon}</span>
                    <span>{g.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {PRESET_GROUPS.map((g) => (
                <TabsContent key={g.id} value={g.id} className="mt-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground/70">{g.description}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {filtered.map((preset) => (
                      <PresetCard
                        key={preset.id}
                        preset={preset}
                        selected={isPresetSelected(description, preset.label)}
                        onToggle={togglePreset}
                      />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
