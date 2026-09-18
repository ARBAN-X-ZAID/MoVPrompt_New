# Phase 04: Durable Generation and Accepted Quality - Pattern Map

**Mapped:** 2026-08-21  
**Files analyzed:** 19 expected new/modified files  
**Analogs found:** 16 / 19

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/providers/src/vercel-gateway-seedance.ts` | provider | request-response | Same file | exact |
| `packages/providers/src/vercel-gateway-seedance.test.ts` | test | request-response | Same file | exact |
| `apps/worker/src/render-lifecycle.ts` | service | event-driven | Same file | exact |
| `apps/worker/src/render-lifecycle.test.ts` | test | event-driven | Same file | exact |
| `apps/worker/src/output-persister.ts` | service | file-I/O | Same file | exact |
| `apps/worker/src/output-persister.test.ts` | test | file-I/O | Same file | exact |
| `apps/worker/src/media-quality-analyzers.ts` | service | transform | Same file | exact |
| `apps/worker/src/output-quality-reviewer.ts` | service | transform | Same file | exact |
| `apps/worker/src/media-quality-analyzers.test.ts` | test | transform | Same file | exact |
| `apps/worker/src/output-quality-reviewer.test.ts` | test | transform | Same file | exact |
| `apps/api/src/generation-service.ts` | service | request-response | Same file | exact |
| `apps/api/src/generation-routes.ts` | route | request-response | Same file | exact |
| `apps/api/src/generation-service.test.ts` | test | request-response | Same file | exact |
| `apps/api/src/generation.test.ts` | test | request-response | Same file | exact |
| `apps/api/src/creator-routes.ts` | route | request-response/file-I/O | Same file | exact |
| `packages/contracts/src/generation.ts` | model | request-response | Same file | exact |
| `packages/db/src/generation-service.ts` | service | CRUD/event-driven | Same file | exact |
| `packages/db/test/generation-service.postgres.test.ts` | test | CRUD/concurrent | Same file | exact |
| `packages/db/migrations/0022_phase4_generation_acceptance.sql` | migration | CRUD | `0013_generation_activation_observability.sql`, `0008_render_quality_attempts.sql` | role-match |
| `apps/worker/src/benchmark-manifest.ts` and fixture/manifest tests | utility/test | batch | No close production benchmark manifest yet | no analog |
| `docs/runbooks/PHASE4_PAID_CANARY.md` | documentation/runbook | batch/manual | `docs/runbooks/GENERATION_ACTIVATION.md` | role-match |
| `scripts/verify-phase4-redaction.ts` | utility | batch | Existing verifier scripts under `scripts/` | partial |

## Pattern Assignments

### `packages/providers/src/vercel-gateway-seedance.ts` (provider, request-response)

**Analog:** existing `packages/providers/src/vercel-gateway-seedance.ts`

**Server-only contract and bounded response parsing** (lines 478-595):

```ts
export function createVercelGatewaySeedanceAdapter(
  options: VercelGatewaySeedanceAdapterOptions,
): ProviderAdapter {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new Error("vercel_gateway_api_key_required");
  const modelId = assertModel(options.modelId);

  async function getStatus(providerRequestId: string): Promise<ProviderOperation> {
    const operation = decodeOperation(providerRequestId);
    const response = await request("/video-model/status", { operation });
    let payload: z.infer<typeof GatewayStatusResponseSchema>;
    try {
      payload = GatewayStatusResponseSchema.parse(await response.json());
    } catch (error) {
      throw new VercelGatewayProviderError("vercel_gateway_status_response_invalid", true, ...);
    }
    return statusOperation(providerRequestId, payload);
  }
  return { id: VERCEL_GATEWAY_SEEDANCE_ADAPTER_ID, capability: options.capability, submit, getStatus, cancel: getStatus };
}
```

**Apply:** keep Seedance 2.5 model validation and opaque `ProviderOperation` encoding here only. Preserve `cancel: getStatus`; do not invent an unproven Gateway cancel endpoint. Status ambiguity must remain retryable and reconcile the same opaque operation.

### `apps/worker/src/render-lifecycle.ts` (service, event-driven)

**Analog:** existing `apps/worker/src/render-lifecycle.ts`

**Persist-before-submit/charge and same-operation reconcile** (lines 657-1087):

```ts
if (snapshot.providerRequestId) return reconcile(payload, snapshot, context);

