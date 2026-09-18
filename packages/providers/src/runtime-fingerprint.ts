import { createHash } from "node:crypto";

function normalizedList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .sort();
}

function normalizedBoolean(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

/**
 * Non-secret activation fingerprint shared by API and worker. A heartbeat only
 * unlocks submissions when both processes agree on provider, storage and media
 * policy. Secret values are deliberately excluded; only their presence is used.
 */
export function generationRuntimeFingerprint(
  environment: Readonly<Record<string, string | undefined>>,
): string {
  const configuration = {
    applicationEnvironment: environment.APP_ENV?.trim() || "",
    developmentFreeGeneration: normalizedBoolean(environment.DEVELOPMENT_FREE_GENERATION),
    gatewayBaseUrl: environment.VERCEL_AI_GATEWAY_BASE_URL?.trim() || "",
    providerReady: normalizedBoolean(environment.MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY),
    gatewayKeyPresent: Boolean(environment.AI_GATEWAY_API_KEY?.trim()),
    capabilities: ["VIDEO_CINEMATIC", "VIDEO_PRODUCT_FIDELITY"].map((name) => {
      const prefix = `MOVPROMPT_CAPABILITY_${name}`;
      return {
        name,
        enabled: normalizedBoolean(environment[`${prefix}_ENABLED`]),
        adapterId: environment[`${prefix}_ADAPTER_ID`]?.trim() || "",
        modelId: environment[`${prefix}_MODEL_ID`]?.trim() || "",
      };
    }),
    generateAudio: normalizedBoolean(environment.VERCEL_GATEWAY_SEEDANCE_GENERATE_AUDIO),
    videoResolutionTier: environment.VERCEL_GATEWAY_SEEDANCE_RESOLUTION_TIER?.trim() || "",
    outputHosts: normalizedList(environment.PROVIDER_OUTPUT_ALLOWED_HOSTS),
    qualityModel: environment.MOVPROMPT_QUALITY_MODEL_ID?.trim() || "",
    qualityRubricVersion: environment.MOVPROMPT_QUALITY_RUBRIC_VERSION?.trim() || "",
    pricing: {
      version: environment.GENERATION_PRICING_VERSION?.trim() || "",
      quoteTtlSeconds: environment.GENERATION_QUOTE_TTL_SECONDS?.trim() || "",
      cinematic480p: environment.GENERATION_VIDEO_CINEMATIC_480P_CREDITS_PER_SECOND?.trim() || "",
      cinematic720p: environment.GENERATION_VIDEO_CINEMATIC_720P_CREDITS_PER_SECOND?.trim() || "",
      productFidelity480p:
        environment.GENERATION_VIDEO_PRODUCT_FIDELITY_480P_CREDITS_PER_SECOND?.trim() || "",
      productFidelity720p:
        environment.GENERATION_VIDEO_PRODUCT_FIDELITY_720P_CREDITS_PER_SECOND?.trim() || "",
    },
    storage: {
      accountId: environment.R2_ACCOUNT_ID?.trim() || "",
      region: "auto",
      assetsBucket: environment.R2_ASSETS_BUCKET?.trim() || "",
      outputsBucket: environment.R2_OUTPUTS_BUCKET?.trim() || "",
      previewsBucket: environment.R2_TEMPLATE_PREVIEWS_BUCKET?.trim() || "",
      credentialsPresent: Boolean(
        environment.R2_ACCESS_KEY_ID?.trim() && environment.R2_SECRET_ACCESS_KEY?.trim(),
      ),
    },
    ffmpegPath: environment.FFMPEG_PATH?.trim() || "",
    ffprobePath: environment.FFPROBE_PATH?.trim() || "",
  };
  return createHash("sha256").update(JSON.stringify(configuration)).digest("hex");
}
