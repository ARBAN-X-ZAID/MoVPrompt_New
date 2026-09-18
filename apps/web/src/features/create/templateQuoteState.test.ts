import { describe, expect, it } from "vitest";

import {
  beginTemplateQuote,
  createTemplateQuoteKey,
  expireTemplateQuote,
  invalidateTemplateQuote,
  quoteForGeneration,
  resolveTemplateQuote,
  unavailableTemplateQuote,
} from "./templateQuoteState";

const templateVersionId = "11111111-1111-4111-8111-111111111111";
const configuration = {
  prompt: "Create a Kuwait campaign.",
  aspectRatio: "9:16" as const,
  resolution: "720p" as const,
  audio: true,
  references: [],
  creativeBrief: {
    market: "KW",
    language: "en",
    goal: "launch",
    product: { name: "Confirmed product", callToAction: "Shop now" },
  },
};

const quote = {
  quoteId: null,
  capability: "video.product_fidelity" as const,
  credits: 80,
  entitlementEligible: false,
  configurationHash: "a".repeat(64),
  pricingVersion: "test-v1",
  expiresAt: "2026-08-20T15:00:00.000Z",
  breakdown: [{ label: "8 seconds", credits: 80 }],
  estimateOnly: true,
  requestId: "request-quote-1",
};

describe("template quote state", () => {
  it("keys a quote by the exact canonical configuration rather than catalog duration or price", () => {
    const first = createTemplateQuoteKey(templateVersionId, configuration);
    const same = createTemplateQuoteKey(templateVersionId, { ...configuration, creativeBrief: { ...configuration.creativeBrief } });
    const changed = createTemplateQuoteKey(templateVersionId, { ...configuration, audio: false });

    expect(first).toBe(same);
    expect(changed).not.toBe(first);
  });

  it("exposes a price only while the matching server quote is ready and unexpired", () => {
    const key = createTemplateQuoteKey(templateVersionId, configuration);
    const loading = beginTemplateQuote(key);
    const ready = resolveTemplateQuote(loading, quote, new Date("2026-08-20T14:00:00.000Z"));

    expect(loading.status).toBe("loading");
    expect(quoteForGeneration(loading, new Date("2026-08-20T14:00:00.000Z"))).toBeNull();
    expect(ready.status).toBe("ready");
    expect(quoteForGeneration(ready, new Date("2026-08-20T14:00:00.000Z"))?.credits).toBe(80);
    expect(quoteForGeneration(ready, new Date("2026-08-20T15:01:00.000Z"))).toBeNull();
  });

  it("keeps unavailable, expired, and changed quote states price-free and retryable", () => {
    const key = createTemplateQuoteKey(templateVersionId, configuration);
    const unavailable = unavailableTemplateQuote(beginTemplateQuote(key), {
      code: "pricing_unavailable",
      message: "Add a working booking link to continue.",
      retryable: true,
      requestId: "request-failure-1",
    });
    const expired = expireTemplateQuote(resolveTemplateQuote(beginTemplateQuote(key), quote, new Date("2026-08-20T14:00:00.000Z")));
    const changedKey = createTemplateQuoteKey(templateVersionId, { ...configuration, audio: false });
    const changed = beginTemplateQuote(changedKey, key);

    expect(unavailable).toMatchObject({ status: "unavailable", retryable: true, requestId: "request-failure-1" });
    expect(unavailable.failure?.message).toBe("Add a working booking link to continue.");
    expect(expired.status).toBe("expired");
    expect(changed.status).toBe("changed");
    expect(quoteForGeneration(unavailable, new Date())).toBeNull();
    expect(quoteForGeneration(expired, new Date())).toBeNull();
    expect(quoteForGeneration(changed, new Date())).toBeNull();
  });

  it("invalidates a ready quote immediately for price, duration and ratio edits", () => {
    const originalKey = createTemplateQuoteKey(templateVersionId, configuration);
    const ready = resolveTemplateQuote(beginTemplateQuote(originalKey), quote, new Date("2026-08-20T14:00:00.000Z"));
    const changedConfigurations = [
      { ...configuration, creativeBrief: { ...configuration.creativeBrief, product: { ...configuration.creativeBrief.product, price: "9.500" } } },
      { ...configuration, durationSeconds: 12 },
      { ...configuration, aspectRatio: "1:1" as const },
    ];

    for (const changedConfiguration of changedConfigurations) {
      const pending = invalidateTemplateQuote(createTemplateQuoteKey(templateVersionId, changedConfiguration));
      expect(pending.status).toBe("loading");
      expect(pending.key).not.toBe(ready.key);
      expect(quoteForGeneration(pending, new Date("2026-08-20T14:00:00.000Z"))).toBeNull();
    }
  });
});
