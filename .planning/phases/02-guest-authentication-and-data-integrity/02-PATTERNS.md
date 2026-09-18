# Phase 2: Guest, Authentication, and Data Integrity - Pattern Map

**Mapped:** 2026-08-19  
**Files analyzed:** 21 current source/test files; 13 planned create/modify targets  
**Analogs found:** 11 / 13

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/contracts/src/creator.ts` | contract/schema | request-response | same file `ClaimDraftRequestSchema` | exact extension |
| `packages/db/src/schema.ts` plus a portable SQL migration | model/migration | CRUD, event-driven | same file `creatorProjects` / `creatorProjectAssets` | exact extension |
| `apps/api/src/guest-claim-repository.ts` | repository | CRUD, event-driven | `apps/api/src/creator-repository.ts` | role-match |
| `apps/api/src/guest-claim-service.ts` | service | event-driven, file-I/O | `apps/api/src/asset-routes.ts` | partial; compose existing repository/storage primitives |
| `apps/api/src/creator-routes.ts` | route | request-response | same file `/api/v1/drafts/claim` | exact modification |
| `apps/api/src/asset-routes.ts` | route | request-response, file-I/O | same file upload/mirror/complete routes | exact modification |
| `apps/api/src/source-scanner.ts` and `remote-image-fetcher.ts` | service | request-response, file-I/O | same files | exact modification |
| `apps/web/src/features/create/guestDraftStore.ts` | utility/store | browser file-I/O | same file IndexedDB draft/blob store | exact modification |
| `apps/web/src/features/create/guestClaimRecovery.ts` | browser service | request-response, event-driven | `portableProjectMapper.ts` and `CreateStudio.tsx` recovery code | partial |
| `apps/web/src/features/create/CreateStudio.tsx` | component/controller | request-response, event-driven | same file guest restore/generate branches | exact modification |
| `apps/web/src/features/create/AuthGateDialog.tsx` and auth provider config | component/config | request-response | `AuthGateDialog.tsx` / `returnPath.ts` | exact modification |
| `apps/web/src/lib/auth/returnPath.ts` and auth pages | utility/component | request-response | same file | exact modification |
| focused Vitest/PostgreSQL/browser tests | test | CRUD, file-I/O, event-driven | existing `creator-routes.postgres.test.ts`, scanner/fetcher tests, `AuthGateDialog.test.tsx` | exact/role-match |

## Pattern Assignments

### `apps/web/src/features/create/guestDraftStore.ts` (browser store, file-I/O)

**Analog:** existing `apps/web/src/features/create/guestDraftStore.ts`.

Use its two IndexedDB stores and explicit expiry as the sole guest-media mechanism. Extend the draft shape/checkpoint helpers here; do not add `localStorage` blobs or guest cloud writes.

**Database and expiry pattern** ([lines 3-38, 71-78](../../../apps/web/src/features/create/guestDraftStore.ts)):

```ts
const DATABASE_NAME = "movprompt-guest-creator";
const DRAFTS = "drafts";
const ASSETS = "assets";

