import type { Hono } from "hono";
import { SaveBrandKitRequestSchema, BrandKitRecordSchema } from "@movprompt/contracts";
import type { ApiEnvironment } from "./request-context.js";
import type { AuthGateway } from "./auth-gateway.js";
import type { AssetRepository } from "./asset-repository.js";
import type { BrandKitRepository } from "./brand-kit-repository.js";
import { ApiHttpError } from "./errors.js";
import { createHash } from "node:crypto";
import type { AssetStorageGateway } from "./asset-storage.js";

export function registerBrandKitRoutes(app: Hono<ApiEnvironment>, services: { auth?: AuthGateway; repository?: BrandKitRepository; assets?: AssetRepository; storage?: AssetStorageGateway }): void {
  const error = (code: string, status: 400 | 401 | 404 | 409 | 503, message: string): never => { throw new ApiHttpError({ code, status, message }); };
  async function owner(headers: Headers) {
    const session = await services.auth?.getSession(headers);
    if (!session) return error("authentication_required", 401, "Sign in to use your saved brand kits.");
    if (!services.repository) return error("brand_kits_unavailable", 503, "Brand kits are temporarily unavailable.");
    return session.user.id;
  }
  app.get("/api/v1/brand-kits", async context => {
    const userId = await owner(context.req.raw.headers);
    return context.json({ kits: await services.repository!.list(userId), requestId: context.get("requestId") });
  });
  app.get("/api/v1/brand-kits/:id/logo", async context => {
    const userId = await owner(context.req.raw.headers);
    const id = context.req.param("id");
    if (!/^[0-9a-f]{24}$/i.test(id)) return error("invalid_brand_kit", 400, "Invalid brand kit.");
    const kit = await services.repository!.find(userId, id);
    if (!kit?.snapshot.logoChecksum) return error("brand_kit_not_found", 404, "Brand logo not found.");
    if (!services.storage) return error("brand_kits_unavailable", 503, "Brand storage is unavailable.");
    const logo = await services.storage.get({ bucket: services.storage.assetsBucket, key: `users/${userId}/brand-kits/logos/${kit.snapshot.logoChecksum}`, maxBytes: 10 * 1024 * 1024 });
    if (createHash("sha256").update(logo.body).digest("hex") !== kit.snapshot.logoChecksum) return error("invalid_brand_logo", 400, "The saved logo could not be verified.");
    context.header("Content-Type", logo.contentType ?? "image/png"); context.header("Cache-Control", "private, no-store"); context.header("X-Content-Type-Options", "nosniff");
    return context.body(new Uint8Array(logo.body).buffer);
  });
  app.post("/api/v1/brand-kits", async context => {
    const userId = await owner(context.req.raw.headers);
    const key = context.req.header("idempotency-key");
    if (!key || key.length > 200) return error("idempotency_key_required", 400, "A valid save key is required.");
    const parsed = SaveBrandKitRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!parsed.success) return error("invalid_brand_kit", 400, "Check the brand name, colors, contact details and logo.");
    const input = parsed.data;
    if (input.logoSource) {
      const asset = await services.assets?.findOwned(userId, input.logoSource.projectId, input.logoSource.assetId);
      if (!asset || asset.checksumSha256 !== input.logoSource.checksum || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType) || asset.sizeBytes <= 0) return error("invalid_brand_logo", 400, "Use a verified logo photo from your own campaign.");
      if (!services.storage) return error("brand_kits_unavailable", 503, "Brand storage is unavailable.");
      const logo = await services.storage.get({ bucket: asset.bucket, key: asset.objectKey, maxBytes: 10 * 1024 * 1024 });
      if (createHash("sha256").update(logo.body).digest("hex") !== input.logoSource.checksum) return error("invalid_brand_logo", 400, "The logo bytes do not match the verified photo.");
      // Library logos outlive project cleanup; each campaign gets its own private copy.
      await services.storage.put({ bucket: services.storage.assetsBucket, key: `users/${userId}/brand-kits/logos/${input.logoSource.checksum}`, body: logo.body, contentType: asset.mimeType, metadata: { "sha256-hex": input.logoSource.checksum } });
    }
    try {
      const kit = BrandKitRecordSchema.parse(await services.repository!.save(userId, key, input));
      return context.json({ kit, requestId: context.get("requestId") });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      if (code === "brand_kit_not_found") return error(code, 404, "Brand kit not found.");
      if (code === "brand_kit_revision_conflict" || code === "brand_kit_idempotency_conflict") return error(code, 409, "This brand kit changed. Reload it before saving again.");
      throw cause;
    }
  });
  app.post("/api/v1/brand-kits/:id/archive", async context => {
    const userId = await owner(context.req.raw.headers);
    const id = context.req.param("id");
    if (!/^[0-9a-f]{24}$/i.test(id)) return error("invalid_brand_kit", 400, "Invalid brand kit.");
    if (!await services.repository!.archive(userId, id)) return error("brand_kit_not_found", 404, "Brand kit not found.");
    return context.json({ archived: true, requestId: context.get("requestId") });
  });
}
