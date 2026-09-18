import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Upload, FileVideo, Wand2, Save, RotateCcw, Trash2, Plus, X, Loader2, Clapperboard, ArrowRight } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trackPageVisit } from "@/lib/analytics";
import { useNavigate } from "react-router-dom";
import { Seo } from "@/components/Seo";
import {
  analyzeConcept,
  saveTemplate,
  listMyTemplates,
  deleteTemplate,
  uploadConceptVideo,
  fileToBase64,
  type AdTemplateJSON,
  type AdTemplateRow,
} from "@/lib/adTemplates";

type Mode = "text" | "video";

const EXAMPLE_CONCEPTS = [
  "Punchy 15s TikTok reveal for a sneaker drop — fast cuts, neon night city, close-up laces snap, hero pose, on-screen price tag.",
  "Aspirational 20s brand film for a coffee brand — slow gimbal glide, morning golden light, hands, steam macro, warm tones.",
  "9:16 UGC-style testimonial for a skincare product — selfie handheld, before/after cut, playful captions, upbeat pop bed.",
];

export default function TemplateWorkshop() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("text");
  const [description, setDescription] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [template, setTemplate] = useState<AdTemplateJSON | null>(null);
  const [conceptVideoUrl, setConceptVideoUrl] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState("");
  const [refining, setRefining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [myTemplates, setMyTemplates] = useState<AdTemplateRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    trackPageVisit("/movprompt");
    refresh();
  }, []);

  async function refresh() {
    try {
      setMyTemplates(await listMyTemplates());
    } catch (e: any) {
      /* silent */
    }
  }

  function onPickVideo(file: File | null) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Video too large. Please use under 25 MB.");
      return;
    }
    setVideoFile(file);
    setVideoUrl(URL.createObjectURL(file));
  }

  async function handleAnalyze() {
    if (mode === "text" && !description.trim()) {
      toast.error("Describe the concept or switch to video upload.");
      return;
    }
    if (mode === "video" && !videoFile) {
      toast.error("Upload a concept video first.");
      return;
    }
    setAnalyzing(true);
    setTemplate(null);
    try {
      let payload: any = { description };
      if (mode === "video" && videoFile) {
        // Upload to storage → pass signed URL AND base64 (base64 for vision, url for record).
        const { signedUrl } = await uploadConceptVideo(videoFile);
        setConceptVideoUrl(signedUrl);
        // Only inline base64 for small clips (Gemini vision handles frames)
        if (videoFile.size <= 8 * 1024 * 1024) {
          const b64 = await fileToBase64(videoFile);
          payload = { ...payload, video_base64: b64, video_mime: videoFile.type || "video/mp4" };
        } else {
          payload = { ...payload, video_url: signedUrl };
        }
      }
      const t = await analyzeConcept(payload);
      setTemplate(t);
      toast.success("Template draft ready — review and save.");
    } catch (e: any) {
      toast.error(e?.message || "Failed to generate template");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleRefine() {
    if (!template || !refineFeedback.trim()) return;
    setRefining(true);
    try {
      const t = await analyzeConcept({ refine_from: template, feedback: refineFeedback });
      setTemplate(t);
      setRefineFeedback("");
      toast.success("Template refined.");
    } catch (e: any) {
      toast.error(e?.message || "Refine failed");
    } finally {
      setRefining(false);
    }
  }

  async function handleSave() {
    if (!template) return;
    setSaving(true);
    try {
      await saveTemplate({
        template,
        concept_source: mode,
        concept_input: mode === "text" ? description : null,
        concept_video_url: conceptVideoUrl,
        status: "ready",
      });
      toast.success("Saved to your Ads templates.");
      setTemplate(null);
      setDescription("");
      setVideoFile(null);
      setVideoUrl(null);
      setConceptVideoUrl(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
      <Seo
        title="MovPrompt Template Workshop — Create Ad Templates"
        description="Design reusable AI ad templates. Describe a concept or upload a reference video, then save the template to your Ads library."
      />
      <TopNav />

      <div className="container max-w-[1200px] mx-auto px-4 py-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 text-sm text-primary/80 mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="uppercase tracking-widest text-xs">Template Workshop</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-semibold mb-2">
            Craft a reusable Ad Template
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Describe your concept or upload a reference video. AI turns it into a structured,
            re-skinnable ad template you can use inside the Ads tool.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
          {/* LEFT: Concept input */}
          <Card className="p-5 space-y-4">
            <div className="flex gap-2">
              <Button
                variant={mode === "text" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("text")}
              >
                <Wand2 className="w-4 h-4 mr-1.5" /> Describe concept
              </Button>
              <Button
                variant={mode === "video" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("video")}
              >
                <FileVideo className="w-4 h-4 mr-1.5" /> Upload reference video
              </Button>
            </div>

            {mode === "text" ? (
              <div className="space-y-3">
                <Textarea
                  placeholder="e.g. 15s TikTok product reveal for a matcha drink. Fast cuts, hands pour macro, condensation, upbeat lo-fi bed, punchy captions, CTA ‘Try today.’"
                  className="min-h-[160px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_CONCEPTS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setDescription(c)}
                      className="text-xs px-2.5 py-1 rounded-full border border-border/60 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition"
                    >
                      Example {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
                />
                {!videoFile ? (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border border-dashed border-border/70 hover:border-primary/60 rounded-lg py-10 flex flex-col items-center gap-2 transition hover:bg-primary/5"
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <div className="text-sm">Click to upload a concept video</div>
                    <div className="text-xs text-muted-foreground">MP4/MOV/WEBM · up to 25 MB</div>
                  </button>
                ) : (
                  <div className="relative rounded-lg overflow-hidden bg-black/40">
                    <video src={videoUrl ?? undefined} controls className="w-full max-h-[280px] object-contain" />
                    <button
                      onClick={() => {
                        setVideoFile(null);
                        setVideoUrl(null);
                      }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 rounded-full p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <Textarea
                  placeholder="Optional context: what you liked, what to abstract into placeholders, ad goal…"
                  className="min-h-[80px] resize-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}

            <Button onClick={handleAnalyze} disabled={analyzing} className="w-full">
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating template…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" /> Generate Template
                </>
              )}
            </Button>
          </Card>

          {/* RIGHT: Template preview */}
          <Card className="p-5">
            {!template && !analyzing && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center text-muted-foreground">
                <Clapperboard className="w-10 h-10 mb-3 opacity-40" />
                <p className="max-w-sm text-sm">
                  Your template will appear here — structured shots, pacing, camera language, sound design, and copy — ready to save to your Ads library.
                </p>
              </div>
            )}

            {analyzing && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing concept and drafting your template…</p>
              </div>
            )}

            {template && !analyzing && <TemplatePreview t={template} />}

            {template && !analyzing && (
              <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Refine (e.g. 'make pacing punchier, drop VO')"
                    value={refineFeedback}
                    onChange={(e) => setRefineFeedback(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRefine()}
                  />
                  <Button variant="outline" onClick={handleRefine} disabled={refining || !refineFeedback.trim()}>
                    {refining ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save to Ads templates
                  </Button>
                  <Button variant="outline" onClick={() => setTemplate(null)}>Discard</Button>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* My templates */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-heading">My Ad Templates</h2>
            <Button variant="outline" size="sm" onClick={() => navigate("/ads")}>
              Open Ads <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          {myTemplates.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border/60 rounded-lg py-8 text-center">
              You haven't saved any templates yet. Create one above.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {myTemplates.map((t) => (
                <Card key={t.id} className="p-4 hover:border-primary/50 transition group">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-medium truncate">{t.name}</div>
                    <button
                      onClick={async () => {
                        if (!confirm(`Delete "${t.name}"?`)) return;
                        try {
                          await deleteTemplate(t.id);
                          setMyTemplates((m) => m.filter((x) => x.id !== t.id));
                        } catch (e: any) {
                          toast.error(e?.message || "Delete failed");
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px]">{t.aspect_ratio}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{t.duration_seconds}s</Badge>
                    {(t.tags ?? []).slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplatePreview({ t }: { t: AdTemplateJSON }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-heading">{t.name}</h3>
          <Badge variant="secondary">{t.aspect_ratio}</Badge>
          <Badge variant="secondary">{t.duration_seconds}s</Badge>
          <Badge variant="outline">{t.goal}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{t.tagline}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="Pacing" value={t.pacing} />
        <Field label="Motion" value={t.motion_intensity} />
        <Field label="Camera" value={`${t.camera_language.style} · ${t.camera_language.lens}`} />
        <Field label="Movement" value={t.camera_language.movement} />
        <Field label="Lighting" value={t.lighting} />
        <Field label="Palette" value={t.color_palette} />
        <Field label="Music" value={t.sound_design.music} />
        <Field label="Voiceover" value={t.sound_design.voiceover} />
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Shots</div>
        <div className="space-y-2">
          {t.shots.map((s) => (
            <div key={s.index} className="border border-border/50 rounded-md p-2.5 bg-card/40">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-[10px]">#{s.index + 1}</Badge>
                <Badge variant="secondary" className="text-[10px]">{s.beat}</Badge>
                <span className="text-[10px] text-muted-foreground">{s.duration_s}s</span>
              </div>
              <div className="text-xs">{s.description}</div>
              <div className="text-[11px] text-muted-foreground mt-1">📷 {s.camera}</div>
              {s.on_screen_text && (
                <div className="text-[11px] text-primary/80 mt-0.5">“{s.on_screen_text}”</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ListBlock label="Hook options" items={t.hook_copy} />
        <ListBlock label="CTA options" items={t.cta_copy} />
      </div>

      <div className="flex flex-wrap gap-1">
        {t.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="text-[10px]">#{tag}</Badge>
        ))}
        {t.recommended_models.map((m) => (
          <Badge key={m} className="text-[10px] bg-primary/15 text-primary hover:bg-primary/20">{m}</Badge>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs">{value}</div>
    </div>
  );
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <ul className="space-y-1">
        {items.map((x, i) => (
          <li key={i} className="text-xs text-foreground/90">• {x}</li>
        ))}
      </ul>
    </div>
  );
}