if (new Date(draft.expiresAt).getTime() <= Date.now()) {
  await deleteGuestDraft(id);
  return null;
}
```

**Blob persistence pattern** ([lines 81-90](../../../apps/web/src/features/create/guestDraftStore.ts)):

```ts
const key = `${draftId}/${crypto.randomUUID()}`;
const asset: StoredAsset = {
  key, draftId, name: file.name, mimeType: file.type,
  size: file.size, blob: file, createdAt: new Date().toISOString(),
};
await transact(ASSETS, "readwrite", (store) => store.put(asset));
```

**Cleanup invariant** ([lines 92-108](../../../apps/web/src/features/create/guestDraftStore.ts)): `deleteGuestDraft` deletes JSON and related blobs in one IndexedDB transaction. Phase 2 must call it only from a new verified canonical-round-trip helper, never after optimistic claim success.

### `apps/web/src/features/create/guestClaimRecovery.ts` (browser recovery service, request-response)

**Analog:** guest restoration in `CreateStudio.tsx` plus canonical hydration in `portableProjectMapper.ts`.

**Restore local JSON and object URLs** ([`CreateStudio.tsx` lines 460-506](../../../apps/web/src/features/create/CreateStudio.tsx:460)):

```ts
const draft = await getGuestDraft(requestedDraft);
const hydratedImages = await Promise.all(draft.product.images.map(async (image) => {
  if (!image.assetKey) return image;
  const stored = await getGuestAsset(image.assetKey);
  return stored ? { ...image, url: URL.createObjectURL(stored.blob) } : image;
}));
```

**Hydrate refreshable private URLs, not persisted signed URLs** ([`portableProjectMapper.ts` lines 76-88](../../../apps/web/src/features/create/portableProjectMapper.ts:76)):

```ts
const images = await Promise.all(project.product.images.map(async (image) => {
  if (!image.storagePath || !image.id) return image;
  try {
    return { ...image, url: await portableCreatorApi.assetDownload(project.id, image.id) };
  } catch {
    return image;
  }
}));
```

**Required Phase 2 correction:** `stableProjectConfiguration` deliberately clears `pendingGenerationId` and `pendingQuoteCredits` ([lines 18-41](../../../apps/web/src/features/create/portableProjectMapper.ts:18)); the claim-recovery helper must preserve those intent fields until successful canonical claim, quote refresh, and submission resolution. Do not copy that reset behavior into claim input.

### `apps/web/src/features/create/CreateStudio.tsx` (component/controller, event-driven)

**Analog:** existing persisted guest-edit path and Generate-time gate.

**Guest vs cloud persistence decision** ([lines 425-447](../../../apps/web/src/features/create/CreateStudio.tsx:425)):

```ts
if (!qaMode && (!user || hasUnclaimedCreatorAssets(next))) {
  await saveGuestDraft(projectToCreationDraft(next, rightsConfirmed));
} else {
  await syncCreatorProject(next, qaMode ? null : user?.id);
}
```

Phase 2 must keep guest drafts fully local before auth, then replace the post-auth `sync → each asset → sync` chain with one `guestClaimRecovery.resumeOrClaim` call. The current sequence at lines 793-827 is an anti-analog: it creates a cloud project before all media are verified and deletes the local draft once paths merely exist.

**Stable Generate intent before authentication** ([lines 844-850](../../../apps/web/src/features/create/CreateStudio.tsx:844)):

```ts
const pendingGenerationId = project.pendingGenerationId || crypto.randomUUID();
const pendingProject = { ...project, pendingGenerationId, pendingQuoteCredits: quote!.credits };
setProject(pendingProject);
await saveGuestDraft(projectToCreationDraft(pendingProject, true, "auth_required"));
setAuthGateOpen(true);
```

Preserve this ordering: validate, produce/reuse stable intent, persist, then open auth. Extend it with snapshot digest and claim checkpoint rather than replacing it with navigation state.

### `apps/web/src/features/create/AuthGateDialog.tsx` and `apps/web/src/lib/auth/returnPath.ts` (component/utility, request-response)

**Analogs:** `AuthGateDialog.tsx`; `returnPath.ts`.

**Safe callback and local recovery fallback** ([`returnPath.ts` lines 3-24](../../../apps/web/src/lib/auth/returnPath.ts:3)):

```ts
if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) return fallback;
const parsed = new URL(candidate, window.location.origin);
if (parsed.origin !== window.location.origin) return fallback;
if (parsed.pathname === "/auth" || parsed.pathname === "/reset-password") return fallback;
```

Use this same utility for email sign-in, social callback, cancellation, and reset completion. Do not accept a raw `next` parameter in a new auth path.

**Provider start pattern** ([`AuthGateDialog.tsx` lines 21-36](../../../apps/web/src/features/create/AuthGateDialog.tsx:21)):

```ts
const safeReturnPath = safeAuthReturnPath(returnPath);
rememberAuthReturnIntent(safeReturnPath);
const result = await portableAuthActions.signInSocial({
  provider: nextProvider,
  callbackURL: authCallbackUrl(safeReturnPath),
});
```

Phase 2 should replace browser-only provider flags with a non-secret server-configured provider response, but retain the existing dialog focus/labels and the one primary email action when none are available.

### `packages/auth/src/config.ts` and `packages/auth/src/auth.ts` (config/provider, request-response)

**Analog:** existing explicit environment parsing and Better Auth composition.

**Configuration boundary** ([`config.ts` lines 29-39, 71-94](../../../packages/auth/src/config.ts:29)):

```ts
if (Boolean(clientId) !== Boolean(clientSecret)) {
  throw new Error(`${idKey} and ${secretKey} must be configured together`);
}
return clientId && clientSecret ? { clientId, clientSecret } : undefined;
```

**Private-beta verification policy must be server-controlled** ([`auth.ts` lines 106-135](../../../packages/auth/src/auth.ts:106)):

```ts
emailAndPassword: {
  enabled: true,
  requireEmailVerification: environment.requireEmailVerification,
  minPasswordLength: 10,
  revokeSessionsOnPasswordReset: true,
},
```

Add one explicit policy/configuration for first-campaign verification rather than a UI bypass; keep Better Auth cookies, trusted origins, and password reset lifecycle intact.

### `packages/contracts/src/creator.ts`, `apps/api/src/creator-routes.ts`, and `apps/api/src/guest-claim-*` (schema, route, repository/service; request-response + event-driven)

**Analogs:** existing strict claim schema, Hono auth/parse/error envelope, and Drizzle idempotent claim repository.

**Strict public contract style** ([`creator.ts` lines 200-215](../../../packages/contracts/src/creator.ts:200)):

```ts
export const ClaimDraftRequestSchema = z.object({
  draftId: z.uuid(),
  ...ProjectConfigurationInput,
}).strict();
```

Extend with opaque pending intent, snapshot digest, and asset manifest—never `userId`, signed URLs, provider IDs, or object keys supplied as authority.

**Authenticated Hono route pattern** ([`creator-routes.ts` lines 62-85, 165-187](../../../apps/api/src/creator-routes.ts:62)):

```ts
const userId = await requireUserId(services, context.req.raw.headers);
const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
const input = ClaimDraftRequestSchema.parse(await parseJson(context.req.raw));
if (idempotencyKey !== input.draftId) throw new ApiHttpError({ ... });
```

Keep `no-store`, request IDs, Zod parsing, and `mapRepositoryError`. Replace the simple direct `repository.claimDraft` body with a service that resumes/finalizes the durable claim; keep endpoint idempotency validation at the route boundary.

**Owner-scoped lock and replay pattern** ([`creator-repository.ts` lines 442-477](../../../apps/api/src/creator-repository.ts:442)):

```ts
return withUserTransaction(db, userId, async (tx) => {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.draftId}, 0))`);
  const [existing] = await tx.select().from(schema.creatorProjects).where(and(
    eq(schema.creatorProjects.userId, userId),
    eq(schema.creatorProjects.clientDraftId, input.draftId),
  )).limit(1);
  if (existing) { /* compare canonical fingerprint, then reuse existing id */ }
});
```

