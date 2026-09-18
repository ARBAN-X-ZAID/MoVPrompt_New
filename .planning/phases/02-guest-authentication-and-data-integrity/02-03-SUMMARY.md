---
phase: 02-guest-authentication-and-data-integrity
plan: "03"
subsystem: auth
tags: [better-auth, hono, postgres, react, vitest, oauth]
requires:
  - phase: 02-02
    provides: Durable guest snapshots, exact claim receipts, and replay-safe claim operations
provides:
  - Fixed server-owned first-campaign verification policy and redacted auth capability
  - Credential-free Google and Apple callback fixtures isolated from production composition
  - Typed browser provider visibility and safe pending-intent return-path helpers
affects: [02-08-auth-interface, generation-eligibility, callback-recovery]
actuals:
  tokens: 8956
  tasks: 3
  commits: 8
tech-stack:
  added: []
  patterns:
    - Server-reduced auth capability exposes method names and policy only
    - Test-only OAuth callback gateway is injected directly and fails closed in production
    - Session-storage pending intent takes precedence over callback next parameters
key-files:
  created:
    - apps/api/src/test/auth-provider-stubs.ts
    - apps/api/src/auth-provider-stubs.test.ts
  modified:
    - packages/auth/src/config.ts
    - packages/contracts/src/api.ts
    - apps/api/src/app.ts
    - apps/web/src/lib/auth/returnPath.ts
key-decisions:
  - "First-campaign verification is fixed to deferred_until_after_first_campaign instead of deployment-configurable."
  - "Social visibility is derived from the server capability, never VITE flags."
  - "Callback fixtures are test-only dependency injection and throw if loaded under production NODE_ENV."
patterns-established:
  - "Auth public response: reduce credentials to emailPassword, configuredProviders, and one verification policy."
  - "Safe return: retain opaque local pending intent and accept only decoded root-relative in-app paths."
requirements-completed: [AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08]
coverage:
  - id: D1
    description: Server-controlled email/social capability and deferred first-campaign verification policy
    requirement: AUTH-04
    verification:
      - kind: unit
        ref: bun run --cwd packages/auth test -- config
        status: pass
      - kind: unit
        ref: apps/api/src/app.test.ts#returns only configured auth method names and the shared verification policy
        status: pass
    human_judgment: false
  - id: D2
    description: Deterministic Google and Apple callback recovery and replay proof
    requirement: AUTH-03
    verification:
      - kind: unit
        ref: apps/api/src/auth-provider-stubs.test.ts#test auth provider stub boundary
        status: pass
      - kind: integration
        ref: MOVPROMPT_TEST_DATABASE_URL bun run --cwd apps/api test -- auth-provider-stubs
        status: unknown
    human_judgment: true
    rationale: PostgreSQL integration cases were skipped because the disposable test database URL and Docker are unavailable.
  - id: D3
    description: Server-derived provider visibility and hostile-return recovery helpers
    requirement: AUTH-05
    verification:
      - kind: unit
        ref: bun run --cwd apps/web test -- authProviders returnPath
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-08-19
status: complete
---

# Phase 2 Plan 3: Server-Controlled Auth Capability and Safe Recovery Summary

**A single deferred first-campaign verification policy, redacted social auth capability, deterministic callback fixtures, and hostile-return-safe browser recovery contract.**

## Performance

- **Duration:** 11min
- **Started:** 2026-08-19T19:23:05Z
- **Completed:** 2026-08-19T19:33:31Z
- **Tasks:** 3/3
- **Files modified:** 15

## Accomplishments

- Replaced deployment-selectable first-campaign verification with the fixed `deferred_until_after_first_campaign` policy consumed by Better Auth, generation eligibility, API capability, and browser types.
- Added server-reduced auth capability output: email/password, configured Google/Apple method names, and verification policy only—no client secrets, OAuth state, or tokens.
- Added credential-free injected Google/Apple callback fixtures with production-load rejection, plus safe local pending-intent and return-path validation that rejects external, encoded, backslash, malformed, and auth-loop destinations.

