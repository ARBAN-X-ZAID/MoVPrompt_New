import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

import type { CreatorStep } from "./types";

export function CreatorProgress({
  current,
  steps,
  label,
  arabic,
}: {
  current: CreatorStep;
  steps: Array<{ id: CreatorStep; label: string }>;
  label: string;
  arabic: boolean;
}) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  const currentLabel = steps[currentIndex]?.label ?? label;
  const summary = arabic
    ? `الخطوة ${currentIndex + 1} من ${steps.length}: ${currentLabel}`
    : `Step ${currentIndex + 1} of ${steps.length}: ${currentLabel}`;

  return (
    <div className="creator-progress-wrap">
      <p className="creator-progress-current-step">{summary}</p>
      <div
        className="creator-progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={currentIndex + 1}
        aria-valuetext={`${currentLabel} (${currentIndex + 1} / ${steps.length})`}
      >
        {steps.map((step, index) => (
          <div key={step.id} aria-current={index === currentIndex ? "step" : undefined} className={cn("creator-progress-step", index === currentIndex && "is-current", index < currentIndex && "is-done")}>
            <span>{index < currentIndex ? <Check aria-hidden="true" /> : index + 1}</span>
            <span className="creator-progress-step-label">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
