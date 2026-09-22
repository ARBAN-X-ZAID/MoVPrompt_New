import { describe, expect, it } from "vitest";
import { campaignOutputText, campaignTextPng } from "./campaign-output-text.js";

describe("deterministic campaign output text", () => {
  it("fails clearly instead of silently truncating an unreadable long destination", () => {
    expect(() => campaignTextPng({ callToAction: "Book now", bookingUrl: `https://example.com/${"a".repeat(2_000)}` }, 480, 854)).toThrow("shorten the offer or booking link");
  });
  it("uses saved generation facts, preserves exact destinations and ignores stale display fields", () => {
    expect(campaignOutputText({ creatorProject: { offer: "Stale offer" }, generation: {
      creativeBrief: { product: { callToAction: "Book now", offer: "20% off", whatsapp: "+96550000000", bookingUrl: "https://example.com/book" } },
    } })).toEqual({ callToAction: "Book now", offer: "20% off", whatsapp: "+96550000000", bookingUrl: "https://example.com/book" });
  });
  it("omits empty optional facts and supports a historical saved booking context", () => {
    expect(campaignOutputText({ creativeBrief: { product: { callToAction: "Learn more", offer: "  ", whatsapp: "" } }, templateQuoteContext: { bookingUrl: "https://example.com/book" } }))
      .toEqual({ callToAction: "Learn more", bookingUrl: "https://example.com/book" });
    expect(campaignOutputText({ prompt: "Advanced direction" })).toBeNull();
  });
  it("keeps the exact brand, description, phone, offer and call to action, and omits blanks", () => {
    expect(campaignOutputText({ creativeBrief: { product: {
      name: "Unused when brand is set",
      brand: "MovPrompt",
      description: "Kuwait campaign videos",
      offer: "20% off",
      whatsapp: "+965 5000 0000",
      callToAction: "Get started",
    } } })).toEqual({
      callToAction: "Get started",
      brand: "MovPrompt",
      description: "Kuwait campaign videos",
      offer: "20% off",
      whatsapp: "+965 5000 0000",
    });
    expect(campaignOutputText({ creativeBrief: { product: {
      name: "Salon Noor",
      brand: " ",
      description: "",
      callToAction: "Book now",
    } } })).toEqual({ callToAction: "Book now", brand: "Salon Noor" });
  });
  it("renders Arabic and exact contact text to a PNG without interpreting filter syntax", () => {
    const png = campaignTextPng({
      brand: "MovPrompt",
      description: "Kuwait campaign videos",
      callToAction: "احجز الآن",
      offer: "خصم 20%",
      whatsapp: "+96550000000",
      bookingUrl: "https://example.com/book?a=1&b=2",
    }, 480, 854);
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
