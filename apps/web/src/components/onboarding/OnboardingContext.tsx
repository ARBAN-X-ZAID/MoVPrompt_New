import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type OnboardingWorkflow = "single" | "twoframe" | "multishot";

interface OnboardingState {
  step: number;
  imageUrl: string | null;
  imageFile: File | null;
  workflow: OnboardingWorkflow;
  model: string;
  result: string | null;
  setImage: (url: string | null, file: File | null) => void;
  setWorkflow: (w: OnboardingWorkflow) => void;
  setModel: (m: string) => void;
  setResult: (r: string | null) => void;
  next: () => void;
  prev: () => void;
  goTo: (n: number) => void;
}

const Ctx = createContext<OnboardingState | null>(null);

export const TOTAL_STEPS = 7;

export const ONBOARDING_DONE_PREFIX = "movprompt.onboarding.done";
export const ONBOARDING_PENDING_KEY = "movprompt.onboarding.pending";

export const onboardingDoneKey = (uid?: string | null) =>
  uid ? `${ONBOARDING_DONE_PREFIX}.${uid}` : `${ONBOARDING_DONE_PREFIX}.anon`;

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [step, setStep] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [workflow, setWorkflow] = useState<OnboardingWorkflow>("single");
  const [model, setModel] = useState("any");
  const [result, setResult] = useState<string | null>(null);

  const setImage = useCallback((url: string | null, file: File | null) => {
    setImageUrl(url);
    setImageFile(file);
  }, []);

  const value = useMemo<OnboardingState>(
    () => ({
      step,
      imageUrl,
      imageFile,
      workflow,
      model,
      result,
      setImage,
      setWorkflow,
      setModel,
      setResult,
      next: () => setStep((s) => Math.min(TOTAL_STEPS, s + 1)),
      prev: () => setStep((s) => Math.max(1, s - 1)),
      goTo: (n: number) => setStep(Math.max(1, Math.min(TOTAL_STEPS, n))),
    }),
    [step, imageUrl, imageFile, workflow, model, result, setImage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useOnboarding = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOnboarding must be used within OnboardingProvider");
  return v;
};
