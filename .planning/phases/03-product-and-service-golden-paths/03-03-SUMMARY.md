---
phase: 03-product-and-service-golden-paths
plan: "03"
subsystem: generation-quotes
tags: [generation, pricing, templates, react, hono, security]
requires:
  - phase: 03-product-and-service-golden-paths
    provides: Reviewed, provenance-bearing product and service campaign drafts.
provides:
  - Server-enforced published-template eligibility before quote calculation, reservation, or render submission.
  - An expiring, configuration-bound template quote lifecycle with safe retry and request cancellation.
  - Explicit creator states that never show or use a client-invented price.
affects: [template-selection, guest-auth-handoff, generation, projects]
actuals:
  tokens: 11913
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - Catalog eligibility is a strict server-side contract distinct from the existing GenerationPricing authority.
    - Creator quote state is keyed by immutable template version plus canonical generation configuration and exposes price only while fresh.
key-files:
  created:
    - apps/web/src/features/create/templateQuoteState.ts
    - apps/web/src/features/create/templateQuoteState.test.ts
    - apps/web/src/features/create/useTemplateQuotes.ts
  modified:
    - packages/contracts/src/creator.ts
    - apps/api/src/generation-repository.ts
    - apps/api/src/generation-service.ts
    - apps/api/src/generation-routes.ts
    - apps/api/src/generation-service.test.ts
    - apps/web/src/features/create/CreateStudio.tsx
    - apps/web/src/features/create/projectStore.ts
    - apps/web/src/lib/api/portableApiClient.ts
key-decisions:
  - "Published template metadata may decide whether a configuration is eligible, but it cannot contain or calculate credits, pricing version, expiry, or configuration hash."
  - "Guest estimates, authenticated project quotes, and render submission all reload and validate the same published template contract."
  - "A creator may only use a ready, unexpired API quote; unavailable, expired, changed, and loading states always contain no price."
patterns-established:
  - "Quote-affecting campaign fields are included in templateQuoteContext so every edit obtains a fresh authoritative quote."
requirements-completed: [CREATE-04, CREATE-05, CREATE-10]
coverage:
  - id: D1
    description: Eligible template configurations receive the existing server quote while mismatched required inputs fail before pricing.
    requirement: CREATE-04
    verification:
      - kind: unit
        ref: apps/api/src/generation-service.test.ts#template quote eligibility
        status: pass
      - kind: unit
        ref: packages/contracts/src/contracts.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Guest and owned-project quote paths reject catalog-ineligible, expired, changed, and mismatched submissions before reservation or provider work.
    requirement: CREATE-05
    verification:
      - kind: unit
        ref: apps/api/src/generation-service.test.ts#template quote rejection
        status: pass
      - kind: typecheck
        ref: bun run --cwd apps/api typecheck
        status: pass
    human_judgment: false
  - id: D3
    description: The creator records loading, unavailable, expired, changed, and ready lifecycle states without an invented fallback price.
    requirement: CREATE-10
    verification:
      - kind: unit
        ref: apps/web/src/features/create/templateQuoteState.test.ts
        status: pass
      - kind: build
        ref: bun run --cwd apps/web build
        status: pass
    human_judgment: false
duration: 10min
completed: 2026-08-20
status: complete
---

# Phase 03 Plan 03: Authoritative Template Quote Lifecycle Summary

**Published Kuwait templates now prove that a campaign configuration is eligible, while the existing server pricing service remains the sole source of a fresh, expiring, configuration-bound generation price.**

## Performance

- **Duration:** 10 min
- **Completed:** 2026-08-20T14:17:28Z
- **Tasks:** 3/3
- **Files modified:** 13

## Accomplishments

