import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "./OnboardingContext";
import { useAuth } from "@/hooks/useAuth";
import { saveOnboardingResult } from "@/lib/onboardingGenerate";
import { useToast } from "@/hooks/use-toast";
import { Sparkles } from "./Sparkles";

export const StepReveal = () => {
  const { result, workflow, model, next } = useOnboarding();
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showSparks, setShowSparks] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSparks(false), 1100);
    return () => clearTimeout(t);
  }, []);

  // Auto-save to library on mount
  useEffect(() => {
    if (!user || !result) return;
    saveOnboardingResult({
      userId: user.id,
      workflow,
      targetModel: model,
      prompt: result,
    }).catch(() => {
      /* silent */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast({ title: "Copied!", description: "Prompt copied to clipboard." });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-2xl mx-auto relative"
    >
      {showSparks && <Sparkles />}
      <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-2">
        Here's your first cinematic prompt
      </h2>
      <p className="text-muted-foreground text-center mb-6 text-sm">
        Saved to your library automatically.
      </p>

      <div className="rounded-xl border border-primary/30 bg-[#0F0F11] p-5 mb-6 max-h-[280px] overflow-y-auto">
        <pre className="font-mono text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
          {result || "—"}
        </pre>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          onClick={copy}
          className="gap-2 bg-[#F5A524] hover:bg-[#F5A524]/90 text-[#0A0A0B] font-semibold"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          Copy prompt
        </Button>
        <Button variant="outline" onClick={next} className="gap-2">
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};
