---
phase: 04-durable-generation-and-accepted-quality
plan: "01"
subsystem: generation
tags: [seedance, worker, postgres, private-storage, ffmpeg, redaction, react]
requires:
  - phase: 03-product-and-service-golden-paths
    provides: guest-claimed projects, quote-bound generation requests, and Template Mode creation UI
provides:
  - restart-safe reconciliation for a persisted Seedance operation
  - exact-host private output validation and final-object full decode checks
  - truthful public cancellation/progress state with provider-detail redaction
affects: [04-02, 04-03, generation-activation, creator-ui]
actuals:
  tokens: 9036
  tasks: 3
  commits: 6
tech-stack:
  added: []
  patterns:
    - Persisted operation ambiguity remains reconcilable and never triggers a replacement provider submit.
    - Public render errors are mapped from stable codes; raw provider messages never cross the API boundary.
    - Development-only QA uses an explicit zero-cost preview quote, while production remains fail-closed on server pricing.
key-files:
  created:
    - scripts/verify-phase4-redaction.ts
  modified:
    - packages/providers/src/vercel-gateway-seedance.ts
    - apps/worker/src/output-persister.ts
    - apps/worker/src/media-quality-analyzers.ts
    - apps/api/src/generation-service.ts
    - apps/web/src/features/create/CreateStudio.tsx
key-decisions:
  - "A completed provider status without an output URL is an ambiguous state to reconcile, never a terminal customer failure or a resubmission trigger."
  - "Gateway cancellation stays visibly pending after acceptance until durable provider reconciliation yields terminal truth."
  - "Only exact reviewed output hosts are accepted; DNS suffixes and wildcard-style host rules are rejected."
  - "The local QA creator may use a labelled zero-cost preview fixture only under import.meta.env.DEV; production always requires a real current quote."
patterns-established:
  - "Final private media must pass FFprobe policy and a full FFmpeg decode before later visual approval."
  - "Provider URLs, operation identifiers, raw messages, retry details, and reviewer evidence are absent from public DTOs and structured evidence."
requirements-completed: [GEN-05, GEN-06, GEN-07, GEN-12, GEN-14]
coverage:
  - id: D1
    description: "Persisted Seedance operations reconcile without a second provider submission after an ambiguous completed response."
    requirement: GEN-05
    verification:
      - kind: unit
        ref: "packages/providers/src/vercel-gateway-seedance.test.ts#keeps a completed operation without an output on the same reconciliation path"
        status: pass
      - kind: integration
        ref: "bun run eval:phase04"
        status: pass
    human_judgment: false
  - id: D2
    description: "Private output acquisition validates exact hosts and the final owned object passes technical media checks."
    requirement: GEN-06
    verification:
      - kind: unit
        ref: "apps/worker/src/output-persister.test.ts and apps/worker/src/media-quality-analyzers.test.ts"
        status: pass
      - kind: integration
        ref: "bun run eval:phase04"
        status: pass
    human_judgment: false
  - id: D3
    description: "Public cancellation and failure state remains truthful and provider details are redacted."
    requirement: GEN-14
    verification:
      - kind: unit
        ref: "apps/api/src/generation-service.test.ts#generation cancellation safety"
        status: pass
      - kind: other
        ref: "bun scripts/verify-phase4-redaction.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Local creator preview is usable at mobile and desktop widths in Arabic dark mode without paid generation."
    requirement: GEN-12
    verification:
      - kind: automated_ui
        ref: "http://localhost:8080/qa/create — manual service path at 375, 768, 1024, and 1440; Arabic/dark mobile editor; console error log"
        status: pass
    human_judgment: true
    rationale: "The local QA fixture proves the no-cost preview path, but a running durable API/worker fixture is still needed to visually inspect a persisted cancelling state."
duration: 18min
completed: 2026-08-21
status: complete
---

# Phase 4 Plan 01: Durable Lifecycle, Private Output, and Truthful State Summary

**A single Seedance operation now survives ambiguous completion safely, final media is owned and technically checked before acceptance, and customers receive calm, provider-free status and cancellation state.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-08-21T16:39:59Z
- **Completed:** 2026-08-21T16:57:48Z
- **Tasks:** 3/3
- **Files modified:** 11
- **Paid provider calls:** 0

## Accomplishments

- Kept an operation with a completed-but-outputless provider response on the original durable reconciliation path, with no second provider start.
- Hardened final-output acceptance with exact host checks, an owned-object full FFmpeg decode, and hard failures for unsupported codecs.
- Replaced raw provider-facing errors with stable product guidance, retained accepted cancellations in `cancelling`, and added a deterministic redaction verifier.
- Fixed the development-only QA route so it can exercise the full no-cost preview flow without contacting live pricing or making a production claim.

## Task Commits

