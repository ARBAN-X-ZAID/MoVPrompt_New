---
phase: 02-guest-authentication-and-data-integrity
plan: "01"
subsystem: api-database
tags: [postgresql, drizzle, rls, idempotency, guest-claims, hono]
requires:
  - phase: 01-production-truth-foundation
    provides: owner-scoped project/version data plane and portable PostgreSQL migrations
provides:
  - Durable owner-bound guest claim operations and ordered asset checkpoints
  - Replay-safe guest claim service with PostgreSQL lifecycle proof
  - Guarded disposable PostgreSQL 17 migration validator
affects: [02-02, 02-03, auth-callbacks, guest-recovery, private-media]
actuals:
  tokens: 13032
  tasks: 3
  commits: 8
tech-stack:
  added: []
  patterns: [owner-scoped lifecycle repository, advisory-lock claim replay, guarded disposable PostgreSQL validation]
key-files:
  created:
    - packages/contracts/src/guest-claims.ts
    - packages/db/migrations/0015_guest_claim_operations.sql
    - apps/api/src/guest-claim-repository.ts
    - apps/api/src/guest-claim-service.ts
    - apps/api/src/guest-claim-service.postgres.test.ts
    - scripts/infra/validate-phase2-migrations.sh
  modified:
    - packages/db/src/schema.ts
    - apps/api/src/creator-routes.ts
    - apps/api/src/runtime-services.ts
key-decisions:
  - "Allocate a draft project at claim start, but keep it non-ready until every required asset is verified and the immutable version is persisted."
  - "Use a globally unique opaque draft plus user-and-intent uniqueness and advisory locks for generic, replay-safe conflicts."
  - "Permit migration validation only through a generated local PostgreSQL 17 database and always tear it down with an exact-name guard."
patterns-established:
  - "Claim lifecycle state belongs in GuestClaimService; GuestClaimRepository owns owner-scoped SQL and locking."
  - "Asset verification accepts canonical private storage keys only and never persists signed URLs."
requirements-completed: [AUTH-07, AUTH-08, AUTH-10]
coverage:
  - id: D1
    description: "Authenticated asset-free guest snapshots replay to one immutable owned project/version receipt without cross-owner disclosure."
    requirement: AUTH-07
    verification:
      - kind: integration
        ref: "apps/api/src/guest-claim-service.postgres.test.ts#creates one immutable receipt for an exact asset-free replay"
        status: pass
    human_judgment: false
  - id: D2
    description: "Claim operations and asset checkpoints enforce owner tuples, forced RLS, constraints, and safe migration replay."
    requirement: AUTH-08
    verification:
      - kind: integration
        ref: "scripts/infra/validate-phase2-migrations.sh"
        status: pass
    human_judgment: false
  - id: D3
    description: "Concurrent claims converge, failed asset checkpoints resume, and only verified assets can finalize a ready receipt."
    requirement: AUTH-10
    verification:
      - kind: integration
        ref: "apps/api/src/guest-claim-service.postgres.test.ts#serializes a claim lifecycle and refuses finalization until every asset is verified"
        status: pass
    human_judgment: false
duration: 18min
completed: 2026-08-19
status: complete
---

# Phase 02 Plan 01: Guest Claim Boundary Summary

**Replay-safe PostgreSQL guest-claim lifecycle with immutable receipts, verified private-asset checkpoints, and owner-enforced RLS.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-19T16:38:26Z
- **Completed:** 2026-08-19T16:56:26Z
- **Tasks:** 3/3
- **Files modified:** 14

## Accomplishments

- Routed the authenticated claim endpoint through a strict contract, dedicated service, and repository boundary; a live PostgreSQL tracer proves exact replay and generic conflicts.
- Added durable claim-operation and per-asset checkpoint tables with immutable snapshot data, owner tuples, indexes, forced RLS, and no signed-URL persistence.
- Implemented start, resume, asset verification/failure, and finalization transitions; only fully verified assets yield a ready project/version receipt.
- Added a guarded PostgreSQL 17 migration harness that only creates and drops generated local disposable databases, then proves empty-to-latest and repeat migration safety.

## Task Commits

1. **Task 1: Route one asset-free authenticated snapshot through the dedicated claim boundary** - `c065438`, `0bcf1a0`
2. **Task 2: Persist durable claim and per-asset checkpoints with owner RLS** - `0152987`, `2d21222`, `fda8693`
3. **Task 3: Move start, resume and finalize semantics fully behind the claim service** - `1d74c10`, `6268645`, `225594c`

## Files Created/Modified

- `packages/contracts/src/guest-claims.ts` - strict snapshot, manifest, status, receipt, and response contracts.
- `packages/db/migrations/0015_guest_claim_operations.sql` - durable claim operation/asset storage, constraints, indexes, and forced owner RLS.
- `apps/api/src/guest-claim-repository.ts` - owner-scoped locks, transitions, canonical asset-key validation, and final receipt persistence.
- `apps/api/src/guest-claim-service.ts` - lifecycle application boundary and stable error mapping.
- `scripts/infra/validate-phase2-migrations.sh` - guarded disposable PostgreSQL 17 migration proof.

## Decisions Made

- Projects are created as non-ready at claim start so private asset keys have a project namespace, while versions and ready visibility wait for all checkpoint verification.
- The database is authoritative for intent replay: global draft uniqueness, user-plus-intent uniqueness, and advisory locks prevent duplicate or cross-owner claims.
- Migration verification is intentionally local and disposable; it rejects non-local administrative endpoints and environment-like markers before creating any database.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Registered claim tables in the exported Drizzle runtime schema map.**
- **Found during:** Task 2 PostgreSQL validation
- **Issue:** The migration and TypeScript definitions existed, but runtime Drizzle composition could not address the new tables.
- **Fix:** Added both tables to the schema export and re-ran PostgreSQL integration tests.
- **Files modified:** `packages/db/src/schema.ts`
- **Verification:** Focused PostgreSQL suite passed.
- **Committed in:** `fda8693`

**2. [Rule 1 - Bug] Updated the existing creator-route PostgreSQL test to exercise the new claim boundary.**
- **Found during:** Task 3 regression verification
- **Issue:** The legacy test omitted the required pending intent and injected no claim service, causing a 503 instead of its expected claim result.
- **Fix:** Composed the durable service and submitted the strict snapshot contract.
- **Files modified:** `apps/api/src/creator-routes.postgres.test.ts`
- **Verification:** `guest-claim-service.postgres creator-routes` passed 12 tests.
- **Committed in:** `225594c`

**Total deviations:** 2 auto-fixed Rule 1 issues.
**Impact on plan:** Both fixes were required to exercise the planned boundary against PostgreSQL; no scope expansion.

## Issues Encountered

- The supplied PostgreSQL administrative endpoint was used only to create generated `movprompt_phase2_test_*` databases; each was dropped after its verification command completed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 2 now has one durable guest-to-owner claim authority with replay, ownership, and asset-finalization proofs. Subsequent auth callback and browser recovery plans can call this boundary without creating duplicate projects or exposing private media.

## Self-Check

PASSED - all listed artifacts exist and all eight task commits are present in git history.
