# Phase 04: Durable Generation and Accepted Quality - Research

**Researched:** 2026-08-21
**Domain:** Durable asynchronous video generation, private media acceptance, and exactly-once settlement
**Confidence:** HIGH for the existing MovPrompt seams; MEDIUM for current Vercel AI Gateway behavior until an authorized paid canary records live evidence.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Provider operation and recovery
- **D-01:** Production generation remains on the semantic `video.cinematic` and `video.product_fidelity` capabilities. Both resolve server-side to the approved Seedance 2.5 adapter only after live contract evidence; the browser never sends or receives provider/model IDs.
- **D-02:** Seedance v1 Pro Fast remains a development-only smoke tool. It is never a fallback for a customer render, never satisfies Phase 4 acceptance, and never changes the production capability registry.
- **D-03:** Omni stays disabled in this phase until a documented video contract, adapter, output parser, settlement path, and separately approved paid canary pass. Catalog presence is not provider proof.
- **D-04:** The worker persists the provider operation identifier and accepted timestamp before polling or charging. Browser closure, worker restart, polling timeout, and transient network failure must resume the same operation.
- **D-05:** An unknown or uncertain provider state is reconciled, never automatically resubmitted. A missing result URL or unrecognized output host parks the original run in a retryable internal state for review/reconciliation without creating another billable request.
- **D-06:** Provider output hosts use an exact reviewed allowlist. Every redirect is revalidated, HTTPS-only, public-address checked and address-pinned. Broad wildcard hosts and guessed documentation hosts are prohibited.

#### Private output and technical acceptance
- **D-07:** Provider success is only an intermediate state. A run becomes completed only after the output is downloaded safely, copied to MovPrompt private storage, normalized, fully decoded, and approved by all required quality gates. — **Reversibility:** costly — Relaxing this would change the public meaning of completed runs and accepted project versions.
- **D-08:** PostgreSQL stores stable private bucket/object keys and immutable media metadata; signed URLs are response-only and short-lived. Expired downloads are refreshed through a new owner-authorized request.
- **D-09:** Technical validation is ordered and fail-closed: allowed origin and bounded download; MIME and MP4 signature; FFprobe container/codec/dimensions/duration/audio policy; normalization to MP4/H.264/AAC as needed; full decode; final dimension and duration verification.
- **D-10:** The requested delivery ratio remains part of the immutable quote. Native ratios preserve their requested canvas; 4:5 uses the supported provider canvas followed by a real deterministic 4:5 crop before acceptance.
- **D-11:** A candidate that cannot be safely acquired, decoded, normalized, or stored is invalid output, not customer success. The previous accepted version and output remain unchanged.

#### Quality acceptance and bounded retries
- **D-12:** Technical checks run before visual/business review. Visual approval covers product identity, confirmed facts, price/offer/CTA truth, Arabic and bilingual legibility, safe zones, visual defects, and vertical-specific policy.
- **D-13:** Automated quality review is structured, bounded, versioned, evidence-bearing, and fail-closed. Invalid schemas, unavailable reviewers, unsupported inputs, or ambiguous decisions never approve an output.
- **D-14:** One quote buys one accepted result and permits at most two internal quality retries after the initial attempt. Internal provider failures or rejected candidates do not create extra customer charges. — **Reversibility:** costly — Retry accounting is bound to quote economics, attempt history, and exactly-once settlement.
- **D-15:** Retries may correct the same immutable configuration and confirmed facts but cannot silently alter product identity, campaign copy, price, CTA, language, ratio, resolution, audio, or rights. Any user-requested visual change is a new quoted version outside the internal retry budget.
- **D-16:** If no candidate passes within the bounded attempt budget, the run fails honestly, value is restored exactly once, and the UI offers retry from the preserved project/version rather than accepting the best failed candidate.

#### Cancellation, settlement, and public truth
- **D-17:** Before provider acceptance, cancellation is immediate and releases the reservation/entitlement exactly once. After acceptance, the run remains cancelling until the adapter confirms cancellation or the provider operation reaches another terminal state.
- **D-18:** The Gateway adapter does not claim cancellation support without a documented and proven contract. If cancellation cannot be confirmed, the worker continues reconciliation and the product explains that cancellation is pending.
- **D-19:** Provider acceptance consumes the starter entitlement or converts the reserved credits into one exact charge. Failure, invalid output, exhausted quality retries, timeout, or confirmed cancellation refunds/restores exactly once; retries and concurrent reconciliation cannot double-settle.
- **D-20:** Every provider attempt records sanitized operation metadata, integer micro-USD cost when available, latency, outcome, technical/quality decision, and retry ordinal. Secrets, signed URLs, raw provider payloads, and internal diagnostics never enter public responses.
- **D-21:** The last accepted project version advances only after final quality approval. Starting or failing a newer working version never replaces it.
- **D-22:** Public progress is derived only from persisted server stages. It uses plain user language, exposes a request ID for support, and never shows a simulated percentage, raw provider error, model name, internal retry count, or signed provider URL.
- **D-23:** New quotes/submissions remain behind one server kill switch and runtime readiness fingerprint. Already accepted operations continue reconciling even when new generation is disabled.

