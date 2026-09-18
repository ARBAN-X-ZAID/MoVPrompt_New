import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

interface ExampleCardProps {
  image: string;
  alt: string;
  model: string;
  prompt: string;
}

export const ExampleCard = ({ image, alt, model, prompt }: ExampleCardProps) => {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
      <div className="aspect-video bg-muted/30">
        <img src={image} alt={alt} loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{model}</span>
          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-2 text-xs gap-1">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? t("results.copied" as any) : t("learn.copyPrompt" as any)}
          </Button>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed font-mono whitespace-pre-wrap">
          {prompt}
        </p>
      </div>
    </div>
  );
};
