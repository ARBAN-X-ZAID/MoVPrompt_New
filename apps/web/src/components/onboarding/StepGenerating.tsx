import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useOnboarding } from "./OnboardingContext";
import { runOnboardingGenerate } from "@/lib/onboardingGenerate";
import { useToast } from "@/hooks/use-toast";

const FACTS = [
  "Rembrandt lighting puts a small triangle of light under the subject's eye.",
  "A 50mm lens roughly matches what the human eye sees.",
  "The 180-degree rule keeps spatial relationships consistent across cuts.",
  "Anamorphic lenses give that wide cinematic look and oval bokeh.",
  "Golden hour is the 60 minutes after sunrise and before sunset.",
  "A push-in slowly intensifies emotion; a pull-out reveals context.",
  "Dutch tilts signal unease or psychological tension.",
  "Negative space leads the eye and amplifies isolation.",
  "Practical lights inside the frame make scenes feel real.",
  "Color theory: teal and orange dominate modern blockbusters.",
];

export const StepGenerating = () => {
  const { imageFile, workflow, model, setResult, next } = useOnboarding();
  const { toast } = useToast();
  const [factIdx, setFactIdx] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const i = setInterval(() => setFactIdx((n) => (n + 1) % FACTS.length), 3500);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!imageFile) {
      toast({ title: "No image selected", variant: "destructive" });
      return;
    }
    (async () => {
      try {
        const prompt = await runOnboardingGenerate({ file: imageFile, workflow, targetModel: model });
        setResult(prompt);
        next();
      } catch (e: any) {
        toast({
          title: "Generation failed",
          description: e?.message || "Please try again.",
          variant: "destructive",
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center max-w-md mx-auto"
    >
      <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-6" />
      <h2 className="font-display font-bold text-xl sm:text-2xl mb-3">
        Composing your first cinematic prompt…
      </h2>
      <div className="h-12 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={factIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="text-sm text-muted-foreground italic px-4"
          >
            {FACTS[factIdx]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
