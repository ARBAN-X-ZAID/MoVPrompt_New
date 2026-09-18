import { useState } from "react";
import { Bug, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getDebugSnapshot } from "@/lib/debugRecorder";
import { cn } from "@/lib/utils";

type Props = {
  sessionId?: string | null;
  className?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  label?: string;
};

export function SendDebugReportButton({
  sessionId,
  className,
  variant = "outline",
  size = "sm",
  label = "Send debug report",
}: Props) {
  const [state, setState] = useState<"idle" | "working" | "done">("idle");

  const handleClick = async () => {
    setState("working");
    try {
      const snapshot = getDebugSnapshot({
        directorSessionId: sessionId ?? null,
        route: window.location.pathname + window.location.search,
      });
      const json = JSON.stringify(snapshot, null, 2);

      try {
        await navigator.clipboard.writeText(json);
      } catch {
        /* clipboard may be blocked — file download still works */
      }

      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debug-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setState("done");
      toast.success("Debug report ready", {
        description: "Saved as a file and copied to your clipboard. Share it with support.",
      });
      setTimeout(() => setState("idle"), 2500);
    } catch (err: any) {
      setState("idle");
      toast.error("Couldn't build debug report", {
        description: err?.message || "Try again.",
      });
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={state === "working"}
      className={cn("gap-1.5", className)}
    >
      {state === "working" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : state === "done" ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Bug className="w-3.5 h-3.5" />
      )}
      {label}
    </Button>
  );
}
