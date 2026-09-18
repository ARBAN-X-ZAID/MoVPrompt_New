import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useVoiceCapture } from "@/lib/director/useVoiceCapture";

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
};

export function DescribeAdMic({ value, onChange, maxLength = 280 }: Props) {
  const { user } = useAuth();
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const { state, level, supported, start, stop, cancel } = useVoiceCapture({
    userId: user?.id ?? null,
    onTranscript: (text) => {
      const current = valueRef.current;
      const merged = current ? `${current.replace(/\s+$/, "")} ${text}` : text;
      onChange(merged.slice(0, maxLength));
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
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt) / 1000)),
      250,
    );
    return () => window.clearInterval(id);
  }, [state]);

  if (!supported || !user) return null;

  const isRecording = state === "recording";
  const isTranscribing = state === "transcribing";
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {isRecording && (
        <>
          <span className="text-[11px] tabular-nums text-destructive font-medium">
            {fmt(elapsed)}
          </span>
          <button
            type="button"
            onClick={cancel}
            aria-label="Cancel recording"
            title="Cancel recording"
            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-border/60 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => {
          if (isRecording) stop();
          else if (state === "idle" || state === "error") start();
        }}
        disabled={isTranscribing}
        aria-label={isRecording ? "Stop recording" : "Record description"}
        title={isRecording ? "Stop recording" : "Record description"}
        className={cn(
          "relative inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors",
          isRecording
            ? "bg-destructive text-destructive-foreground border-destructive"
            : "bg-background/60 border-border/60 text-muted-foreground hover:text-foreground hover:bg-background",
          isTranscribing && "opacity-70 cursor-not-allowed",
        )}
      >
        {isTranscribing ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isRecording ? (
          <>
            <Square className="w-3 h-3 fill-current" />
            <span
              className="absolute inset-0 rounded-full border-2 border-destructive/60 animate-ping"
              style={{ opacity: 0.4 + level * 0.6 }}
            />
          </>
        ) : (
          <Mic className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}
