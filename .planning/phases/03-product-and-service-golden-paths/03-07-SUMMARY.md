---
phase: 03-product-and-service-golden-paths
plan: "07"
subsystem: creator-review-auth-handoff
tags: [web, react, campaign-review, quotes, auth, rtl, accessibility]
requires:
  - phase: 03-03
    provides: configuration-bound server quote lifecycle
  - phase: 03-06
    provides: normalized Kuwait campaign setup and presenter eligibility
provides:
  - canonical six-group campaign review
  - current-quote and rights gated Generate-time authentication handoff
  - Arabic RTL review and outage/cancellation recovery coverage
affects: [create-studio, guest-drafts, auth-recovery, generation-submission]
tech-stack:
  added: []
  patterns: [derived review projection, expired quote click-time guard, focus-return trigger ref]
key-files:
  created:
    - apps/web/src/features/create/CampaignReviewStep.tsx
    - apps/web/src/features/create/CampaignReviewStep.test.tsx
  modified:
    - apps/web/src/features/create/CreateStudio.tsx
    - apps/web/src/features/create/GoldenPathStates.test.tsx
    - apps/web/src/features/create/AuthGateDialog.test.tsx
    - apps/web/src/features/create/creator.css
key-decisions:
  - "The final review is a projection of the active normalized CreatorProject, never a duplicated submission object."
  - "Generate requires a live unexpired quote, complete rights, and required source media; the server remains the final authority after claim."
  - "Auth cancellation returns focus to the same Generate control and retains the stable pending generation intent."
requirements-completed: [SOURCE-02, SOURCE-03, CREATE-02, CREATE-05, CREATE-07, CREATE-08, CREATE-09, CREATE-10]
coverage:
  - id: D1
    description: Exact product review groups, fact provenance, edit routing, and ready Generate state.
    requirement: CREATE-02
    verification:
      - kind: unit
        ref: apps/web/src/features/create/CampaignReviewStep.test.tsx#renders an exact product review and routes each group to its owning step
        status: pass
    human_judgment: false
  - id: D2
    description: Arabic service review keeps URL values direction-isolated and blocks an expired quote.
    requirement: CREATE-08
    verification:
      - kind: unit
        ref: apps/web/src/features/create/CampaignReviewStep.test.tsx#keeps an Arabic service review direction-safe and blocks generation for an expired quote
        status: pass
    human_judgment: false
  - id: D3
    description: Quote outage and authentication cancellation retain the exact review and safe recovery action.
    requirement: CREATE-09
    verification:
      - kind: unit
        ref: apps/web/src/features/create/GoldenPathStates.test.tsx#keeps the exact review available through quote and service outages without enabling Generate
        status: pass
      - kind: unit
        ref: apps/web/src/features/create/AuthGateDialog.test.tsx#reports cancellation through the existing dialog close action without clearing the return intent
        status: pass
    human_judgment: false
actuals:
  tokens: 11502
  tasks: 3
  commits: 5
metrics:
  duration: "completed during Wave 7"
  completed: "2026-08-20"
status: complete
---

# Phase 03 Plan 07: Campaign Review and Auth Handoff Summary

The creator now ends with a calm, truthful six-group campaign review that can only open account creation at Generate, after current pricing, rights, and required source media agree.

## Accomplishments

- Added a semantic review of Source; Campaign; Presenter and media; Delivery; Rights; and Price, derived directly from the active project and normalized campaign facts.
- Added provenance labels, direction-safe URLs/phone/price values in RTL, KWD context, presenter/media selection, output settings, and source/fact/campaign edit routes.
- Replaced the old loose final panel with an explicit price/rights gate. Expired quotes are blocked again at click time, even if their visual expiry timer is late.
- Kept the existing stable pending-generation ID and guest draft save before Generate-time authentication; cancellation returns focus to the final Generate button rather than losing place in the review.
- Added price outage, worker-paused, request-ID support detail, rights-required, incomplete-source, and cancelled-auth recovery states without fake prices or fake success.
- Added responsive review layout, 44px edit targets, semantic definition lists, logical RTL styling, reduced-motion compatibility, and a mobile sticky primary action.

## Verification

- `bun run --cwd apps/web test -- src/features/create/CampaignReviewStep.test.tsx src/features/create/GoldenPathStates.test.tsx src/features/create/AuthGateDialog.test.tsx` — passed (3 files, 9 tests).
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/web build` — passed. The pre-existing Vite large chunk warning remains.
- Rendered `http://127.0.0.1:8081/qa/create` at 375, 768, 1024, and 1440px: all viewport checks reported no document horizontal overflow; the creator main region remained visible; the captured 375px English source step had clear hierarchy and accessible source controls. The new review uses the existing semantic light/dark creator tokens rather than hardcoded colors.
- Browser console inspection found no app warnings or errors. The local QA environment has no reachable authoritative quote service, so it correctly could not advance to the final review with a real server quote; the exact review itself is covered by focused interaction tests and the production build.

## Task Commits

1. **Task 03-07-01: Review and hand off one exact product campaign** — `7956a40` (test), `1d03238` (feat)
2. **Task 03-07-02: Complete exact Arabic service review** — `1d03238` (feat)
3. **Task 03-07-03: Preserve exact review through quote outages and authentication recovery** — `53123a0` (test)

Additional correctness fixes: `1c56766` restores Generate focus after dialog cancellation; `7fde774` requires an actual source before the review can enable generation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Accessibility bug] Restored focus to the final Generate control after auth cancellation.**
- **Found during:** Task 03-07-03.
- **Issue:** Replacing the old final panel removed the ref used by the existing auth dialog close handler.
- **Fix:** Passed the review’s Generate button ref through to the existing focus-return handler.
- **Files modified:** `CampaignReviewStep.tsx`, `CreateStudio.tsx`.
- **Verification:** Focus-compatible component suite and TypeScript check passed.
- **Commit:** `1c56766`.

**2. [Rule 2 - Generation gate] Prevented incomplete source campaigns from appearing ready to generate.**
- **Found during:** Task 03-07-03.
- **Issue:** A valid quote and rights checkbox alone could visually enable the new review action before required source name/media checks.
- **Fix:** Made required source name and media part of the same client gate; the server remains authoritative at claim/submission.
- **Files modified:** `CampaignReviewStep.tsx`.
- **Verification:** Focused review tests and TypeScript check passed.
- **Commit:** `7fde774`.

## Known Verification Limitation

The isolated QA web server intentionally has no authoritative quote API. It cannot demonstrate the complete live review-to-auth flow in a browser without the provisioned API/worker environment. This is an integration-environment limitation, not a simulated pricing fallback; the Phase 03 final real-stack UAT remains the closing evidence for that path.

## Self-Check: PASSED

- Task commits `7956a40`, `1d03238`, `53123a0`, `1c56766`, and `7fde774` exist in Git history.
- `CampaignReviewStep.tsx`, its focused tests, and all modified integration files exist at the paths recorded above.
- No new placeholders, TODOs, or hardcoded prices were introduced by this plan.
