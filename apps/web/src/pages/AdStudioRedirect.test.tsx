import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import AdStudioRedirect from "./AdStudioRedirect";

function Probe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

function visit(path: string) {
  render(<MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/ad-studio" element={<AdStudioRedirect />} />
    <Route path="/ad-studio/:slug" element={<AdStudioRedirect />} />
    <Route path="/ads" element={<AdStudioRedirect />} />
    <Route path="*" element={<Probe />} />
  </Routes></MemoryRouter>);
  return screen.getByTestId("location").textContent;
}

afterEach(cleanup);

describe("Ad Studio routes", () => {
  it.each(["/ad-studio", "/ads", "/ad-studio/ad-studio-brand-ad"])("opens the brand ad form from %s", path => {
    expect(visit(path)).toBe("/create?template=ad-studio-brand-ad");
  });

  it("keeps a saved draft and the sign-in return marker", () => {
    expect(visit("/ad-studio?draft=abc&resume=ready&utm=x")).toBe("/create?template=ad-studio-brand-ad&draft=abc&resume=ready");
  });

  it("sends old Ad Studio template links to their Templates page", () => {
    expect(visit("/ad-studio/female-product-review")).toBe("/templates/female-product-review");
  });
});
