---
phase: 03-product-and-service-golden-paths
plan: "02"
subsystem: ui
tags: [react, creator, campaign-source, accessibility, i18n]
requires:
  - phase: 03-product-and-service-golden-paths
    provides: Normalized CampaignSource, provenance helpers, and guest-draft compatibility mapping.
provides:
  - Four source entry choices for product, business/service, uploaded media, and manual facts.
  - Reviewable product and service facts with explicit imported, confirmed, and manual provenance.
  - Bilingual, non-destructive validation and recovery states for the source journey.
affects: [template-selection, guest-auth-handoff, asset-claim, generation]
actuals:
  tokens: 20294
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Controlled source and fact-review components with CreateStudio as the sole state, scan, and guest-draft controller.
    - Provenance remains visible while user corrections are applied through normalized CampaignSource helpers.
key-files:
  created:
    - apps/web/src/features/create/SourceChoiceStep.tsx
    - apps/web/src/features/create/FactReviewStep.tsx
    - apps/web/src/features/create/GoldenPathFlow.test.tsx
    - apps/web/src/features/create/FactReviewStep.test.tsx
    - apps/web/src/features/create/GoldenPathStates.test.tsx
  modified:
    - apps/web/src/features/create/CreateStudio.tsx
    - apps/web/src/features/create/creator.css
    - apps/web/src/features/create/types.ts
    - apps/web/src/i18n/translations/en.ts
    - apps/web/src/i18n/translations/ar.ts
key-decisions:
  - "The four source choices converge on one normalized CampaignSource rather than separate product and service state models."
  - "URL scanning remains behind the existing abortable portable API controller; no browser-side fetch was added."
  - "Source failures provide one contextual recovery action and retain the exact editable draft."
patterns-established:
  - "Source form pattern: use a native fieldset/radiogroup, 44px actions, logical CSS, and a dedicated live status."
  - "Fact review pattern: show provenance next to every fact and focus the first missing outcome-required input without clearing values."
requirements-completed: [SOURCE-01, SOURCE-02, SOURCE-03, CREATE-01, CREATE-10]
coverage:
  - id: D1
    description: Product, business/service, upload, footage, and manual source choices lead into one provenance-bearing fact review.
    requirement: SOURCE-01
    verification:
      - kind: unit
        ref: apps/web/src/features/create/GoldenPathFlow.test.tsx#product link to confirmed facts
        status: pass
      - kind: unit
        ref: apps/web/src/features/create/FactReviewStep.test.tsx
        status: pass
    human_judgment: false
  - id: D2
    description: Source errors, cancellation, required field validation, and recovery retain entered values.
    requirement: CREATE-10
    verification:
      - kind: unit
        ref: apps/web/src/features/create/GoldenPathStates.test.tsx
        status: pass
    human_judgment: false
  - id: D3
    description: English/Arabic source, provenance, and recovery presentation uses logical layout and accessible controls.
    requirement: SOURCE-03
    verification:
      - kind: other
        ref: bun run --cwd apps/web build
        status: pass
    human_judgment: true
    rationale: Visual RTL and responsive quality needs rendered-browser review at 375, 768, 1024, and 1440 pixels.
duration: 26min
completed: 2026-08-20
status: complete
---

# Phase 03 Plan 02: Product and Service Source Journey Summary

**A guided, bilingual product-and-service source journey that keeps campaign facts reviewable, attributable, and intact through recoverable errors.**

## Performance

- **Duration:** 26 min
- **Completed:** 2026-08-20T14:00:21Z
- **Tasks:** 3/3
- **Files modified:** 10

## Accomplishments

- Replaced the sample-led source area with four clear starting points: product link, business/service link, photos or footage, and manual details.
- Added a source-specific fact review that visibly distinguishes imported facts, user confirmations, manual corrections, and missing optional facts.
- Kept URL scans on the hardened internal portable API path, with cancellation, focused field validation, Arabic/English labels, and no destructive error recovery.

## Task Commits

1. **Task 1: Complete product-link to confirmed-fact review** — `6db8458` (feat)
2. **Task 2: Complete service, upload, footage, and manual fact review** — `bb0859f` (feat)
3. **Task 3: Add bilingual source validation and non-destructive recovery states** — `59bd64a` (feat)

## Verification

- `bun run --cwd apps/web test -- src/features/create/GoldenPathFlow.test.tsx src/features/create/FactReviewStep.test.tsx src/features/create/GoldenPathStates.test.tsx` — passed (4 tests).
- `bun run --cwd apps/web typecheck` — passed.
- `bun run --cwd apps/web build` — passed.
- Accessibility review applied: semantic groups, labelled controls, associated errors, focused invalid field, live loading status, 44px targets, reduced-motion-safe transitions, and logical CSS were verified in code and focused component tests. Rendered RTL/responsive review remains a required manual UAT item.

## Decisions Made

- Product and service paths stay typed views of `CampaignSource`; no duplicate business-form state was introduced.
- Imported metadata is never promoted to campaign-ready copy without review. A manual edit stays visibly user-authored, while Confirm details only changes untouched imported facts.
- The only source retry action is contextual: link retry, file replacement, or continue-editing for offline state. It never clears the draft.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 - Bug] Corrected the offline recovery state check**
   - **Found during:** Task 3
   - **Issue:** The recovery controller exposes `offline`, while the new source retry handler compared against the input code `network_offline`.
   - **Fix:** Used the normalized recovery state so continuing offline clears only the transient error and preserves the draft.
   - **Files modified:** `apps/web/src/features/create/CreateStudio.tsx`
   - **Verification:** Focused source-state tests and TypeScript check passed.
   - **Committed in:** `59bd64a`

**Total deviations:** 1 auto-fixed (Rule 1)

## Known Stubs

- `apps/web/src/features/create/creatorAssets.ts:37` — The new MP4/MOV source choice is stored and reviewed in the seven-day guest draft, but the authenticated asset-claim client still accepts only JPEG, PNG, and WebP. General media claiming must be completed before footage can proceed through account creation to generation.

## Next Phase Readiness

- Template selection can now depend on a reviewed, provenance-bearing product or service source.
- Guest-auth handoff must extend the existing image-only claim/upload validation before the footage source option can become an end-to-end generated campaign.

## Self-Check: PASSED

- Source and fact-review components, focused state test, and summary file exist.
- Task commits `6db8458`, `bb0859f`, and `59bd64a` exist in repository history.

---
*Phase: 03-product-and-service-golden-paths*
*Completed: 2026-08-20*