The new claim repository should use the same `withUserTransaction`, advisory lock, fingerprint comparison, and generic conflict behavior, but scope it by `userId + pendingGenerationId` as well as draft identity and persist per-asset checkpoints.

### `packages/db/src/schema.ts` plus migration (model/migration, CRUD)

**Analog:** current owner tuple, immutable version, and unique operation constraints.

**Claim idempotency anchor** ([`schema.ts` lines 227-255](../../../packages/db/src/schema.ts:227)):

```ts
clientDraftId: uuid("client_draft_id"),
unique("creator_projects_id_user_unique").on(table.id, table.userId),
uniqueIndex("creator_projects_client_draft_unique").on(table.clientDraftId),
```

**Owner-bound child data** ([`schema.ts` lines 257-328](../../../packages/db/src/schema.ts:257)):

```ts
foreignKey({
  name: "creator_assets_project_owner_fk",
  columns: [table.projectId, table.userId],
  foreignColumns: [creatorProjects.id, creatorProjects.userId],
}).onDelete("cascade")
```

Add a `guest_claim_operations` table and per-asset checkpoint table with owner tuple foreign keys, opaque intent/draft unique constraints, immutable snapshot digest/manifest, status/attempt/error metadata, and cleanup timestamps. Follow the repository-owned SQL migration convention; do not use browser state as an authoritative migration source.

### `apps/api/src/asset-routes.ts` and `apps/api/src/asset-repository.ts` (route/repository, file-I/O)

**Analog:** authenticated asset ownership, deterministic IDs, storage verification, and response-only signed URLs.

**Ownership before outbound work** ([`asset-routes.ts` lines 460-480](../../../apps/api/src/asset-routes.ts:460)):

```ts
if (!(await repository.isProjectOwned(userId, projectId))) {
  throw new ApiHttpError({ code: "project_not_found", status: 404, retryable: false, ... });
}
```

