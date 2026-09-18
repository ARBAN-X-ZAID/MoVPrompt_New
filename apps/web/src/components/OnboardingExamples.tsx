import { useLanguage } from "@/i18n/LanguageContext";
import exampleTokyo from "@/assets/example-tokyo.jpg";
import exampleDesert from "@/assets/example-desert.jpg";
import examplePortrait from "@/assets/example-portrait.jpg";

export interface OnboardingExample {
  src: string;
  alt: string;
  workflow: "single" | "twoframe" | "multishot";
}

export const ONBOARDING_EXAMPLES: OnboardingExample[] = [
  { src: exampleTokyo, alt: "Neon Tokyo alley", workflow: "single" },
  { src: exampleDesert, alt: "Desert at golden hour", workflow: "multishot" },
  { src: examplePortrait, alt: "Rainy window portrait", workflow: "single" },
];

interface OnboardingExamplesProps {
  onPick: (example: OnboardingExample) => void;
}

export const OnboardingExamples = ({ onPick }: OnboardingExamplesProps) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground/80">
          {t("onboarding.tryExample" as any)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {ONBOARDING_EXAMPLES.map((ex, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(ex)}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-primary/20 hover:border-primary/60 transition-all hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`${t("onboarding.useExample" as any)}: ${ex.alt}`}
          >
            <img
              src={ex.src}
              alt={ex.alt}
              loading="lazy"
              width={512}
              height={512}
              className="w-full h-full object-cover transition-transform group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
            <span className="absolute inset-x-1.5 bottom-1.5 text-[11px] font-medium text-foreground/95 leading-tight text-left drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
              {ex.alt}
            </span>
          </button>

        ))}
      </div>
      <p className="text-xs text-muted-foreground/80 leading-relaxed text-center px-1">
        {t("onboarding.description" as any)}
      </p>
    </div>
  );
};
