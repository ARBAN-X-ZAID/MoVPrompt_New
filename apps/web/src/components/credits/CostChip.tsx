import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  amount: number;
  /** Optional descriptive prefix, e.g. "≈" for estimates. */
  prefix?: string;
  /** Optional tooltip text (rendered as title attr). */
  title?: string;
  className?: string;
  size?: "xs" | "sm";
};

/**
 * Small inline cost indicator: `◆ 3`. Use anywhere a button or action will
 * deduct credits, so users know the price before clicking.
 */
export function CostChip({ amount, prefix, title, className, size = "xs" }: Props) {
  if (!amount || amount <= 0) return null;
  return (
    <span
      title={title ?? `Costs ${amount} credit${amount === 1 ? "" : "s"}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 text-accent tabular-nums",
        size === "xs" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
        className,
      )}
    >
      <Coins className={size === "xs" ? "w-2.5 h-2.5" : "w-3 h-3"} />
      <span>
        {prefix}
        {amount}
      </span>
    </span>
  );
}
