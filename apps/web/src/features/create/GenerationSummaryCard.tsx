import { Clock, Languages, RectangleHorizontal, Sparkles, Wand2 } from "lucide-react";

import type { CreatorProject, CreatorResolution } from "./types";
import { getCreatorTemplate } from "./templates";
import { useCapabilities } from "./useCapabilities";
import { useLanguage } from "@/i18n/LanguageContext";

export interface GenerationSummaryCardProps {
  project: CreatorProject;
  resolution?: CreatorResolution;
}

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

export function GenerationSummaryCard({ project, resolution }: GenerationSummaryCardProps) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const capabilities = useCapabilities();
  const template = getCreatorTemplate(project.templateId);
  return (
    <section className="creator-generation-summary" aria-label={copy(ar, "What we'll send to the model", "ما سنرسله للنموذج")}>
      <h3>
        <Wand2 aria-hidden="true" />
        {copy(ar, "What we'll send to the model", "ما سنرسله للنموذج")}
      </h3>
      <dl className="creator-generation-summary-grid">
        <div className="creator-generation-summary-cell">
          <dt><Clock aria-hidden="true" /> {copy(ar, "Duration", "المدة")}</dt>
          <dd>{project.durationSeconds}{ar ? "ث" : "s"}</dd>
        </div>
        <div className="creator-generation-summary-cell">
          <dt><RectangleHorizontal aria-hidden="true" /> {copy(ar, "Format", "المقاس")}</dt>
          <dd>{project.aspectRatio}</dd>
        </div>
        <div className="creator-generation-summary-cell">
          <dt>{copy(ar, "Quality", "الجودة")}</dt>
          <dd>{resolution ?? project.resolution}</dd>
        </div>
        <div className="creator-generation-summary-cell">
          <dt><Languages aria-hidden="true" /> {copy(ar, "Language", "اللغة")}</dt>
          <dd>{project.language}</dd>
        </div>
        <div className="creator-generation-summary-cell">
          <dt><Sparkles aria-hidden="true" /> {copy(ar, "Model", "النموذج")}</dt>
          <dd>{capabilities.active.displayName}</dd>
        </div>
        <div className="creator-generation-summary-cell">
          <dt>{copy(ar, "Template", "القالب")}</dt>
          <dd>{ar ? template.nameAr : template.name}</dd>
        </div>
      </dl>
    </section>
  );
}
