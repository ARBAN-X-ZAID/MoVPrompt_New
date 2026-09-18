---
phase: 03-product-and-service-golden-paths
plan: "08"
subsystem: creator-golden-path-validation
tags: [react, vitest, postgres, accessibility, evidence, uat]
requires:
  - phase: 03-07
    provides: canonical campaign review and Generate-time auth handoff
provides:
  - deterministic product and service campaign fixtures with a focused smoke gate
  - truthful provisioned-UAT and rendered-browser evidence contracts
  - a final review that visibly includes the selected CTA
affects: [phase-03-verification, release-gates, provisioned-uat]
actuals:
  tokens: 11000
  tasks: 1
  commits: 5
tech-stack:
  added: []
  patterns: [fixture-driven creator intent comparison, read-only UAT readiness, fail-closed evidence redaction]
key-files:
  created:
    - apps/web/src/features/create/__fixtures__/goldenPathFixtures.ts
    - apps/web/src/features/create/GoldenPathFlow.test.tsx
    - scripts/infra/run-phase3-provisioned-uat.ts
    - scripts/infra/check-phase3-evidence-redaction.mjs
    - .planning/phases/03-product-and-service-golden-paths/03-UAT-EVIDENCE.md
    - .planning/phases/03-product-and-service-golden-paths/03-BROWSER-EVIDENCE.md
  modified:
    - apps/web/src/features/create/CampaignReviewStep.tsx
    - apps/worker/src/abandoned-claim-cleanup.ts
    - .planning/phases/03-product-and-service-golden-paths/03-VALIDATION.md
key-decisions:
  - "The release gate records unavailable UAT infrastructure as NOT VERIFIED rather than inventing a claim, quote, or run result."
  - "The final review exposes the selected CTA because it is a user-confirmed generation fact, not hidden configuration."
  - "The worker cleanup type accepts footage so abandoned claimed media receives the same safe cleanup path as other private assets."
requirements-completed: []
coverage:
  - id: D1
    description: Deterministic product and service fixtures retain all submit-boundary fields and require no provider work.
    verification:
      - kind: unit
        ref: bun run test:creator-smoke
        status: pass
    human_judgment: false
  - id: D2
    description: Real authentication, private claim/checksum, replay, authoritative quote, and a queue-paused durable run.
    verification:
      - kind: manual_procedural
        ref: .planning/phases/03-product-and-service-golden-paths/03-UAT-EVIDENCE.md
        status: unknown
    human_judgment: true
    rationale: Provisioned stack lacks Mailpit/worker proof and has generation disabled; no safe real UAT can be inferred.
  - id: D3
    description: Rendered responsive, theme, RTL, keyboard, focus, and reduced-motion matrix.
    verification:
      - kind: manual_procedural
        ref: .planning/phases/03-product-and-service-golden-paths/03-BROWSER-EVIDENCE.md
        status: unknown
    human_judgment: true
    rationale: Browser automation is unavailable and the provisioned creator path cannot reach Generate truthfully.
metrics:
  duration: 33min
  completed: 2026-08-21
status: halted
---

# Phase 03 Plan 08: Golden Path Validation Summary

**The creator now has deterministic product/service submit-boundary tests and a release gate that refuses to represent unavailable real-stack or browser evidence as a passing campaign journey.**

## Accomplishments

- Added explicit product and salon-service fixture manifests that preserve source facts/provenance, template, presenter, KWD campaign details, media, rights, quote, pending generation intent, and delivery settings through the final review boundary.
- Added `bun run test:creator-smoke`, which passes 12 focused tests without starting any provider work; the full release gate also passes.
- Corrected the final review so it visibly shows the user-selected CTA before Generate.
- Added a loopback-only, read-only provisioned-UAT readiness harness and an evidence redaction gate. The observed environment is recorded as NOT VERIFIED because generation is disabled and the required Mailpit/worker/queue proof is unavailable.
- Restored workspace typecheck by adding the new footage kind to the abandoned-claim cleanup boundary.

