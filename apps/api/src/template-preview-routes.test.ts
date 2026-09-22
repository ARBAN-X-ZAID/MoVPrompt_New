import { describe, expect, it, vi } from "vitest";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";
import { createApi } from "./app.js";
import { loadApiConfig } from "./config.js";

describe("private R2 template preview access", () => {
  it("allows twelve posters and only verified launch videos", async () => {
    const signDownload = vi.fn(async () => ({ url: "https://private.example.test/signed" }));
    const app = createApi({ templatePreviewStorage: { previewsBucket: "movprompt", signDownload } });
    for (const id of ["premium-phone-reveal", "phone-floating-ad", "restaurant-food-hero", "food-delivery-ad", "fashion-product-showcase", "luxury-fashion-reveal", "cosmetic-product-commercial", "perfume-advertisement", "female-product-review", "real-estate-property", "business-service-promotion", "new-york-billboard-takeover"]) {
      const response = await app.request(`/api/v1/template-previews/v1/${id}.jpg`);
      expect(response.status).toBe(302);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(signDownload).toHaveBeenLastCalledWith({ bucket: "movprompt", key: `templates/v1/${id}.jpg` });
    }
    for (const id of CATEGORY_PREVIEW_TEMPLATE_IDS) {
      expect((await app.request(`/api/v1/template-previews/v1/${id}.mp4`)).status).toBe(302);
      expect(signDownload).toHaveBeenLastCalledWith({ bucket: "movprompt", key: `templates/v1/${id}.mp4` });
    }
    for (const id of ["phone-floating-ad", "food-delivery-ad", "luxury-fashion-reveal", "cosmetic-product-commercial", "perfume-advertisement", "business-service-promotion", "real-estate-property", "new-york-billboard-takeover"].filter((id) => !(CATEGORY_PREVIEW_TEMPLATE_IDS as readonly string[]).includes(id))) {
      expect((await app.request(`/api/v1/template-previews/v1/${id}.mp4`)).status).toBe(404);
    }
    signDownload.mockClear();
    for (const path of ["users/a/projects/b/master.mp4", "v1/unknown.mp4", "v2/app-service.mp4", "v3/food-beverage.mp4", "v1/app-service.png", "v1/app-service.preview.mp4"]) {
      expect((await app.request(`/api/v1/template-previews/${path}`)).status).toBe(404);
    }
    expect(signDownload).not.toHaveBeenCalled();
  });
  it("serves only the two newly approved v3 demos", async () => {
    const signDownload = vi.fn(async () => ({ url: "https://private.example.test/signed" }));
    const app = createApi({ templatePreviewStorage: { previewsBucket: "movprompt", signDownload } });
    for (const id of ["salon-booking-offer", "app-service"]) {
      expect((await app.request(`/api/v1/template-previews/v3/${id}.mp4`)).status).toBe(302);
      expect(signDownload).toHaveBeenLastCalledWith({ bucket: "movprompt", key: `templates/v3/${id}.mp4` });
    }
  });
  it("reports missing storage rather than falling back to local files", async () => {
    const response = await createApi().request("/api/v1/template-previews/v1/premium-phone-reveal.jpg");
    expect(response.status).toBe(503);
  });
  it("applies CORS to redirects for the configured website", async () => {
    const app = createApi({ config: loadApiConfig({ WEB_ORIGIN: "http://localhost:8080" }), templatePreviewStorage: { previewsBucket: "movprompt", signDownload: async () => ({ url: "https://private.example.test/signed" }) } });
    const response = await app.request("/api/v1/template-previews/v1/app-service.jpg", { headers: { origin: "http://localhost:8080" } });
    expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:8080");
  });
});