const shouldSubmit = await options.store.beginProviderSubmission({
  runId: snapshot.id, userId: snapshot.userId, provider: adapter.id,
  attemptNumber: snapshot.qualityAttempt, now: now(),
});
if (!shouldSubmit) {
  const latest = await options.store.load(payload);
  if (!latest.providerRequestId) throw new RenderLifecycleError("provider_submission_unavailable", true);
  return reconcile(payload, latest, context);
}
const submission = await adapter.submit(request);
await options.billing.recordProviderSubmission({
  userId: snapshot.userId, runId: snapshot.id, provider: adapter.id,
  providerRequestId: submission.providerRequestId, now: now(),
});
await options.billing.finalizeProviderAccepted({ ... });
await schedule(payload);
```

**Candidate acceptance composition** (lines 710-822):

```ts
await options.store.updateProcessingStage({ ..., stage: "securing_output", now: now() });
const persisted = await options.outputPersister.persist({ ..., sourceUrl: sourceUrl(operation.outputUrl) });
await options.store.updateProcessingStage({ ..., stage: "quality_review", now: now() });
const quality = await options.outputQualityReviewer.review({ ..., bucket: persisted.bucket, objectKey: persisted.objectKey });
if (quality.status === "retry") return options.store.prepareQualityRetry({ ..., decision: quality });
if (quality.status !== "accepted") return terminateAfterAcceptance(...);
await options.store.complete({ ..., outputBucket: persisted.bucket, outputObjectKey: persisted.objectKey });
```

**Apply:** all Phase 4 lifecycle additions belong inside this handler/store. Never complete at Gateway `completed`; never use queue retry count as the customer retry budget; terminalize/refund through the existing billing service only.

### `apps/worker/src/output-persister.ts` (service, file-I/O)

**Analog:** existing `apps/worker/src/output-persister.ts`

**Exact allowlist, public DNS check and redirect revalidation** (lines 49-141 and 188-224):

```ts
function assertAllowedUrl(raw: string, hosts: readonly HostRule[]): URL {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !hostMatches(url.hostname.toLowerCase(), hosts)) {
    throw new Error("provider_output_url_invalid");
  }
  if (url.username || url.password) throw new Error("provider_output_url_credentials_not_allowed");
  return url;
}

for (let redirect = 0; redirect <= options.maxRedirects; redirect += 1) {
  const addresses = await publicAddresses(url.hostname, options.resolveHost);
  const response = await pinnedHttpsGet(url, addresses[0]!, options.maxBytes, options.timeoutMs);
  if (response.status >= 300 && response.status < 400) {
    url = assertAllowedUrl(new URL(location, url).toString(), options.hosts);
    continue;
  }
}
```

**Private owned-object write** (lines 339-403):

```ts
const bytes = await normalizer(providerBytes, campaignVoice, delivery);
if (!bytes.byteLength || bytes.byteLength > maxBytes || !isMp4(bytes)) throw new Error("normalized_output_invalid");
const checksum = createHash("sha256").update(bytes).digest("hex");
const objectKey = objectKeys.creatorOutput({ userId, projectId, versionId, outputId: ... });
const saved = await options.storage.put({ bucket: options.storage.outputsBucket, key: objectKey, body: bytes,
  contentType: "video/mp4", metadata: { "sha256-hex": checksum, ... } });
return { bucket: saved.bucket, objectKey: saved.key };
```

**Apply:** tighten host rules to exact reviewed hosts only; preserve safe hostname-only error evidence. Add final normalized-object full-decode/probe before a candidate is returned to the lifecycle, not a signed/provider URL or pre-normalized probe result.

### `apps/worker/src/media-quality-analyzers.ts` and `output-quality-reviewer.ts` (services, transform)

**Analogs:** existing `apps/worker/src/media-quality-analyzers.ts` and `apps/worker/src/output-quality-reviewer.ts`

**Bounded stored-media technical/AI analysis** (analyzers lines 64-154 and 290-405):

```ts
const signed = await options.storage.signDownload({ bucket: input.candidate.bucket, key: input.candidate.objectKey, expiresInSeconds: 900 });
const report = ProbeSchema.parse(await probe(signed.url));
// return one hard-failing technical observation rather than throwing success