- Added strict published-template eligibility metadata for goals, languages, ratios, Kuwait market, required inputs, and capability aliases; this schema deliberately has no price fields.
- Enforced that metadata for guest estimates, owned project quotes, and `startRender`, returning only the stable, sanitized `template_configuration_ineligible` error when it does not match.
- Bound template quotes to a canonical full configuration and supplied a cancellable last-request-wins creator coordinator with honest loading, unavailable, expired, changed, and ready states.
- Included presenter, booking destination, subtitles, market, language, and outcome in the quote-bound configuration, so relevant draft changes automatically invalidate the old quote.

## Task Commits

1. **Task 1: Quote one eligible template from its exact configuration** — `daa4ff4` (TDD red), `7810bc5` (feature)
2. **Task 2: Reject stale and mismatched template quotes** — `97c77c8` (tests)
3. **Task 3: Coordinate per-template quote lifecycle in the creator** — `4487059` (TDD red), `017a4b8` (feature)
4. **Verification fixture correction** — `f03f13a` (tests)

## Verification

- `bun run --cwd packages/contracts test -- contracts` — passed (9 tests).
- `bun run --cwd apps/api test -- generation-service.test.ts` — passed (13 tests).
- `bun run --cwd apps/api typecheck` — passed.
- `bun run --cwd apps/web test -- src/features/create/templateQuoteState.test.ts src/features/create/GoldenPathFlow.test.tsx src/features/create/GoldenPathStates.test.tsx` — passed (6 tests).
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/web build` — passed.
- Pricing source scan over the quote state, coordinator, creator, API client, contracts, and generation service found no fallback credit or local-price expression.
- Accessibility review applied: quote transitions retain the draft, expose a single retry path through existing labelled feedback, do not disclose provider details, and do not add a new inaccessible control surface. The existing creator's rendered responsive/RTL UAT remains a phase-level browser review item.

## Decisions Made

- Eligibility and economics remain separated: the immutable template catalog controls fit; `GenerationPricing` controls credits, pricing version, expiry, and configuration hash.
- The server rechecks eligibility at all three trust boundaries. A previously acceptable browser state never authorizes a stale or altered render.
- The request coordinator holds no cost when an API request fails, expires, or is superseded. It only exposes the API response when it is ready and unexpired.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 2 - Missing critical configuration binding] Included creator campaign fields in the quote payload**
   - **Found during:** Task 3
   - **Issue:** Presenter mode, booking destination, and subtitle preference could change while the generation configuration remained unchanged, allowing an old quote to be reused after a quote-affecting edit.
   - **Fix:** Added `templateQuoteContext` to the portable generation configuration, preserving these campaign fields in the server-bound quote hash.
   - **Files modified:** `apps/web/src/features/create/projectStore.ts`
   - **Verification:** Creator quote lifecycle tests, API tests, and TypeScript checks passed.
   - **Committed in:** `017a4b8`

2. **[Rule 1 - Test fixture] Completed the starter-only quote configuration**
   - **Found during:** Plan-level API regression verification
   - **Issue:** A pre-existing starter-only quote test omitted the now-required `aspectRatio` configuration field.
   - **Fix:** Added the valid ratio to the test fixture without changing production pricing behavior.
   - **Files modified:** `apps/api/src/generation-service.test.ts`
   - **Verification:** All 13 generation-service tests passed.
   - **Committed in:** `f03f13a`

**Total deviations:** 1 auto-fixed Rule 2 requirement and 1 auto-fixed Rule 1 test correction.

## Known Stubs

None. The coordinator calls the existing internal generation quote API and never supplies a local quote, synthetic price, or provider call.

## Next Phase Readiness

- Template-selection UI can consume the explicit quote state to show only server-priced, eligible candidates.
- Guest authentication and generation remain protected by the same quote expiry, configuration, and idempotency constraints.

## Self-Check: PASSED

- Quote state module, coordinator, server eligibility integration, focused tests, and this summary file exist.
- Task commits `daa4ff4`, `7810bc5`, `97c77c8`, `4487059`, `017a4b8`, and `f03f13a` exist in repository history.

---
*Phase: 03-product-and-service-golden-paths*
*Completed: 2026-08-20*
