import { motion } from "framer-motion";
import { ArrowRight, Film, ArrowLeftRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboarding, type OnboardingWorkflow } from "./OnboardingContext";
import loopTokyo from "@/assets/loop-tokyo.mp4.asset.json";
import loopDesert from "@/assets/loop-desert.mp4.asset.json";
import loopKitchen from "@/assets/loop-kitchen.mp4.asset.json";

const OPTIONS: Array<{
  id: OnboardingWorkflow;
  title: string;
  desc: string;
  icon: React.ElementType;
  video: string;
  recommended?: boolean;
}> = [
  {
    id: "single",
    title: "Single shot",
    desc: "One image → one cinematic prompt",
    icon: Film,
    video: (loopTokyo as any).url,
    recommended: true,
  },
  {
    id: "twoframe",
    title: "Start + End",
    desc: "Animate between two key frames",
    icon: ArrowLeftRight,
    video: (loopDesert as any).url,
  },
  {
    id: "multishot",
    title: "Multi-shot",
    desc: "Storyboard a sequence of shots",
    icon: LayoutGrid,
    video: (loopKitchen as any).url,
  },
];

export const StepWorkflow = () => {
  const { workflow, setWorkflow, next } = useOnboarding();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-3xl mx-auto"
    >
      <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-2">
        Pick a workflow
      </h2>
      <p className="text-muted-foreground text-center mb-8">
        You can switch any time inside the tool.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {OPTIONS.map((opt) => {
          const selected = workflow === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setWorkflow(opt.id)}
              className={`relative text-left rounded-xl border overflow-hidden transition-all ${
                selected
                  ? "border-primary ring-2 ring-primary/40 bg-primary/[0.04]"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="relative aspect-video bg-black">
                <video
                  src={opt.video}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-80"
                />
                {opt.recommended && (
                  <div className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-[#F5A524] text-[#0A0A0B]">
                    Most popular
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-semibold">{opt.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={next}
          className="gap-2 bg-[#F5A524] hover:bg-[#F5A524]/90 text-[#0A0A0B] font-semibold"
        >
          Continue <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};
