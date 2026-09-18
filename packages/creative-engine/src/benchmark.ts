import { CREATIVE_TEMPLATE_CATALOG, getCreativeTemplate } from "./catalog.js";
import { compileCreativeDirection } from "./prompt-compiler.js";
import { ENGINE_VERSION, type CreativeBrief, type CompiledCreativeDirection } from "./types.js";
import { z } from "zod";

export type BenchmarkLanguage = "en" | "ar" | "bilingual";

export type BenchmarkBrief = {
  id: string;
  vertical: "salon" | "clinic" | "retail" | "ecommerce";
  language: BenchmarkLanguage;
  templateId: string;
  subjectName: string;
  confirmedFacts: string[];
  requiredRatio: "9:16" | "1:1" | "4:5" | "16:9";
  challenge: "identity" | "motion" | "arabic" | "conversion";
};

const SUBJECTS = {
  salon: ["صالون نوف", "جلسة عناية بالشعر", "خدمة أظافر", "باقة عروس"],
  clinic: ["عيادة الندى", "تنظيف أسنان", "استشارة بشرة", "جولة المرافق"],
  retail: ["عطر نور", "ساعة الديرة", "بوكس هدية", "قهوة مختصة"],
  ecommerce: ["متجر كِنزا", "سماعات لاسلكية", "حقيبة يومية", "تطبيق حجز"],
} as const;

const CHALLENGES = ["identity", "motion", "arabic", "conversion"] as const;
const RATIOS = ["9:16", "1:1", "4:5", "16:9"] as const;

/**
 * Fixed 48-brief corpus: four Kuwait launch verticals x three language modes x
 * four quality challenges. It is deterministic so provider comparisons remain
 * reproducible and cannot be cherry-picked between bake-offs.
 */
export const PROVIDER_BENCHMARK_CORPUS: BenchmarkBrief[] = (
  ["salon", "clinic", "retail", "ecommerce"] as const
).flatMap((vertical) => {
  const templates = CREATIVE_TEMPLATE_CATALOG.filter((template) => template.verticals.includes(vertical));
  return (["en", "ar", "bilingual"] as const).flatMap((language) =>
    CHALLENGES.map((challenge, index) => ({
      id: `${vertical}-${language}-${challenge}`,
      vertical,
      language,
      templateId: templates[index % templates.length]!.id,
      subjectName: SUBJECTS[vertical][index]!,
      confirmedFacts: [
        `subject:${SUBJECTS[vertical][index]}`,
        `price:${vertical === "clinic" ? "user-confirmed only" : `${(index + 1) * 3}.500 KWD`}`,
        "market:Kuwait",
        "cta:WhatsApp or booking destination supplied by user",
      ],
      requiredRatio: RATIOS[index]!,
      challenge,
    })),
  );
});

export const ProviderBenchmarkObservationSchema = z.object({
  providerKey: z.string().trim().min(1).max(160),
  briefId: z.string().trim().min(1).max(160),
  technicalSuccess: z.boolean(),
  usable: z.boolean(),
  productIdentity: z.number().min(0).max(100),
  promptAdherence: z.number().min(0).max(100),
  motionRealism: z.number().min(0).max(100),
  arabicDialect: z.number().min(0).max(100),
  latencyMs: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  errorCode: z.string().trim().min(1).max(240).optional(),
  providerRequestId: z.string().trim().min(1).max(500).optional(),
  artifactObjectKey: z.string().trim().min(1).max(1_024).optional(),
}).strict();

export type ProviderBenchmarkObservation = z.infer<typeof ProviderBenchmarkObservationSchema>;

export type ProviderBenchmarkScore = {
  providerKey: string;
  sampleSize: number;
  technicalSuccessRate: number;
  usableOutputRate: number;
  qualityScore: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  costPerUsableOutputUsd: number | null;
  corpusComplete: boolean;
  missingBriefIds: string[];
  duplicateBriefIds: string[];
  unexpectedBriefIds: string[];
  productIdentityPassRate: number;
  arabicDialectPassRate: number;
  approved: boolean;
};

export type ProviderBenchmarkExecutionResult = Omit<
  ProviderBenchmarkObservation,
  "providerKey" | "briefId" | "latencyMs"
>;

export type ProviderBenchmarkExecutionInput = {
  brief: BenchmarkBrief;
  creativeBrief: CreativeBrief;
  direction: CompiledCreativeDirection;
};

export type ProviderBenchmarkRun = {
  providerKey: string;
  corpusVersion: "kw-48-v1";
  startedAt: string;
  completedAt: string;
  observations: ProviderBenchmarkObservation[];
  score: ProviderBenchmarkScore;
};

function factValue(facts: readonly string[], key: string): string {
  return facts.find((fact) => fact.startsWith(`${key}:`))?.slice(key.length + 1).trim() ?? "";
}

