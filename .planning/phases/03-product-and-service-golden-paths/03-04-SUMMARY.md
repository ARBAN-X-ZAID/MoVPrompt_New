---
phase: 03-product-and-service-golden-paths
plan: "04"
subsystem: presenter-eligibility
tags: [api, postgres, zod, security, generation, ownership]
requires:
  - phase: 03-product-and-service-golden-paths
    provides: Published-template eligibility, immutable project versions, and authoritative server-side generation quotes.
provides:
  - Strict beginner presenter contracts for none, AI UGC, and rights-attested uploaded spokesperson footage.
  - One server-side campaign eligibility assertion shared by guest claim, authenticated quote, and render submission.
  - Exact owner/project footage revalidation with uniform denial errors before any quote, reservation, charge, or provider work.
affects: [guest-auth-handoff, generation, people-studio, project-assets, advanced-mode]
actuals:
  tokens: 12800
  tasks: 3
  commits: 7
tech-stack:
  added: []
  patterns:
    - Presenter authorization is determined from strict configuration plus server-reloaded template, capability, and owned asset state.
    - Uploaded spokesperson rights bind an opaque asset UUID to one versioned person/media attestation.
key-files:
  created:
    - apps/api/src/campaign-eligibility.ts
    - packages/db/migrations/0018_add_footage_asset_kind.sql
  modified:
    - packages/contracts/src/creator.ts
    - packages/contracts/src/assets.ts
    - apps/api/src/guest-claim-service.ts
    - apps/api/src/generation-service.ts
    - apps/api/src/generation-repository.ts
key-decisions:
  - "Digital Twins are rejected by the beginner presenter contract; no provider reference or model identifier may cross this boundary."
  - "An uploaded spokesperson is authorized only by the exact owner/project footage row, verified video metadata, checksum, duration, and matching rights asset UUID."
  - "All presenter failures use presenter_configuration_ineligible so callers cannot infer another user's asset, template recipe, or provider state."
patterns-established:
  - "Claim, quote, and submission reload policy instead of trusting browser or persisted JSON alone."
requirements-completed: [SOURCE-03, CREATE-05, CREATE-07, CREATE-09, CREATE-10]
coverage:
  - id: D1
    description: Footage assets and beginner presenter configuration reject invalid media, missing rights, Digital Twin, provider fields, and unknown fields.
    requirement: SOURCE-03
    verification:
      - kind: unit
        ref: packages/contracts/src/contracts.test.ts
        status: pass
      - kind: other
        ref: DATABASE_URL_DIRECT=disposable bun run --cwd packages/db check
        status: pass
    human_judgment: false
  - id: D2
    description: Guest claim accepts exactly one eligible footage snapshot and denies unsupported AI UGC, wrong asset kind/UUID, missing rights, and altered replay before a ready project is visible.
    requirement: CREATE-05
    verification:
      - kind: integration
        ref: apps/api/src/guest-claim-service.postgres.test.ts#presenter eligibility
        status: pass
      - kind: other
        ref: disposable PostgreSQL 17 migration run
        status: pass
    human_judgment: false
  - id: D3
    description: Authenticated quote and render submission reload template/capability/owned-footage evidence and deny before pricing or reservation.
    requirement: CREATE-07
    verification:
      - kind: unit
        ref: apps/api/src/generation-service.test.ts#generation reference ownership and presenter eligibility
        status: pass
      - kind: unit
        ref: apps/api/src/generation.test.ts#presenter eligibility
        status: pass
      - kind: other
        ref: bun run --cwd apps/api typecheck
        status: pass
    human_judgment: false
duration: 30min
completed: 2026-08-20
status: complete
---

# Phase 03 Plan 04: Presenter Eligibility Boundaries Summary

**Guest and authenticated campaigns now authorize only no presenter, policy-supported AI UGC, or one checksum-verified owner footage asset with matching explicit rights—before any generation economics or provider work begins.**

## Performance

- **Duration:** 30 min
- **Completed:** 2026-08-20T19:45:44Z
- **Tasks:** 3/3
- **Files modified:** 22

## Accomplishments

- Added a portable `footage` asset kind and bounded video upload metadata, including checksum, size, duration, and private object-key support.
- Defined a strict discriminated `CampaignPresenterSchema`; Digital Twin, provider references, signed URLs, and unknown presenter fields fail parsing.
- Implemented a shared `CampaignEligibilityService` that reloads the published template policy, language support, current capability state, and exact footage metadata before guest claim, quote, or submission can continue.
- Added PostgreSQL-backed guest claim proof and service/HTTP denial coverage showing invalid presenter state never creates a ready project, quote, reservation, charge, or provider submission.

## Task Commits