1. **Task 1: Reconcile one persisted Seedance operation end to end**
   - `8837653` — `test(04-01): cover missing provider output recovery`
   - `fa1c069` — `feat(04-01): reconcile missing provider output safely`
2. **Task 2: Acquire and validate final private media**
   - `f648f95` — `test(04-01): cover final-object media safety gates`
   - `78c8611` — `feat(04-01): harden owned media validation`
3. **Task 3: Expose truthful cancellation and persisted public progress**
   - `bb8845b` — `test(04-01): cover safe cancellation and public redaction`
   - `f4d5492` — `feat(04-01): present durable generation states honestly`

## Verification

- `bun run eval:phase04` — passed; provider, worker, API, DB, storage, output, and quality fixtures ran without a provider request.
- `bun run --cwd apps/api test --run src/generation-service.test.ts` — 35 passed.
- `bun run --cwd apps/web test --run src/features/create/GoldenPathStates.test.tsx src/features/create/TemplateRecommendation.test.tsx` — 9 passed.
- `bun scripts/verify-phase4-redaction.ts` — passed.
- `bun run --cwd apps/api typecheck` and `bun run --cwd apps/web typecheck` — passed.
- Browser QA: local QA service flow reached review and no-cost preview generation; Arabic/dark mobile editor remained usable at 375px, editor controls remained visible at 768/1024/1440px, and the browser console had zero errors.

## UX Guidance Applied

- `ux-research-ia`: kept the primary task to one clear state and one safe next action, rather than exposing delivery mechanics.
- `visual-art-direction`: retained the existing quiet white/paper and gold-accent composition; no new visual language was introduced for an outage or cancellation.
- `design-system-token-architect`: reused the existing creator status, button, and progress tokens rather than adding a parallel notification component.
- `interaction-state-microcopy`: made pending cancellation explicit—"Cancellation is pending — we'll keep checking your saved project"—and disabled repeat cancellation while preserving access to the saved project.
- `accessibility-visual-qa`: made the visual bar decorative, kept status in a live region, verified keyboard-reachable controls, Arabic RTL, dark mode, responsive layout, and a clean console in the local QA route.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Completed provider states with no output URL became terminal failures**
- **Found during:** Task 1
- **Issue:** An ambiguous completed status could stop recovery even though the already-paid operation still required reconciliation.
- **Fix:** Preserve the exact provider operation as `processing` and schedule continued reconciliation.
- **Files modified:** `packages/providers/src/vercel-gateway-seedance.ts`, its test
- **Verification:** Adapter and lifecycle fixtures through `bun run eval:phase04`
- **Committed in:** `fa1c069`

**2. [Rule 2 - Security] Final private delivery bytes were not always fully decoded and suffix host allowance was too broad**
- **Found during:** Task 2
- **Issue:** FFprobe alone cannot prove a full decode, and a suffix-only host rule could admit unintended origins.
- **Fix:** Added full final-object FFmpeg decode, hard codec failures, and exact-host-only validation.
- **Files modified:** `apps/worker/src/media-quality-analyzers.ts`, `apps/worker/src/output-persister.ts`, tests
- **Verification:** 26 worker tests passed under the non-billable fixture suite.
- **Committed in:** `78c8611`

**3. [Rule 1 - Bug] The development QA flow advertised a no-cost preview but still blocked on live pricing**
- **Found during:** Task 3 browser QA
- **Issue:** Template selection could not reach the preview generation state with no API/worker pricing environment.
- **Fix:** Added an explicitly development-only, zero-cost preview quote and skipped authoritative quote revalidation only when `simulatedGeneration` is true.
- **Files modified:** `apps/web/src/features/create/CreateStudio.tsx`
- **Verification:** Rendered local `/qa/create` service flow completed without network provider use.
- **Committed in:** `f4d5492`

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2). All were required to maintain durability, security, or an honest no-cost QA boundary.

## Verification Gap

- A live durable API/worker fixture was not running locally, so the rendered browser matrix could not visually rehydrate a real persisted `cancelling` run. API tests prove that state and the QA route proves the no-cost UX at all required widths; a post-worker activation browser check remains required before public launch.

## User Setup Required

None for this plan. All verification was fixture-based and did not use paid provider credentials.

## Next Phase Readiness

- Phase 04-02 can add the calibrated visual/business quality policy on top of technically owned output without changing the provider lifecycle.
- Phase 04-03 can add settlement and acceptance pointer advancement once the quality decisions are complete.
- A real approved canary remains explicitly deferred; it requires the separate user-authorized budget and live worker/runtime evidence specified by the phase context.

## Self-Check: PASSED

- Summary exists at the required phase path.
- All six task commits are present in repository history.

*Phase: 04-durable-generation-and-accepted-quality*
*Completed: 2026-08-21*