#### Evidence and activation
- **D-24:** Unit, API, worker, PostgreSQL, storage, media, and adversarial tests use mocks/fixtures by default. No paid provider request is made implicitly by a test, build, migration, or planning command.
- **D-25:** Each real canary requires explicit current budget authorization. It records configuration hash, provider operation, cost, timings, output host, private object checksum, media validation, quality decision, and exactly-once ledger evidence.
- **D-26:** Phase 4 cannot be declared complete from code alone. At least one real approved production-model operation must survive browser closure/restart, reconcile the same provider operation, persist a privately owned accepted MP4, and pass the failure/cancellation settlement matrix.

### the agent's Discretion
- Exact polling cadence, lease duration, backoff curve, and internal stage names, provided they are bounded, durable, observable, and do not change the public truth contract.
- Exact FFmpeg normalization arguments and quality score thresholds, provided golden fixtures and real canary evidence prove the required output contract.
- Exact internal attempt/status table additions, provided existing append-only, idempotent, owner-scoped database patterns are preserved.

### Deferred Ideas (OUT OF SCOPE)
- Omni video activation remains deferred until its own documented adapter, parser, settlement path, and canary pass.
- Deterministic four-format campaign-pack exports belong to Phase 6.
- Advanced direction UI and multi-direction generation belong to Phase 8.
- Production rollout percentages, alert dashboards, and 72-hour soak belong to Phase 10.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-05 | Durable worker submits, polls, reconciles, and completes generation independently of the browser. | Persist operation first; pg-boss singleton reconciliation, lease-safe lifecycle, no uncertain resubmission. |
| GEN-06 | Successful provider output is copied into MovPrompt-owned private storage before the run can complete. | SSRF-safe acquisition, normalize, private object write, only then completion. |
| GEN-07 | Output is validated for container, codec, dimensions, duration, audio policy, full decode, and safe output origin. | Ordered technical gate with bounded bytes, FFprobe, FFmpeg normalization/full decode, final probe. |
| GEN-08 | Output passes product identity, factual accuracy, Arabic/text legibility, visual quality, safe-zone, and compliance review before acceptance. | Composed structured review with missing/invalid evidence failing closed. |
| GEN-09 | One quote may include at most two internal quality retries; provider failures and rejected internal attempts do not create extra user charges. | Immutable attempt evidence plus a single charged acceptance and bounded quality retry ordinal. |
| GEN-10 | Failure, timeout, invalid output, quality rejection, or confirmed cancellation releases or refunds value exactly once. | Row locks, idempotency keys, reservation/ledger settlement, post-acceptance reconciliation. |
| GEN-11 | Failed regeneration preserves the last accepted version and exposes a clear retry path. | Working and accepted version pointers stay separate; output recovery reuses the operation. |
| GEN-12 | User can cancel before provider acceptance immediately and after acceptance only when provider cancellation is confirmed. | Pre-acceptance release; post-acceptance remains pending/reconciled for this adapter. |
| GEN-13 | User can download an accepted output after an old signed URL expires by receiving a newly authorized URL. | Persist only object keys; issue owner-authorized, short-lived response URL at download time. |
| GEN-14 | Provider IDs, raw provider errors, secrets, signed URLs, and internal retry details never cross the public product boundary. | Public mapping permits only safe status/stage/error envelope; sanitize telemetry and logs. |
</phase_requirements>

## Summary

Use the existing React/Hono/PostgreSQL/pg-boss/S3 worker architecture; Phase 04 is an integration-hardening phase, not a new-provider or new-package phase. The durable unit of work is the persisted render run plus its opaque provider operation and immutable attempts. A provider `completed` response is a candidate, never product completion. [VERIFIED: packages/db/src/schema.ts:496-605] [VERIFIED: packages/providers/src/vercel-gateway-seedance.ts:381-411]

The decisive acceptance sequence is: submit exactly once → persist provider operation and acceptance → reconcile the same operation until terminal → acquire only from an approved public HTTPS host with DNS pinning and redirect revalidation → normalize/private-store → technical gate → structured business/visual gate → advance accepted version and settle exactly once. An uncertain state or inaccessible result stays attached to the original provider operation; it never causes an automatic second billable submission. [VERIFIED: apps/worker/src/output-persister.ts:334-400] [VERIFIED: docs/runbooks/GENERATION_ACTIVATION.md]

