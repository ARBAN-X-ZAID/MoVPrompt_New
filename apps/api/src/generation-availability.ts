import type { GenerationAvailability } from "@movprompt/contracts";
import {
  MOVPROMPT_WORKER_SERVICE_NAME,
  type ServiceHeartbeatRepository,
} from "@movprompt/db";
import {
  generationRuntimeFingerprint,
  type CapabilityRegistry,
} from "@movprompt/providers";

import type { AssetStorageGateway } from "./asset-storage.js";
import type { GenerationPricing } from "./generation-pricing.js";

export interface GenerationAvailabilityService {
  evaluate(): Promise<GenerationAvailability>;
}

function unavailable(
  reason: Exclude<GenerationAvailability["reason"], null>,
  retryable = true,
): GenerationAvailability {
  return { status: "unavailable", reason, retryable };
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error("WORKER_HEARTBEAT_MAX_AGE_SECONDS invalid");
  return parsed;
}

export function createGenerationAvailabilityService(options: {
  enabled: boolean;
  environment: Readonly<Record<string, string | undefined>>;
  capabilities: CapabilityRegistry;
  pricing: GenerationPricing;
  storage?: Pick<AssetStorageGateway, "checkBuckets">;
  heartbeats: Pick<ServiceHeartbeatRepository, "findFreshReady">;
}): GenerationAvailabilityService {
  const expectedFingerprint = generationRuntimeFingerprint(options.environment);
  const maxAgeSeconds = positiveInteger(options.environment.WORKER_HEARTBEAT_MAX_AGE_SECONDS, 45);

  return {
    async evaluate() {
      if (!options.enabled) return unavailable("disabled", false);

      const qualityModel = options.environment.MOVPROMPT_QUALITY_MODEL_ID?.trim();
      if (
        !options.environment.AI_GATEWAY_API_KEY?.trim() ||
        !qualityModel ||
        !/^google\/gemini-[a-z0-9.-]+$/u.test(qualityModel) ||
        !options.environment.FFMPEG_PATH?.trim() ||
        !options.environment.FFPROBE_PATH?.trim()
      ) {
        return unavailable("quality_unavailable");
      }

      const requiredAliases = ["video.cinematic", "video.product_fidelity"] as const;
      if (
        requiredAliases.some(
          (alias) => !options.capabilities.listPublic().some((item) => item.alias === alias && item.available),
        )
      ) {
        return unavailable("capability_unavailable");
      }

      let pricingReady = true;
      try {
        for (const alias of requiredAliases) {
          for (const resolution of ["480p", "720p"] as const) {
            options.pricing.price(alias, {
              prompt: "runtime-readiness",
              durationSeconds: 4,
              resolution,
            });
          }
        }
      } catch {
        pricingReady = false;
      }
      if (!pricingReady) {
        return unavailable("pricing_unavailable");
      }

      if (!options.storage) return unavailable("storage_unavailable");
      try {
        await options.storage.checkBuckets();
      } catch {
        return unavailable("storage_unavailable");
      }

      const heartbeat = await options.heartbeats.findFreshReady({
        serviceName: MOVPROMPT_WORKER_SERVICE_NAME,
        maxAgeSeconds,
      });
      if (
        !heartbeat ||
        heartbeat.metadata.generationReady !== true ||
        heartbeat.metadata.configurationFingerprint !== expectedFingerprint
      ) {
        return unavailable("worker_unavailable");
      }

      return { status: "ready", reason: null, retryable: false };
    },
  };
}
