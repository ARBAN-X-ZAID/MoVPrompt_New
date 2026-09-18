import type { CampaignGoal } from "@movprompt/contracts";

import { cn } from "@/lib/utils";
import { CAMPAIGN_GOAL_OPTIONS } from "./types";

const ARABIC_OUTCOMES: Record<CampaignGoal, string> = {
  whatsapp_orders: "الحصول على طلبات واتساب",
  bookings: "الحصول على حجوزات",
  launch: "إطلاق شيء جديد",
  offer: "الترويج لعرض",
  demonstration: "شرح المنتج أو الخدمة",
  education: "شرح فكرة مفيدة",
  announcement: "إعلان خبر مهم",
  trust: "بناء الثقة",
  brand_story: "رواية قصة العلامة التجارية",
};

export function OutcomeStep({
  value,
  onChange,
  arabic = false,
  goals,
}: {
  value: CampaignGoal;
  onChange: (goal: CampaignGoal) => void;
  arabic?: boolean;
  goals?: readonly CampaignGoal[];
}) {
  const options = CAMPAIGN_GOAL_OPTIONS.filter(option => !goals || goals.includes(option.value));
  const hasSelection = options.some(option => option.value === value);
  const heading = arabic ? "ماذا تريد أن تحقق هذه الحملة؟" : "What do you want this campaign to do?";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const isPrevious = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
    if (isPrevious || isNext) {
      event.preventDefault();
      const nextIndex = (index + (isNext ? 1 : -1) + options.length) % options.length;
      const next = options[nextIndex]!;
      onChange(next.value);
      document.getElementById(`campaign-outcome-${next.value}`)?.focus();
      return;
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onChange(options[index]!.value);
    }
  };

  return (
    <fieldset className="creator-outcome-step">
      <legend>{heading}</legend>
      <p>{arabic ? "اختر نتيجة واحدة. سنعرض قوالب مناسبة بناءً على التفاصيل التي أكّدتها." : "Choose one result. We’ll show templates that match the details you confirmed."}</p>
      <div className="creator-outcome-grid" role="radiogroup" aria-label={heading}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              id={`campaign-outcome-${option.value}`}
              className={cn("creator-outcome-option", selected && "is-selected")}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!hasSelection && index === 0) ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span>{arabic ? ARABIC_OUTCOMES[option.value] : option.label}</span>
              <small>{selected ? (arabic ? "تم الاختيار" : "Selected") : (arabic ? "اختر النتيجة" : "Choose result")}</small>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