**Canonical key and verify-before-ready pattern** ([`asset-routes.ts` lines 132-171](../../../apps/api/src/asset-routes.ts:132)):

```ts
assertOwnedProjectKey(asset.objectKey, asset.userId, asset.projectId);
const head = await storage.head(asset.bucket, asset.objectKey);
if (head.contentLength !== asset.sizeBytes || checksum !== asset.checksumSha256 || contentType !== asset.mimeType.toLowerCase()) {
  throw new ApiHttpError({ code: "asset_integrity_mismatch", status: 409, retryable: false, ... });
}
```

**Repository owner predicate** ([`asset-repository.ts` lines 85-135](../../../apps/api/src/asset-repository.ts:85)): join the parent project and bind `assetId`, `projectId`, `userId`, and non-trashed project in one query. Keep the deliberate generic 404 at [`asset-routes.ts` lines 174-190](../../../apps/api/src/asset-routes.ts:174) to avoid an existence oracle.

Phase 2 should move asset claim/mirror orchestration behind the durable claim service, while reusing these endpoints/primitives for verified copy and signed URL refresh. Use [`keys.ts` lines 20-64](../../../packages/storage/src/keys.ts:20) for stable `users/{user}/projects/{project}/...` keys; never persist the signed URL returned at asset-route lines 619-626.

### `apps/api/src/source-scanner.ts` and `apps/api/src/remote-image-fetcher.ts` (service, request-response + file-I/O)

**Analogs:** existing SSRF-safe scanner and image fetcher.

**Every-hop public DNS/IP validation** ([`source-scanner.ts` lines 100-133, 223-270](../../../apps/api/src/source-scanner.ts:100)):

```ts
const pinnedAddresses = await resolvePublicHost(url, resolveHost);
response = await fetcher(url.toString(), { method: "GET", redirect: "manual", signal: controller.signal }, pinnedAddresses);
if ([301, 302, 303, 307, 308].includes(response.status)) {
  url = safeHttpUrl(location, url);
  continue;
}
```

**Verified remote-image result** ([`remote-image-fetcher.ts` lines 339-361](../../../apps/api/src/remote-image-fetcher.ts:339)):

```ts
const bytes = await readLimitedBody(response, maxBytes);
if (!hasMatchingMagic(bytes, mimeType)) throw new ApiHttpError({ code: "remote_image_signature_mismatch", ... });
return { canonicalUrl: url.toString(), bytes, mimeType,
  checksumSha256: createHash("sha256").update(bytes).digest("hex"),
  originalFilename: safeFilename(url, mimeType) };
```

Do not duplicate a looser scanner in a claim service. Extract/common-configure policy only if it preserves this DNS pinning, redirect revalidation, MIME, byte, timeout, magic-byte, and sanitized URL-hash behavior. Add deterministic rate-limit behavior at the route/service boundary; no current close analog exists.

### Tests (unit, PostgreSQL integration, browser E2E)

**Analogs:**

- `apps/api/src/creator-routes.postgres.test.ts` for two-user authenticated HTTP ownership and replay.
- `apps/api/src/source-scanner.test.ts` and `remote-image-fetcher.test.ts` for injected transport/DNS and security assertions.
- `apps/web/src/features/create/AuthGateDialog.test.tsx` and `apps/web/src/lib/auth/returnPath.test.ts` for Testing Library plus safe-return tests.

**PostgreSQL test fixture pattern** ([`creator-routes.postgres.test.ts` lines 11-74](../../../apps/api/src/creator-routes.postgres.test.ts:11)):

```ts
const describePostgres = integrationUrl ? describe.sequential : describe.skip;
database = createDatabase({ url: integrationUrl!, maxConnections: 3, applicationName: "movprompt-creator-http-test" });
const auth: AuthGateway = { async getSession(headers) { /* x-test-user fixture */ } };
```

**Cross-user assertions** ([lines 140-159](../../../apps/api/src/creator-routes.postgres.test.ts:140)):

```ts
expect(crossUserRead.status).toBe(404);
expect(crossUserClaim.status).toBe(409);
await expect(secondUserProjects.json()).resolves.toMatchObject({ projects: [] });
```

**SSRF injection pattern** ([`source-scanner.test.ts` lines 23-44](../../../apps/api/src/source-scanner.test.ts:23)):