const result = await generateText({
  model: languageModel,
  messages: [{ role: "user", content }],
  output: Output.object({ schema: JudgeResultSchema }),
  temperature: 0,
  abortSignal: AbortSignal.timeout(requestTimeoutMs),
});
const judgment = JudgeResultSchema.parse(result.output);
```

**Fail-closed composition** (reviewer lines 67-107):

```ts
const observations = (await Promise.all(analyzers.map((analyzer) => analyzer.analyze(...)))).flat();
const dimensions = new Set<QualityDimension>();
for (const observation of observations) {
  if (dimensions.has(observation.dimension)) throw new Error(`duplicate_quality_dimension:${observation.dimension}`);
  dimensions.add(observation.dimension);
}
return evaluateAcceptedOutput({ observations, policy: qualityPolicy(input.configuration), attempt: input.attemptNumber });
```

**Apply:** retain Zod strict-schema parsing, bounded private buffers, no URLs in persistence/logs, and deterministic quality policy outside the model. The AI judge supplies observations only; it never owns settlement, access control, acceptance pointer, or retry count.

### `packages/db/src/generation-service.ts` and `packages/db/src/schema.ts` (service/model, CRUD/event-driven)

**Analogs:** existing `packages/db/src/generation-service.ts`, `packages/db/src/schema.ts`

**Owner-scoped transaction and exact once finalization** (generation service lines 411-566):

```ts
return db.transaction(async (tx) => {
  await tx.execute(sql`select set_config('movprompt.user_id', ${input.userId}, true)`);
  const [run] = await tx.select().from(renderRuns)
    .where(and(eq(renderRuns.id, input.runId), eq(renderRuns.userId, input.userId)))
    .for("update").limit(1);
  // validate persisted operation identity, consume entitlement or charge reserved credits once
  const ledgerKey = `render.charge:${run.id}`;
  const [existingLedger] = await tx.select().from(creditLedger)
    .where(eq(creditLedger.idempotencyKey, ledgerKey)).limit(1);
  // only insert/debit if absent, then write providerAcceptedAt/status atomically
});
```

**Immutable attempt records and constrained state** (`schema.ts` lines 496-605):

```ts
unique("render_attempts_run_number_unique").on(table.renderRunId, table.userId, table.attemptNumber),
unique("render_attempts_provider_request_unique").on(table.provider, table.providerRequestId),
check("render_runs_processing_stage_valid", sql`${table.processingStage} IN (...)`),
check("render_attempts_status_valid", sql`${table.status} IN (...)`),
```

**Apply:** use a fresh ordered migration only if source schema cannot express required immutable evidence/constraints. Preserve `FOR UPDATE`, `movprompt.user_id`, owner predicates, unique idempotency, append-only ledger keys and acceptance pointer updates inside the same transaction.

### `apps/api/src/generation-service.ts`, `generation-routes.ts`, and `creator-routes.ts` (service/routes, request-response)

**Analogs:** existing files listed above

**Public response allowlist and owner lookup** (generation service lines 457-490):

```ts
function publicRun(run: OwnedRenderRun): PublicRenderRun {
  return {
    id: run.id, projectId: run.projectId, projectVersionId: run.projectVersionId,
    capability: capability.data, quoteId: run.quoteId,
    quotedCredits: run.quotedCredits, chargedCredits: run.chargedCredits,
    status: run.status, processingStage: run.processingStage,
    outputAvailable: Boolean(run.outputBucket && run.outputObjectKey),
    error: run.errorCode ? { code: run.errorCode, ...(run.errorMessage ? { message: run.errorMessage } : {}) } : null,
    createdAt: run.createdAt.toISOString(), updatedAt: run.updatedAt.toISOString(), completedAt: run.completedAt?.toISOString() ?? null,
  };
}
```

**Hono route validation/error envelope** (`generation-routes.ts` lines 167-290):

```ts
const session = await requireSession(auth, context.req.raw.headers);
const request = StartRenderRunRequestSchema.parse(await parseJson(context.req.raw));
const idempotencyKey = IdempotencyKeySchema.parse(context.req.header("idempotency-key") ?? "");
try {
  const run = await generation.startRender({ userId: session.user.id, ...request, idempotencyKey });
  return context.json({ run, requestId: context.get("requestId") }, 202);
} catch (error) { applicationError(error); }
```

**Fresh signed URL on demand** (`creator-routes.ts` lines 540-625):

```ts
const output = await repository.findOwnedOutput(userId, projectId, runId!);
if (!output || output.bucket !== services.storage.outputsBucket) throw new ApiHttpError(...);
const download = await services.storage.signDownload({ bucket: output.bucket, key: output.objectKey, downloadFilename: `${projectId}.mp4` });
noStore(context);
return context.json({ runId: runId!, projectId, download: { method: "GET", url: download.url, expiresInSeconds: download.expiresInSeconds }, requestId: context.get("requestId") });
```

**Apply:** only public, persisted stages/codes/request IDs travel to the browser. Do not add provider/model/request IDs, raw provider errors, signed URLs to `PublicRenderRun`; URLs may exist only in the owner-authorized no-store download response.

### Tests (unit, API, PostgreSQL, file-I/O)

**Analogs:** existing phase seams each have colocated Vitest coverage.

**Mocked lifecycle dependency factory** (`render-lifecycle.test.ts` lines 15-106):

```ts
function store(current: RenderLifecycleSnapshot): RenderLifecycleStore { return { load: vi.fn(async () => current), ... }; }
function billing() { return { recordProviderSubmission: vi.fn(async () => ({} as never)), finalizeProviderAccepted: vi.fn(async () => ({} as never)), ... }; }
function adapter(overrides: Partial<ProviderAdapter> = {}): ProviderAdapter { return { submit: vi.fn(...), getStatus: vi.fn(...), cancel: vi.fn(...), ...overrides }; }
```

**Fixture-gated FFmpeg full decode** (`output-persister.test.ts` lines 17-92):

```ts
it.runIf(process.env.MOVPROMPT_TEST_FFMPEG === "true")("converts ... into a decoded 4:5 delivery artifact", async () => {
  // create media fixture, call normalizeDeliveryMp4, verify FFprobe then FFmpeg -f null -
}, 30_000);
```

**Disposable PostgreSQL integration pattern** (`packages/db/test/generation-service.postgres.test.ts` lines 1-55):

```ts
const integrationUrl = process.env.MOVPROMPT_TEST_DATABASE_URL;
const describePostgres = integrationUrl ? describe.sequential : describe.skip;
beforeAll(() => { database = createDatabase({ url: integrationUrl!, maxConnections: 4, applicationName: "movprompt-generation-tests" }); });
afterAll(async () => { await database.close(); });
```

**Apply:** default all coverage to mocks/fixtures. Add explicit tests for full final-object decode, concurrent reconcile/retry/cancel settlement, public DTO/log redaction, same-operation output recovery, pending-cancellation wording, and fresh owner-only download refresh. No test, build, migration, or benchmark command may call a paid provider.

## Shared Patterns

### Owner-scoped database writes

**Source:** `packages/db/src/generation-service.ts` lines 411-810 and `apps/worker/src/render-lifecycle.ts` lines 242-640

All user-owned render mutations set the transaction-local user before selecting/locking owner rows. Use `withUserTransaction` for lifecycle store operations and explicit `db.transaction` + `set_config` where a multi-row quality retry/ledger transaction is needed.

### Fail-closed public boundary

**Source:** `apps/api/src/generation-routes.ts` lines 27-76; `apps/api/src/generation-service.ts` lines 457-490

Routes parse Zod contracts, map domain errors to `ApiHttpError`, set `private, no-store`, and return an allowlisted DTO with request ID. New internal diagnostics must not be added to the public DTO merely for debugging.

### Exact-once economic settlement

**Source:** `packages/db/src/generation-service.ts` lines 480-810

Provider acceptance is finalized after the opaque provider request is durable. Release applies only before acceptance; refund applies after a confirmed terminal outcome. Both rely on row locks, reservation state and deterministic ledger idempotency keys.

### Private output ownership

**Source:** `apps/worker/src/output-persister.ts` lines 339-403; `apps/api/src/creator-routes.ts` lines 540-625

Persist only output bucket/key/checksum metadata. The worker owns acquisition and private write; the API issues a short-lived, owner-authorized URL only at download time.

### Bounded AI quality review

**Source:** `apps/worker/src/media-quality-analyzers.ts` lines 221-405; `apps/worker/src/output-quality-reviewer.ts` lines 67-107

Signed media is converted to bounded worker buffers; strict Zod results become quality observations. Missing, duplicate, invalid, timed-out, or ambiguous review must result in a fail-closed decision, never an implicit approval.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `apps/worker/src/benchmark-manifest.ts` and `kw-video-48-v1` fixtures | utility/test | batch | Existing `benchmark.ts` informs provider comparison, but no phase-scoped immutable accepted-output manifest/fixture runner has been identified. Use `packages/creative-engine/src/benchmark.ts` only as a data-shape reference. |
| `docs/runbooks/PHASE4_PAID_CANARY.md` | documentation/runbook | manual/batch | Existing activation runbook is closest, but it does not yet encode Phase 4's authorization, host, checksum, media, quality and exact-settlement evidence record. |
| `scripts/verify-phase4-redaction.ts` | utility | batch | Existing repository verification scripts are organizational analogs; public DTO/log forbidden-field scan is a new phase-specific assertion. |

## Metadata

**Analog search scope:** `packages/providers/src`, `packages/db/src`, `packages/db/test`, `packages/db/migrations`, `apps/worker/src`, `apps/api/src`, `apps/web/src/features/create`, `packages/contracts/src`  
**Files scanned:** 28  
**Pattern extraction date:** 2026-08-21
