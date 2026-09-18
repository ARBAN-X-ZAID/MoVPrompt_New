import { describe, expect, it } from "vitest";

import { CreativeBriefSchema } from "./types.js";

describe("creative engine types", () => {
  it("accepts the shared complete campaign outcome taxonomy", () => {
    for (const goal of [
      "whatsapp_orders",
      "bookings",
      "launch",
      "offer",
      "demonstration",
      "education",
      "announcement",
      "trust",
      "brand_story",
    ]) {
      expect(CreativeBriefSchema.shape.goal.parse(goal)).toBe(goal);
    }
  });
});
