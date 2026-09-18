import { useEffect, useMemo, useState } from "react";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ModelPicker } from "@/components/ModelPicker";
import { ImageUploadZone } from "@/components/ImageUploadZone";
import {
  SceneBreakdown,
  type SceneFrame,
  type ElementDirections,
} from "@/components/SceneBreakdown";
import { SceneMentionTextarea } from "@/components/SceneMentionTextarea";
import { ResultsPanel } from "@/components/ResultsPanel";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

const CHECKLIST: { id: string; label: string }[] = [
  { id: "topbar", label: "Top bar buttons don't wrap or overflow; no horizontal page scroll." },
  { id: "picker-trigger", label: "ModelPicker trigger shows name + description on two lines, no clipping." },
  { id: "picker-popover", label: "Picker popover fits viewport; list scrolls; sticky group headers; left accent on selected." },
  { id: "picker-flash", label: "Selecting a new model briefly flashes ring on trigger." },
  { id: "upload-empty", label: "ImageUploadZone empty state: icon + copy centered, CTA doesn't overflow." },
  { id: "breakdown", label: "SceneBreakdown: cards don't overflow, buttons wrap, long text truncates/wraps cleanly." },
  { id: "mention-popover", label: "Mention pill row doesn't overflow; popover fits; empty-state renders when elements cleared." },
  { id: "results", label: "ResultsPanel: header wraps cleanly; collapsibles toggle; copy buttons reachable." },
  { id: "rounded", label: "No text clipped by rounded corners; safe bottom padding respected." },
];

const MOCK_FRAMES: SceneFrame[] = [
  {
    frameIndex: 0,
    elements: [
      {
        id: "el-1",
        category: "Subject",
        description: "A weathered desert traveler in ochre robes, hood drawn.",
        details:
          "Mid-shot, face partly shadowed by the hood; fabric is sun-faded with fine sand dust on the shoulders.",
      },
      {
        id: "el-2",
        category: "Background",
        description: "Endless rolling dunes under a hazy dusk sky.",
        details:
          "Horizon line low in the frame, soft gradient from peach to muted violet, distant ridges barely visible.",
      },
      {
        id: "el-3",
        category: "Lighting",
        description: "Low-angle warm key light skimming across the dunes.",
        details:
          "Long raking shadows, backlit particles of windblown sand glinting, gentle fill from sky bounce.",
      },
    ],
  },
];

const MOCK_SHOTS = [
  {
    shotName: "Shot 1 — Arrival",
    mainPrompt:
      "A lone desert traveler crests a dune at golden hour, robes fluttering, framed in a slow 35mm dolly-in.",
    negativePrompt: "blurry, oversaturated, modern clothing, text, watermark",
    cameraSuggestions: "35mm lens, slow dolly-in, eye-level, shallow depth of field.",
    modelNotes: "Emphasize cinematic grain and warm tonal range.",
    suggestedAspectRatio: "2.39:1",
    suggestedDuration: "5s",
    recommendedModel: "veo-3",
    recommendedModelReason: "Strong with cinematic motion + natural lighting.",
  },
  {
    shotName: "Shot 2 — Reveal",
    mainPrompt:
      "Continuing from the prior beat, the camera tracks laterally to reveal a half-buried caravan in the distance, while the traveler pauses and lowers the hood. The light softens as a thin veil of mist rises off the cooling sand, and the color palette shifts from warm amber into cooler violet tones. The shot closes on a contemplative medium-close framing as particles of dust drift across the lens, catching the last rays of the sun and adding a painterly sparkle to the composition.",
    negativePrompt: "cartoonish, low detail, jitter, double exposure",
    cameraSuggestions: "50mm, lateral tracking then settle to medium-close, subtle handheld.",
    modelNotes: "Keep continuity of wardrobe and lighting direction from previous shot.",
    suggestedAspectRatio: "2.39:1",
    suggestedDuration: "6s",
    recommendedModel: "any",
  },
];

const useViewportWidth = () => {
  const [w, setW] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return w;
};

const SectionHeader = ({ title }: { title: string }) => {
  const w = useViewportWidth();
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/90 backdrop-blur border-b border-border flex items-center justify-between">
      <h2 className="text-sm font-display font-semibold text-foreground">{title}</h2>
      <span className="text-[11px] font-mono text-muted-foreground">{w}px</span>
    </div>
  );
};

