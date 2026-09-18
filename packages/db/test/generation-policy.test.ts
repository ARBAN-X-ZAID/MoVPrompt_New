import { describe, expect, it } from "vitest";

import {
  assertApprovedCapability,
  assertConfigurationHash,
  canonicalizeGenerationConfiguration,
  GenerationDomainError,
  hashGenerationConfiguration,
} from "../src/generation-policy";

describe("generation policy", () => {
  it("hashes semantically identical object configurations identically", () => {
    const first = {
      ratio: "9:16",
      duration: 8,
      nested: { audio: true, references: ["a", "b"] },
    };
    const second = {
      nested: { references: ["a", "b"], audio: true },
      duration: 8,
      ratio: "9:16",
    };

    expect(canonicalizeGenerationConfiguration(first)).toBe(canonicalizeGenerationConfiguration(second));
    expect(hashGenerationConfiguration(first)).toBe(hashGenerationConfiguration(second));
    expect(hashGenerationConfiguration(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects unapproved capabilities and malformed hashes", () => {
    expect(() => assertApprovedCapability("video.kling.latest")).toThrowError(
      expect.objectContaining<Partial<GenerationDomainError>>({ code: "unapproved_capability" }),
    );
    expect(() => assertConfigurationHash("not-a-sha256")).toThrowError(
      expect.objectContaining<Partial<GenerationDomainError>>({ code: "invalid_configuration_hash" }),
    );
  });

  it("rejects unstable configuration values", () => {
    expect(() => hashGenerationConfiguration({ value: Number.NaN })).toThrowError(
      expect.objectContaining<Partial<GenerationDomainError>>({ code: "invalid_configuration" }),
    );
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => hashGenerationConfiguration(circular)).toThrowError(
      expect.objectContaining<Partial<GenerationDomainError>>({ code: "invalid_configuration" }),
    );
  });
});
