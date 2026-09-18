import { describe, expect, it } from "vitest";

import { CampaignSourceSchema } from "@movprompt/contracts";

import {
  applyImportedFacts,
  confirmCampaignFacts,
  editFact,
  factsForReview,
  normalizeCampaignSource,
  requiredFactsForOutcome,
} from "./sourceFacts";

describe("campaign facts", () => {
  it("manual product tracer preserves stable fact values and asset identifiers", () => {
    const source = CampaignSourceSchema.parse({
      kind: "service_manual",
      subject: "product",
      assetKeys: ["creator-assets/user/project/product-image"],
      facts: [
        { field: "name", value: "Northfield No. 07", provenance: "manual" },
      ],
    });

    expect(normalizeCampaignSource(source)).toEqual(source);
  });

  it("normalizes every source kind without losing source facts or owned assets", () => {
    const sources = [
      { kind: "product_url", subject: "product", field: "name", value: "Imported product" },
      { kind: "business_url", subject: "service", field: "service_name", value: "Salon booking" },
      { kind: "product_upload", subject: "product", field: "description", value: "Uploaded product" },
      { kind: "real_footage", subject: "service", field: "service_details", value: "A real service tour" },
      { kind: "service_manual", subject: "service", field: "location", value: "Kuwait City" },
    ] as const;

    for (const item of sources) {
      const source = applyImportedFacts({
        kind: item.kind,
        subject: item.subject,
        assetKeys: ["creator-assets/user/project/source-asset"],
        facts: [],
      }, [{ field: item.field, value: item.value }]);

      expect(source).toMatchObject({
        kind: item.kind,
        subject: item.subject,
        assetKeys: ["creator-assets/user/project/source-asset"],
        facts: [{ field: item.field, value: item.value, provenance: "imported" }],
      });
    }
  });

  it("keeps provenance truthful when an imported fact is edited then confirmed", () => {
    const imported = applyImportedFacts({
      kind: "product_url",
      subject: "product",
      assetKeys: [],
      facts: [],
    }, [
      { field: "name", value: "Northfield No. 07" },
      { field: "description", value: "Premium fragrance" },
      { field: "price", value: "12.500" },
    ]);
    const edited = editFact(imported, "price", "13.000");
    const confirmed = confirmCampaignFacts(edited, ["name", "description", "price"]);

    expect(confirmed.facts).toEqual([
      { field: "name", value: "Northfield No. 07", provenance: "user_confirmed" },
      { field: "description", value: "Premium fragrance", provenance: "user_confirmed" },
      { field: "price", value: "13.000", provenance: "manual" },
    ]);
  });

  it("reports missing optional facts separately from outcome-required facts", () => {
    const source = applyImportedFacts({
      kind: "business_url",
      subject: "service",
      assetKeys: [],
      facts: [],
    }, [{ field: "service_name", value: "Noura Salon" }]);

    expect(requiredFactsForOutcome("bookings", "service")).toEqual(["service_name", "booking_url"]);
    expect(factsForReview(source, "bookings")).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "booking_url", state: "required_missing" }),
      expect.objectContaining({ field: "whatsapp", state: "not_added" }),
    ]));
  });
});
