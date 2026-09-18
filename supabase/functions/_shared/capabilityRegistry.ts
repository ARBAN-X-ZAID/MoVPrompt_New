export type CapabilityAlias =
  | "video.seedance.latest"
  | "video.omni_flash.latest"
  | "image.nano_banana.latest";

export type CapabilityDefinition = {
  alias: CapabilityAlias;
  kind: "video" | "image";
  enabled: boolean;
  provider: "fal" | "google" | "unconfigured";
  externalModelId: string | null;
  creditsPerSecond?: number;
};

export const CAPABILITY_REGISTRY: Record<CapabilityAlias, CapabilityDefinition> = {
  "video.seedance.latest": {
    alias: "video.seedance.latest",
    kind: "video",
    enabled: true,
    provider: "fal",
    externalModelId: "seedance-2.0-ref",
    creditsPerSecond: 18,
  },
  "video.omni_flash.latest": {
    alias: "video.omni_flash.latest",
    kind: "video",
    enabled: false,
    provider: "unconfigured",
    externalModelId: null,
  },
  "image.nano_banana.latest": {
    alias: "image.nano_banana.latest",
    kind: "image",
    enabled: true,
    provider: "google",
    externalModelId: "gemini-2.5-flash-image",
  },
};

export function isCapabilityAlias(value: string): value is CapabilityAlias {
  return value in CAPABILITY_REGISTRY;
}

export function resolveCapability(value: string, kind: "video" | "image") {
  if (!isCapabilityAlias(value)) throw new Error("unapproved_capability");
  const definition = CAPABILITY_REGISTRY[value];
  if (definition.kind !== kind) throw new Error("capability_kind_mismatch");
  if (!definition.enabled || !definition.externalModelId) throw new Error("capability_unavailable");
  return definition;
}
