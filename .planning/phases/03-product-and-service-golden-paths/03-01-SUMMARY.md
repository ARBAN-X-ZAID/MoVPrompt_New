---
phase: 03-product-and-service-golden-paths
plan: "01"
subsystem: creator-contracts
tags: [zod, vitest, react, campaign-source, provenance]
requires:
  - phase: 02-guest-authentication-and-data-integrity
    provides: seven-day guest drafts, private claim, project version and hydration seams
provides:
  - one normalized CampaignSource and ConfirmedFact collection for product and service campaigns
  - immutable imported/manual/confirmed provenance transitions and outcome-aware fact requirements
  - source-first/template-first serialization, generation configuration, and cloud hydration regression proof
affects: [phase-03-plans-02-to-08, quote-hashing, creator-ui, project-hydration]
actuals:
  tokens: 8990
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns:
    - CampaignSource is the one durable browser/API source of truth; product remains a compatibility view.
    - Campaign fact transitions are pure functions that preserve explicit provenance.
key-files:
  created:
    - apps/web/src/features/create/sourceFacts.ts
    - apps/web/src/features/create/campaignFacts.test.ts
    - apps/web/src/features/create/campaignDraft.test.ts
    - packages/contracts/src/creator.test.ts
    - packages/creative-engine/src/types.test.ts
  modified:
    - packages/contracts/src/creator.ts
    - apps/web/src/features/create/projectStore.ts
    - apps/web/src/features/create/portableProjectMapper.ts
key-decisions:
  - Campaign sources persist only facts plus stable object keys; browser, remote-preview, and signed media URLs are rejected.
  - Existing pre-Phase-3 project records derive a deterministic manual-provenance CampaignSource at the compatibility edge.
  - The public contract and creative brief share all nine outcome identifiers.
requirements-completed: []
coverage:
  - id: D1
    description: Product and service inputs use one validated CampaignSource with durable asset identifiers.
    requirement: SOURCE-01
    verification:
      - kind: unit
        ref: apps/web/src/features/create/campaignFacts.test.ts#manual product tracer preserves stable fact values and asset identifiers
        status: pass
      - kind: unit
        ref: packages/contracts/src/creator.test.ts#accepts durable campaign source identifiers but rejects browser and signed URLs
        status: pass
    human_judgment: false
  - id: D2
    description: Imported edits and confirmations retain exact per-fact provenance and missing-fact state.
    requirement: SOURCE-03
    verification:
      - kind: unit
        ref: apps/web/src/features/create/campaignFacts.test.ts#keeps provenance truthful when an imported fact is edited then confirmed
        status: pass
    human_judgment: false
  - id: D3
    description: Both campaign source families retain facts and all nine outcomes through draft, canonical configuration, and hydration.
    requirement: CREATE-02
    verification:
      - kind: unit
        ref: apps/web/src/features/create/campaignDraft.test.ts#round-trips product and service sources from a saved project version without URL-bearing truth
        status: pass
      - kind: unit
        ref: packages/creative-engine/src/types.test.ts#accepts the shared complete campaign outcome taxonomy
        status: pass
    human_judgment: false
duration: 11min
completed: 2026-08-20
status: complete
---

# Phase 03 Plan 01: Normalized campaign source summary

**Campaign facts now survive browser drafts, portable claim configuration, generation compilation, and cloud hydration as one provenance-bearing CampaignSource for both products and services.**

## Accomplishments

- Added a strict public `CampaignSourceSchema` with bounded facts, explicit provenance, unique field protection, and durable asset-key-only media references.
- Built pure source-fact helpers for import, edit, confirmation, required facts, and review states without silently changing a user value.
- Bound the canonical source into guest drafts, stable project serialization, generation briefs, portable recipes, and cloud hydration.
- Expanded the shared campaign outcome taxonomy to all nine locked Phase 3 outcomes.

## Task Commits

1. **Task 03-01-01: Prove one manual-product fact through the normalized contract** — `372ba76`
2. **Task 03-01-02: Expand all source variants and provenance transitions** — `4c529b8`
3. **Task 03-01-02 follow-up: align the focused creator-contract selector** — `a61701a`
4. **Task 03-01-03: Preserve normalized intent through convergence, quote configuration, and hydration** — `099d241`

## Verification

- `bun run --cwd packages/contracts build` — passed.
- `bun run --cwd packages/creative-engine build` — passed.
- `bun run --cwd packages/contracts test -- creator` — passed (1 test).
- `bun run --cwd packages/creative-engine test -- types` — passed (1 test).
- `bun run --cwd apps/web test -- src/features/create/campaignFacts.test.ts` — passed (4 tests).
- `bun run --cwd apps/web test -- src/features/create/campaignDraft.test.ts` — passed (3 tests).
- `bun run --cwd apps/web typecheck` — passed.

## Decisions Made

- The canonical source stores only stable asset keys, fact values, and provenance. A booking link remains a fact; media URLs are never accepted as durable asset identity.
- Older creator projects remain readable: their legacy fields deterministically hydrate into a manual-provenance source, while all new Phase 3 flows write the normalized anchor.
- The creative engine imports the public campaign-goal schema instead of maintaining a second enum.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking verification] Added focused `creator.test.ts` and `types.test.ts` selectors.**

- **Found during:** Tasks 03-01-02 and 03-01-03.
- **Issue:** The plan's focused `vitest -- creator` and `vitest -- types` commands had no matching test filenames.
- **Fix:** Added focused contract and creative-engine tests, and moved the source-schema assertion to the matching creator test file.
- **Verification:** Both exact planned selector commands now pass.
- **Committed in:** `4c529b8`, `a61701a`, `099d241`.

**2. [Rule 3 - Blocking type safety] Updated fixed goal-label records after the shared taxonomy expanded.**

- **Found during:** Task 03-01-03.
- **Issue:** Adding the three locked outcomes made creator labels and media goal maps non-exhaustive.
- **Fix:** Added the Arabic creator labels and deterministic media labels/tone mappings required by the public type.
- **Verification:** Web typecheck passes.
- **Committed in:** `099d241`.

**Total deviations:** 2 auto-fixed blocking issues. Both are required for the planned focused verification and type-safe shared taxonomy; no user-facing flow was redesigned.

## Known Stubs

None. Existing legacy project fields are an intentional compatibility boundary, not a rendered mock or placeholder; they are deterministically converted to `CampaignSource` during draft/configuration/hydration.

## Next Phase Readiness

Plan 03-02 can now build the product/service source and fact-review UI on a shared, tested contract. The remaining Phase 3 plans must use `CampaignSource` as the persisted anchor and must not reintroduce a parallel product/service truth shape.

The five Phase 3 requirements named by the plan remain pending in the project tracker because their end-user screens and full golden-path proof are intentionally delivered by later Phase 3 plans. This plan supplies their durable data contract only.

## Self-Check: PASSED

- All five new test/helper files exist.
- All four task commits exist in local Git history.
- No provider call, paid action, migration, or unrelated dirty file was included.
