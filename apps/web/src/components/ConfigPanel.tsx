import { useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, Sparkles, X, Mic, Square, Loader2 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceCapture } from "@/lib/director/useVoiceCapture";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConfigPanelProps {
  description: string;
  onDescriptionChange: (v: string) => void;
}

export const ConfigPanel = ({ description, onDescriptionChange }: ConfigPanelProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useLanguage();
  const { user } = useAuth();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descRef = useRef(description);
  useEffect(() => {
    descRef.current = description;
  }, [description]);

  const { state, level, supported, start, stop, cancel } = useVoiceCapture({
    userId: user?.id ?? null,
    onTranscript: (text) => {
      const current = descRef.current;
      const next = current ? `${current.replace(/\s+$/, "")} ${text}` : text;
      onDescriptionChange(next);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
    onError: (msg) => toast.error(msg),
  });

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (state !== "recording") {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 250);
    return () => window.clearInterval(id);
  }, [state]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const showMic = supported && !!user;
  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";

  const charCount = description.length;

  return (
    <div className="space-y-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="rounded-lg border border-border/50 bg-card/40 p-3 sm:p-4 space-y-4">
          <CollapsibleTrigger className="group w-full flex items-start justify-between gap-3 text-start hover:bg-secondary/30 -m-2 p-2 rounded-md transition-colors">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Sparkles size={16} className="text-muted-foreground" />
                <h3 className="text-sm font-semibold font-display text-foreground">
                  {t("config.describeVision")}
                </h3>
                <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t("config.describeVision.optional")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("config.describeVisionHelper")}
              </p>
            </div>
            <ChevronDown
              size={18}
              className="text-muted-foreground mt-0.5 transition-transform group-data-[state=closed]:-rotate-90"
            />
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out overflow-hidden">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground/80">
                  {t("config.yourDescription")}
                </label>
                {charCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={t("config.clear")}
                    title={t("config.clear")}
                    className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                    onClick={() => onDescriptionChange("")}
                  >
                    <X className="w-3 h-3" />
                    <span className="hidden sm:inline">{t("config.clear")}</span>
                  </Button>
                )}
              </div>
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder={t("config.placeholder")}
                  className={cn(
                    "bg-secondary border-border resize-none min-h-[100px] pb-9",
                    showMic && "ps-12",
                  )}
                />
                {showMic && (
                  <div className="absolute bottom-2 start-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isRecording) stop();
                        else if (state === "idle" || state === "error") start();
                      }}
                      disabled={isTranscribing}
                      aria-label={
                        isRecording ? t("config.stopRecording") : t("config.record")
                      }
                      title={
                        isRecording ? t("config.stopRecording") : t("config.record")
                      }
                      className={cn(
                        "relative inline-flex items-center justify-center w-8 h-8 rounded-full border transition-colors",
                        isRecording
                          ? "bg-destructive text-destructive-foreground border-destructive"
                          : "bg-background/60 border-border text-muted-foreground hover:text-foreground hover:bg-background",
                        isTranscribing && "opacity-70 cursor-not-allowed",
                      )}
                    >
                      {isTranscribing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isRecording ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span
                            className="absolute inset-0 rounded-full border-2 border-destructive/60 animate-ping"
                            style={{ opacity: 0.4 + level * 0.6 }}
                          />
                        </>
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>
                    {isRecording && (
                      <>
                        <span className="text-[11px] tabular-nums text-destructive font-medium">
                          {formatTime(elapsed)}
                        </span>
                        <button
                          type="button"
                          onClick={cancel}
                          aria-label={t("config.cancelRecording")}
                          title={t("config.cancelRecording")}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-border bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                    {isTranscribing && (
                      <span className="text-[11px] text-muted-foreground">
                        {t("config.transcribing")}
                      </span>
                    )}
                  </div>
                )}
                <span className="absolute bottom-2 end-3 text-[10px] text-muted-foreground/70 pointer-events-none">
                  {t("config.charsCount").replace("{n}", String(charCount))}
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
};