## Verification

- `bun run test:creator-smoke` — passed: 3 files, 12 tests.
- `bun run test:all` — passed: web 180 tests; API 89 passed / 13 environment-guarded skips; worker 67 passed / 9 environment-guarded skips; all shared package suites passed.
- `bun run typecheck` — passed after footage cleanup compatibility fix.
- `bun run build` and `bun run check:web-bundle` — passed; first-route bundle is within the configured limit. Vite retains its non-blocking large-chunk warning.
- `bun scripts/infra/run-phase3-provisioned-uat.ts --verify-evidence` and `node scripts/infra/check-phase3-evidence-redaction.mjs` — passed.
- `bun scripts/infra/run-phase3-provisioned-uat.ts` — intentionally reports NOT VERIFIED and exits non-zero after read-only checks; it makes no mutation or provider call.

## Task Commits

1. **Task 03-08-01: Add complete fixtures and a focused creator smoke command** — `d31e576` (RED), `e18e54a` (GREEN)
2. **Task 03-08-02: Prove real auth, private claim, quote and durable submission on a provisioned stack** — `154485c` (truthful blocked-UAT harness and evidence)
3. **Task 03-08-03: Complete rendered matrix and final release gates** — `71c02f2` (release evidence and validation status)

Additional blocking correctness fix: `f4c0311` aligns worker cleanup with the Phase 3 footage schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Truthful review] Added the selected CTA to the final campaign review.**
- **Found during:** Task 03-08-01.
- **Issue:** CTA survived in the draft but was not visible in the exact user-facing review, violating the review contract.
- **Fix:** Added a direction-safe CTA row to the Campaign review group.
- **Files modified:** `apps/web/src/features/create/CampaignReviewStep.tsx`.
- **Verification:** Focused creator smoke and web typecheck passed.
- **Commit:** `e18e54a`.

**2. [Rule 3 - Blocking typecheck] Added `footage` to the worker abandoned-claim cleanup kind.**
- **Found during:** Task 03-08-03 release gate.
- **Issue:** The data/API schema accepted footage while worker cleanup rejected it structurally, blocking workspace typecheck and leaving abandoned footage without the intended cleanup contract.
- **Fix:** Extended the worker union and reran worker tests/typecheck plus the full release gate.
- **Files modified:** `apps/worker/src/abandoned-claim-cleanup.ts`.
- **Verification:** Worker cleanup tests, worker typecheck, and full workspace typecheck passed.
- **Commit:** `f4c0311`.

## Known Verification Gaps

- The provisioned UAT cannot yet prove real email delivery, private claim/checksum, callback replay, authoritative quote, or a paused-queue durable run. The generation feature is disabled and Mailpit/worker queue evidence is unavailable.
- The browser matrix at 375, 768, 1024, and 1440 in English/Arabic and light/dark remains unobserved because browser automation is unavailable and the required provisioned creator route cannot reach the true Generate boundary.
- These are release blockers, not simulated or downgraded passes. See [03-UAT-EVIDENCE.md](03-UAT-EVIDENCE.md), [03-BROWSER-EVIDENCE.md](03-BROWSER-EVIDENCE.md), and [03-VALIDATION.md](03-VALIDATION.md).

## Next Phase Readiness

- Code-level creator coverage and the no-provider release gates are ready for formal verification.
- Phase 03 remains halted until a healthy disposable stack provides Mailpit, worker heartbeat, queue pause, generation pricing/capability readiness, and a browser automation path for the required real UAT and rendered matrix.

## Self-Check: PASSED

- Task commits `d31e576`, `e18e54a`, `154485c`, `f4c0311`, and `71c02f2` exist in Git history.
- Golden fixtures, smoke command, UAT harness, evidence redaction script, and both evidence artifacts exist at the recorded paths.
- Evidence redaction passes and no provider call was submitted during this plan.
