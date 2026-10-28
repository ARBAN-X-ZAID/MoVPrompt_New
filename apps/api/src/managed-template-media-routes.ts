import { z } from "zod";
import type { Hono } from "hono";
import type { Document } from "mongodb";
import type { AssetStorageGateway } from "./asset-storage.js";
import type { ApiEnvironment } from "./request-context.js";
import { parseAdminMediaRange } from "./admin/media-range.js";
import { templateMediaSlots } from "./admin/template-media.js";

export type PublishedTemplateMediaResolver = (
  versionId: string,
  slot: (typeof templateMediaSlots)[number],
  index: number,
) => Promise<Document | null>;
export function registerManagedTemplateMediaRoutes(
  app: Hono<ApiEnvironment>,
  resolve?: PublishedTemplateMediaResolver,
  storage?: AssetStorageGateway,
) {
  app.get("/api/v1/template-media/:versionId/:slot/:index", async (context) => {
    const id = z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .safeParse(context.req.param("versionId"));
    const slot = z
      .enum(templateMediaSlots)
      .safeParse(context.req.param("slot"));
    const index = z.coerce
      .number()
      .int()
      .min(0)
      .max(2)
      .safeParse(context.req.param("index"));
    if (!id.success || !slot.success || !index.success || !resolve || !storage)
      return context.notFound();
    const row = await resolve(id.data, slot.data, index.data);
    if (
      !row?.objectKey ||
      ![storage.assetsBucket, storage.outputsBucket].includes(row.bucket)
    )
      return context.notFound();
    const head = await storage.head(row.bucket, row.objectKey);
    const size = head.contentLength;
    if (
      !size ||
      size !== row.sizeBytes ||
      head.checksumSha256 !== row.checksumSha256
    )
      return context.notFound();
    const range = parseAdminMediaRange(context.req.header("range"), size);
    const type = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "video/mp4",
    ].includes(row.mimeType)
      ? row.mimeType
      : "application/octet-stream";
    context.header("Cache-Control", "no-store");
    context.header("X-Content-Type-Options", "nosniff");
    context.header("Content-Type", type);
    context.header("Accept-Ranges", "bytes");
    if (range === false) {
      context.header("Content-Range", `bytes */${size}`);
      return context.body(null, 416);
    }
    const length = range ? range.end - range.start + 1 : size;
    context.header("Content-Length", String(length));
    if (range)
      context.header(
        "Content-Range",
        `bytes ${range.start}-${range.end}/${size}`,
      );
    if (storage.stream) {
      const result = await storage.stream({
        bucket: row.bucket,
        key: row.objectKey,
        ...(range ? { range } : {}),
      });
      if (result.contentLength !== length) {
        await result.body.cancel();
        return context.notFound();
      }
      return new Response(result.body, {
        status: range ? 206 : 200,
        headers: context.res.headers,
      });
    }
    const result = await storage.get({
      bucket: row.bucket,
      key: row.objectKey,
      maxBytes: 64 * 1024 * 1024,
    });
    return context.body(
      new Uint8Array(
        range ? result.body.slice(range.start, range.end + 1) : result.body,
      ).buffer,
      range ? 206 : 200,
    );
  });
}
