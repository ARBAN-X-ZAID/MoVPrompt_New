---
phase: 02-guest-authentication-and-data-integrity
plan: "06"
subsystem: creator-source-integrity
tags: [postgresql, immutable-versions, source-fingerprint, recovery, rtl, accessibility]
requires:
  - phase: 02-05
    provides: guest claim and owner-scoped asset foundation
provides:
  - immutable source-change endpoint with server-computed fingerprint
  - current-output compatibility guard and typed recovery states
  - bilingual retry and replacement actions for source/claim failures
affects: [creator-api, creator-store, create-studio, portable-api-client]
tech-stack:
  added: []
  patterns: [owner-scoped source asset validation, canonical SHA-256 source fingerprint, pure recovery-state mapping]
key-files:
  created:
    - apps/api/src/source-change-service.ts
    - apps/api/src/source-change-service.test.ts
  modified:
    - apps/api/src/creator-repository.ts
    - apps/api/src/creator-routes.ts
    - apps/web/src/features/create/creatorProjectOutput.ts
    - apps/web/src/features/create/guestClaimRecovery.ts
    - apps/web/src/features/create/CreateStudio.tsx
decisions:
  - Source replacement is a dedicated fingerprinted child-version transition rather than an ordinary project save.
  - A current output must carry the same source fingerprint as its current source; unknown output is hidden when a fingerprint is present.
metrics:
  duration: 12m
  completed: 2026-08-19
  tasks_completed: 3
  files_modified: 18
status: complete
actuals:
  tokens: 13247
  tasks: 3
  commits: 8
coverage:
  - id: D1
    description: Source replacement creates one owner-scoped immutable version and removes stale render binding.
    requirement: SOURCE-07
    verification:
      - kind: unit
        ref: apps/api/src/source-change-service.test.ts#binds a canonical source fingerprint
        status: pass
      - kind: integration
        ref: apps/api/src/creator-routes.postgres.test.ts#replays concurrent source replacement once
        status: unknown
    human_judgment: true
    rationale: PostgreSQL concurrency proof requires a disposable database not configured in this worktree.
  - id: D2
    description: Local recovery retains campaign state and suppresses incompatible current output.
    requirement: SOURCE-06
    verification:
      - kind: unit
        ref: apps/web/src/features/create/guestClaimRecovery.test.ts#maps failures to a single explicit recovery action
        status: pass
      - kind: unit
        ref: apps/web/src/features/create/creatorProjectOutput.test.ts#does not project a previous source output
        status: pass
    human_judgment: false
  - id: D3
    description: English and Arabic recovery messages provide accessible retry and replacement actions.
    requirement: AUTH-06
    verification:
      - kind: unit
        ref: apps/web/src/features/create/guestClaimRecovery.test.ts#uses the exact bilingual recovery copy
        status: pass
      - kind: other
        ref: bun run --cwd apps/web build
        status: pass
    human_judgment: true
    rationale: Rendered browser inspection at 375/768/1024/1440 in light/dark and RTL needs browser automation, which is not installed in this checkout.
---

# Phase 02 Plan 06: Source Change and Recovery Summary

**Fingerprint-bound immutable source replacements, truthful current-output filtering, and bilingual retry/replace recovery actions for the creator.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-19T20:10:07Z
- **Completed:** 2026-08-19T20:21:52Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Added a server-only source fingerprint and idempotent source-change route that creates a child version, verifies owner-scoped assets, preserves accepted history, and clears incompatible output fields.
- Routed authenticated source mirroring through the immutable source-change path and prevented stale/demo/previous-source video from being projected as current.
- Added pure, data-preserving recovery state selection plus exact English/Arabic retry, replace, offline, and session-mismatch copy in the creator interface.

## Verification