/**
 * Builds the exact campaign contract used for a benchmark sample. The product,
 * campaign facts and story recipe are deterministic; only the provider output
 * may vary between runs.
 */
export function buildBenchmarkCreativeBrief(brief: BenchmarkBrief): CreativeBrief {
  const template = getCreativeTemplate(brief.templateId);
  if (!template.verticals.includes(brief.vertical)) {
    throw new Error(`benchmark_template_vertical_mismatch:${brief.id}`);
  }
  const price = factValue(brief.confirmedFacts, "price");
  return {
    engineVersion: ENGINE_VERSION,
    templateId: template.id,
    market: "KW",
    language: brief.language,
    arabicDialect: brief.language === "en" ? null : "kuwaiti",
    dialectRegister: template.dialectRegister,
    tone: template.tone,
    vertical: brief.vertical,
    goal: template.goals[0]!,
    product: {
      name: brief.subjectName,
      brand: "",
      description: `Fixed Kuwait benchmark subject for ${brief.vertical}; evaluate ${brief.challenge} without inventing facts.`,
      price: price === "user-confirmed only" ? "" : price.replace(/\s*KWD$/u, ""),
      offer: "",
      callToAction: brief.vertical === "salon" || brief.vertical === "clinic"
        ? "Book through the confirmed destination"
        : "Order through the confirmed WhatsApp destination",
      whatsapp: "+96550000000",
      location: "Kuwait",
    },
    scenes: template.scenes,
    qualityPolicy: template.qualityPolicy,
  };
}

export function compileBenchmarkDirection(brief: BenchmarkBrief): {
  creativeBrief: CreativeBrief;
  direction: CompiledCreativeDirection;
} {
  const creativeBrief = buildBenchmarkCreativeBrief(brief);
  return {
    creativeBrief,
    direction: compileCreativeDirection({
      rawPrompt: [
        `Execute the fixed MovPrompt benchmark brief ${brief.id}.`,
        `Primary challenge: ${brief.challenge}.`,
        `Required output ratio: ${brief.requiredRatio}.`,
        `Use only these confirmed facts: ${brief.confirmedFacts.join("; ")}.`,
      ].join(" "),
      creativeBrief,
    }),
  };
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)]!;
}

export function scoreProviderBenchmark(
  observations: ProviderBenchmarkObservation[],
): ProviderBenchmarkScore[] {
  const groups = new Map<string, ProviderBenchmarkObservation[]>();
  for (const observation of observations) {
    const group = groups.get(observation.providerKey) ?? [];
    group.push(observation);
    groups.set(observation.providerKey, group);
  }
  return [...groups.entries()].map(([providerKey, samples]) => {
    const successful = samples.filter((sample) => sample.technicalSuccess);
    const usable = samples.filter((sample) => sample.technicalSuccess && sample.usable);
    const counts = new Map<string, number>();
    for (const sample of samples) counts.set(sample.briefId, (counts.get(sample.briefId) ?? 0) + 1);
    const expectedIds = new Set(PROVIDER_BENCHMARK_CORPUS.map((brief) => brief.id));
    const missingBriefIds = [...expectedIds].filter((id) => !counts.has(id)).sort();
    const duplicateBriefIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort();
    const unexpectedBriefIds = [...counts.keys()].filter((id) => !expectedIds.has(id)).sort();
    const corpusComplete = missingBriefIds.length === 0 && duplicateBriefIds.length === 0 && unexpectedBriefIds.length === 0;
    const arabicBriefIds = new Set(
      PROVIDER_BENCHMARK_CORPUS.filter((brief) => brief.language !== "en").map((brief) => brief.id),
    );
    const arabicSamples = samples.filter((sample) => arabicBriefIds.has(sample.briefId));
    const productIdentityPassRate = samples.length
      ? samples.filter((sample) => sample.technicalSuccess && sample.productIdentity >= 80).length / samples.length
      : 0;
    const arabicDialectPassRate = arabicSamples.length
      ? arabicSamples.filter((sample) => sample.technicalSuccess && sample.arabicDialect >= 85).length / arabicSamples.length
      : 0;
    const qualityScore = samples.length
      ? Math.round(
          samples.reduce(
            (sum, sample) =>
              sum + (sample.technicalSuccess
                ? sample.productIdentity * 0.35 +
                  sample.promptAdherence * 0.25 +
                  sample.motionRealism * 0.2 +
                  sample.arabicDialect * 0.2
                : 0),
            0,
          ) / samples.length,
        )
      : 0;
    const technicalSuccessRate = samples.length ? successful.length / samples.length : 0;
    const usableOutputRate = samples.length ? usable.length / samples.length : 0;
    const totalCost = samples.reduce((sum, sample) => sum + sample.costUsd, 0);
    return {
      providerKey,
      sampleSize: samples.length,
      technicalSuccessRate,
      usableOutputRate,
      qualityScore,
      p50LatencyMs: percentile(samples.map((sample) => sample.latencyMs), 0.5),
      p95LatencyMs: percentile(samples.map((sample) => sample.latencyMs), 0.95),
      costPerUsableOutputUsd: usable.length ? Number((totalCost / usable.length).toFixed(4)) : null,
      corpusComplete,
      missingBriefIds,
      duplicateBriefIds,
      unexpectedBriefIds,
      productIdentityPassRate,
      arabicDialectPassRate,
      approved:
        corpusComplete &&
        technicalSuccessRate >= 0.98 &&
        usableOutputRate >= 0.8 &&
        qualityScore >= 85 &&
        productIdentityPassRate >= 0.95 &&
        arabicDialectPassRate >= 0.95,
    };
  });
}

