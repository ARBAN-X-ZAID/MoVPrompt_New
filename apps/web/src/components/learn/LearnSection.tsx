import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface LearnSectionProps {
  id: string;
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}

export const LearnSection = forwardRef<HTMLElement, LearnSectionProps>(
  ({ id, title, eyebrow, children, className }, ref) => {
    return (
      <section
        id={id}
        ref={ref}
        className={cn("scroll-mt-24 py-8 border-t border-border/40 first:border-t-0 first:pt-0", className)}
      >
        {eyebrow && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">{eyebrow}</span>
        )}
        <h2 className="text-2xl sm:text-3xl font-display font-bold mt-1 mb-4 text-foreground">{title}</h2>
        <div className="space-y-4 text-sm sm:text-base text-muted-foreground leading-relaxed">{children}</div>
      </section>
    );
  },
);
LearnSection.displayName = "LearnSection";