- Passed: `bun run --cwd apps/api test` — 79 passed, 11 skipped.
- Passed: `bun run --cwd apps/web test -- creatorProjectAssets guestClaimRecovery projectStore creatorProjectOutput` — 18 passed.
- Passed: `bun run --cwd apps/web test -- AuthGateDialog` — 2 passed.
- Passed: API and web typechecks, web production build, and web lint (20 existing Fast Refresh warnings; no errors).
- Smoke-passed: local Vite routes `/qa/create` and `/qa/create?template=luxury-product-reveal` returned HTTP 200.

## Files Created/Modified

- `packages/contracts/src/creator.ts` — source-replacement request/response contracts.
- `apps/api/src/source-change-service.ts` — canonical source fingerprint and output-safe transition input.
- `apps/api/src/creator-repository.ts` — owner-scoped, idempotent immutable source-version persistence.
- `apps/api/src/creator-routes.ts` — source-change API endpoint.
- `apps/web/src/features/create/projectStore.ts` — portable source-change client/store path.
- `apps/web/src/features/create/creatorProjectOutput.ts` — current-output fingerprint compatibility filter.
- `apps/web/src/features/create/guestClaimRecovery.ts` — typed recovery choices and localized copy.
- `apps/web/src/features/create/CreateStudio.tsx` — accessible recovery alert actions and focus recovery.

## Decisions Made

- Source replacement remains append-only and preserves the accepted version as history; only the working pointer changes.
- A fingerprinted source with no matching output fingerprint renders no current video, rather than falling back to source, demo, poster, or historical media.
- Recovery actions never alter campaign fields, blobs, pending intent, language, CTA, offer, price, ratio, audio, or subtitles.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Built the contracts workspace before production web build**
- **Found during:** Task 3 verification
- **Issue:** Vite resolved the existing built contracts package, which lacked the new source-replacement export despite source typechecking.
- **Fix:** Ran the existing contracts build before rerunning the web build; no dependency or package configuration changed.
- **Verification:** `bun run --cwd apps/web build` passed.

**2. [Rule 1 - Test regression] Updated creator-assets store mock for source replacement**
- **Found during:** Full web test run
- **Issue:** The existing asset persistence test did not supply the newly required source-replacement store method.
- **Fix:** Updated its mock and assertions to verify the mirrored asset handoff.
- **Files modified:** `apps/web/src/features/create/creatorProjectAssets.test.ts`
- **Committed in:** e0c58ab

**3. [Rule 2 - Missing critical link] Routed private mirrored sources to the dedicated source-change API**
- **Found during:** Task 3 verification
- **Issue:** The new server service would not be used after authenticated remote-image mirroring, leaving source fingerprints unset on that path.
- **Fix:** Added the portable API/client-store handoff after private mirroring.
- **Files modified:** `apps/web/src/lib/api/portableApiClient.ts`, `apps/web/src/features/create/projectStore.ts`, `apps/web/src/features/create/creatorProjectAssets.ts`
- **Committed in:** dc70909

## Issues Encountered

- The full web suite has one pre-existing order-dependent locale failure in `AuthGateDialog.test.tsx`; it passes alone. Recorded in `deferred-items.md` without changing unrelated auth code.
- PostgreSQL source-change concurrency/history tests are skipped because no disposable `MOVPROMPT_TEST_DATABASE_URL` is configured. Recorded for follow-up.
- Browser automation is unavailable (`playwright` CLI is not installed), so rendered multi-viewport/RTL/theme visual inspection could not run. The production build and local route smoke test passed.

## Known Stubs

None introduced by this plan.

## Next Phase Readiness

The creator now has the server and client boundary required to make source changes truthful. Before production readiness, run the PostgreSQL integration test against disposable PostgreSQL 17 and perform the required browser visual/accessibility matrix.

## Self-Check: PASSED

- Confirmed all 18 implementation/test files exist.
- Confirmed commits `17f163c`, `c5757b5`, `36d9c7a`, `e681343`, `85bfd6b`, `4ab4765`, `dc70909`, and `e0c58ab` exist.