```ts
const scanner = createSourceScanner({ fetch: fetcher, resolveHost: vi.fn(...) });
await expect(scanner.scan(...)).rejects.toMatchObject({ code: "source_url_blocked", status: 400 });
expect(fetcher).toHaveBeenCalledTimes(1);
```

Add focused tests for draft expiry/blob retention/verified deletion, durable claim concurrency and partial retry, configured provider truth, auth cancellation/reset/replay, source-change output invalidation, rate limiting, signed URL refresh, and a two-user asset/version/run matrix. Browser E2E has no close committed analog: follow RESEARCH.md only after its human tooling checkpoint.

## Shared Patterns

### Authentication and safe returns

**Sources:** `apps/api/src/creator-routes.ts:62-73`, `apps/web/src/lib/auth/returnPath.ts:3-49`, `packages/auth/src/auth.ts:49-147`.

- Derive owner from `AuthGateway.getSession(headers)`; do not accept browser `userId`.
- Store only a root-relative validated return path in session storage as recovery, not authority.
- Better Auth owns cookies/OAuth/reset; callbacks must use trusted origins and safe path validation.

### Ownership, RLS, and idempotency

**Sources:** `packages/db/src/user-transaction.ts:7-21`, `apps/api/src/creator-repository.ts:442-543`, `apps/api/src/asset-repository.ts:42-135`.

```ts
return db.transaction(async (transaction) => {
  await transaction.execute(sql`select set_config('movprompt.user_id', ${userId}, true)`);
  return operation(transaction);
});
```

Every new authenticated repository path must use this transaction wrapper plus explicit `userId` predicates. Repeated claim/upload/finalize actions use user-scoped idempotency and advisory locks; same draft/intent replay returns the same record, different input returns a generic conflict.

### API errors and validation

**Sources:** `apps/api/src/creator-routes.ts:38-108`, `apps/api/src/asset-routes.ts:37-76`.

- Parse JSON once with the local `parseJson` helper; validate with strict Zod schemas.
- Throw `ApiHttpError` with stable code, plain-language message, HTTP status, and retryability.
- Return generic not-found responses for ownership failures and `cache-control: private, no-store` for user/claim/asset responses.

### Private storage integrity

**Sources:** `packages/storage/src/keys.ts:20-75`, `apps/api/src/asset-routes.ts:132-171, 590-629`.

- Canonical key is produced from server-derived user/project/asset IDs and checksum.
- Verify HEAD metadata before declaring asset ready or issuing download URL.
- Store only bucket/key/checksum/MIME/size; signed upload/download URLs are response-only and refreshable.

### Failure recovery

**Sources:** `guestDraftStore.ts:53-69`, `CreateStudio.tsx:844-862`, UI-SPEC §Interaction and State Contract.

- Persist stable pending generation intent before opening auth.
- On asset/claim/import failure, retain guest JSON, blobs, form values, rights, and intent; expose Retry/Replace rather than clearing state.
- Delete guest data only after the returned canonical project/version/assets exactly match snapshot and checksum manifest.

## No Analog Found

| File / concern | Role | Data Flow | Reason / planner direction |
|---|---|---|---|
| `apps/api/src/guest-claim-service.ts` durable claim saga | service | event-driven + file-I/O | Current claim is a direct DB insert and current asset routes are independent; compose their patterns with explicit persisted claim/checkpoint state. |
| Claim operation/checkpoint migration | model/migration | CRUD | No existing durable multi-asset saga table. Use current owner-tuple and unique-operation constraints as the schema pattern. |
| Scanner/mirror rate limiter | middleware/service | request-response | No request-rate policy found in these paths. Add a configured, deterministic rate limiter with 429 tests; do not hide it in the UI. |
| Browser E2E config and guest-auth-claim spec | test | event-driven | No committed browser E2E harness. Follow RESEARCH.md's Wave 0/human package-checkpoint guidance. |
| Source-change output invalidation | domain service | event-driven | No direct compatible-output invalidation analog found. Bind it to immutable version/change operations and cover it in PostgreSQL integration tests. |

## Metadata

**Analog search scope:** `apps/web/src/features/{create,auth}`, `apps/api/src`, `packages/{auth,contracts,db,storage}/src`, existing Vitest tests  
**Files scanned:** 21  
**Pattern extraction date:** 2026-08-19
