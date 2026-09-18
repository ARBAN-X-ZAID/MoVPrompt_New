---
phase: 02-guest-authentication-and-data-integrity
plan: "08"
subsystem: auth-recovery-ui
tags: [react, better-auth, accessibility, rtl, browser-evidence, redaction]
requires:
  - phase: 02-07
    provides: durable claim, cleanup, RLS, and two-user integrity proof
provides:
  - Generate-time auth that exposes only server-configured social methods
  - Exact English and Arabic auth, recovery, and verification-reminder copy
  - Safe-return and deterministic recovery tests with redacted browser evidence
affects: [guest-claim, auth, creator-ui, phase-2-verification]
actuals:
  tokens: 70324
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [server-capability-driven social visibility, whole-string translation contract, deterministic recovery seam, evidence redaction guard]
key-files:
  created:
    - apps/web/src/features/create/GuestAuthRecovery.test.tsx
    - scripts/infra/check-phase2-evidence-redaction.mjs
    - .planning/phases/02-guest-authentication-and-data-integrity/02-BROWSER-EVIDENCE.md
  modified:
    - apps/web/src/features/create/AuthGateDialog.tsx
    - apps/web/src/pages/Auth.tsx
    - apps/web/src/pages/AuthCallback.tsx
    - apps/web/src/pages/ResetPassword.tsx
    - apps/web/src/pages/AuthCopy.test.ts
    - apps/web/src/i18n/translations/en.ts
    - apps/web/src/i18n/translations/ar.ts
    - .planning/phases/02-guest-authentication-and-data-integrity/02-VALIDATION.md
key-decisions:
  - "Social authentication controls fail closed until the server's public auth capability explicitly enables them."
  - "First-campaign email verification remains a quiet reminder rather than an auth or generation blocker."
  - "Rendered evidence records only observed local UI facts; unavailable live API/provider/claim paths remain open."
patterns-established:
  - "Keep recovery copy in complete catalog strings and test equality rather than assembling translated fragments."
requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, SOURCE-04, SOURCE-05, SOURCE-06, SOURCE-07, PROJ-06]
coverage:
  - id: D1
    description: Generate-time auth uses server-derived provider availability, complete bilingual preservation copy, and correct initial focus.
    requirement: AUTH-02
    verification:
      - kind: automated_ui
        ref: apps/web/src/features/create/AuthGateDialog.test.tsx
        status: pass
      - kind: unit
        ref: apps/web/src/pages/AuthCopy.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Safe callback, reset, cancellation, offline, mismatch, replay, and expiry recovery retain local campaign state.
    requirement: AUTH-08
    verification:
      - kind: integration
        ref: apps/web/src/features/create/GuestAuthRecovery.test.tsx plus guestClaimRecovery.test.ts
        status: pass
      - kind: unit
        ref: apps/web/src/lib/auth/returnPath.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Responsive English/Arabic, light/dark, keyboard, RTL, overflow, and console observations are redacted and recorded.
    requirement: AUTH-01
    verification:
      - kind: automated_ui
        ref: .planning/phases/02-guest-authentication-and-data-integrity/02-BROWSER-EVIDENCE.md
        status: unknown
    human_judgment: true
    rationale: Live API, provider, private-asset claim, and two-account browser paths were not available at the observed local web origin.
duration: 7m
completed: 2026-08-19
status: complete
---

# Phase 02 Plan 08: Auth Recovery UI and Evidence Summary

**Generate-time authentication now preserves campaigns through exact bilingual, capability-driven auth and recovery states, with redacted rendered-browser evidence.**

## Performance

- **Duration:** 7m
- **Started:** 2026-08-19T20:51:17Z
- **Completed:** 2026-08-19T20:57:58Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Added a server-capability-backed auth gate that fails closed for social methods, focuses the first available method, preserves Generate-time draft intent, and restores focus after cancellation.
- Enforced every approved English/Arabic auth and recovery string as an exact catalog contract; made private-beta email verification a non-blocking reminder.
- Added deterministic recovery coverage and a committed redaction guard; recorded rendered 375/768/1024/1440, LTR/RTL, light/dark, keyboard, overflow, reduced-motion stylesheet, and console observations.

## Verification

- Passed focused auth/recovery suites and web typecheck.
- Passed full web suite: 37 files, 133 tests.
- Passed web production build and evidence redaction check.
- Passed web lint with 20 pre-existing Fast Refresh warnings and no errors.
- Confirmed no `@playwright/test` entry exists in package metadata or lockfile.

## Task Commits

1. **Task 1: Complete one Generate → email auth → restored campaign interface** — `ac9b4e2` (feat)
2. **Task 2: Complete callback, reset, replay and recovery states in both languages** — `1fd576f` (fix), `1dbd8be` (test)
3. **Task 3: Capture redacted rendered-browser evidence and close the phase gate** — `1be6c5c` (docs)

## Decisions Made

- Server capability is the sole social-provider authority; no configured capability means email-only UI.
- The private-beta default defers verification until after the first campaign, as a quiet reminder.
- Browser evidence does not convert unavailable local API/provider flows into passing claims.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Server capability lookup for auth methods**
- **Found during:** Task 1
- **Issue:** Auth surfaces always passed no capability to provider filtering, so configured social methods could never be truthfully displayed.
- **Fix:** Loaded the public server capability in both auth entry surfaces and failed closed on lookup failure.
- **Files modified:** `AuthGateDialog.tsx`, `Auth.tsx`
- **Verification:** Provider zero/one/two focused tests and web typecheck passed.
- **Committed in:** `ac9b4e2`, `1fd576f`

**2. [Rule 1 - Contract regression] Deferred verification default test**
- **Found during:** Task 3 full web suite
- **Issue:** The policy implementation correctly deferred private-beta verification, but its existing test still expected a blocking default.
- **Fix:** Updated the test to assert the approved deferred policy.
- **Files modified:** `apps/web/src/config/authPolicy.test.ts`
- **Verification:** Full web suite passed.
- **Committed in:** `1dbd8be`

**Total deviations:** 2 auto-fixed (1 Rule 2, 1 Rule 1).
**Impact on plan:** Both changes enforce the approved auth policy and fail-closed provider visibility without adding packages or external calls.

## Known Open Validation

- The local web interface was available, but the dedicated API, worker, PostgreSQL, private storage, live provider redirects, and two-account browser fixture were not. The rendered live claim/replay/owner-refresh matrix remains open and is not treated as passed. See `02-BROWSER-EVIDENCE.md` and `02-VALIDATION.md`.

## Known Stubs

None.

## Self-Check: PASSED

- Confirmed all created evidence, redaction, and recovery-test artifacts exist.
- Confirmed task commits `ac9b4e2`, `1fd576f`, `1dbd8be`, and `1be6c5c` exist.
