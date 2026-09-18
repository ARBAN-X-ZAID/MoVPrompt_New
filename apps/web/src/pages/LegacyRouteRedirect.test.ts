import { describe, expect, it } from "vitest";

import { legacyRouteTarget } from "./legacyRouteTarget";

describe("legacy route compatibility", () => {
  it("moves legacy creator entries into the canonical advanced workspace", () => {
    expect(legacyRouteTarget("advanced")).toBe("/advanced");
    expect(legacyRouteTarget("template-builder")).toBe("/advanced/templates");
  });

  it("preserves a director session in Advanced History", () => {
    expect(legacyRouteTarget("director-session", "", "session 12")).toBe(
      "/advanced/history?session=session+12",
    );
  });

  it("routes video library traffic to Projects and other history without losing filters", () => {
    expect(legacyRouteTarget("library", "?tab=videos")).toBe("/projects");
    expect(legacyRouteTarget("library", "?tab=prompts&query=perfume")).toBe(
      "/advanced/history?tab=prompts&query=perfume",
    );
  });
});
