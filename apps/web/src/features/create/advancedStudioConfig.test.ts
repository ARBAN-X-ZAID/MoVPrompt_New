import { describe, expect, it } from "vitest";

import {
  advancedCampaignRecipe,
  buildAdvancedProjectConfiguration,
  providerCanvasRatio,
  type AdvancedStudioConfigurationInput,
} from "./advancedStudioConfig";
import type { CreationDraft } from "./contracts";

const base: AdvancedStudioConfigurationInput = {
  prompt: "Slow premium push-in on the confirmed product.",
  capability: "video.product_fidelity",
  duration: 8,
  ratio: "4:5",
  resolution: "720p",
  audio: false,
  cameraMove: "push-in",
  shotType: "macro",
  motion: "Calm",
  lighting: "Studio rim",
  fidelity: "Exact",
  selectedDirection: 3,
  selectedDirectionLabel: "Macro",
  sourceTemplateVersionId: "5a8231bc-9eb3-4cf5-9f0f-a970d5ef1494",
  references: [
    {
      id: "ref-1",
      name: "gold-light.webp",
      role: "Lighting",
      objectKey: "creator-assets/user/project/ref-1.webp",
      mimeType: "image/webp",
    },
  ],
};

describe("Advanced Studio generation truth", () => {
  it("maps the 4:5 delivery format to Seedance's supported 3:4 canvas", () => {
    expect(providerCanvasRatio("4:5")).toBe("3:4");
    expect(providerCanvasRatio("9:16")).toBe("9:16");
  });

  it("persists every interactive video control and only stable reference keys", () => {
    const configuration = buildAdvancedProjectConfiguration(base);
    expect(configuration.generation).toMatchObject({
      prompt: base.prompt,
      durationSeconds: 8,
      aspectRatio: "4:5",
      providerAspectRatio: "3:4",
      resolution: "720p",
      audio: false,
      cameraMove: "push-in",
      shotType: "macro",
      motion: "Calm",
      lighting: "Studio rim",
      fidelity: "Exact",
      direction: { index: 3, label: "Macro" },
      references: [
        {
          objectKey: "creator-assets/user/project/ref-1.webp",
          mimeType: "image/webp",
        },
      ],
    });
    expect(configuration.advanced).toMatchObject({
      capability: "video.product_fidelity",
      renderSettings: {
        duration: 8,
        ratio: "4:5",
        providerRatio: "3:4",
        resolution: "720p",
        audio: false,
        camera: "push-in",
        shot: "macro",
        motion: "Calm",
        lighting: "Studio rim",
        fidelity: "Exact",
        direction: 3,
      },
    });
  });

  it("supports a truthful 480p preview tier and keeps it in the campaign recipe", () => {
    const configuration = buildAdvancedProjectConfiguration({ ...base, resolution: "480p" });
    expect(configuration.generation).toMatchObject({ resolution: "480p" });
    expect(advancedCampaignRecipe(null, "1:1", "480p", true)).toMatchObject({
      aspectRatio: "1:1",
      resolution: "480p",
      audio: true,
    });
  });

  it("preserves the confirmed CTA and campaign facts when Advanced forks a template", () => {
    const source = {
      campaign: {
        ...advancedCampaignRecipe(null, "9:16", "720p", true),
        cta: "Book on WhatsApp",
        offer: "20% launch offer",
        whatsapp: "+96550000000",
      },
    } as CreationDraft;
    expect(advancedCampaignRecipe(source, "16:9", "480p", false)).toMatchObject({
      cta: "Book on WhatsApp",
      offer: "20% launch offer",
      whatsapp: "+96550000000",
      aspectRatio: "16:9",
      resolution: "480p",
      audio: false,
    });
  });

  it("does not send browser-only reference keys to the provider", () => {
    const configuration = buildAdvancedProjectConfiguration({
      ...base,
      references: [{ id: "local", name: "local.png", role: "Style" }],
    });
    expect(configuration.generation).toMatchObject({ references: [] });
    expect(configuration.advanced).toMatchObject({
      references: [{ id: "local", name: "local.png", role: "Style" }],
    });
  });
});
