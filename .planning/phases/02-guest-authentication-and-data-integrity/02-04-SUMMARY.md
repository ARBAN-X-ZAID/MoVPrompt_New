---
phase: 02-guest-authentication-and-data-integrity
plan: "04"
subsystem: guest-claim-assets
tags: [hono, postgresql, private-storage, indexeddb, integrity, vitest]
requires:
  - phase: 02-03
    provides: authenticated callback recovery and safe pending intent
provides:
  - Owner-scoped asset upload, verification, and claim-checkpoint completion boundary
  - Typed start/resume/finalize claim routes and ordered canonical asset receipts
  - Browser retry state machine that follows server checkpoints and retains local blobs
affects: [02-06-source-recovery-ui, 02-08-auth-interface, project-asset-downloads]
tech-stack:
  added: []
  patterns:
    - Server-derived local manifest asset IDs become canonical private object IDs
    - Browser cleanup remains gated on an ordered server receipt, never a signed preview
    - Claim retries re-read the server operation and secure only its next checkpoint
key-files:
  created: []
  modified:
    - packages/contracts/src/assets.ts
    - packages/contracts/src/guest-claims.ts
    - apps/api/src/asset-routes.ts
    - apps/api/src/guest-claim-repository.ts
    - apps/api/src/guest-claim-service.ts
    - apps/api/src/creator-routes.ts
    - apps/web/src/features/create/creatorAssets.ts
decisions:
  - "Guest claim lifecycle is explicit: start, resume per server checkpoint, then idempotent finalization."
  - "The immutable local manifest asset ID is also the private object asset ID, avoiding a browser-side ID translation."
  - "Signed previews remain response-only; ordered checksum manifests are the browser cleanup authority."
metrics:
  duration: 10min
  completed: 2026-08-19
status: complete
actuals:
  tokens: 6999
  tasks: 3
  commits: 7
---

# Phase 2 Plan 4: Resumable Private Guest Asset Claims Summary

**Guest images now move from local browser storage to owner-scoped private storage only through verified, resumable checkpoints, with canonical receipts protecting local media cleanup.**

## Performance

- **Duration:** 10min
- **Started:** 2026-08-19T19:38:45Z
- **Completed:** 2026-08-19T19:48:31Z
- **Tasks:** 3/3
- **Files modified:** 11

## Accomplishments

- Added typed start, resume, and finalization routes around the durable guest-claim operation, including a server-derived `nextAsset` checkpoint.
- Bound private asset completion to the authenticated claim operation only after canonical key ownership, HEAD metadata, MIME, byte size, checksum, and image signature checks succeed.
- Preserved deterministic local manifest asset IDs through upload reservation and object-key derivation, eliminating browser-side stable-key translation.
- Added a browser claim loop that follows the server-reported checkpoint, retains every input blob on failure, and exposes only the failed local asset for retry.
- Required final receipts to carry the complete ordered manifest so `verifyCanonicalReceipt` remains the sole gate before IndexedDB cleanup.

## Task Commits

1. **Task 1: Claim one IndexedDB image into one verified private asset**
   - `d672823` `test(02-04): add failing asset claim checkpoint test`
   - `b5869c3` `test(02-04): add failing resumable claim route test`
   - `a78ccb0` `feat(02-04): add resumable private asset claim boundary`
2. **Task 2: Resume multi-asset integrity failures without losing local media**
   - `1503dcc` `test(02-04): add failing resumable asset recovery test`
   - `caceb66` `feat(02-04): resume guest asset claims safely`
3. **Task 3: Prove multi-asset server integrity and owner replay boundaries**
   - `78c2ebc` `test(02-04): add failing canonical claim receipt test`
   - `c4d4ba4` `feat(02-04): return verified asset manifests on claim finalization`

## Verification

- `bun run --cwd apps/api test -- assets` — passed (12 tests).
- `bun run --cwd packages/storage test` — passed (6 tests).
- `bun run --cwd apps/api test -- creator-routes` — passed (9 tests).
- `bun run --cwd apps/web test -- creatorAssets guestClaimRecovery` — passed (8 tests).
- `bun run --cwd packages/contracts build` — passed.
- `bun run --cwd apps/api typecheck` — passed.
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/api test -- guest-claim-service.postgres` — skipped (no `MOVPROMPT_TEST_DATABASE_URL`; four disposable PostgreSQL integration cases were not run).

## Decisions Made

- A server operation must be started before asset transfer and is the only source for the next retryable asset; the browser does not infer progress from a percentage or local loop index.
- Asset completion sends only an opaque local asset ID and claim intent. The server derives and verifies bucket/object coordinates, then advances the checkpoint.
- Final receipts include the ordered manifest of verified metadata, while signed URLs stay response-only and are not used for local cleanup or persistence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking integration] Added minimal claim lifecycle API composition outside the original file list**

- **Found during:** Task 1
- **Issue:** The existing claim endpoint immediately finalized and could not coordinate per-asset checkpoints; asset routes could not call the already-composed guest claim service.
- **Fix:** Added typed start/resume/finalize claim routes, the minimal `app.ts` service wiring, and stable manifest asset-ID handling.
- **Files modified:** `apps/api/src/app.ts`, `apps/api/src/creator-routes.ts`, `apps/api/src/creator-routes.test.ts`, `packages/contracts/src/guest-claims.ts`.
- **Verification:** Focused API route tests and typecheck passed.

**2. [Rule 3 - Blocking test runtime] Rebuilt the local contracts workspace before web verification**

- **Found during:** Task 2
- **Issue:** Web tests resolve the contracts package runtime from `dist/`, which did not yet contain the new schemas.
- **Fix:** Ran the existing `bun run --cwd packages/contracts build` command; no dependency or source-package change was introduced.
- **Verification:** Web recovery tests and typecheck passed.

## Issues Encountered

- Disposable PostgreSQL integration proof is not available in this environment: `MOVPROMPT_TEST_DATABASE_URL` is unset and Docker is unavailable. Four guarded `guest-claim-service.postgres` cases were skipped. Unit, route, storage, and browser-contract tests pass, but durable multi-user database behavior remains unverified here.

## Known Stubs

None. The "unavailable" strings in API error boundaries are intentional fail-closed errors, not user-facing data stubs.

## Accessibility and Visual QA

- No layout, copy, control, token, or semantic markup was changed; the existing UI-SPEC recovery copy and visual implementation remain owned by Plans 02-06 and 02-08.
- Interaction-state code keeps local blobs intact on every non-final outcome and supplies the exact failed opaque asset ID for the planned Retry action.

## Next Phase Readiness

- Plans 02-06 and 02-08 can consume `claimGuestAssets` to render factual claim progress, Retry, and Replace-image states without exposing storage internals.
- Before ship, run `MOVPROMPT_TEST_DATABASE_URL=<disposable-postgres-url> bun run --cwd apps/api test -- guest-claim-service.postgres` to close the multi-asset replay/owner isolation integration gap.

## Self-Check: PASSED

- Confirmed all principal asset, claim, contract, browser recovery, and summary artifacts exist on disk.
- Confirmed all seven TDD and implementation commits listed above exist in Git history.