1. **Task 1: Carry one rights-attested footage asset through shared contracts** — `5ce35e9` (TDD red), `25b0d41` (feature), `2a12213` (typing correction)
2. **Task 2: Reject ineligible presenter data during guest claim** — `f4153c5` (feature and PostgreSQL coverage)
3. **Task 3: Revalidate presenter ownership at quote and submission** — `6d0b3d7` (TDD red), `52a5861` (feature), `3ab9bf2` (valid-footage and pre-reservation coverage)

## Verification

- `bun run --cwd packages/contracts test -- contracts` — passed (11 tests).
- `bun run --cwd packages/contracts typecheck` — passed.
- `DATABASE_URL_DIRECT=postgresql://127.0.0.1:55432/<disposable> bun run --cwd packages/db check` — passed.
- `DATABASE_URL_DIRECT=postgresql://127.0.0.1:55432/<disposable> bun run db:migrate` — passed on disposable PostgreSQL 17 with migration `0018` applied.
- `MOVPROMPT_TEST_DATABASE_URL=postgresql://127.0.0.1:55432/<disposable> bun run --cwd apps/api test -- guest-claim-service.postgres.test.ts -t "presenter eligibility"` — passed (1 integration test).
- `bun run --cwd apps/api test -- generation-service.test.ts generation.test.ts -t "presenter eligibility"` — passed (4 tests).
- `bun run --cwd apps/api test -- generation-service.test.ts generation.test.ts` — passed (24 tests).
- `bun run --cwd apps/api typecheck` and `bun run --cwd packages/db typecheck` — passed.

## Decisions Made

- Digital Twin remains deliberately outside the beginner campaign contract and cannot be introduced through a browser field or stale persisted configuration.
- AI UGC is fail-closed unless the published template explicitly permits the presenter mode and language and the server capability registry currently resolves `presenter.ai_ugc`.
- Presenter revalidation occurs before price creation and again before render reservation; the browser only displays this state and never authorizes it.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Security boundary propagation] Propagated footage metadata through asset, guest-claim, storage-key, and route helpers.**
   - **Found during:** Task 1
   - **Issue:** The declared contract and database migration alone would not have carried duration and footage identity into the private claimed asset that later authorization reloads.
   - **Fix:** Added typed duration propagation, private footage object-key support, and stable validation in the asset/claim plumbing.
   - **Files modified:** `apps/api/src/asset-repository.ts`, `apps/api/src/asset-routes.ts`, `apps/api/src/guest-claim-repository.ts`, `packages/contracts/src/guest-claims.ts`, `packages/storage/src/keys.ts`
   - **Verification:** Contract tests, PostgreSQL claim test, and TypeScript checks passed.
   - **Committed in:** `25b0d41`

2. **[Rule 2 - Information disclosure] Mapped guest-claim presenter denials to the same stable public error as quote and submission.**
   - **Found during:** Task 2
   - **Issue:** Claim errors could otherwise surface service-specific details distinct from the protected generation boundary.
   - **Fix:** Added a uniform `presenter_configuration_ineligible` mapping in the creator route boundary.
   - **Files modified:** `apps/api/src/creator-routes.ts`
   - **Verification:** PostgreSQL negative claim coverage passed.
   - **Committed in:** `f4153c5`

3. **[Rule 1 - Exact optional property type] Preserved optional duration typing in the owner-scoped asset repository.**
   - **Found during:** Task 1 verification
   - **Issue:** An omitted non-footage duration violated strict optional-property TypeScript semantics.
   - **Fix:** Declared the optional duration field explicitly as omittable.
   - **Files modified:** `apps/api/src/asset-repository.ts`
   - **Verification:** API and database type checks passed.
   - **Committed in:** `2a12213`

**Total deviations:** 2 Rule 2 security/completeness fixes and 1 Rule 1 typing fix. All were required to preserve the intended trust boundary without expanding product scope.

## TDD Gate Compliance

- Task 1 and Task 3 include explicit failing-test commits before their implementation commits.
- Task 2's PostgreSQL negative coverage was committed together with its assertion implementation in `f4153c5`; this remains covered by a passing disposable-PostgreSQL integration run, but does not provide a separate RED commit.

## Known Stubs

None. This path contains no local-success fallback, provider call, public provider identifier, signed URL persistence, or browser-authorized presenter behavior.

## Next Phase Readiness

- The guest/auth and generation flows can now rely on one private-footage presenter boundary with repeatable idempotency semantics.
- People Studio and any later Digital Twin enrollment must introduce a separate consent/audit contract; it cannot reuse the beginner presenter modes.
- No paid provider call was made. Generation continues to fail closed unless all independent runtime readiness conditions are satisfied.

## Self-Check: PASSED

- `packages/db/migrations/0018_add_footage_asset_kind.sql`, `apps/api/src/campaign-eligibility.ts`, and this summary file exist.
- Task commits `5ce35e9`, `25b0d41`, `f4153c5`, `6d0b3d7`, `52a5861`, `2a12213`, and `3ab9bf2` exist in repository history.

---
*Phase: 03-product-and-service-golden-paths*
*Completed: 2026-08-20*
