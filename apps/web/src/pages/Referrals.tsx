import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Check, Clapperboard, Copy, Gift, Loader2, Share2, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import {
  buildReferralUrl,
  getOrCreateMyReferralCode,
  listMyReferrals,
  type ReferralRow,
} from "@/lib/referrals";
import { toast } from "sonner";

const Referrals = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState<string | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth?next=/referrals");
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([getOrCreateMyReferralCode(), listMyReferrals()])
      .then(([c, rows]) => {
        if (cancelled) return;
        setCode(c);
        setReferrals(rows);
      })
      .catch((e) => !cancelled && setError(e?.message || "Could not load referral data"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [user, authLoading, navigate]);

  const url = code ? buildReferralUrl(code) : "";

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1800);
  };

  const tweetHref = url
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        "I'm using MovPrompt to direct AI video like a real DP 🎬 — try it with my link:",
      )}&url=${encodeURIComponent(url)}`
    : "#";

  return (
    <div className="min-h-screen" style={{ background: "hsl(220 25% 4%)" }}>
      <Helmet>
        <title>Refer friends · MovPrompt</title>
        <meta name="description" content="Invite friends to MovPrompt and unlock perks for both of you." />
      </Helmet>

      <header className="border-b border-border/40 sticky top-0 z-10 backdrop-blur" style={{ backgroundColor: "hsl(220 25% 4% / 0.85)" }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <Clapperboard className="w-5 h-5 text-brand group-hover:scale-110 transition-transform" />
            <span className="font-display font-semibold text-sm">MovPrompt</span>
          </Link>
          <Button asChild size="sm" variant="ghost">
            <Link to="/"><ArrowLeft className="w-3.5 h-3.5 me-1.5" />Back</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-accent font-display">
            <Gift className="w-3.5 h-3.5" /> Referral program
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight">Invite a friend, both of you win.</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Share your personal link. When someone signs up through it, you'll see them appear below — and we'll credit perks to both accounts as they roll out.
          </p>
        </div>

        {(loading || authLoading) && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin me-2" /> Loading…
          </div>
        )}

        {error && !loading && (
          <Card className="border-destructive/30"><CardContent className="py-8 text-center text-sm">{error}</CardContent></Card>
        )}

        {!loading && code && (
          <>
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> Your invite link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                  <Button onClick={handleCopy} variant="secondary" className="shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button asChild variant="outline" size="sm">
                    <a href={tweetHref} target="_blank" rel="noopener noreferrer">
                      <Share2 className="w-3.5 h-3.5 me-1.5" /> Tweet
                    </a>
                  </Button>
                  <span className="text-[11px] text-muted-foreground self-center">
                    Code: <span className="font-mono text-foreground/80">{code}</span>
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-3 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-display">Friends joined</div>
                  <div className="font-display text-3xl font-semibold mt-1 inline-flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />{referrals.length}
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/60 sm:col-span-2">
                <CardContent className="p-4 text-xs text-muted-foreground space-y-1.5">
                  <div className="text-[11px] uppercase tracking-wider text-accent font-display">Perks (rolling out)</div>
                  <ul className="list-disc ps-4 text-foreground/85 space-y-0.5">
                    <li>Priority access to new model integrations.</li>
                    <li>Early invites to upcoming pro features.</li>
                    <li>Bonus generations once usage limits go live.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-sm">Recent signups</CardTitle>
              </CardHeader>
              <CardContent>
                {referrals.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No signups yet. Share your link to get started.
                  </p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {referrals.map((r) => (
                      <li key={r.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-mono text-foreground/70 truncate">{r.referred_user_id.slice(0, 8)}…</span>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Referrals;
