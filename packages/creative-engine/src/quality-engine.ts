import { findCreativeTemplate } from "./catalog.js";
import type { CreativeBrief, TemplateQualityPolicy } from "./types.js";

export type QualityDimension =
  | "technical"
  | "product_identity"
  | "prompt_adherence"
  | "motion_realism"
  | "visual_artifacts"
  | "brand_safety"
  | "dialect_fidelity"
  | "speech_sync"
  | "safe_zones"
  | "compliance";

export type QualityObservation = {
  dimension: QualityDimension;
  score: number;
  hardFailure?: boolean;
  evidence?: string;
};

export type QualityDecision = {
  status: "accepted" | "retry" | "needs_review" | "failed";
  score: number;
  failedDimensions: QualityDimension[];
  retryDirective?: string;
};

const WEIGHTS: Record<QualityDimension, number> = {
  technical: 0.12,
  product_identity: 0.2,
  prompt_adherence: 0.12,
  motion_realism: 0.09,
  visual_artifacts: 0.09,
  brand_safety: 0.08,
  dialect_fidelity: 0.1,
  speech_sync: 0.08,
  safe_zones: 0.05,
  compliance: 0.07,
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function retryDirective(failed: QualityDimension[]): string {
  const instructions: Partial<Record<QualityDimension, string>> = {
    product_identity: "Lock product silhouette, packaging, label, logo and colour more strictly to the primary reference",
    motion_realism: "Reduce simultaneous movement and use one physically plausible camera move per shot",
    visual_artifacts: "Simplify hands, reflections, fine geometry and background activity",
    prompt_adherence: "Follow the timecoded shot plan literally and remove decorative actions not requested",
    dialect_fidelity: "Use only the approved ar-KW script and native Kuwait Arabic delivery",
    speech_sync: "Regenerate visible dialogue with synchronized mouth movement, or remove the speaking presenter",
    safe_zones: "Reframe subjects away from deterministic copy, price, logo and CTA safe zones",
    technical: "Regenerate with stable duration, frame cadence, audio and delivery dimensions",
    compliance: "Remove unconfirmed claims, generated transformations and any implied guaranteed result",
    brand_safety: "Remove unsafe or misleading imagery while preserving the confirmed campaign facts",
  };
  return failed.map((item) => instructions[item]).filter(Boolean).join("; ");
}

export function evaluateAcceptedOutput(input: {
  observations: QualityObservation[];
  policy: TemplateQualityPolicy;
  attempt: number;
}): QualityDecision {
  const byDimension = new Map(input.observations.map((item) => [item.dimension, item]));
  const hardFailures = input.observations.filter((item) => item.hardFailure || item.score < 35);
  const score = Math.round(
    (Object.entries(WEIGHTS) as Array<[QualityDimension, number]>).reduce(
      (total, [dimension, weight]) => total + clamp(byDimension.get(dimension)?.score ?? 0) * weight,
      0,
    ),
  );
  const failedDimensions = (Object.keys(WEIGHTS) as QualityDimension[]).filter(
    (dimension) => (byDimension.get(dimension)?.score ?? 0) < (dimension === "product_identity" || dimension === "dialect_fidelity" ? 90 : 75),
  );
  if (!hardFailures.length && !failedDimensions.length && score >= input.policy.acceptanceScore) {
    return { status: "accepted", score, failedDimensions: [] };
  }
  if (input.attempt < input.policy.internalRetryLimit) {
    return { status: "retry", score, failedDimensions, retryDirective: retryDirective(failedDimensions) };
  }
  if (hardFailures.length || score < 65) return { status: "failed", score, failedDimensions };
  return { status: "needs_review", score, failedDimensions };
}

export function preflightCreativeBrief(brief: CreativeBrief): { passed: boolean; failures: string[] } {
  const failures: string[] = [];
  const duration = brief.scenes.reduce((total, scene) => total + scene.duration, 0);
  if (duration < 3 || duration > 60) failures.push("scene_duration_out_of_range");
  if (brief.language !== "en" && brief.arabicDialect !== "kuwaiti") failures.push("kuwaiti_dialect_required");
  if (!brief.product.name.trim()) failures.push("confirmed_subject_name_required");
  if (!findCreativeTemplate(brief.templateId)) failures.push("creative_template_unknown");
  if (brief.vertical === "clinic" && brief.scenes.some((scene) => /guarantee|cure|before.?after|نتيجة مضمونة|علاج نهائي/iu.test(`${scene.headline.en} ${scene.headline.ar} ${scene.voiceover.en} ${scene.voiceover.ar}`))) {
    failures.push("clinic_claim_not_allowed");
  }
  return { passed: failures.length === 0, failures };
}
