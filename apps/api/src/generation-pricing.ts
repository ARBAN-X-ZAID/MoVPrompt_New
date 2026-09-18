import type { CapabilityAlias } from "@movprompt/contracts";
import {
  VERCEL_GATEWAY_SEEDANCE_FAST_MODEL_ID,
} from "@movprompt/providers";

const RATE_ENVIRONMENT_KEYS: Readonly<Partial<Record<CapabilityAlias, string>>> = {
  "video.cinematic": "GENERATION_VIDEO_CINEMATIC_CREDITS_PER_SECOND",
  "video.product_fidelity": "GENERATION_VIDEO_PRODUCT_FIDELITY_CREDITS_PER_SECOND",
  "image.product": "GENERATION_IMAGE_PRODUCT_CREDITS_PER_IMAGE",
};

type VideoResolution = "480p" | "720p";

const VIDEO_RATE_ENVIRONMENT_KEYS: Readonly<
  Record<Extract<CapabilityAlias, "video.cinematic" | "video.product_fidelity">, Record<VideoResolution, string>>
> = {
  "video.cinematic": {
    "480p": "GENERATION_VIDEO_CINEMATIC_480P_CREDITS_PER_SECOND",
    "720p": "GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND",
  },
  "video.product_fidelity": {
    "480p": "GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND",
    "720p": "GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND",
  },
};

export type GenerationPrice = {
  credits: number;
  breakdown: Array<{ label: string; credits: number }>;
};

export class GenerationPricingUnavailableError extends Error {
  constructor(readonly capability?: CapabilityAlias) {
    super("generation_pricing_unavailable");
    this.name = "GenerationPricingUnavailableError";
  }
}

export class InvalidGenerationConfigurationError extends Error {
  constructor(readonly code: "duration_required" | "duration_invalid") {
    super(code);
    this.name = "InvalidGenerationConfigurationError";
  }
}

export interface GenerationPricing {
  readonly version: string;
  readonly quoteTtlSeconds: number;
  readonly mode?: "paid" | "development-free";
  isAvailable(capability: CapabilityAlias): boolean;
  price(
    capability: CapabilityAlias,
    configuration: unknown,
    templateDurationSeconds?: number,
  ): GenerationPrice;
}

type PricingState = {
  version?: string;
  quoteTtlSeconds?: number;
  rates: Partial<Record<CapabilityAlias, number>>;
  videoRates: Partial<
    Record<Extract<CapabilityAlias, "video.cinematic" | "video.product_fidelity">, Partial<Record<VideoResolution, number>>>
  >;
  legacyVideoFixedResolution?: VideoResolution;
};

