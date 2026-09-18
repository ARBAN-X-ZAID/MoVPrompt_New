import { motion } from "framer-motion";
import { Layers, Library as LibraryIcon, ArrowLeftRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const TIPS = [
  { icon: Layers, title: "8 supported AI models", desc: "Veo, Kling, Seedance, Runway and more — all from one tool." },
  { icon: LibraryIcon, title: "Saved automatically", desc: "Every prompt lands in your private library." },
  { icon: ArrowLeftRight, title: "Start + End transitions", desc: "Generate two-frame motion stories with one upload." },
];

interface Props {
  onDone: () => void;
}

export const StepQuickTips = ({ onDone }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-xl mx-auto"
    >
      <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-2">
        A few things to know
      </h2>
      <p className="text-muted-foreground text-center mb-8 text-sm">
        Quick tour of the four most-loved features.
      </p>

      <div className="space-y-3">
        {TIPS.map((tip) => {
          const Icon = tip.icon;
          return (
            <div
              key={tip.title}
              className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-4"
            >
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-sm">{tip.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{tip.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={onDone}
          className="gap-2 bg-[#F5A524] hover:bg-[#F5A524]/90 text-[#0A0A0B] font-semibold"
        >
          <Check className="w-4 h-4" /> Got it — start creating
        </Button>
      </div>
    </motion.div>
  );
};
