import { Clapperboard } from "lucide-react";

/** Marks work made in Ad Studio so it stands apart from template campaigns in Projects. */
export function AdStudioChip({ ar }: { ar: boolean }) {
  return <span className="creator-ad-studio-chip"><Clapperboard aria-hidden="true" />{ar ? "استوديو الإعلانات" : "Ad Studio"}</span>;
}
