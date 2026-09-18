import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelPicker } from "@/components/ModelPicker";
import { useOnboarding } from "./OnboardingContext";

export const StepModel = () => {
  const { model, setModel, next } = useOnboarding();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-xl mx-auto"
    >
      <h2 className="font-display font-bold text-2xl sm:text-3xl text-center mb-2">
        Choose a target model
      </h2>
      <p className="text-muted-foreground text-center mb-8">
        Don't worry — you can change this anytime.
      </p>

      <div className="rounded-xl border border-border bg-secondary/20 p-4 sm:p-5">
        <ModelPicker model={model} onModelChange={setModel} />
      </div>

      <div className="mt-8 flex justify-center">
        <Button
          onClick={next}
          className="gap-2 bg-[#F5A524] hover:bg-[#F5A524]/90 text-[#0A0A0B] font-semibold"
        >
          Generate my first prompt <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
};