## Task Commits

1. **Task 1: Publish one server-controlled auth and verification capability**
   - `2550771` `test(02-03): add failing auth capability tests`
   - `4b07578` `feat(02-03): publish server auth capability`
2. **Task 2: Prove Google and Apple callback recovery with deterministic provider stubs**
   - `b091c88` `test(02-03): add failing social callback recovery tests`
   - `a46672e` `feat(02-03): add deterministic social callback stubs`
   - `f711074` `fix(02-03): remove obsolete verification override`
   - `36f7edb` `test(02-03): cover public auth capability redaction`
3. **Task 3: Share safe auth return and provider visibility with the web**
   - `e8b877a` `test(02-03): add failing safe auth return tests`
   - `8da37f7` `feat(02-03): share safe auth return contract`

## Files Created/Modified

- `packages/auth/src/config.ts` — validates complete provider pairs and publishes the safe fixed capability.
- `packages/auth/src/auth.ts` — defers verification gating for the first campaign while retaining verification email operations.
- `packages/contracts/src/api.ts` — defines the public auth capability and verification-policy schema.
- `apps/api/src/app.ts` and `apps/api/src/auth-gateway.ts` — return only safe auth capability data from feature flags.
- `apps/api/src/test/auth-provider-stubs.ts` — deterministic, injected Google/Apple callback gateway unavailable in production.
- `apps/web/src/config/authProviders.ts` — derives social options only from typed server capability.
- `apps/web/src/lib/auth/returnPath.ts` — preserves opaque pending intent and validates return paths.

## Decisions Made

- First-campaign verification remains deferred everywhere; the obsolete `AUTH_REQUIRE_EMAIL_VERIFICATION` override was removed from Compose so normal API composition cannot disagree with the fixed policy.
- Social provider controls fail closed until a server feature response is consumed; final auth interface rendering remains in Plan 02-08.
- OAuth callback test fixtures are injected from test code only, not selected by configuration or production environment input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking configuration] Removed obsolete Compose verification override**
- **Found during:** Task 2
- **Issue:** `compose.yaml` still supplied `AUTH_REQUIRE_EMAIL_VERIFICATION`, which the new fixed policy correctly rejects at API startup.
- **Fix:** Removed the no-longer-valid Compose variable.
- **Files modified:** `compose.yaml`
- **Verification:** API typecheck passed; static Compose validation could not run because Docker is unavailable.
- **Committed in:** `f711074`

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Required for the server policy to be deployable without reintroducing a competing override.

## Issues Encountered

- `MOVPROMPT_TEST_DATABASE_URL` is unset and Docker is not installed, so the four PostgreSQL callback/replay integration cases were skipped. The open verification gap is recorded in `.planning/WINDOWS.md` as `unrun-verify`.

## Known Stubs

None. Test provider fixtures are deliberate test-only adapters, not production stubs; production composition cannot import or enable them.

## Accessibility and Visual QA

- No layout, copy, semantic markup, or visual token changes were made; Plan 02-08 owns final auth interface rendering.
- Focused interaction-state coverage passes for provider absence/presence and safe callback recovery helpers. Rendered breakpoint and keyboard verification remains appropriate for Plan 02-08 when the capability is wired into the dialog.

## User Setup Required

None. A disposable PostgreSQL 17 test URL must be provided in a later verification run to execute the skipped callback replay cases.

## Next Phase Readiness

- Plan 02-08 can consume the typed feature capability to render only configured social controls without adding browser environment flags.
- Re-run `MOVPROMPT_TEST_DATABASE_URL=<disposable-url> bun run --cwd apps/api test -- auth-provider-stubs` before ship to close the recorded integration gap.

## Self-Check: PASSED

- Confirmed all six principal implementation artifacts and this summary exist on disk.
- Confirmed every TDD and implementation commit listed above exists in Git history.
