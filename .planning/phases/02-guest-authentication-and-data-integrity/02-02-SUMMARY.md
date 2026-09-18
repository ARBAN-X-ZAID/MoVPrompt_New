---
phase: 02-guest-authentication-and-data-integrity
plan: "02"
subsystem: guest-authentication
tags: [react, indexeddb, guest-draft, claim-recovery, vitest]
requires:
  - phase: 02-01
    provides: Canonical guest claim snapshots, receipts, and owner-safe claim boundary
provides:
  - Versioned seven-day browser draft records with local blob ownership
  - Stable Generate intent that survives auth cancellation and reload
  - Fail-closed canonical receipt comparison before one-time local cleanup
affects: [02-03, 02-04, 02-06, 02-08, CreateStudio]
actuals:
  tokens: 8225
  tasks: 2
  commits: 4
tech-stack:
  added: []
  patterns: [versioned IndexedDB record, injected storage-and-clock seam, fail-closed receipt cleanup]
key-files:
  created: [apps/web/src/features/create/guestClaimRecovery.ts, apps/web/src/features/create/guestDraftStore.test.ts, apps/web/src/features/create/guestClaimRecovery.test.ts]
  modified: [apps/web/src/features/create/guestDraftStore.ts, apps/web/src/features/create/CreateStudio.tsx]
key-decisions:
  - "Preserve the original expiry timestamp on ordinary saves so active editing cannot extend the seven-day retention limit."
  - "Require exact checkpoint configuration and ordered server asset digests before local draft/blob deletion."
patterns-established:
  - "Guest recovery uses only same-browser draft IDs and opaque local asset keys; no account identity is stored locally."
requirements-completed: [AUTH-01, AUTH-02, AUTH-06, AUTH-07, AUTH-09]
coverage:
  - id: D1
    description: Versioned guest drafts retain exact campaign JSON, local blob keys, rights, and stable Generate intent for same-browser recovery.
    requirement: AUTH-01
    verification:
      - kind: unit
        ref: apps/web/src/features/create/guestDraftStore.test.ts#restores every local campaign field, blob key and stable Generate intent without renewing expiry
        status: pass
    human_judgment: false
  - id: D2
    description: Guest expiry removes the draft and associated local blob set at the stored seven-day boundary.
    requirement: AUTH-09
    verification:
      - kind: unit
        ref: apps/web/src/features/create/guestDraftStore.test.ts#keeps the complete JSON/blob set at day six and expires both together at the seven-day boundary
        status: pass
    human_judgment: false
  - id: D3
    description: Local cleanup occurs once only after exact configuration and checksum-manifest receipt parity; failures retain the draft.
    requirement: AUTH-07
    verification:
      - kind: unit
        ref: apps/web/src/features/create/guestClaimRecovery.test.ts#retains the exact local draft when the canonical receipt has a missing configuration field or checksum mismatch
        status: pass
      - kind: unit
        ref: apps/web/src/features/create/guestClaimRecovery.test.ts#deletes a matching draft once and treats replay as harmless
        status: pass
    human_judgment: false
duration: 11 min
completed: 2026-08-19
status: complete
---

# Phase 02 Plan 02: Guest Draft Lifecycle Summary

**Versioned IndexedDB guest drafts preserve complete campaigns and blobs for seven days, then allow one-time cleanup only after exact canonical claim receipt verification.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-19T19:04:03Z
- **Completed:** 2026-08-19T19:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Kept exact Template/Advanced campaign data, rights, local asset keys, and a stable Generate idempotency intent in one versioned guest record.
- Preserved the original seven-day expiry during normal edits; expiry atomically removes the draft and all its local blobs.
- Added a recovery verifier that fails closed on receipt/configuration/asset-manifest mismatch and deletes the verified local set exactly once.
- Kept the existing auth dialog composition while restoring keyboard focus to Generate after cancellation.

## Task Commits

1. **Task 1: Persist one complete guest campaign and stable Generate intent** - `f296f16` (RED), `a4f418c` (GREEN)
2. **Task 2: Enforce seven-day expiry and verified canonical cleanup** - `5662166` (RED), `6ede966` (GREEN)

## Files Created/Modified

- `apps/web/src/features/create/guestDraftStore.ts` - Versioned IndexedDB lifecycle, injected clock/storage test seam, expiry and protected cleanup state.
- `apps/web/src/features/create/guestClaimRecovery.ts` - Typed same-browser recovery and fail-closed canonical receipt verifier.
- `apps/web/src/features/create/CreateStudio.tsx` - Retains local draft after cloud claim until verifier evidence exists and restores Generate focus on auth close.
- `apps/web/src/features/create/guestDraftStore.test.ts` - Exact draft/blob/intent and day-six/day-seven lifecycle coverage.
- `apps/web/src/features/create/guestClaimRecovery.test.ts` - Receipt mismatch, wrong-account recovery, verified blob cleanup, and replay coverage.

## Decisions Made

- Original expiry timestamps are immutable across ordinary local saves, preventing perpetual guest retention.
- Presence of a cloud storage path is not evidence for local deletion; only exact canonical configuration plus ordered asset checksums makes cleanup eligible.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Validation

- `bun run --cwd apps/web test -- guestDraftStore guestClaimRecovery` — passed (5 tests).
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/web test -- AuthGateDialog` — passed (2 tests).
- Rendered local QA confirmed the existing creator review flow at 375px English/light and 1440px Arabic/RTL/dark, including visible labelled controls and the primary action.

## Next Phase Readiness

Ready for 02-03. Plan 02-04 should wire server-verified per-asset checkpoint results into `guestClaimRecovery` before any production cleanup is attempted.

## Self-Check: PASSED

- Summary file and all four TDD commits exist in the current repository history.

---
*Phase: 02-guest-authentication-and-data-integrity*
*Completed: 2026-08-19*
