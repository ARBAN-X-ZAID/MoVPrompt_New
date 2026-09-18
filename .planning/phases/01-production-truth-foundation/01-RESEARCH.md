# Phase 1 Research: Current Implementation and Gaps

## Executive Finding

Most Phase 1 components already exist in the dirty brownfield worktree. The task is to reconcile, test, and close gaps without replacing the architecture. The current local API, worker, and web processes are stopped, so no runtime-ready claim is presently valid.

## Existing Building Blocks

### Availability and runtime agreement

- `apps/api/src/generation-availability.ts` evaluates the kill switch, quality model/key, FFmpeg/FFprobe, both video capabilities, 480p/720p pricing, private buckets, worker heartbeat, and a shared runtime fingerprint.
- `packages/providers/src/runtime-fingerprint.ts` hashes only non-secret configuration and secret presence.
- `apps/worker/src/service-heartbeat.ts` writes ready/stopping heartbeats.
- `packages/db/src/service-heartbeat.ts` and migrations `0013`/`0014` provide heartbeat, telemetry, and persisted processing-stage data.

### Quotes and settlement

- `apps/api/src/generation-pricing.ts` supports versioned 480p/720p rates and fails closed when a tier is missing.
- `packages/db/src/generation-service.ts` owns quote hashes, reservations, idempotency, starter entitlement, charge, release, and refund invariants.
- API generation routes already use the availability service before quotes/submissions.

### Durable progress and output truth

- Render runs expose a persisted `processingStage` contract.
- `apps/worker/src/render-lifecycle.ts` advances stages and persists terminal state.
- `apps/web/src/features/create/CreateStudio.tsx` and `apps/web/src/pages/CreatorProjects.tsx` map named stages for the user.
- Project working and accepted version pointers are separated by migration `0011`.

## Gaps to Prove or Fix

1. Local runtime is currently offline; heartbeat, storage, feature flags, quotes, and browser recovery are unproven in the current checkout.
2. Migrations through `0014` must be applied and validated on a disposable PostgreSQL 17 database and the selected local database.
3. API and worker environment parity must be validated without exposing secrets.
4. Availability responses must remain safe and distinguish disabled, pricing, capability, worker, storage, and quality causes.
5. Quote invalidation must include every cost/output-affecting field used by Template Mode.
6. Starter entitlement and repeated submit behavior need current PostgreSQL concurrency proof.
7. Canonical UI must not show a fabricated 92% or demo/template media as generated output.
8. Previously completed/stuck runs need an owner-safe status/output reconciliation path and must appear in Projects.
9. Browser QA must prove refresh/close recovery and truthful state copy in both languages/themes.

## Implementation Pattern

Use PostgreSQL as the source of truth, Hono only as an owner-scoped boundary, pg-boss/outbox for execution, and React as a projection of the current run. Never let the browser advance or complete a run.

## Validation Architecture

### Unit and contract

- Availability reason ordering and safe public payload.
- Pricing tiers, TTL, invalid duration/resolution, and deterministic configuration hash.
- Runtime fingerprint parity and mismatch.
- Heartbeat freshness.
- UI stage/copy mapping and quote retry behavior.

### PostgreSQL integration

- Migrations `0000` through `0014` on fresh PostgreSQL 17.
- Restricted API/worker roles.
- Duplicate quote/start concurrency.
- Starter entitlement reserve/consume/restore and exactly-once settlement.
- Working/accepted version preservation on failure.

### Runtime integration

- Start PostgreSQL, MinIO, API, and worker.
- Verify `/healthz`, `/api/v1/health`, and `/api/v1/feature-flags`.
- Complete a queue health job and observe a fresh heartbeat.
- Confirm storage put/head/get round trip.
- Confirm a valid quote only when all readiness inputs agree.

### Browser

- Test ready, unavailable, retry, price-changed, generating, failed, cancelled, and ready states.
- Reload during generation and verify the same run/stage.
- Verify no sample/preview/direction is labeled as generated.
- Run keyboard, screen-reader semantics, contrast, responsive, RTL, theme, and reduced-motion checks.

