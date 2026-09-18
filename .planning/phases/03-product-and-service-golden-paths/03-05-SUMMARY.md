---
phase: 03-product-and-service-golden-paths
plan: "05"
subsystem: template-recommendations
tags: [web, creator, recommendations, quotes, accessibility, rtl]
requires:
  - phase: 03-01
    provides: confirmed campaign source facts
  - phase: 03-03
    provides: configuration-bound template quote lifecycle
  - phase: 03-04
    provides: presenter eligibility constraints
provides:
  - explainable, deterministic outcome-based template recommendations
  - quote-gated selection carrying the exact quote and configuration
  - truthful distinction between verified motion previews and static directions
affects: [create-studio, template-discovery, quote-recovery]
tech-stack:
  added: []
  patterns: [controlled recommendation selection, server-quote gating, keyboard radio navigation]
key-files:
  created:
    - apps/web/src/features/create/templateRecommendations.ts
    - apps/web/src/features/create/TemplateRecommendationCards.tsx
    - apps/web/src/features/create/templateRecommendations.test.ts
  modified:
    - apps/web/src/features/create/OutcomeStep.tsx
    - apps/web/src/features/create/TemplateRecommendation.test.tsx
    - apps/web/src/features/create/CreateStudio.tsx
    - apps/web/src/features/create/TemplateGrid.tsx
    - apps/web/src/features/create/TemplateGrid.test.tsx
    - apps/web/src/features/create/creator.css
decisions:
  - "Recommendation selection remains disabled until the matching server quote is ready and unexpired."
  - "Catalog data narrows eligible templates but never supplies a fallback customer price."
  - "Only previewVideo may expose motion playback; static artwork uses a View direction affordance."
metrics:
  duration: "completed during Wave 5"
  completed: "2026-08-20"
status: complete
actuals:
  tokens: 9002
  tasks: 3
  commits: 7
---

# Phase 03 Plan 05: Outcome Recommendations Summary

MovPrompt now guides a confirmed beginner source through one clear campaign outcome to at most three explainable templates, and only enables a choice after the matching live quote is ready.

## Delivered

- Added all nine campaign outcomes as an accessible, keyboard-operable radio group with selected-state copy, roving focus, Arrow-key movement, and explicit Space/Enter selection.
- Added deterministic recommendation ranking from published local catalog eligibility only: matching vertical, outcome, language, aspect ratio, and source presence, with stable score and template-ID tie breaks.
- Added a maximum-three recommendation surface that explains expected result, required inputs, duration/formats, presenter compatibility, preview type, and current authoritative quote state.
- Wired recommendations into `CreateStudio`: source facts and outcome remain intact, while selection passes the exact template, configuration, and server quote forward rather than a catalog estimate.
- Added loading, unavailable, expired, and changed-price recovery states. Price is only shown when the corresponding quote is ready; support request IDs remain behind an expandable disclosure.
- Made verified preview media the only source of Play controls. Static artwork is visibly labeled as a direction and exposes View direction without a duration bar or player chrome.
- Added responsive outcome/recommendation layouts using the existing semantic token system: one column at mobile, multi-column when space permits, light/dark/RTL support, visible focus, and 44px-or-larger primary controls.

## Verification

- `bun run --cwd apps/web test -- src/features/create/TemplateRecommendation.test.tsx src/features/create/templateRecommendations.test.ts src/features/create/TemplateGrid.test.tsx` — passed (3 files, 14 tests).
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/web build` — passed. Vite reported the existing Analytics chunk-size warning only.
- Rendered local browser check at `http://127.0.0.1:4173/create`:
  - Manual source → fact review → outcome step reached the three ranked recommendation cards.
  - With no local API quote service, every card truthfully showed `Price unavailable`, offered `Retry price`, and kept `Use this template` disabled; no fallback credit number was exposed.
  - Arabic mode set `dir="rtl"` and rendered Arabic headings and outcome states without visual-card overflow.
  - Dark mode rendered successfully using the existing tokens.
  - At 375px, cards measured within the available content width and stacked as one column; the only measured document edge artifact was an existing clipped progress-label/screen-reader utility, not visible recommendation content.
  - Keyboard Arrow navigation moved focus and selected the next outcome after the accessibility fix.
  - `/templates` rendered static directions as `View direction` links with no Play controls, while verified-motion cards retained their playable preview control.

## Commits

- `4f4bad3` — `test(03-05): add quoted recommendation tracer`
- `d0adda3` — `feat(03-05): add quoted template recommendations`
- `a70ef7c` — `test(03-05): cover recommendation recovery states`
- `7f420b1` — `feat(03-05): connect outcome recommendations to creator`
- `81169e2` — `test(03-05): protect static template media truth`
- `0aa51fd` — `feat(03-05): separate motion previews from static directions`
- `2c8ded7` — `fix(03-05): support keyboard outcome selection`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking portability issue] Avoided a case-insensitive filesystem module collision**
- **Found during:** Task 03-05-01.
- **Issue:** The planned `TemplateRecommendations.tsx` component collides with `templateRecommendations.ts` on default macOS filesystems and TypeScript's consistent-casing check.
- **Fix:** Named the visual component `TemplateRecommendationCards.tsx`; the planned `templateRecommendations.ts` remains the pure ranking and selection contract.
- **Files modified:** `apps/web/src/features/create/TemplateRecommendationCards.tsx`, `apps/web/src/features/create/CreateStudio.tsx`, tests.
- **Commit:** `d0adda3`, `7f420b1`.

**2. [Rule 1 - Accessibility bug] Completed keyboard behavior for outcome selection**
- **Found during:** Rendered browser QA.
- **Issue:** The new custom radio buttons selected by pointer but did not reliably invoke the controlled selection change through the keyboard.
- **Fix:** Added roving `tabIndex`, Arrow-key movement, and explicit Space/Enter selection with automated coverage.
- **Files modified:** `apps/web/src/features/create/OutcomeStep.tsx`, `apps/web/src/features/create/TemplateRecommendation.test.tsx`.
- **Commit:** `2c8ded7`.

**3. [Rule 3 - Verification blocker] Rebuilt referenced shared workspace outputs before web verification**
- **Found during:** Initial targeted test startup.
- **Issue:** The local workspace had stale/missing compiled outputs for `@movprompt/contracts` and `@movprompt/creative-engine`.
- **Fix:** Ran their existing build scripts before the UI test suite; no source or dependency change was required.

## Known Stubs

None. Local development intentionally displays the honest quote-unavailable recovery state until an API quote service is running; it does not substitute a mock price or simulated ready quote.

## Self-Check: PASSED

- All seven implementation commits exist in Git history.
- The recommendation scorer, card surface, integration, static-media tests, and this summary exist at the paths recorded above.
