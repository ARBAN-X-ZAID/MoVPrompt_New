import type { Hono } from "hono";
import { AutoSaveLibraryPhotoSchema, LibraryKindSchema, LibrarySourceSchema, LibraryUploadRequestSchema, SaveLibraryEntrySchema } from "@movprompt/contracts";
import { ReferenceLibraryError, type ReferenceLibraryService } from "@movprompt/db";
import { AssetContentVerificationError } from "./asset-content-verifier.js";
import type { AuthGateway } from "./auth-gateway.js";
import type { ApiEnvironment } from "./request-context.js";
import { ApiHttpError } from "./errors.js";

export function registerReferenceLibraryRoutes(app: Hono<ApiEnvironment>, services: { auth?: AuthGateway; library?: ReferenceLibraryService }) {
  const path = "/api/v1/reference-library";
  app.get(`${path}/status`, context => context.json({ enabled: Boolean(services.library) }));
  const invalid = (message: string): never => { throw new ApiHttpError({ status: 400, code: "invalid_library_request", message }); };
  async function owner(headers: Headers) {
    const session = await services.auth?.getSession(headers);
    if (!session) throw new ApiHttpError({ status: 401, code: "authentication_required", message: "Sign in to use My assets." });
    if (headers.get("x-library-owner") && headers.get("x-library-owner") !== session.user.id) throw new ApiHttpError({ status: 409, code: "library_account_changed", message: "Your account changed. Reopen My assets." });
    if (!services.library) throw new ApiHttpError({ status: 503, code: "library_unavailable", message: "My assets is not available yet." });
    return session.user.id;
  }
  const key = (headers: Headers) => { const value = headers.get("idempotency-key"); return value && value.length >= 8 && value.length <= 200 ? value : invalid("A valid save key is required."); };
  const id = (value: string) => /^[0-9a-f]{24}$/i.test(value) || /^[0-9a-f-]{36}$/i.test(value) ? value : invalid("Invalid saved item.");
  app.use(`${path}/*`, async (_context, next) => {
    _context.header("Cache-Control", "private, no-store");
    try { await next(); }
    catch (error) {
      if (error instanceof ReferenceLibraryError || error instanceof AssetContentVerificationError) {
        const status = error.code === "not_found" ? 404 : error.code === "conflict" || error.code === "review_required" ? 409 : error.code === "unavailable" ? 503 : 400;
        throw new ApiHttpError({ status, code: `library_${error.code}`, message: error.message });
      }
      throw error;
    }
  });
  app.get(path, async context => {
    context.header("Cache-Control", "private, no-store");
    const user = await owner(context.req.raw.headers);
    const kind = context.req.query("kind");
    if (kind && !LibraryKindSchema.safeParse(kind).success) invalid("Choose products or presenters.");
    const result = await services.library!.list(user, { ...(kind ? { kind } : {}), ...(context.req.query("search") ? { search: context.req.query("search")!.slice(0, 120) } : {}), ...(context.req.query("cursor") ? { cursor: id(context.req.query("cursor")!) } : {}) });
    return context.json({ ...result, requestId: context.get("requestId") });
  });
  app.get(`${path}/session`, async context => context.json({ ownerId: await owner(context.req.raw.headers), requestId: context.get("requestId") }));
  app.get(`${path}/:id`, async context => {
    const user = await owner(context.req.raw.headers);
    return context.json({ entry: await services.library!.find(user, id(context.req.param("id"))), requestId: context.get("requestId") });
  });
  app.post(`${path}/uploads`, async context => {
    const user = await owner(context.req.raw.headers);
    const input = LibraryUploadRequestSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) return invalid("Choose a JPEG, PNG or WebP photo under 12 MB.");
    const upload = await services.library!.allocateUpload(user, key(context.req.raw.headers), input.data);
    return context.json({ uploadId: upload.id, upload: { url: new URL(`${path}/uploads/${upload.id}/content`, context.req.url).toString(), headers: { "Content-Type": input.data.mimeType, "X-Library-Owner": user } }, requestId: context.get("requestId") });
  });
  app.put(`${path}/uploads/:id/content`, async context => {
    const user = await owner(context.req.raw.headers);
    const reader = context.req.raw.body?.getReader();
    if (!reader) return invalid("Choose a photo.");
    const chunks: Uint8Array[] = []; let length = 0;
    try { while (true) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > 12 * 1024 * 1024) { await reader.cancel(); return invalid("Photos must be under 12 MB."); } chunks.push(value); } } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    await services.library!.writeUpload(user, id(context.req.param("id")), bytes);
    return context.json({ verified: true, requestId: context.get("requestId") });
  });
  app.post(`${path}/copies`, async context => {
    const user = await owner(context.req.raw.headers); key(context.req.raw.headers);
    const input = await context.req.json().catch(() => null);
    const source = LibrarySourceSchema.safeParse(input?.source);
    if (!source.success || typeof input?.checksum !== "string" || !/^[a-f0-9]{64}$/.test(input.checksum)) return invalid("Choose a verified saved photo.");
    return context.json(await services.library!.attach(user, id(input.projectId ?? ""), source.data, input.checksum, key(context.req.raw.headers)));
  });
  app.post(`${path}/save`, async context => {
    const user = await owner(context.req.raw.headers);
    const input = SaveLibraryEntrySchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) return invalid("Check the name, photos, approval and current revision.");
    const entry = await services.library!.save(user, key(context.req.raw.headers), input.data);
    // The durable queue retries interrupted copies; completing reconciliation here keeps open drafts current.
    await services.library!.reconcileOwner(user);
    return context.json({ entry, requestId: context.get("requestId") });
  });
  app.post(`${path}/auto-save`, async context => {
    const user = await owner(context.req.raw.headers);
    const input = AutoSaveLibraryPhotoSchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) return invalid("Choose a verified product or presenter photo.");
    return context.json({ entry: await services.library!.autoSave(user, key(context.req.raw.headers), input.data), requestId: context.get("requestId") });
  });
  app.post(`${path}/:id/delete`, async context => {
    const user = await owner(context.req.raw.headers);
    const input = await context.req.json().catch(() => null);
    if (!Number.isSafeInteger(input?.expectedRevision) || input.expectedRevision < 1) return invalid("The current revision is required.");
    const entry = await services.library!.remove(user, id(context.req.param("id")), input.expectedRevision, key(context.req.raw.headers));
    await services.library!.reconcileOwner(user);
    return context.json({ entry, requestId: context.get("requestId") });
  });
  app.get(`${path}/:id/photos/:photoId`, async context => {
    const user = await owner(context.req.raw.headers);
    const photo = await services.library!.photo(user, id(context.req.param("id")), id(context.req.param("photoId")));
    context.header("Content-Type", photo.mimeType); context.header("Cache-Control", "private, no-store"); context.header("X-Content-Type-Options", "nosniff");
    return context.body(new Uint8Array(photo.body).buffer);
  });
}
