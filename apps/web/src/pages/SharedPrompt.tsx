import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clapperboard, Copy, Check, Eye, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";
import { fetchSharedPrompt, incrementShareViews } from "@/lib/sharePrompt";
import { getModelLabel } from "@/lib/models";
import { toast } from "sonner";

interface ShotResult {
  shotName?: string;
  mainPrompt: string;
  negativePrompt?: string;
  cameraSuggestions?: string;
  modelNotes?: string;
  suggestedAspectRatio?: string;
  suggestedDuration?: string;
  audioBlock?: string;
  cameraTags?: string;
}

interface SharedRecord {
  slug: string;
  title: string | null;
  workflow_type: string;
  target_model: string;
  agent_name: string | null;
  results: ShotResult[];
  view_count: number;
  created_at: string;
  expires_at: string | null;
}

const CopyBtn = ({ text, label = "Copy" }: { text: string; label?: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-[11px]"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied");
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="w-3 h-3 me-1" /> : <Copy className="w-3 h-3 me-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
};

const SharedPrompt = () => {
  const { slug = "" } = useParams<{ slug: string }>();
  const [record, setRecord] = useState<SharedRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchSharedPrompt(slug);
        if (cancelled) return;
        if (!data) {
          setError("This share link is not available or has expired.");
        } else {
          setRecord(data as unknown as SharedRecord);
          incrementShareViews(slug);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not load this share.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const modelLabel = useMemo(() => (record ? getModelLabel(record.target_model) : ""), [record]);
  const shotCount = record?.results?.length ?? 0;
  const pageTitle = record
    ? `${record.title || `${shotCount} cinematic prompt${shotCount === 1 ? "" : "s"}`} · MovPrompt`
    : "Shared prompts · MovPrompt";
  const pageDesc = record
    ? `${shotCount} ${shotCount === 1 ? "shot" : "shots"} for ${modelLabel}, generated with MovPrompt's AI Director of Photography.`
    : "A shared cinematic prompt set from MovPrompt.";

  const canonical = `https://movprompt.com/p/${slug}`;
  const ogImage = "https://movprompt.com/og-image.jpg";
  const jsonLd = record
    ? {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: record.title || `Cinematic prompt set for ${modelLabel}`,
        description: pageDesc,
        url: canonical,
        dateCreated: record.created_at,
        author: record.agent_name
          ? { "@type": "Person", name: record.agent_name }
          : { "@type": "Organization", name: "MovPrompt" },
        about: modelLabel,
      }
    : undefined;

  return (
    <div className="min-h-screen" style={{ background: "hsl(220 25% 4%)" }}>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonical} />
        <meta property="og:image" content={ogImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image" content={ogImage} />
        <link rel="canonical" href={canonical} />
        {jsonLd && (
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        )}
      </Helmet>

      <header className="border-b border-border/40 sticky top-0 z-10 backdrop-blur" style={{ backgroundColor: "hsl(220 25% 4% / 0.85)" }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <Clapperboard className="w-5 h-5 text-brand group-hover:scale-110 transition-transform" />
            <span className="font-display font-semibold text-sm">MovPrompt</span>
          </Link>
          <Button asChild size="sm" variant="default">
            <Link to="/">
              <Sparkles className="w-3.5 h-3.5 me-1.5" />
              Make your own
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">Loading share…</p>
          </div>
        )}

        {error && !loading && (
          <Card className="border-destructive/30">
            <CardContent className="py-10 text-center space-y-3">
              <h1 className="font-display text-xl font-semibold">Link unavailable</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button asChild variant="default" className="mt-2">
                <Link to="/">
                  <ArrowLeft className="w-4 h-4 me-1.5" />
                  Go to MovPrompt
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {record && !loading && (
          <>
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap text-[11px] uppercase tracking-wider text-muted-foreground font-display">
                <span className="rounded-full border border-primary/30 bg-primary/10 text-primary px-2 py-0.5">
                  {modelLabel}
                </span>
                <span className="rounded-full border border-border bg-muted px-2 py-0.5">
                  {shotCount} {shotCount === 1 ? "shot" : "shots"}
                </span>
                {record.agent_name && (
                  <span className="rounded-full border border-accent/30 bg-accent/10 text-accent px-2 py-0.5 inline-flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {record.agent_name}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 ms-auto normal-case tracking-normal text-[11px]">
                  <Eye className="w-3 h-3" /> {record.view_count + 1} views
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold leading-tight">
                {record.title || `Cinematic prompt set for ${modelLabel}`}
              </h1>
              <p className="text-sm text-muted-foreground">
                Shared from MovPrompt — copy any prompt and paste straight into {modelLabel}.
              </p>
            </div>

            <div className="space-y-4">
              {record.results.map((shot, idx) => (
                <Card key={idx} className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="font-display text-base flex items-center gap-2">
                      <span className="text-primary font-mono text-xs">SHOT {idx + 1}</span>
                      {shot.shotName && <span className="text-foreground/90">— {shot.shotName}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <section className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[11px] font-display uppercase tracking-wider text-primary">Main prompt</h2>
                        <CopyBtn text={shot.mainPrompt} />
                      </div>
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed rounded-md border border-border bg-muted/40 p-3 text-foreground/90">
{shot.mainPrompt}
                      </pre>
                    </section>

                    {shot.negativePrompt && (
                      <section className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <h2 className="text-[11px] font-display uppercase tracking-wider text-muted-foreground">Negative</h2>
                          <CopyBtn text={shot.negativePrompt} />
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed rounded-md border border-border bg-muted/30 p-3 text-foreground/80">
{shot.negativePrompt}
                        </pre>
                      </section>
                    )}

                    <div className="grid sm:grid-cols-2 gap-3 text-xs">
                      {shot.cameraSuggestions && (
                        <div className="rounded-md border border-border bg-card/40 p-2.5">
                          <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1">Camera</div>
                          <p className="text-foreground/85 whitespace-pre-wrap">{shot.cameraSuggestions}</p>
                        </div>
                      )}
                      {shot.audioBlock && (
                        <div className="rounded-md border border-border bg-card/40 p-2.5">
                          <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1">Audio</div>
                          <p className="text-foreground/85 whitespace-pre-wrap">{shot.audioBlock}</p>
                        </div>
                      )}
                      {shot.modelNotes && (
                        <div className="rounded-md border border-border bg-card/40 p-2.5 sm:col-span-2">
                          <div className="text-[10px] font-display uppercase tracking-wider text-muted-foreground mb-1">Model notes</div>
                          <p className="text-foreground/85 whitespace-pre-wrap">{shot.modelNotes}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {shot.suggestedAspectRatio && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                          {shot.suggestedAspectRatio}
                        </span>
                      )}
                      {shot.suggestedDuration && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                          {shot.suggestedDuration}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-5 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-display text-base font-semibold">Want prompts like these?</h2>
                  <p className="text-xs text-muted-foreground">Upload any frame — MovPrompt's AI Director of Photography handles the rest.</p>
                </div>
                <Button asChild>
                  <Link to="/">
                    <Sparkles className="w-4 h-4 me-1.5" />
                    Try MovPrompt
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default SharedPrompt;
