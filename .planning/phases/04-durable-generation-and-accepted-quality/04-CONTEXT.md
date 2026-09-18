# Phase 4: Durable Generation and Accepted Quality - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase turns one already-authorized, quoted render request into one durable, MovPrompt-owned, technically valid, quality-approved result. It owns provider submission and reconciliation, safe output acquisition, normalization, quality acceptance, bounded internal retries, exact entitlement/credit settlement, cancellation truth, and secure output refresh. It does not add editing, campaign-pack exports, new provider families, billing, or project-library features.

</domain>

<decisions>
## Implementation Decisions

### Provider operation and recovery
- **D-01:** Production generation remains on the semantic `video.cinematic` and `video.product_fidelity` capabilities. Both resolve server-side to the approved Seedance 2.5 adapter only after live contract evidence; the browser never sends or receives provider/model IDs.
- **D-02:** Seedance v1 Pro Fast remains a development-only smoke tool. It is never a fallback for a customer render, never satisfies Phase 4 acceptance, and never changes the production capability registry.
- **D-03:** Omni stays disabled in this phase until a documented video contract, adapter, output parser, settlement path, and separately approved paid canary pass. Catalog presence is not provider proof.
- **D-04:** The worker persists the provider operation identifier and accepted timestamp before polling or charging. Browser closure, worker restart, polling timeout, and transient network failure must resume the same operation.
- **D-05:** An unknown or uncertain provider state is reconciled, never automatically resubmitted. A missing result URL or unrecognized output host parks the original run in a retryable internal state for review/reconciliation without creating another billable request.
- **D-06:** Provider output hosts use an exact reviewed allowlist. Every redirect is revalidated, HTTPS-only, public-address checked and address-pinned. Broad wildcard hosts and guessed documentation hosts are prohibited.

### Private output and technical acceptance
- **D-07:** Provider success is only an intermediate state. A run becomes completed only after the output is downloaded safely, copied to MovPrompt private storage, normalized, fully decoded, and approved by all required quality gates. — **Reversibility:** costly — Relaxing this would change the public meaning of completed runs and accepted project versions.
- **D-08:** PostgreSQL stores stable private bucket/object keys and immutable media metadata; signed URLs are response-only and short-lived. Expired downloads are refreshed through a new owner-authorized request.
- **D-09:** Technical validation is ordered and fail-closed: allowed origin and bounded download; MIME and MP4 signature; FFprobe container/codec/dimensions/duration/audio policy; normalization to MP4/H.264/AAC as needed; full decode; final dimension and duration verification.
- **D-10:** The requested delivery ratio remains part of the immutable quote. Native ratios preserve their requested canvas; 4:5 uses the supported provider canvas followed by a real deterministic 4:5 crop before acceptance.
- **D-11:** A candidate that cannot be safely acquired, decoded, normalized, or stored is invalid output, not customer success. The previous accepted version and output remain unchanged.

### Quality acceptance and bounded retries
- **D-12:** Technical checks run before visual/business review. Visual approval covers product identity, confirmed facts, price/offer/CTA truth, Arabic and bilingual legibility, safe zones, visual defects, and vertical-specific policy.
- **D-13:** Automated quality review is structured, bounded, versioned, evidence-bearing, and fail-closed. Invalid schemas, unavailable reviewers, unsupported inputs, or ambiguous decisions never approve an output.
- **D-14:** One quote buys one accepted result and permits at most two internal quality retries after the initial attempt. Internal provider failures or rejected candidates do not create extra customer charges. — **Reversibility:** costly — Retry accounting is bound to quote economics, attempt history, and exactly-once settlement.
- **D-15:** Retries may correct the same immutable configuration and confirmed facts but cannot silently alter product identity, campaign copy, price, CTA, language, ratio, resolution, audio, or rights. Any user-requested visual change is a new quoted version outside the internal retry budget.
- **D-16:** If no candidate passes within the bounded attempt budget, the run fails honestly, value is restored exactly once, and the UI offers retry from the preserved project/version rather than accepting the best failed candidate.

### Cancellation, settlement, and public truth
- **D-17:** Before provider acceptance, cancellation is immediate and releases the reservation/entitlement exactly once. After acceptance, the run remains cancelling until the adapter confirms cancellation or the provider operation reaches another terminal state.
- **D-18:** The Gateway adapter does not claim cancellation support without a documented and proven contract. If cancellation cannot be confirmed, the worker continues reconciliation and the product explains that cancellation is pending.
- **D-19:** Provider acceptance consumes the starter entitlement or converts the reserved credits into one exact charge. Failure, invalid output, exhausted quality retries, timeout, or confirmed cancellation refunds/restores exactly once; retries and concurrent reconciliation cannot double-settle.
- **D-20:** Every provider attempt records sanitized operation metadata, integer micro-USD cost when available, latency, outcome, technical/quality decision, and retry ordinal. Secrets, signed URLs, raw provider payloads, and internal diagnostics never enter public responses.
- **D-21:** The last accepted project version advances only after final quality approval. Starting or failing a newer working version never replaces it.
- **D-22:** Public progress is derived only from persisted server stages. It uses plain user language, exposes a request ID for support, and never shows a simulated percentage, raw provider error, model name, internal retry count, or signed provider URL.
- **D-23:** New quotes/submissions remain behind one server kill switch and runtime readiness fingerprint. Already accepted operations continue reconciling even when new generation is disabled.

