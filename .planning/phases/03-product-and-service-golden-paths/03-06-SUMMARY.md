---
phase: 03-product-and-service-golden-paths
plan: "06"
subsystem: campaign-setup
tags: [web, creator, kuwait, presenter, quotes, rtl, accessibility]
requires:
  - phase: 03-04
    provides: server-side presenter and rights eligibility enforcement
  - phase: 03-05
    provides: configuration-bound recommendation quotes
provides:
  - progressive Kuwait-first campaign configuration
  - fail-closed presenter choices with exact footage rights binding
  - quote-honest updates for campaign and presenter settings
affects: [create-studio, guest-drafts, project-configuration, quote-recovery]
tech-stack:
  added: []
  patterns: [controlled campaign settings, normalized fact updates, capability-projected UI, immutable presenter consent payload]
key-files:
  created:
    - apps/web/src/features/create/campaignSetupRules.ts
    - apps/web/src/features/create/CampaignSetupStep.tsx
    - apps/web/src/features/create/PresenterChoice.tsx
    - apps/web/src/features/create/CampaignSetupStep.test.tsx
    - apps/web/src/features/create/PresenterStep.test.tsx
  modified:
    - apps/web/src/features/create/CreateStudio.tsx
    - apps/web/src/features/create/contracts.ts
    - apps/web/src/features/create/projectStore.ts
    - apps/web/src/features/create/portableProjectMapper.ts
    - apps/web/src/features/create/types.ts
    - apps/web/src/features/create/creator.css
    - apps/web/src/i18n/translations/en.ts
    - apps/web/src/i18n/translations/ar.ts
decisions:
  - "No presenter is the safe default; AI UGC appears only after the public capability, selected template policy, and campaign language all agree."
  - "Uploaded spokesperson remains unavailable in the live creator until the API projects both a verified-footage policy and private eligible assets; the component still enforces exact asset and rights binding."
  - "Price, offer, booking link, and WhatsApp updates write through the normalized campaign fact source before refreshing the configuration-bound quote."
metrics:
  duration: "completed during Wave 6"
  completed: "2026-08-20"
status: complete
actuals:
  tokens: 16175
  tasks: 3
  commits: 5
---

# Phase 03 Plan 06: Presenter and Campaign Setup Summary

MovPrompt now guides a beginner through a Kuwait-first campaign setup with a no-presenter default, truthful human-media controls, and clear re-pricing feedback instead of model or prompt controls.

## Delivered

- Replaced the old all-at-once campaign form with a progressive setup: presenter, Kuwait/campaign language, offer and CTA, goal-relevant destination, and delivery settings.
- Fixed Kuwait as the only selectable market and normalized KWD amounts to three decimal places on blur.
- Kept booking and WhatsApp values lossless when the selected outcome hides them; required destination validation follows the current outcome.
- Connected price, offer, booking and WhatsApp edits to normalized campaign facts so the persisted configuration, prompt compilation, and quote input agree.
- Added a distinct, live polite re-pricing state after each quote-affecting campaign or presenter change.
- Added server-projected presenter controls: no presenter is always available; AI UGC is absent unless capability availability, published template policy, and the selected campaign language all permit it.
- Added exact uploaded-spokesperson consent payload behavior, tying the selected private footage UUID to the versioned rights acknowledgement. Unsupported/tampered presenter values fall back to no presenter in the UI.
- Persisted valid presenter data across guest drafts, portable configuration, project records, and cloud hydration without exposing providers, model IDs, or digital-twin controls.
- Added responsive semantic styling, visible focus, 44px-or-larger primary actions, RTL-safe logical layout, reduced-motion support, localized campaign vocabulary, and a mobile creator-progress overflow correction.

## Verification

- `bun run --cwd apps/web test -- src/features/create/PresenterStep.test.tsx src/features/create/CampaignSetupStep.test.tsx src/features/create/__tests__/creatorContracts.test.ts src/features/create/portableProjectMapper.test.ts` — passed (4 files, 11 tests).
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/web build` — passed. The existing Vite Analytics chunk-size warning remains.
- Rendered local QA at `http://127.0.0.1:8081/qa/create`:
  - Light/dark and English/Arabic RTL shells rendered without console errors.
  - Measured no document horizontal overflow at 375, 768, 1024, and 1440 pixels after the creator-progress correction.
  - Arabic mobile layout retained the visible language, theme, navigation, outcome, and focus treatment at 375px.
  - Keyboard-accessible names, native field labels, field errors, and live quote feedback are covered by the focused component suite.

## Commits

- `6d0f22e` — `test(03-06): add failing Kuwait setup tracer`
- `7ee87a5` — `feat(03-06): add guided Kuwait campaign setup`
- `5f73fd2` — `test(03-06): add presenter eligibility coverage`
- `1cf7c37` — `feat(03-06): gate presenter choices by compatibility`
- `c61f1c2` — `style(03-06): polish responsive campaign setup`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical persistence] Persisted the exact presenter rights payload beyond the UI.**
- **Found during:** Task 03-06-02.
- **Issue:** The existing browser project and draft contracts stored only `presenterMode`, which would lose the asset UUID and rights attestation required for an uploaded spokesperson.
- **Fix:** Added the optional validated presenter payload to creator types, guest drafts, portable generation/configuration recipes, and cloud-project hydration. Legacy/tampered modes fail closed to no presenter.
- **Files modified:** `types.ts`, `contracts.ts`, `projectStore.ts`, `portableProjectMapper.ts`.
- **Commit:** `1cf7c37`.

**2. [Rule 1 - Responsive bug] Removed mobile creator-progress horizontal overflow.**
- **Found during:** Rendered 375px RTL QA.
- **Issue:** The compressed progress rail positioned a hidden-label step 11px outside the viewport, creating document-level horizontal scrolling.
- **Fix:** Compressed the rail spacing at tablet/mobile widths and hid nonessential labels with the existing screen-reader-safe pattern.
- **Files modified:** `creator.css`.
- **Commit:** `c61f1c2`.

## Known Verification Limitation

The local QA app had no reachable authoritative quote service, so its recommendation cards correctly kept template selection disabled. The full page could not therefore advance to the campaign setup panel in this browser session. The new setup and presenter states have focused DOM interaction tests, type checks, and production-build evidence; end-to-end browser verification with a live quote service remains part of the next integrated environment check.

## Self-Check: PASSED

- All five task commits exist in Git history.
- All created components, tests, rules, styling, translations, and this summary exist at the paths recorded above.
