import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "./OnboardingContext";

export const StepWelcome = () => {
  const { user } = useAuth();
  const { next } = useOnboarding();
  const fullName: string =
    (user?.user_metadata?.full_name as string) || user?.email?.split("@")[0] || "filmmaker";
  const firstName = fullName.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center max-w-xl mx-auto"
    >
      <h1 className="font-display font-bold text-3xl sm:text-5xl tracking-tight mb-4">
        Welcome to <span className="text-primary">MovPrompt</span>, {firstName}
      </h1>
      <p className="text-muted-foreground text-base sm:text-lg mb-10">
        Let's make your first cinematic prompt in 60 seconds.
      </p>
      <Button
        size="lg"
        onClick={next}
        className="gap-2 bg-[#F5A524] hover:bg-[#F5A524]/90 text-[#0A0A0B] font-semibold px-8"
      >
        Let's go <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
};