### Evidence and activation
- **D-24:** Unit, API, worker, PostgreSQL, storage, media, and adversarial tests use mocks/fixtures by default. No paid provider request is made implicitly by a test, build, migration, or planning command.
- **D-25:** Each real canary requires explicit current budget authorization. It records configuration hash, provider operation, cost, timings, output host, private object checksum, media validation, quality decision, and exactly-once ledger evidence.
- **D-26:** Phase 4 cannot be declared complete from code alone. At least one real approved production-model operation must survive browser closure/restart, reconcile the same provider operation, persist a privately owned accepted MP4, and pass the failure/cancellation settlement matrix.

### the agent's Discretion
- Exact polling cadence, lease duration, backoff curve, and internal stage names, provided they are bounded, durable, observable, and do not change the public truth contract.
- Exact FFmpeg normalization arguments and quality score thresholds, provided golden fixtures and real canary evidence prove the required output contract.
- Exact internal attempt/status table additions, provided existing append-only, idempotent, owner-scoped database patterns are preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and release contract
- `.planning/PROJECT.md` — Product constraints: beginner-first, Kuwait truth, accepted-output economics, and evidence requirements.
- `.planning/REQUIREMENTS.md` — GEN-05 through GEN-14 are the locked Phase 4 requirements.
- `.planning/ROADMAP.md` — Phase boundary, success criteria, and three-plan delivery order.
- `.planning/phases/03-product-and-service-golden-paths/03-CONTEXT.md` — Preserved source facts, quote, rights, and beginner-facing state decisions entering generation.

### Runtime and provider operations
- `docs/runbooks/GENERATION_ACTIVATION.md` — Fail-closed staging activation, heartbeat/fingerprint, canary, stop, and rollout procedure.
- `docs/product/VERCEL_GATEWAY_LOCAL.md` — Current Seedance contracts, private first-frame preparation, output-host rules, development smoke boundary, and cancellation limitation.
- `.planning/codebase/ARCHITECTURE.md` — Canonical API/outbox/pg-boss/worker/private-storage flow.
- `.planning/codebase/INTEGRATIONS.md` — Current provider, quality reviewer, S3, FFmpeg, and environment integration inventory.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/providers/src/vercel-gateway-seedance.ts`: current durable Seedance async adapter boundary.
- `packages/providers/src/capability-registry.ts`: fail-closed semantic capability resolution.
- `apps/worker/src/render-lifecycle.ts`: submit/reconcile/retry/settlement lifecycle and accepted-version update boundary.
- `apps/worker/src/output-persister.ts`: safe output acquisition, normalization, and private storage copy.
- `apps/worker/src/media-quality-analyzers.ts`: structured multimodal quality review boundary.
- `packages/db/src/generation-service.ts`: quote binding, reservation, charge/refund, idempotency, and outbox invariants.
- `packages/db/src/service-heartbeat.ts` and `apps/worker/src/service-heartbeat.ts`: API/worker readiness agreement.

### Established Patterns
- Server-only capability aliases; raw provider IDs never cross the public contract.
- Transactional outbox plus pg-boss singleton jobs; the browser displays status but never completes work.
- Working-version and accepted-version pointers are separate; only approved completion advances accepted.
- Stable private object keys are stored; signed URLs are generated on demand.
- Runtime availability fails closed when capability, pricing, storage, quality tools, heartbeat, or fingerprints disagree.

### Integration Points
- API quote/start/status/cancel routes in `apps/api/src/generation-service.ts`.
- Worker composition and provider registration in `apps/worker/src/main.ts`.
- Render attempts, runs, outputs, ledger, entitlement, and heartbeat tables in `packages/db/src/schema.ts` and migrations.
- User progress/retry states in `apps/web/src/features/create/CreateStudio.tsx` consume persisted run stages only.

</code_context>

<specifics>
## Specific Ideas

- Product wording should remain calm and outcome-oriented: building, checking, finalizing, ready, needs attention. Internal provider and retry mechanics stay out of the beginner interface.
- Unknown provider output origin is an operator incident on the same operation, not a reason to create a second customer charge.
- Real canary execution is an explicit evidence checkpoint, never a hidden automated side effect.

</specifics>

<deferred>
## Deferred Ideas

- Omni video activation remains deferred until its own documented adapter, parser, settlement path, and canary pass.
- Deterministic four-format campaign-pack exports belong to Phase 6.
- Advanced direction UI and multi-direction generation belong to Phase 8.
- Production rollout percentages, alert dashboards, and 72-hour soak belong to Phase 10.

</deferred>

---

*Phase: 04-durable-generation-and-accepted-quality*
*Context gathered: 2026-08-21*