function positiveInteger(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function durationSeconds(
  configuration: unknown,
  fallback: number | undefined,
  limits: { minimum: number; maximum: number },
): number {
  const root = record(configuration);
  const nested = record(root?.generation);
  const candidate = nested?.durationSeconds ?? root?.durationSeconds ?? fallback;
  if (candidate === undefined) throw new InvalidGenerationConfigurationError("duration_required");
  if (
    !Number.isSafeInteger(candidate) ||
    Number(candidate) < limits.minimum ||
    Number(candidate) > limits.maximum
  ) {
    throw new InvalidGenerationConfigurationError("duration_invalid");
  }
  return Number(candidate);
}

function videoDurationLimits(
  environment: Readonly<Record<string, string | undefined>>,
  capability: Extract<CapabilityAlias, "video.cinematic" | "video.product_fidelity">,
): { minimum: number; maximum: number } {
  const prefix = capability === "video.cinematic" ? "VIDEO_CINEMATIC" : "VIDEO_PRODUCT_FIDELITY";
  const selectedModel = environment[`MOVPROMPT_CAPABILITY_${prefix}_MODEL_ID`]?.trim();
  if (environment.APP_ENV?.trim() === "local" && selectedModel === VERCEL_GATEWAY_SEEDANCE_FAST_MODEL_ID) {
    return { minimum: 2, maximum: 12 };
  }
  return { minimum: 4, maximum: 30 };
}

function videoResolution(configuration: unknown): VideoResolution {
  const root = record(configuration);
  const nested = record(root?.generation);
  const candidate = nested?.resolution ?? root?.resolution ?? "720p";
  if (candidate !== "480p" && candidate !== "720p") {
    throw new GenerationPricingUnavailableError();
  }
  return candidate;
}

function checkedCredits(rate: number, quantity: number): number {
  const credits = rate * quantity;
  if (!Number.isSafeInteger(credits) || credits <= 0) {
    throw new GenerationPricingUnavailableError();
  }
  return credits;
}

export function createGenerationPricingFromEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): GenerationPricing {
  const developmentFree = environment.APP_ENV?.trim() === "local"
    && environment.DEVELOPMENT_FREE_GENERATION?.trim().toLowerCase() === "true";
  const version = environment.GENERATION_PRICING_VERSION?.trim() || undefined;
  const quoteTtlSeconds = positiveInteger(environment.GENERATION_QUOTE_TTL_SECONDS);
  const state: PricingState = {
    ...(version === undefined ? {} : { version }),
    ...(quoteTtlSeconds === undefined ? {} : { quoteTtlSeconds }),
    rates: {},
    videoRates: {},
  };

  const fixedResolution = environment.GENERATION_VIDEO_FIXED_RESOLUTION?.trim();
  if (fixedResolution === "480p" || fixedResolution === "720p") {
    state.legacyVideoFixedResolution = fixedResolution;
  }

  for (const [capability, environmentKey] of Object.entries(RATE_ENVIRONMENT_KEYS) as Array<
    [CapabilityAlias, string]
  >) {
    const rate = positiveInteger(environment[environmentKey]);
    if (rate !== undefined) state.rates[capability] = rate;
  }

  for (const [capability, keys] of Object.entries(VIDEO_RATE_ENVIRONMENT_KEYS) as Array<
    [Extract<CapabilityAlias, "video.cinematic" | "video.product_fidelity">, Record<VideoResolution, string>]
  >) {
    const configured: Partial<Record<VideoResolution, number>> = {};
    for (const resolution of ["480p", "720p"] as const) {
      const rate = positiveInteger(environment[keys[resolution]]);
      if (rate !== undefined) configured[resolution] = rate;
    }
    if (Object.keys(configured).length) state.videoRates[capability] = configured;
  }

  const globallyAvailable = Boolean(state.version && state.quoteTtlSeconds);

  return {
    mode: developmentFree ? "development-free" : "paid",
    get version() {
      if (developmentFree) return "development-free-v1";
      if (!state.version) throw new GenerationPricingUnavailableError();
      return state.version;
    },
    get quoteTtlSeconds() {
      if (developmentFree) return 86_400;
      if (!state.quoteTtlSeconds) throw new GenerationPricingUnavailableError();
      return state.quoteTtlSeconds;
    },
    isAvailable(capability) {
      if (developmentFree) return capability !== "image.product";
      if (!globallyAvailable) return false;
      if (capability === "video.cinematic" || capability === "video.product_fidelity") {
        return Boolean(
          state.videoRates[capability]?.["480p"] ??
          state.videoRates[capability]?.["720p"] ??
          (state.legacyVideoFixedResolution ? state.rates[capability] : undefined),
        );
      }
      return state.rates[capability] !== undefined;
    },
    price(capability, configuration, templateDurationSeconds) {
      if (developmentFree) {
        if (capability === "image.product") {
          return { credits: 0, breakdown: [{ label: "Local development image generation", credits: 0 }] };
        }
        const resolution = videoResolution(configuration);
        const seconds = durationSeconds(
          configuration,
          templateDurationSeconds,
          videoDurationLimits(environment, capability as Extract<CapabilityAlias, "video.cinematic" | "video.product_fidelity">),
        );
        return {
          credits: 0,
          breakdown: [{ label: `Local development ${seconds}s ${resolution} video`, credits: 0 }],
        };
      }
      const rate = state.rates[capability];
      if (!globallyAvailable) {
        throw new GenerationPricingUnavailableError(capability);
      }

      if (capability === "image.product") {
        if (rate === undefined) throw new GenerationPricingUnavailableError(capability);
        const credits = checkedCredits(rate, 1);
        return { credits, breakdown: [{ label: "1 generated image", credits }] };
      }

      const resolution = videoResolution(configuration);
      const resolutionRate = capability === "video.cinematic" || capability === "video.product_fidelity"
        ? state.videoRates[capability]?.[resolution]
        : undefined;
      const legacyRate = state.legacyVideoFixedResolution === resolution ? rate : undefined;
      const effectiveRate = resolutionRate ?? legacyRate;
      if (effectiveRate === undefined) {
        throw new GenerationPricingUnavailableError(capability);
      }
      const seconds = durationSeconds(
        configuration,
        templateDurationSeconds,
        videoDurationLimits(environment, capability as Extract<CapabilityAlias, "video.cinematic" | "video.product_fidelity">),
      );
      const credits = checkedCredits(effectiveRate, seconds);
      return {
        credits,
        breakdown: [{ label: `${seconds} seconds of ${resolution} generated video`, credits }],
      };
    },
  };
}
