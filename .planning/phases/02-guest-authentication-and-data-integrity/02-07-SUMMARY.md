---
phase: 02-guest-authentication-and-data-integrity
plan: "07"
subsystem: database-integrity
tags: [postgresql, rls, pg-boss, private-storage, cleanup, idempotency]
requires:
  - phase: 02-06
    provides: source-aware immutable project and claim paths
provides:
  - 24-hour leased cleanup for abandoned private claim objects
  - guarded PostgreSQL 17 migration/rerun/drop and restricted-role RLS proof
  - disposable two-user callback, claim, creator, asset, and data-plane evidence
affects: [guest-claim, worker, creator-api, storage, phase-2-verification]
actuals:
  tokens: 13845
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns: [durable cleanup lease in bounded asset audit metadata, generated-database-only harness, restricted current_user RLS probe]
key-files:
  created:
    - apps/worker/src/abandoned-claim-cleanup.ts
    - apps/worker/src/abandoned-claim-cleanup.test.ts
    - packages/db/src/abandoned-claim-cleanup-repository.ts
    - packages/db/migrations/0017_force_phase2_owner_rls.sql
    - scripts/infra/validate-phase2-migrations.test.sh
  modified:
    - apps/worker/src/pg-boss-worker.ts
    - apps/worker/src/main.ts
    - scripts/infra/validate-phase2-migrations.sh
    - scripts/infra/check-rls-isolation.sql
    - apps/api/src/creator-routes.postgres.test.ts
    - apps/api/src/auth-provider-stubs.test.ts
key-decisions:
  - "Cleanup uses a durable asset checkpoint lease and recheck, so finalization cannot race into deletion."
  - "Migration tests accept only local postgres admin URLs and generated movprompt_phase2_test_* targets."
  - "All Phase 2 owner tables force RLS and are exercised through a non-superuser non-bypass role."
patterns-established:
  - "Run PostgreSQL integration suites in fresh guarded databases when test fixtures expect an empty data plane."
requirements-completed: [AUTH-08, AUTH-09, AUTH-10, SOURCE-05, PROJ-06]
coverage:
  - id: D1
    description: Abandoned private claim assets retain for 24 hours, then clean idempotently without touching finalized media.
    requirement: AUTH-09
    verification:
      - kind: unit
        ref: apps/worker/src/abandoned-claim-cleanup.test.ts#AbandonedClaimCleanupService
        status: pass
    human_judgment: false
  - id: D2
    description: Fresh PostgreSQL migrations rerun safely and prove forced owner RLS under a restricted database role.
    requirement: PROJ-06
    verification:
      - kind: integration
        ref: scripts/infra/validate-phase2-migrations.sh
        status: pass
    human_judgment: false
  - id: D3
    description: Two-user callback, guest claim, creator route, asset, and data-plane replay/isolation matrix has disposable PostgreSQL evidence.
    requirement: AUTH-08
    verification:
      - kind: integration
        ref: apps/api/src/auth-provider-stubs.test.ts plus guest-claim-service.postgres.test.ts plus creator-routes.postgres.test.ts
        status: pass
      - kind: integration
        ref: packages/db/test/creator-data-plane.postgres.test.ts
        status: pass
    human_judgment: false
duration: 17m
completed: 2026-08-19
status: complete
---

# Phase 02 Plan 07: Operational Integrity Summary

**Audited 24-hour private-claim cleanup, forced owner RLS, and fresh PostgreSQL 17 replay/isolation evidence close Phase 2’s abandoned-object and cross-account integrity paths.**

## Performance

- **Duration:** 17m
- **Started:** 2026-08-19T20:26:00Z
- **Completed:** 2026-08-19T20:42:46Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments

- Added a singleton, bounded pg-boss cleanup schedule that leases stale private claim assets, validates their canonical namespace, rechecks finalization, treats object-not-found as success, and records sanitized retry and terminal audit state.
- Added destructive-safe PostgreSQL 17 migration validation: strict local URL and generated-name guards, empty-to-latest catalog checks, rerun proof, restricted-role/current-user assertions, two-user read/update/delete/reference attacks, and verified trap cleanup.
- Ran fresh disposable PostgreSQL matrices for the earlier callback, guest-claim, creator-route, and data-plane suites; closed Windows entries 1–3 after passing evidence.

## Verification

