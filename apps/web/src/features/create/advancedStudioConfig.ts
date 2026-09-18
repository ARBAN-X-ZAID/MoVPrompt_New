import {
  GenerationConfigurationSchema,
  type JsonValue,
} from "@movprompt/contracts";

import type { ApprovedCapability, CampaignSettings, CreationDraft } from "./contracts";
import type { CreatorAspectRatio, CreatorResolution } from "./types";

export type AdvancedReferenceConfiguration = {
  id: string;
  name: string;
  role: "Style" | "Lighting" | "Setting" | "Motion";
  objectKey?: string;
  mimeType?: string;
};

export type AdvancedStudioConfigurationInput = {
  prompt: string;
  capability: ApprovedCapability;
  duration: number;
  ratio: CreatorAspectRatio;
  resolution: CreatorResolution;
  audio: boolean;
  cameraMove: "push-in" | "orbit" | "handheld" | "static";
  shotType: "macro" | "close" | "medium" | "wide";
  motion: "Calm" | "Natural" | "Dynamic";
  lighting: "Studio rim" | "Soft daylight" | "Golden hour" | "Night contrast";
  fidelity: "Exact" | "Strong" | "Flexible";
  selectedDirection: number;
  selectedDirectionLabel: string;
  sourceTemplateVersionId?: string;
  references: AdvancedReferenceConfiguration[];
};

export type AdvancedProjectConfiguration = Record<string, JsonValue>;

export function providerCanvasRatio(ratio: CreatorAspectRatio): "9:16" | "1:1" | "3:4" | "16:9" {
  return ratio === "4:5" ? "3:4" : ratio;
}

export function buildAdvancedGenerationConfiguration(input: AdvancedStudioConfigurationInput) {
  return GenerationConfigurationSchema.parse({
    prompt: input.prompt,
    durationSeconds: input.duration,
    // The delivery format remains 4:5 in the product contract. Seedance 2.5
    // maps it to its supported 3:4 canvas at the provider boundary.
    aspectRatio: input.ratio,
    resolution: input.resolution,
    audio: input.audio,
    providerAspectRatio: providerCanvasRatio(input.ratio),
    references: input.references.flatMap((reference) =>
      reference.objectKey && reference.mimeType
        ? [{ objectKey: reference.objectKey, mimeType: reference.mimeType }]
        : [],
    ),
    cameraMove: input.cameraMove,
    shotType: input.shotType,
    motion: input.motion,
    lighting: input.lighting,
    fidelity: input.fidelity,
    direction: {
      index: input.selectedDirection,
      label: input.selectedDirectionLabel,
    },
  });
}

export function buildAdvancedProjectConfiguration(
  input: AdvancedStudioConfigurationInput,
): AdvancedProjectConfiguration {
  const references = input.references.map((reference) => ({
    id: reference.id,
    name: reference.name,
    role: reference.role,
    ...(reference.objectKey ? { objectKey: reference.objectKey } : {}),
    ...(reference.mimeType ? { mimeType: reference.mimeType } : {}),
  }));
  return {
    generation: buildAdvancedGenerationConfiguration(input),
    advanced: {
      capability: input.capability,
      prompt: input.prompt,
      references,
      renderSettings: {
        duration: input.duration,
        ratio: input.ratio,
        providerRatio: providerCanvasRatio(input.ratio),
        resolution: input.resolution,
        audio: input.audio,
        camera: input.cameraMove,
        shot: input.shotType,
        motion: input.motion,
        lighting: input.lighting,
        fidelity: input.fidelity,
        direction: input.selectedDirection,
        directionLabel: input.selectedDirectionLabel,
      },
      ...(input.sourceTemplateVersionId
        ? { sourceTemplateVersionId: input.sourceTemplateVersionId }
        : {}),
    },
  };
}

export function advancedCampaignRecipe(
  source: CreationDraft | null,
  ratio: CreatorAspectRatio,
  resolution: CreatorResolution,
  audio: boolean,
): CampaignSettings {
  const fallback: CampaignSettings = {
    market: "KW",
    language: "en",
    arabicDialect: "kuwaiti",
    dialectRegister: "conversational",
    vertical: "ecommerce",
    goal: "launch",
    presenterMode: "none",
    location: "",
    bookingUrl: "",
    whatsapp: "",
    offer: "",
    cta: "Learn more",
    brandColor: "#d49737",
    aspectRatio: "9:16",
    resolution: "720p",
    subtitles: false,
    audio: true,
  };
  return {
    ...(source?.campaign ?? fallback),
    aspectRatio: ratio,
    resolution,
    audio,
  };
}
