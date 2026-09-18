import { Check, CircleAlert, CircleDashed, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type SaveLifecycleState = "idle" | "saving" | "saved" | "error";

type SaveStatusIndicatorProps = {
  state: SaveLifecycleState;
  arabic?: boolean;
  className?: string;
};

const COPY = {
  en: {
    idle: "Not saved yet",
    saving: "Saving…",
    saved: "Changes saved",
    error: "Save failed — keep this tab open",
  },
  ar: {
    idle: "لم يتم الحفظ بعد",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ التغييرات",
    error: "تعذر الحفظ — اترك هذه الصفحة مفتوحة",
  },
} as const;

export function SaveStatusIndicator({ state, arabic = false, className }: SaveStatusIndicatorProps) {
  const Icon = state === "saved"
    ? Check
    : state === "saving"
      ? Loader2
      : state === "error"
        ? CircleAlert
        : CircleDashed;

  return (
    <span
      className={cn("creator-save-lifecycle", `is-${state}`, className)}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon className={state === "saving" ? "animate-spin" : undefined} aria-hidden="true" />
      {COPY[arabic ? "ar" : "en"][state]}
    </span>
  );
}
