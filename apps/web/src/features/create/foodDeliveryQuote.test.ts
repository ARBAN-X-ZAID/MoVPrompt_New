import { TemplateCampaignPayloadSchema } from "@movprompt/contracts";
import { describe, expect, it } from "vitest";

import { buildPortableTemplateEstimateConfiguration } from "./projectStore";
import { createDraftProject, projectWithDuration } from "./templates";

describe("food delivery quote payload", () => {
  it("accepts a photo without a WhatsApp number at every offered length", () => {
    for (const seconds of [8, 15, 20]) {
      const base = createDraftProject("food-delivery-ad");
      const project = projectWithDuration({
        ...base,
        product: {
          ...base.product,
          images: [{
            id: "11111111-1111-4111-8111-111111111111",
            name: "phone.jpg",
            url: "blob:http://localhost/photo",
            mimeType: "image/jpeg",
            assetKey: `${base.id}/22222222-2222-4222-8222-222222222222`,
            source: "upload" as const,
          }],
        },
      }, seconds);
      const estimate = buildPortableTemplateEstimateConfiguration(project) as { templateCampaign?: unknown };
      expect(TemplateCampaignPayloadSchema.safeParse(estimate.templateCampaign).success).toBe(true);
    }
  });
});
