import type { AdminGenerationSummary } from "@movprompt/contracts";
export function generationTime(row: AdminGenerationSummary, ar: boolean) {
  if (row.elapsedSeconds === null) return ar ? "غير متاح" : "Unavailable";
  const seconds = row.elapsedSeconds;
  const formatted = seconds >= 60
    ? ar ? `${Math.floor(seconds / 60)} د ${seconds % 60} ث` : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`
    : ar ? `${seconds} ث` : `${seconds} sec`;
  return row.timing === "elapsed" ? `${ar ? "الوقت المنقضي" : "Elapsed"} · ${formatted}` : formatted;
}
