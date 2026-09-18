# Phase 04 Coverage — Vercel Gateway and Source Audit

**Phase goal:** Convert an accepted request into a MovPrompt-owned, technically valid, quality-approved result with exact settlement.

## External API Coverage

The public product uses semantic capabilities only. Provider/model identifiers remain server-side, and every automated command in the three plans is non-billable.

| capability | decision | reason |
|---|---|---|
| Seedance 2.5 async submit | INTEGRATE | Plan 04-01 submits once through `vercel-gateway-seedance.ts` with the stable per-attempt provider idempotency key and persists the opaque operation before polling or economic acceptance. |
| Seedance 2.5 status / polling | INTEGRATE | Plan 04-01 parses the documented status contract strictly and lets pg-boss reconcile the persisted operation after browser/worker interruption. |
| Same-operation reconciliation | INTEGRATE | Plans 04-01 and 04-03 resume the existing operation after missing output, unknown state, timeout, restart, or newly reviewed output host. |
| Generated result / output acquisition | INTEGRATE | Plans 04-01 and 04-02 accept only an exact reviewed HTTPS host, revalidate public DNS/redirects, bound bytes, and retain a valid MovPrompt private object before acceptance. |
| Generation warnings / sanitized metadata | INTEGRATE | Plans 04-01 and 04-03 store sanitized outcome, integer micro-USD cost when supplied, latency, and bounded usage metadata in the immutable attempt. |
| Customer/provider cancellation endpoint | OPT-OUT | No documented and proven Gateway request-cancel contract is available; pre-acceptance cancellation releases locally while post-acceptance stays `cancelling` and reconciles the original operation. |
| Provider webhooks | OPT-OUT | No documented Gateway video webhook contract is established for this adapter; durable status reconciliation is the authoritative path. |
| Omni video | OPT-OUT | Deferred by D-03 because no proven video adapter, parser, settlement path, or authorized canary exists. |
| Seedance v1 Pro Fast in production | OPT-OUT | D-02 restricts it to guarded development smoke tooling and forbids production capability resolution/fallback. |
| Generic AI SDK `experimental_generateVideo` as customer workflow | OPT-OUT | The customer lifecycle uses the durable start/status adapter; the experimental helper remains guarded smoke tooling only. |
| Provider-hosted URL as customer delivery | OPT-OUT | D-07/D-08 require private MovPrompt ownership and response-time owner signing instead of provider URL delivery. |
| Broad host wildcards or guessed hosts | OPT-OUT | D-06 requires exact canary-observed and reviewed hostnames; unknown hosts park the same operation for review. |

## Requirement Coverage

| Requirement | Observable contract | Plan | Status |
|---|---|---:|---|
| GEN-05 | Worker submits, polls, reconciles, and completes independently of the browser. | 04-01, 04-03 | COVERED |
| GEN-06 | Candidate output is copied into private MovPrompt storage before completion. | 04-01 | COVERED |
| GEN-07 | Final owned output passes origin, container, codec, dimension, duration, audio, normalization, and full-decode checks. | 04-01 | COVERED |
| GEN-08 | Final output passes product/fact, Arabic/text, visual, safe-zone, and compliance quality review. | 04-02 | COVERED |
| GEN-09 | One initial attempt plus at most two internal quality retries settle as one customer result. | 04-02, 04-03 | COVERED |
| GEN-10 | Every terminal failure/cancellation restores value exactly once. | 04-03 | COVERED |
| GEN-11 | Failed regeneration preserves the last accepted version and offers a truthful retry. | 04-02, 04-03 | COVERED |
| GEN-12 | Cancellation truth differs before and after provider acceptance. | 04-01, 04-03 | COVERED |
| GEN-13 | An owner can refresh an expired accepted-output download URL. | 04-03 | COVERED |
| GEN-14 | Public responses/logs omit provider, secret, URL, and internal retry details. | 04-01, 04-03 | COVERED |

## Locked Decision Coverage