/**
 * Executes the fixed corpus with bounded concurrency and a durable checkpoint
 * callback. Production callers must persist each observation before the next
 * paid sample so a process restart never loses cost or quality evidence.
 */
export async function runProviderBenchmark(options: {
  providerKey: string;
  execute: (input: ProviderBenchmarkExecutionInput) => Promise<ProviderBenchmarkExecutionResult>;
  briefs?: readonly BenchmarkBrief[];
  concurrency?: number;
  now?: () => number;
  onObservation?: (observation: ProviderBenchmarkObservation) => Promise<void> | void;
  existingObservations?: readonly ProviderBenchmarkObservation[];
  signal?: AbortSignal;
}): Promise<ProviderBenchmarkRun> {
  const providerKey = options.providerKey.trim();
  if (!providerKey) throw new Error("benchmark_provider_key_required");
  const briefs = [...(options.briefs ?? PROVIDER_BENCHMARK_CORPUS)];
  if (!briefs.length) throw new Error("benchmark_briefs_required");
  if (new Set(briefs.map((brief) => brief.id)).size !== briefs.length) {
    throw new Error("benchmark_brief_ids_must_be_unique");
  }
  const concurrency = options.concurrency ?? 1;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 4) {
    throw new Error("benchmark_concurrency_must_be_between_1_and_4");
  }
  const now = options.now ?? Date.now;
  const startedAtMs = now();
  const observations: Array<ProviderBenchmarkObservation | undefined> = new Array(briefs.length);
  const indexByBriefId = new Map(briefs.map((brief, index) => [brief.id, index]));
  const existingIds = new Set<string>();
  for (const observation of options.existingObservations ?? []) {
    const parsed = ProviderBenchmarkObservationSchema.parse(observation);
    if (parsed.providerKey !== providerKey) throw new Error("benchmark_checkpoint_provider_mismatch");
    const index = indexByBriefId.get(parsed.briefId);
    if (index === undefined) throw new Error(`benchmark_checkpoint_brief_unknown:${parsed.briefId}`);
    if (existingIds.has(parsed.briefId)) throw new Error("benchmark_checkpoint_brief_duplicate");
    existingIds.add(parsed.briefId);
    observations[index] = parsed;
  }
  const workIndices = briefs.map((_, index) => index).filter((index) => !observations[index]);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      if (options.signal?.aborted) throw new Error("benchmark_aborted");
      const workIndex = cursor;
      cursor += 1;
      if (workIndex >= workIndices.length) return;
      const index = workIndices[workIndex]!;
      const brief = briefs[index]!;
      const sampleStartedAt = now();
      let observation: ProviderBenchmarkObservation;
      try {
        const compiled = compileBenchmarkDirection(brief);
        const result = await options.execute({ brief, ...compiled });
        observation = ProviderBenchmarkObservationSchema.parse({
          providerKey,
          briefId: brief.id,
          ...result,
          latencyMs: Math.max(0, now() - sampleStartedAt),
        });
      } catch (error) {
        observation = ProviderBenchmarkObservationSchema.parse({
          providerKey,
          briefId: brief.id,
          technicalSuccess: false,
          usable: false,
          productIdentity: 0,
          promptAdherence: 0,
          motionRealism: 0,
          arabicDialect: 0,
          latencyMs: Math.max(0, now() - sampleStartedAt),
          costUsd: 0,
          errorCode: error instanceof Error ? error.message.slice(0, 240) : "benchmark_execution_failed",
        });
      }
      observations[index] = observation;
      await options.onObservation?.(observation);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, workIndices.length)) }, () => worker()));
  const completed = observations.map((observation) => {
    if (!observation) throw new Error("benchmark_observation_missing");
    return observation;
  });
  const score = scoreProviderBenchmark(completed)[0];
  if (!score) throw new Error("benchmark_score_missing");
  return {
    providerKey,
    corpusVersion: "kw-48-v1",
    startedAt: new Date(startedAtMs).toISOString(),
    completedAt: new Date(now()).toISOString(),
    observations: completed,
    score,
  };
}
