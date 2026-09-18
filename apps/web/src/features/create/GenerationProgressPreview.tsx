import { useState } from "react";
import type { RenderProcessingStage } from "@movprompt/contracts";
import { useLanguage } from "@/i18n/LanguageContext";
import { CreatorShell } from "./CreatorShell";
import { GenerationProgress } from "./GenerationProgress";

// Development-only status fixture: no jobs or provider calls are submitted.
export function GenerationProgressPreview() {
  const { locale } = useLanguage();
  const [startedAt] = useState(() => Date.now() - 120_000);
  const [stage, setStage] = useState<RenderProcessingStage>("rendering");
  const [error, setError] = useState("");
  return <CreatorShell qaMode><section className="creator-generation"><div className="creator-generation-inner">
    <h1>{locale === "ar" ? "معاينة تقدم التوليد" : "Generation progress preview"}</h1>
    <p>{locale === "ar" ? "حالات تجريبية فقط، بدون توليد فيديو." : "Simulated status only. No video generation."}</p>
    <GenerationProgress stage={stage} startedAt={startedAt} completedAt={["ready", "failed"].includes(stage) ? startedAt + 121_000 : null} lastCheckedAt={startedAt + 119_000} error={error} arabic={locale === "ar"} onRetry={() => setError("")} />
    <div className="creator-field"><label htmlFor="progress-preview-stage">Status preview</label><select id="progress-preview-stage" value={stage} onChange={event => {const next = event.target.value as RenderProcessingStage;setStage(next);setError(next === "failed" ? "Video creation failed. Your project is saved." : "");}}>
      <option value="preparing">Preparing</option><option value="rendering">Creating video</option><option value="securing_output">Saving video</option><option value="quality_review">Checking quality</option><option value="ready">Ready</option><option value="failed">Failed</option>
    </select></div>
    <button className="creator-button creator-button-secondary" type="button" onClick={() => setError("Status connection unavailable. Your project is saved.")}>Simulate connection error</button>
  </div></section></CreatorShell>;
}