- Passed worker cleanup test: 6 tests.
- Passed migration guard preflight test.
- Passed guarded migration harness with fresh migration, rerun, RLS proof, and zero generated databases left after trap cleanup.
- Passed on independent freshly migrated guarded databases: API creator routes plus assets (15 tests), auth provider stubs (5 tests), guest claim service (4 tests), and DB creator data plane (3 tests).
- Passed API, worker, and DB typechecks.

## Task Commits

1. **Task 1: Clean one 24-hour abandoned claim object through pg-boss** — 8d1fea2 (test), ed051e2 (feat)
2. **Task 2: Prove guarded migrations and restricted-role RLS invariants** — 1bf6c33 (test), f6faa24 (feat)
3. **Task 3: Run the complete two-user replay, asset and cleanup adversarial matrix** — 7a3ba9d (test), d4ce6fd (fix)

## Files Created/Modified

- apps/worker/src/abandoned-claim-cleanup.ts — injectable 24-hour cleanup service.
- packages/db/src/abandoned-claim-cleanup-repository.ts — durable lease/recheck/audit persistence.
- apps/worker/src/pg-boss-worker.ts and apps/worker/src/main.ts — singleton scheduled cleanup composition.
- packages/db/migrations/0017_force_phase2_owner_rls.sql — forced RLS for every Phase 2 owner table.
- scripts/infra/validate-phase2-migrations.sh and scripts/infra/check-rls-isolation.sql — guarded migration and restricted-role proof.
- apps/api/src/creator-routes.postgres.test.ts and apps/api/src/auth-provider-stubs.test.ts — concurrent claim and no-new-claim assertions.

## Decisions Made

- Cleanup changes a leased checkpoint to securing, which prevents finalization from accepting it until cleanup releases or completes the lease.
- Cleanup audit state is stored in the existing bounded asset metadata rather than adding a separate retention table.
- The protected user-owned packages/db/test/creator-data-plane.postgres.test.ts was executed but never edited, staged, or committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical security] Forced RLS on existing Phase 2 owner tables**
- **Found during:** Task 2
- **Issue:** The restricted-role probe showed several owner tables had RLS enabled but were still owner-bypassable.
- **Fix:** Added portable migration 0017_force_phase2_owner_rls.sql and journal entry.
- **Verification:** Fresh migration harness and restricted-role two-user proof passed.
- **Committed in:** f6faa24

**2. [Rule 1 - Test regression] Corrected skipped PostgreSQL fixture assumptions**
- **Found during:** Task 3
- **Issue:** The source-replay test used a different idempotency header than its pending intent; history matching and callback rejection checks also assumed an empty shared database.
- **Fix:** Bound the source test header to its claim intent, asserted version IDs explicitly, and measured callback row counts before and after rejected requests.
- **Files modified:** apps/api/src/creator-routes.postgres.test.ts, apps/api/src/auth-provider-stubs.test.ts
- **Verification:** Fresh independent PostgreSQL suites passed.
- **Committed in:** 7a3ba9d, d4ce6fd

**3. [Rule 2 - Ownership preservation] Added separate cleanup persistence instead of touching protected campaign-recipe coverage**
- **Found during:** Task 1
- **Issue:** The declared DB test file has a pre-existing user modification and could not be safely changed.
- **Fix:** Added a narrowly scoped cleanup repository and worker test while leaving that file untouched.
- **Verification:** Worker cleanup tests and the protected DB suite both passed.
- **Committed in:** ed051e2

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 1).
**Impact on plan:** All fixes are required for isolation, cleanup safety, or protected dirty-tree ownership; no external packages or provider calls were added.

## Issues Encountered

- An early combined suite reused one disposable database; a callback fixture expected no earlier claims. Independent fresh databases are now used per fixture-isolated suite.
- One aborted ad-hoc test run left a generated disposable database; it was explicitly rechecked, dropped, and final verification confirmed zero leftovers.

## Known Stubs

None.

## Next Phase Readiness

Phase 2 now has durable cleanup and disposable database evidence for its owner and replay boundaries. One unrelated open Windows entry remains for the web locale test in AuthGateDialog.test.tsx; it was not part of this data-integrity plan.

## Self-Check: PASSED

- Confirmed all cleanup, migration, RLS, and summary artifacts exist.
- Confirmed task commits 8d1fea2, ed051e2, 1bf6c33, f6faa24, 7a3ba9d, and d4ce6fd exist.
- Confirmed zero guarded disposable PostgreSQL databases remain.
