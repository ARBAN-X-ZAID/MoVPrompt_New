import type { Hono } from "hono";
import { CATEGORY_PREVIEW_TEMPLATE_IDS } from "@movprompt/creative-engine";
import { ApiHttpError } from "./errors.js";
import type { ApiEnvironment } from "./request-context.js";

export interface TemplatePreviewStorage {
  previewsBucket: string | undefined;
  signDownload(input: { bucket: string; key: string }): Promise<{ url: string }>;
}

const LEGACY_DEMO_FILE = /^(luxury-product-reveal|whatsapp-sales-ad|food-beverage|salon-booking-offer|app-service)\.(mp4|jpg)$/;
const LAUNCH_POSTER_FILE = /^(premium-phone-reveal|phone-floating-ad|restaurant-food-hero|food-delivery-ad|fashion-product-showcase|luxury-fashion-reveal|cosmetic-product-commercial|perfume-advertisement|real-estate-property|business-service-promotion|new-york-billboard-takeover)\.jpg$/;
const APPROVED_LAUNCH_VIDEO_FILES = new Set(CATEGORY_PREVIEW_TEMPLATE_IDS.map((id) => `${id}.mp4`));

export function registerTemplatePreviewRoutes(app: Hono<ApiEnvironment>, storage?: TemplatePreviewStorage): void {
  app.get("/api/v1/template-previews/:version/:file", async context => {
    const file = context.req.param("file");
    const version = context.req.param("version");
    // Public access is limited to approved demos. Never sign caller-supplied customer keys.
    const approvedV1 = version === "v1" && (LEGACY_DEMO_FILE.test(file) || LAUNCH_POSTER_FILE.test(file) || APPROVED_LAUNCH_VIDEO_FILES.has(file));
    const approvedV3 = version === "v3" && /^(salon-booking-offer|app-service)\.(mp4|jpg)$/.test(file);
    if (!approvedV1 && !approvedV3) return context.notFound();
    context.header("cache-control", "no-store");
    if (!storage?.previewsBucket) {
      throw new ApiHttpError({ code: "template_preview_unavailable", message: "Template previews are not configured yet.", status: 503, retryable: true });
    }
    const signed = await storage.signDownload({ bucket: storage.previewsBucket, key: `templates/${version}/${file}` });
    return context.redirect(signed.url, 302);
  });
}