Vercel documents video generation as asynchronous and its SDK entry point as experimental; model-specific inputs and polling differ by model. Keep the explicit server-only adapter and require the authorized live canary to prove the current Seedance contract, output host, price, and cancellation behavior before capability activation. [CITED: https://ai-sdk.dev/docs/ai-sdk-core/video-generation] [CITED: https://vercel.com/docs/ai-gateway/getting-started/video] [CITED: https://vercel.com/ai-gateway/models/seedance-2.5/faq]

**Primary recommendation:** Finish and test the existing durable lifecycle as one acceptance transaction boundary: only final private-media quality approval may complete a run and advance the accepted version.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Quote-bound submission and public stages | API / Backend | Browser / Client | The API authenticates, owner-scopes, and exposes safe persisted truth; the browser renders it. |
| Provider submit/poll/reconcile | Worker | Database / Storage | A server worker survives browser/process interruptions; PostgreSQL carries the operation and attempt evidence. |
| Output acquisition and normalization | Worker | CDN / Static | The worker must contain SSRF/media-tool access; the public never handles the provider URL. |
| Private accepted output and refreshed download URL | Database / Storage | API / Backend | Stable object keys remain private; API authorizes each new signed response URL. |
| Quality acceptance and retry | Worker | Database / Storage | Technical and multimodal review run off-browser and write immutable evidence. |
| Settlement and cancellation truth | Database / Storage | API / Backend | Transactional row locks/idempotency decide value restoration; the API reports the result safely. |

## Project Constraints (from AGENTS.md)

- Preserve the React/Hono/PostgreSQL/Better Auth/pg-boss/S3 architecture; do not redesign it. [VERIFIED: AGENTS.md]
- Parse untrusted payloads with Zod, return stable domain codes/retryability, and never turn failures into success. [VERIFIED: AGENTS.md]
- Authenticated mutations must use owner predicates and `withUserTransaction` where applicable; repeated charge/duplicate-risk mutations require validated idempotency keys. [VERIFIED: AGENTS.md]
- Store bucket/object keys, never signed URLs; provider IDs remain server-side; do not log secrets, signed URLs, OAuth tokens, or full provider payloads. [VERIFIED: AGENTS.md]
- Use TypeScript semicolons, double quotes, trailing commas, two-space indentation, explicit dependency factories, package barrels, and server `.js` ESM imports. [VERIFIED: AGENTS.md]
- All UI work must use the project UX/accessibility skills and rendered-browser verification. Phase 04 should not redesign UI; any minimal stage/cancellation/download copy must meet this constraint. [VERIFIED: AGENTS.md]

## Standard Stack

### Core

| Library / tool | Version observed | Purpose | Why standard here |
|----------------|------------------|---------|-------------------|
| PostgreSQL + Drizzle | PostgreSQL-backed existing domain | Row locks, durable runs, attempt records, reservation/ledger settlement | Existing source of truth and RLS boundary. [VERIFIED: packages/db/src/schema.ts:496-605] |
| pg-boss | `^12.26.3` | Durable worker jobs and singleton reconciliation | Existing worker queue; no browser dependency. [VERIFIED: apps/worker/package.json] |
| Zod | `^4.4.3` | Provider/status/quality boundary validation | Existing fail-closed schema parser. [VERIFIED: apps/worker/package.json] |
| FFmpeg / FFprobe | Host tools; FFmpeg/FFprobe `8.1.2` observed locally | Normalize/full-decode/probe media | Already required by the worker activation check. [VERIFIED: apps/worker/src/main.ts:196-213] |
| S3-compatible private storage | Existing `@movprompt/storage` seam | Private owned candidate/accepted MP4 objects and signed-response generation | Existing storage policy. [VERIFIED: apps/worker/src/output-persister.ts:334-400] |

### Supporting

| Library / tool | Version observed | Purpose | When to use |
|----------------|------------------|---------|-------------|
| Vercel AI Gateway + server adapter | Gateway contract is current/live-variable | Seedance operation start/status and independent visual reviewer routing | Only behind semantic capabilities and activation evidence. [CITED: https://vercel.com/docs/ai-gateway/getting-started/video] |
| AI SDK | `ai` `^7.0.64` | Structured multimodal quality reviewer | Existing reviewer only; keep it behind a stable local analyzer interface because video APIs are experimental. [VERIFIED: apps/worker/package.json] [CITED: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-video] |
| Vitest | `^4.1.10` | Unit/API/worker integration fixture tests | Default test framework in affected workspaces. [VERIFIED: apps/worker/package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing pg-boss reconciliation | Browser polling or a new queue | Violates GEN-05 durability and duplicates established transactional-outbox semantics. |
| Existing private S3-compatible storage | Provider-hosted public URL or Vercel Blob | Violates the locked private-object ownership boundary and adds an unnecessary storage system. |
| Existing Seedance adapter | Omni or Seedance v1 smoke model | Explicitly deferred/development-only; neither may become a customer fallback. |

**Installation:** No external package installation is recommended for this phase. Reuse the installed workspace stack. [VERIFIED: apps/worker/package.json]

## Package Legitimacy Audit

No package installation is in scope, so the package legitimacy gate is not applicable. The planner must not add a package merely to implement queueing, HTTP downloading, media validation, S3 signing, or quality JSON validation; working seams already exist. [VERIFIED: apps/worker/src/output-persister.ts:1-47] [VERIFIED: apps/worker/src/media-quality-analyzers.ts:1-16]

## Architecture Patterns

### System Architecture Diagram

```text
Authenticated Generate request
          |
          v
API: quote + owner/idempotency validation ----> PostgreSQL: render run, reservation, outbox
                                                      |
                                                      v
                                             pg-boss singleton generation job
                                                      |
                                                      v
       Seedance adapter <--- submit once / persist opaque operation / reconcile status
              |                                                     |
              | completed candidate                                 | pending/unknown
              v                                                     v
Worker: allowlisted HTTPS + DNS pinning + bounded download       reschedule same operation
              |
              v
FFmpeg normalize/full decode -> private S3 object -> FFprobe technical gate
              |
              v
Structured visual/business reviewer (strict schema + evidence)
       | pass                                  | reject / unavailable / invalid
       v                                       v
DB: accepted pointer + one settlement     bounded same-config retry or one refund/release
       |
       v
API: safe persisted stage + owner-authorized fresh signed download URL
```

### Existing Lifecycle Values (source of truth)

Verbatim established public-workflow state values are: `"preparing" | "rendering" | "securing_output" | "quality_review" | "ready" | "cancelling" | "failed" | "cancelled"`; the attempt status values are `"submitted" | "processing" | "quality_rejected" | "accepted" | "failed" | "cancelled"`; and the current maximum internal retry default is `2`. [VERIFIED: packages/db/src/schema.ts:511-526] [VERIFIED: packages/db/src/schema.ts:554-602]

### Recommended Project Structure

Keep ownership with the current domain modules rather than adding a parallel pipeline:

```text
packages/providers/src/
  vercel-gateway-seedance.ts     # opaque operation + submit/status contract
packages/db/src/
  generation-service.ts          # reservation, charge/refund, outbox invariants
apps/worker/src/
  render-lifecycle.ts            # durable orchestration and retry decisions
  output-persister.ts            # safe download, normalization, owned object write
  output-quality-reviewer.ts     # composition and acceptance policy
  media-quality-analyzers.ts     # FFprobe and structured visual reviewer
apps/api/src/
  generation-service.ts          # owner-scoped status, cancellation, recovery/download API
```

### Pattern 1: Persist-before-poll state machine

**What:** Make submission a guarded database transition that records an opaque provider operation and `providerAcceptedAt` before charging or scheduling reconciliation. The worker must read the persisted operation to poll/recover after any restart. [VERIFIED: packages/db/src/schema.ts:516-529]

**When to use:** Every customer render and every quality retry. Never use it for the development-only smoke command.

**Implementation rule:** There is exactly one outbound submit path per `(run, attempt)` guarded by the existing unique run/idempotency and provider-operation constraints. If a crash happens after submit but before the local response is durable, reconcile/review that same operation instead of issuing another request. [VERIFIED: packages/db/src/schema.ts:533-559] [VERIFIED: packages/db/src/schema.ts:590-603]

### Pattern 2: Candidate-to-accepted-media gate

**What:** Treat provider output as untrusted remote input, then retain only a normalized MovPrompt-owned MP4 candidate. Completion must occur after technical and quality acceptance, never at provider success. [VERIFIED: apps/worker/src/output-persister.ts:334-400] [VERIFIED: apps/worker/src/output-quality-reviewer.ts:62-107]

**When to use:** Every provider `completed` result and every output-recovery request.

**Implementation rule:** Validate host/protocol/DNS before request, revalidate each redirect, bound headers and streaming body, check MP4 magic, normalize, hash, save with private key/metadata, fully probe the saved result, then review it. The current persister already supplies most of this sequence; planner tasks should close gaps only after fixture evidence. [VERIFIED: apps/worker/src/output-persister.ts:49-224] [VERIFIED: apps/worker/src/output-persister.ts:334-400]

### Pattern 3: Composed, evidence-bearing quality decision

**What:** Combine independent analyzers, reject duplicate/missing dimensions, and let the policy return a structured decision plus retry directive. A reviewer outage, schema failure, unsupported media, or ambiguous result fails closed. [VERIFIED: apps/worker/src/output-quality-reviewer.ts:62-107] [VERIFIED: apps/worker/src/media-quality-analyzers.ts:157-204]

**When to use:** Only after private media persists and technical validation succeeds.

**Implementation rule:** Preserve the candidate object and decision in the immutable attempt record, but do not expose raw reviewer evidence/provider payload to the client. [VERIFIED: packages/db/src/schema.ts:565-603]

### Pattern 4: Settlement is terminal and idempotent

**What:** Charge/consume only after provider acceptance; refund/release through the domain service for a true terminal failure or confirmed cancellation; protect both paths with row locks and idempotency keys. [VERIFIED: packages/db/src/generation-service.ts:737-787]

**When to use:** At cancellation, provider terminal error, exhausted quality budget, output timeout, and final acceptance.

**Implementation rule:** A post-acceptance operation remains economically live while it is reconcilable. Do not release value just because a caller timed out, the browser closed, or the first output URL could not be downloaded. [VERIFIED: apps/api/src/generation-service.ts:944-1025]

### Anti-Patterns to Avoid

- **Completing at provider success:** skips ownership, normalization, technical proof, and business-quality truth.
- **Retrying an unknown operation:** may create a second paid render; schedule reconciliation of the persisted operation instead.
- **Trusting a provider URL or redirect:** turns the worker into an SSRF pivot and risks persisting unowned media.
- **SDK-only long polling in a request:** ties customer truth to process/browser lifetime; isolate the volatility behind the provider adapter and worker job. [CITED: https://ai-sdk.dev/docs/ai-sdk-core/video-generation]
- **Returning signed/provider URLs in stored or public fields:** leaks capability-bearing URLs and breaks GEN-14.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Durable job dispatch | Browser timer loop or ad-hoc cron table | Existing transactional outbox + pg-boss singleton job | Existing project pattern already survives browser closure and coordinates retries. |
| Exactly-once financial transitions | Controller-level credit arithmetic | Existing generation domain service with row locks, reservations, entitlement, and ledger idempotency | Race conditions occur on cancellation, retry, and multi-worker reconciliation. |
| Object-key/URL policy | Hand-made public output links | Existing storage key factory and response-only signing | Maintains private ownership and correct expiry refresh. |
| SSRF defenses | `fetch(providerUrl)` | Existing allowlist, public-address validation, redirect revalidation, pinned HTTPS downloader | URL parsing alone does not prevent DNS rebinding/private-address access. |
| Media acceptance | Header-only MIME check | Existing FFmpeg normalization + FFprobe analyzer + full decode fixture tests | Container headers and declared MIME do not prove a playable delivery file. |
| Quality JSON parsing | Regex or free-form model prose | Existing strict Zod structured output analyzer | Missing/ambiguous evidence must not approve a video. |

**Key insight:** Phase 04 reliability comes from preserving a single durable truth record across asynchronous boundaries, not from making any one provider request appear synchronous.

## Common Pitfalls

### Pitfall 1: Ambiguous provider acceptance

**What goes wrong:** A timeout or malformed start response is treated as permission to submit again.

**Why it happens:** Remote acceptance can succeed even when the caller loses the response.

**How to avoid:** Persist a start marker/operation as early as the adapter permits; otherwise park/reconcile rather than auto-resubmit. The existing adapter tests explicitly exercise malformed start behavior with the same billable idempotency key. [VERIFIED: packages/providers/src/vercel-gateway-seedance.test.ts]

**Warning signs:** More than one provider request ID for a single `(run, attempt)`, or a ledger settlement without a persisted operation.

### Pitfall 2: Unsafe output recovery

**What goes wrong:** The worker follows a new host on redirect, trusts DNS after the initial check, or stores the provider URL as the output.

**Why it happens:** A provider result URL is untrusted capability data and can expire or redirect.

**How to avoid:** Exact host rule, HTTPS, public DNS result, address pinning, manual redirects, byte cap, magic/MIME checks, then private save. [VERIFIED: apps/worker/src/output-persister.ts:81-224]

**Warning signs:** Broad host suffix/wildcard configuration, query URLs in logs, or output objects with no SHA-256 metadata.

### Pitfall 3: Quality approval by incomplete evidence

**What goes wrong:** A visual reviewer returns partial/free-form data and the candidate is accepted because a score looks high.

**Why it happens:** Multimodal model output is not a contract unless schema and all dimensions are enforced.

**How to avoid:** Strict schema, fixed dimensions, explicit evidence limits, zero-temperature structured result, and no approval on missing analysis. [VERIFIED: apps/worker/src/media-quality-analyzers.ts:157-204] [VERIFIED: apps/worker/src/output-quality-reviewer.ts:62-107]

**Warning signs:** Missing dialect/safe-zone/compliance evidence, duplicate dimensions, or a reviewer timeout recorded as success.

### Pitfall 4: Technical validation before versus after normalization

**What goes wrong:** A provider MP4 is probed but the stored/transcoded output is never fully checked.

**Why it happens:** Normalization changes container, codecs, dimensions, duration, and audio stream.

**How to avoid:** Run initial safety checks before FFmpeg, then decode/probe the final private object and compare it against immutable quote configuration. [VERIFIED: apps/worker/src/output-persister.ts:146-185] [VERIFIED: apps/worker/src/media-quality-analyzers.ts:55-154]

**Warning signs:** Candidate probe passes but accepted delivery dimensions/audio differ from the quote.

### Pitfall 5: Pretending cancellation completed

**What goes wrong:** Post-acceptance cancellation immediately refunds/returns `cancelled` while the provider can still complete.

**Why it happens:** HTTP cancellation is confused with a provider-confirmed terminal state.

**How to avoid:** Immediate release is limited to pre-acceptance. For the Gateway adapter, expose pending/reconcile truth until documented and proven cancellation support exists. [VERIFIED: apps/api/src/generation-service.ts:977-1025] [VERIFIED: docs/product/VERCEL_GATEWAY_LOCAL.md]

**Warning signs:** A refund occurs with a persisted provider operation that later returns media.

## Code Examples

### Safe durable reconciliation skeleton

```typescript
// Source pattern: apps/worker/src/render-lifecycle.ts and packages/db/src/generation-service.ts
const run = await store.load(payload);

if (!run.providerRequestId) {
  // Atomically set the start marker, then submit with the persisted attempt key.
  // If this process loses its response, do not start another attempt.
  await submitAndPersistOneOperation(run);
}

const operation = await adapter.status(run.providerRequestId);
if (operation.status === "processing") {
  return scheduleSameOperation(payload);
}

if (operation.status === "completed") {
  const owned = await outputPersister.persist({ sourceUrl: operation.outputUrl, ...identity });
  const decision = await reviewer.review({ ...owned, ...identity });
  return decision.accepted ? completeAndSettleOnce(owned) : retryOrRefundOnce(decision);
}

return settleTerminalOperationOnce(operation);
```

The literal `"processing"` is a verified provider-operation state returned by the current adapter; all other helper names above are explanatory pseudocode, not an API to create. [VERIFIED: packages/providers/src/vercel-gateway-seedance.ts:381-410]

### Safe output acquisition sequence

```typescript
// Source pattern: apps/worker/src/output-persister.ts
const providerBytes = await boundedPinnedDownload({
  url: operation.outputUrl,
  allowedHosts: reviewedHosts,
  redirectPolicy: "manual_revalidate_every_hop",
});
const normalizedMp4 = await normalizeDeliveryMp4(providerBytes, campaignVoice, quoteDelivery);
const privateObject = await privateOutputStorage.put(normalizedMp4);
await technicalAnalyzer.analyze(privateObject, immutableConfiguration);
```

`"manual_revalidate_every_hop"` is pseudocode; the implementation should retain the existing manual redirect loop rather than add a new downloader. [VERIFIED: apps/worker/src/output-persister.ts:188-224]

## State of the Art

| Old approach | Current approach | Impact |
|--------------|------------------|--------|
| Synchronous request/blocking page generation | Asynchronous video generation with provider-specific polling | Persist operation and let a durable worker own reconciliation. [CITED: https://ai-sdk.dev/docs/ai-sdk-core/video-generation] |
| Provider result URL as delivery | Private owned normalized object plus response-time signing | Output remains available after provider URL expiry and stays owner-authorized. |
| Free-form “looks good” review | Strict structured multimodal evidence plus technical gate | A missing reviewer/schema result cannot silently approve media. |

**Deprecated/outdated:** Treating generic AI SDK behavior as a stable production protocol is unsafe because `experimental_generateVideo` is explicitly experimental. Keep its changing wire behavior inside `vercel-gateway-seedance.ts` and prove it with a live canary. [CITED: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-video]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | [ASSUMED] A bounded exponential reconciliation cadence such as 15 seconds, 30 seconds, then capped 60–120 seconds will satisfy latency/cost needs. | Architecture Patterns | It may delay recovery or overload provider/status endpoints; set only with observed canary latency and queue evidence. |
| A2 | [ASSUMED] Current official public docs do not expose a Gateway request-cancellation endpoint usable by this adapter. | Summary / Pitfall 5 | Gateway could add one; verify immediately before enabling post-acceptance cancellation. |
| A3 | [ASSUMED] The observed exact Seedance output host remains valid for production activation. | Provider operation | Hosts can change; activation must record the actual approved canary host before enablement. |

## Open Questions (RESOLVED BY GATES)

These are deliberately unresolved live-contract questions, not implementation assumptions. Each answer is accepted only from the named plan gate; implementation must remain fail-closed and must not infer, guess, or pre-populate an answer before that gate passes.

1. **What are the observed Seedance 2.5 start/status fields, output host, price, and latency for the currently authorized account?**
   - What we know: The code has an explicit opaque-operation parser and a reviewed host, while Vercel’s video APIs are documented as asynchronous/experimental. [VERIFIED: packages/providers/src/vercel-gateway-seedance.ts:38-67] [CITED: https://ai-sdk.dev/docs/ai-sdk-core/video-generation]
   - What is unclear: Current account/provider contract evidence has not been recorded in a paid canary during this research.
   - Resolution gate: Plan 04-03 Task 04-03-03, the separately budget-authorized paid canary, records the current contract fields, hostname, micro-USD cost, and timing evidence from one persisted operation. Before that checkpoint passes, implementation must not assume the live field shape, hostname, cost, latency, or cancellation capability and must keep the capability fail-closed.

2. **What exact quality thresholds pass representative Kuwait Arabic/English/bilingual fixtures?**
   - What we know: The current premium policy has an acceptance score and two internal retries. [VERIFIED: apps/worker/src/output-quality-reviewer.ts:30-47]
   - What is unclear: Golden fixtures and human review calibration are not proven in this research.
   - Resolution gate: Plan 04-02 Task 04-02-01 builds the non-billable schema/metrics/import validator, and blocking Task 04-02-03 requires two independent qualified-human labels per candidate, adjudication, role attestations, candidate checksums, evaluator/rubric versions, an approval record, weighted kappa >= 0.70, every applicable per-dimension Spearman >= 0.70, and zero critical false accepts. The paid canary cannot replace this calibration. Before the human checkpoint passes, implementation must not invent labels or assume any threshold result; automatic acceptance remains unavailable.

3. **Can the final private output be downloaded through an owner-authorized refresh route in the intended browser journey?**
   - What we know: The public service has recoverable output logic and storage is response-signed. [VERIFIED: apps/api/src/generation-service.ts:944-975]
   - What is unclear: A rendered-browser acceptance path for expired accepted-download URLs must be added/verified in this phase.
   - Resolution gate: Plan 04-03 Task 04-03-02 supplies automated owner/cross-owner expiry-refresh coverage plus the rendered-browser matrix. Before those checks pass, implementation must not claim that the intended browser journey is proven and must never persist or reuse a signed URL.

## Environment Availability

| Dependency | Required By | Available | Version / observation | Fallback |
|------------|-------------|-----------|-----------------------|----------|
| Node.js | Worker/API tests and runtime | ✓ | `v25.2.0` (meets `>=24`) | — |
| Bun | Workspace scripts | ✓ | `1.3.12` | — |
| FFmpeg | Normalization/full decode | ✓ | `8.1.2` | — |
| FFprobe | Technical media inspection | ✓ | `8.1.2` | — |
| PostgreSQL client/server socket | DB integration work | ✓ | `psql 15.17`; local `5432` accepts connections | Use project PostgreSQL 17 Docker topology for canonical parity. |
| Docker Compose | Documented full stack/MinIO/PostgreSQL 17 | ✗ | `docker` command not present | No equivalent full-stack fallback; use provisioned CI/staging or install Docker. |
| Vercel AI Gateway credentials/budget authorization | Live Seedance canary | Not probed | No paid calls authorized | Explicit human budget checkpoint only. |

**Missing dependencies with no fallback:** Docker is unavailable for the documented local PostgreSQL-17/MinIO stack; live provider credentials/budget authorization are intentionally unproven and require human approval.

**Missing dependencies with fallback:** None. Fixture-based unit/API/worker validation can run without Docker or provider calls.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `4.1.10` in worker, API, providers, and DB workspaces. [VERIFIED: apps/worker/package.json] |
| Config file | `apps/worker/vitest.config.ts`, `apps/api/vitest.config.ts`, and workspace equivalents. [VERIFIED: apps/worker/vitest.config.ts] |
| Quick run command | `bun run --cwd apps/worker test --run src/render-lifecycle.test.ts src/output-persister.test.ts src/output-quality-reviewer.test.ts src/media-quality-analyzers.test.ts` |
| Full focused suite | `bun run --cwd packages/providers test --run src/vercel-gateway-seedance.test.ts && bun run --cwd apps/worker test --run src/render-lifecycle.test.ts src/output-persister.test.ts src/output-quality-reviewer.test.ts src/media-quality-analyzers.test.ts && bun run --cwd apps/api test --run src/generation.test.ts src/generation-service.test.ts` |

The focused full suite was executed in this research session with 8 provider tests, 27 passing worker tests (2 skipped), and 43 API tests; it makes no paid provider request. [VERIFIED: research-session command output]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-05 | Same operation submits/polls/reconciles after restart/error | unit + worker integration | `bun run --cwd apps/worker test --run src/render-lifecycle.test.ts` | ✅ |
| GEN-06 | Candidate is private-stored before completion | unit | `bun run --cwd apps/worker test --run src/render-lifecycle.test.ts src/output-persister.test.ts` | ✅ |
| GEN-07 | Host, redirect, size, MP4, codec/dimensions/audio/media failures reject | unit fixture | `bun run --cwd apps/worker test --run src/output-persister.test.ts src/media-quality-analyzers.test.ts` | ✅ |
| GEN-08 | Complete structured technical/visual decision required | unit fixture | `bun run --cwd apps/worker test --run src/output-quality-reviewer.test.ts src/media-quality-analyzers.test.ts` | ✅ |
| GEN-09 | At most two internal quality retries without duplicate customer settlement | unit + DB integration | `bun run --cwd apps/worker test --run src/render-lifecycle.test.ts` | ✅; PostgreSQL evidence add/retain |
| GEN-10 | Exactly-once charge/refund/release under concurrent/terminal paths | PostgreSQL integration | `bun run --cwd packages/db test --run test/generation-service.postgres.test.ts` | ✅ |
| GEN-11 | Latest accepted pointer survives failed regeneration and recovery is same operation | API + PostgreSQL integration | `bun run --cwd apps/api test --run src/generation.test.ts src/generation-service.test.ts` | ✅ |
| GEN-12 | Pre-acceptance cancel releases; Gateway post-acceptance does not fabricate cancel | API + worker unit | `bun run --cwd apps/api test --run src/generation-service.test.ts && bun run --cwd apps/worker test --run src/render-lifecycle.test.ts` | ✅ |
| GEN-13 | Owner-authorized fresh signed URL after expiry | API/storage integration + browser | API test command plus new browser fixture | ❌ browser proof gap |
| GEN-14 | Public DTO/logs omit provider IDs, raw errors, URLs, retries, secrets | API unit + log assertion | `bun run --cwd apps/api test --run src/generation.test.ts src/generation-service.test.ts` | ✅; add explicit redaction cases if absent |

### Sampling Rate

- **Per task commit:** Run the affected focused Vitest file(s), with no external provider calls.
- **Per wave merge:** Run the focused full suite above and relevant PostgreSQL integration tests on a disposable database.
- **Phase gate:** Full suite green plus one explicitly approved live canary and rendered-browser evidence for progress, cancellation truth, accepted output, and expired-download refresh.

### Wave 0 Gaps

- [ ] Add a deterministic media fixture proving full decode/probe occurs on the final normalized private object, not only the provider input.
- [ ] Add a PostgreSQL concurrency test that races reconciliation/retry/cancellation and proves one provider operation and one settlement outcome.
- [ ] Add API/log serialization tests asserting provider request IDs, raw provider errors, signed URLs, internal retry count, and quality internals are absent from every public response/log event.
- [ ] Add a rendered-browser test or manual evidence script for expired accepted-download URL refresh and pending cancellation copy.
- [ ] Create an explicit paid-canary checklist artifact with budget authorization, safe operation/host/checksum/ledger evidence; never run it in tests.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Owner-authenticated API routes and no provider identity in browser contracts. |
| V3 Session Management | Yes | Server-authorized download refresh, short-lived response URLs, no persisted signed URL. |
| V4 Access Control | Yes | Owner predicates, `withUserTransaction`, RLS, owner-scoped object-key lookup. |
| V5 Input Validation | Yes | Zod schemas for provider/status/quality data and strict media/URL checks. |
| V6 Cryptography | Yes | TLS-only download, S3 credentials/server-side signing, SHA-256 integrity metadata; no custom cryptography. |
| V8 Data Protection | Yes | Private buckets, no secrets/signed URLs/raw payloads in public or persisted telemetry. |
| V14 Configuration | Yes | Kill switch, readiness fingerprint, exact reviewed output host, server-only environment configuration. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Provider URL SSRF/DNS rebinding | Tampering / Information disclosure | Exact hosts, HTTPS, public IP filtering, DNS resolution and pinned address, every redirect revalidated. |
| Duplicate billable submit | Repudiation / Tampering | Persisted operation, unique keys, outbox/pg-boss singleton, reconcile unknown operations. |
| Double refund or credit spend | Tampering | Transactional `FOR UPDATE`, reservation status, append-only ledger idempotency. |
| Cross-user output refresh | Information disclosure | Owner-scoped run/output lookup before signing; never expose stable key/URL publicly. |
| Model/reviewer prompt injection via media/text | Tampering | Immutable confirmed facts, bounded private inputs, strict output schema, reviewer failure is rejection. |
| Sensitive diagnostics leak | Information disclosure | Safe public status DTO; sanitize telemetry and logs; omit provider URL/ID/raw response. |

## Sources

### Primary (HIGH confidence)

- Current source and tests opened in this session: provider adapter, worker lifecycle, output persister, quality analyzers/reviewer, generation schema/service, API service, and focused test suites. [VERIFIED: packages/providers/src/vercel-gateway-seedance.ts:38-67] [VERIFIED: apps/worker/src/output-persister.ts:334-400]
- Local focused fixture suite executed without a provider call: 8 provider tests, 27 passing worker tests, and 43 API tests. [VERIFIED: research-session command output]

### Secondary (MEDIUM confidence)

- [Vercel Video Generation Quickstart](https://vercel.com/docs/ai-gateway/getting-started/video) — current video entry point and model-specific contract caution.
- [Seedance 2.5 FAQ](https://vercel.com/ai-gateway/models/seedance-2.5/faq) — current model availability, audio, reference input, and `bytedance/seedance-2.5` identifier.
- [AI SDK video generation guide](https://ai-sdk.dev/docs/ai-sdk-core/video-generation) and [API reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-video) — asynchronous/experimental API, long-running polling, warnings, errors, and model-specific options.

### Tertiary (LOW confidence)

- None. Exact production operation payload, output host persistence, price, latency, and cancellation capabilities remain canary-proven facts rather than documentation assumptions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing packages/tools and tested seams were read and executed locally.
- Architecture: HIGH — current DB/API/worker/provider module boundaries and constraint decisions agree.
- Provider contract: MEDIUM — official Vercel/AI SDK docs were inspected, but the specific live account/model result remains a required authorized canary.
- Pitfalls: HIGH — derived from explicit security/settlement/quality controls in the existing code and locked context.

**Research date:** 2026-08-21
**Valid until:** 2026-08-28 for Vercel AI Gateway contract claims; codebase findings are valid for this checkout.