| Decision | Plan | Implementation coverage |
|---|---:|---|
| D-01 | 04-01 | Only semantic cinematic/product-fidelity capabilities resolve to the server-only Seedance 2.5 adapter after readiness evidence. |
| D-02 | 04-01, 04-03 | v1 Pro Fast remains an explicitly guarded development smoke path and cannot satisfy the canary. |
| D-03 | 04-01, 04-03 | Omni remains disabled and absent from production adapter/parser/canary evidence. |
| D-04 | 04-01 | Operation and accepted timestamp persist before polling/settlement; restart resumes the same operation. |
| D-05 | 04-01 | Uncertain state, missing result, or unknown host parks/reconciles; it does not resubmit. |
| D-06 | 04-01 | Exact HTTPS host, public-address pinning, and redirect-by-redirect revalidation. |
| D-07 | 04-01, 04-02 | Provider completion is intermediate; Plan 04-01 proves private/full-decode technical acceptance and Plan 04-02 supplies human-calibrated quality acceptance. |
| D-08 | 04-01, 04-03 | Database stores stable bucket/key/metadata; owner-authorized URLs are short-lived responses only. |
| D-09 | 04-01 | Ordered origin, signature, probe, normalization, full decode, and final-probe gate. |
| D-10 | 04-01 | Quote canvas is immutable; supported 4:5 source becomes a real deterministic final 4:5 file. |
| D-11 | 04-02, 04-03 | Invalid candidate leaves the previous accepted version/output unchanged. |
| D-12 | 04-02 | Technical approval precedes complete visual/business review. |
| D-13 | 04-02, 04-03 | Automation builds the checksum/schema/metrics/approval validator but cannot fabricate labels; Task 04-02-03 separately blocks on two qualified-human labels per candidate, role attestations, adjudication, approval record, kappa/Spearman >= 0.70 and zero critical false accepts. Runtime accepts only that validated exact-version artifact, and the paid canary cannot replace it. |
| D-14 | 04-02, 04-03 | One quote covers at most three total attempts and one economic result. |
| D-15 | 04-02 | Retry reuses the immutable configuration/facts and only a deterministic retry directive. |
| D-16 | 04-02, 04-03 | Exhaustion fails honestly, restores value once, and preserves the manual retry source. |
| D-17 | 04-01, 04-03 | Immediate pre-acceptance release; accepted operation stays cancelling until terminal truth. |
| D-18 | 04-01, 04-03 | Adapter does not claim a cancellation endpoint; public state remains pending/reconciling. |
| D-19 | 04-03 | Acceptance and all restore paths are row-locked and idempotent. |
| D-20 | 04-01, 04-03 | Attempt telemetry is sanitized and internal; public/log redaction is verified. |
| D-21 | 04-02, 04-03 | Accepted pointer advances only after final approval. |
| D-22 | 04-01, 04-03 | Public progress uses persisted stages, plain copy, and request ID only. |
| D-23 | 04-01 | Kill switch blocks new work while accepted operations continue reconciliation. |
| D-24 | 04-01, 04-02, 04-03 | Tests/eval/build/migration commands use mocks/fixtures and cannot call a paid provider. |
| D-25 | 04-03 | The one real canary is blocked on current budget authorization and records the specified safe evidence. |
| D-26 | 04-03 | Phase completion requires the authorized production-model recovery/private-media/settlement proof. |

## Research Coverage

| Research item | Plan | Status / handling |
|---|---:|---|
| Persisted operation plus pg-boss singleton reconciliation | 04-01 | COVERED |
| Candidate-to-owned-media gate | 04-01 | COVERED |
| Ordered final-object technical validation | 04-01 | COVERED |
| Complete structured visual/business review | 04-02 | COVERED |
| Executable 48-case human calibration and exact-version fail-closed readiness | 04-02, 04-03 | COVERED — automated candidate/import/schema/metrics/approval validator, separate blocking two-reviewer human calibration/adjudication/approval checkpoint, validated runtime artifact gate, and independent canary precondition |
| Immutable same-configuration retry evidence | 04-02 | COVERED |
| Transactional exact settlement and cancellation truth | 04-03 | COVERED |
| Owner-only response-time output signing | 04-03 | COVERED |
| `kw-video-48-v1` non-billable evaluation manifest and runner | 04-02 | COVERED |
| Explicit authorized production canary | 04-03 | COVERED |
| Reuse installed PostgreSQL/pg-boss/S3/FFmpeg/Zod/AI SDK stack | all | COVERED — no package installation |
| A1 polling cadence | 04-01 | FLAGGED ASSUMPTION — keep bounded/configurable; validate with canary timings before activation. |
| A2 no Gateway cancel endpoint | 04-01, 04-03 | FLAGGED ASSUMPTION — recheck official contract at execution; pending cancellation remains the safe behavior. |
| A3 exact output host | 04-01, 04-03 | FLAGGED ASSUMPTION — canary records hostname; unknown host pauses the same operation for review. |

## Spec-less Edge-Probe Closure

