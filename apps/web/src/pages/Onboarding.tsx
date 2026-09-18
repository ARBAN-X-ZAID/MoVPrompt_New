import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Seo } from "@/components/Seo";
import {
  OnboardingProvider,
  useOnboarding,
  TOTAL_STEPS,
  onboardingDoneKey,
  ONBOARDING_PENDING_KEY,
} from "@/components/onboarding/OnboardingContext";
import { StepWelcome } from "@/components/onboarding/StepWelcome";
import { StepStarterImage } from "@/components/onboarding/StepStarterImage";
import { StepWorkflow } from "@/components/onboarding/StepWorkflow";
import { StepModel } from "@/components/onboarding/StepModel";
import { StepGenerating } from "@/components/onboarding/StepGenerating";
import { StepReveal } from "@/components/onboarding/StepReveal";
import { StepQuickTips } from "@/components/onboarding/StepQuickTips";

const StepDots = () => {
  const { step } = useOnboarding();
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              active ? "w-6 bg-primary" : done ? "w-3 bg-primary/60" : "w-3 bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
};

const OnboardingInner = () => {
  const { step, goTo } = useOnboarding();
  const { user } = useAuth();
  const navigate = useNavigate();

  const finish = () => {
    try {
      localStorage.setItem(onboardingDoneKey(user?.id), "1");
      localStorage.removeItem(ONBOARDING_PENDING_KEY);
    } catch {
      /* ignore */
    }
    navigate("/", { replace: true });
  };

  const skip = () => {
    // Skip jumps to the quick tips so users still see the highlights.
    if (step < 7) goTo(7);
    else finish();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Seo title="Welcome — MovPrompt" description="Set up MovPrompt in 60 seconds." path="/onboarding" />


      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-4 max-w-5xl mx-auto">
        <span className="font-display font-bold text-sm tracking-tight">
          <span className="text-primary">Mov</span>Prompt
        </span>
        <StepDots />
        {step < 7 ? (
          <button
            onClick={skip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        ) : (
          <span className="w-8" />
        )}
      </header>

      <main className="relative z-10 px-4 sm:px-6 pt-6 pb-16 max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[calc(100vh-72px)]">
        {step === 1 && <StepWelcome />}
        {step === 2 && <StepStarterImage />}
        {step === 3 && <StepWorkflow />}
        {step === 4 && <StepModel />}
        {step === 5 && <StepGenerating />}
        {step === 6 && <StepReveal />}
        {step === 7 && <StepQuickTips onDone={finish} />}
      </main>
    </div>
  );
};

const Onboarding = () => (
  <OnboardingProvider>
    <OnboardingInner />
  </OnboardingProvider>
);

export default Onboarding;