const QaChecklist = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-display font-semibold text-foreground">Mobile QA checklist</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify at 360 / 390 / 414 / 440 px. Local-only, resets on reload.
        </p>
      </div>
      <ul className="space-y-2">
        {CHECKLIST.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <Checkbox
              id={`qa-${item.id}`}
              checked={!!checked[item.id]}
              onCheckedChange={(v) =>
                setChecked((c) => ({ ...c, [item.id]: v === true }))
              }
              className="mt-0.5"
            />
            <label
              htmlFor={`qa-${item.id}`}
              className="text-xs text-foreground leading-relaxed cursor-pointer"
            >
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

const QaMobileInner = () => {
  const [model, setModel] = useState("any");
  const [preview, setPreview] = useState<string | null>(null);
  const [directions, setDirections] = useState<ElementDirections>({
    "el-1": { action: "move", note: "" },
    "el-2": { action: "lock", note: "Keep dunes identical." },
    "el-3": { action: "move", note: "" },
  });
  const [mentionValue, setMentionValue] = useState(
    "Keep @2 locked while @1 walks forward into the frame.",
  );
  const [clearElements, setClearElements] = useState(false);
  const [simulateSafeArea, setSimulateSafeArea] = useState(false);
  const SAFE_AREA_PX = 34;

  const mentionElements = useMemo(() => {
    if (clearElements) return [];
    return MOCK_FRAMES[0].elements.map((el, i) => ({
      index: i + 1,
      category: el.category,
      description: el.description,
    }));
  }, [clearElements]);

  const handleImageSelect = (file: File) => {
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground relative"
      style={{
        paddingBottom: simulateSafeArea
          ? `calc(3rem + ${SAFE_AREA_PX}px)`
          : "3rem",
      }}
    >
      <header className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-display font-bold">Mobile QA — main flow</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Static harness — no auth, no uploads, no generation calls.
        </p>
      </header>

      <main className="px-4 space-y-8">
        <QaChecklist />

        <section className="rounded-xl border border-border bg-card/60 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-display font-semibold text-foreground">
                Simulate iOS safe-area
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reserves {SAFE_AREA_PX}px at the bottom (home indicator). Verify ResultsPanel
                bottom content stays reachable and isn't hidden under the overlay.
              </p>
            </div>
            <Button
              size="sm"
              variant={simulateSafeArea ? "default" : "outline"}
              onClick={() => setSimulateSafeArea((v) => !v)}
              aria-pressed={simulateSafeArea}
            >
              {simulateSafeArea ? "On" : "Off"}
            </Button>
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">
            simulated inset → {simulateSafeArea ? `${SAFE_AREA_PX}px` : "0px"}
          </p>
        </section>

        <section className="space-y-3">
          <SectionHeader title="1. Top bar + ModelPicker" />
          <ModelPicker model={model} onModelChange={setModel} />
        </section>

        <section className="space-y-3">
          <SectionHeader title="2. Upload phase" />
          <ImageUploadZone
            label="Start Frame"
            onImageSelect={handleImageSelect}
            onImageRemove={() => setPreview(null)}
            preview={preview}
          />
        </section>

        <section className="space-y-3">
          <SectionHeader title="3. Breakdown phase" />
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Elements: <span className="font-mono">{clearElements ? 0 : MOCK_FRAMES[0].elements.length}</span>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setClearElements((v) => !v)}
            >
              {clearElements ? "Restore elements" : "Clear elements"}
            </Button>
          </div>
          {!clearElements && (
            <SceneBreakdown
              frames={MOCK_FRAMES}
              frameLabels={["Start Frame"]}
              framePreviews={[null]}
              directions={directions}
              onDirectionsChange={setDirections}
            />
          )}
          <SceneMentionTextarea
            value={mentionValue}
            onChange={setMentionValue}
            elements={mentionElements}
            placeholder="Describe the motion. Type @ to mention an element."
          />
        </section>

        <section className="space-y-3">
          <SectionHeader title="4. Generate / Results phase" />
          <ResultsPanel
            results={MOCK_SHOTS}
            onRegenerate={() => {}}
            isLoading={false}
            modelLabel={model === "any" ? "Any Model" : model}
          />
        </section>
      </main>

      {simulateSafeArea && (
        <div
          aria-hidden
          className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none border-t border-dashed border-primary/40 bg-primary/10 backdrop-blur-[1px] flex items-center justify-center"
          style={{ height: `${SAFE_AREA_PX}px` }}
        >
          <span className="text-[10px] font-mono uppercase tracking-wider text-primary">
            simulated safe-area ({SAFE_AREA_PX}px)
          </span>
        </div>
      )}
    </div>
  );
};

const QaMobile = () => (
  <LanguageProvider>
    <TooltipProvider>
      <QaMobileInner />
    </TooltipProvider>
  </LanguageProvider>
);

export default QaMobile;