| Probe | Acceptance criterion | Plan | Resolution |
|---:|---|---:|---|
| 1 | Browser closure cannot interrupt or complete a run; server state resumes it. | 04-01, 04-03 | TEST + CANARY |
| 2 | Worker restart with a persisted operation calls status, never submit. | 04-01 | TEST |
| 3 | Transient/ambiguous start or status response cannot create a second provider operation. | 04-01 | TEST |
| 4 | Missing result URL remains retryable/reconciling on the same operation. | 04-01 | TEST |
| 5 | Unknown output hostname stops acquisition and records hostname-only evidence without another request. | 04-01, 04-03 | TEST + CANARY |
| 6 | Provider `completed` cannot set product completion before private ownership and acceptance. | 04-01, 04-02 | TEST |
| 7 | Empty, truncated, oversized, wrong-MIME, or bad-signature output is rejected. | 04-01, 04-02 | TEST |
| 8 | The final normalized private object—not only provider bytes—passes FFprobe and full decode. | 04-01 | TEST |
| 9 | Requested ratio/resolution/duration/audio remain quote-bound; 4:5 is an actual 4:5 final file. | 04-01 | TEST |
| 10 | Missing, duplicate, schema-invalid, timed-out, ambiguous, unattested, unapproved, stale-checksum/version, or below-threshold quality evidence cannot approve; automation never fabricates labels, qualified-human calibration is blocking, and the canary cannot substitute. | 04-02, 04-03 | VALIDATOR + HUMAN CHECKPOINT + TEST + CANARY PRECONDITION |
| 11 | Product/facts/Arabic/bilingual/safe-zone/compliance failures reject even when visual score is attractive. | 04-02 | EVAL FIXTURE |
| 12 | One initial attempt plus no more than two same-configuration internal retries creates one customer settlement. | 04-02, 04-03 | TEST |
| 13 | Concurrent reconciliation, retry, cancellation, and terminal delivery cannot double-settle or create another operation. | 04-03 | POSTGRESQL RACE TEST |
| 14 | Pre-acceptance cancel releases immediately; post-acceptance remains cancelling until confirmed terminal state. | 04-01, 04-03 | API/WORKER/BROWSER TEST |
| 15 | Failed newer work cannot replace the previous accepted version/output. | 04-02, 04-03 | POSTGRESQL/API TEST |
| 16 | Expired output access refreshes only for the owner, while public DTOs/logs remain redacted. | 04-01, 04-03 | API/BROWSER/REDACTION TEST |

## Schema and Migration Gate

No Phase 04 plan edits `packages/db/src/schema.ts` or adds a migration: the existing `render_runs`, immutable `render_attempts`, provider cost/latency/usage columns, owner keys, attempt bounds, ledger keys, and accepted-version pointers already express the locked contract. Plan 04-03 Task 04-03-01 requires `docs/runbooks/PHASE4_PAID_CANARY.md` to document an isolated `postgres:17-alpine` container named `movprompt-phase4-pg17` on loopback port 55434, exact readiness/migration/check/race-test commands, an EXIT cleanup trap plus explicit `docker stop`, an absence check, and the equivalent ephemeral CI service contract. `MOVPROMPT_TEST_DATABASE_URL` must identify that disposable database; a shared database is rejected. If execution discovers that a source schema change is actually required, the executor must stop, add an ordered migration plus schema parity, and insert a blocking `bun run db:migrate && bun run db:check` validation before continuing; destructive schema push is not permitted.

## Execution Discipline

- Every task receives its own focused commit containing only that task's listed files and verification evidence.
- Provider/worker/database changes and frontend/API changes are never mixed in one task commit.
- Existing unrelated dirty-tree files are never staged by Phase 04 execution.
- Automated calibration work may build candidates and validate/import evidence, but only blocking Task 04-02-03 may create the approved production calibration artifact from genuine qualified-human review records.

## Multi-Source Coverage Audit

| Source | IDs / item group | Plans | Status |
|---|---|---:|---|
| GOAL | Owned, technically valid, quality-approved output with exact settlement | 04-01..04-03 | COVERED |
| REQ | GEN-05..GEN-14 | 04-01..04-03 | COVERED 10/10 |
| CONTEXT | D-01..D-26 | 04-01..04-03 | COVERED 26/26 |
| RESEARCH | Architecture, quality/eval, security, assumptions, canary | 04-01..04-03 | COVERED; A1..A3 explicitly flagged |
| DEFERRED | Omni, four-format pack, Advanced directions, rollout/soak | none | EXCLUDED BY SOURCE |
