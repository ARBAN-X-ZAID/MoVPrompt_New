---
status: resolved
trigger: "Phase 03 security audit found that campaign settings are bounded in the browser but claim/version and generation schemas accept unrestricted JSON."
created: 2026-08-21
updated: 2026-08-21
---

# Phase 3 Campaign Contract

## Symptoms

- **Expected behavior:** Price, offer, CTA, booking URL, WhatsApp, language, Kuwait market, brand fields, and hidden campaign values are validated by one bounded shared contract when written and when read for generation.
- **Actual behavior:** Claim/version `configuration`, `productRecipe`, and `campaignRecipe` accept unrestricted JSON, while the generation configuration has an unbounded catchall.
- **Error:** Security threat T-03-07 remains open; browser-only validation can be bypassed by direct API callers or malicious persisted configuration.
- **Timeline:** Found by the Phase 03 threat audit after the final clean code review on 2026-08-21.
- **Reproduction:** Submit oversized, malformed, unsupported-market, or hidden campaign fields directly to claim/version/generation boundaries and observe schema acceptance.

## Current Focus

- hypothesis: Campaign domain validation was implemented in web-only rules while portable public contracts retained generic JSON for migration compatibility.
- test: Add adversarial contract/API tests for malformed and oversized campaign settings at claim/version write and generation read boundaries.
- expecting: A shared bounded campaign schema rejects invalid settings consistently before persistence, quote, reservation, or provider work while preserving valid Kuwait Arabic/English/bilingual paths.
- next_action: resolved — strict guest campaign parsing is enforced at route, service, repository, version, quote, and render boundaries
- reasoning_checkpoint: Preserve the existing generic project envelope only where legacy compatibility demands it; security-critical campaign fields must be parsed and normalized server-side without silently dropping unknown values.
- tdd_checkpoint: pending

## Evidence

- timestamp: 2026-08-21T02:40:00+03:00
  observation: GSD security auditor closed 16 of 17 threats and identified T-03-07 as the only blocking high-severity threat.
- timestamp: 2026-08-21T03:55:00+03:00
  observation: The shared strict `CampaignSettingsSchema` and persisted Template Mode payload contract reject unsupported markets, malformed KWD, invalid CTA/booking/WhatsApp/brand values, and hidden keys at claim, version, source replacement, guest claim, quote, and start boundaries.
- timestamp: 2026-08-21T04:10:00+03:00
  observation: Focused contracts, API, generation, browser creator tests, full typechecks/builds, creator smoke tests, and a disposable PostgreSQL 17 migration/API proof passed with no provider calls.
- timestamp: 2026-08-21T04:25:00+03:00
  observation: Re-audit found the initial fix still allowed a narrow bypass: Template Mode writes could omit their immutable template version, and a persisted row or direct estimate could fall back to the generic generation configuration instead of requiring the complete Template Mode campaign payload.
- timestamp: 2026-08-21T05:10:00+03:00
  observation: The second remediation rejects Template Mode without a UUID template version at contract, repository, and PostgreSQL boundaries. Persisted Template Mode quote/start now parses the full payload before template, quote, reference, reservation, or provider work; direct Template estimates use the identical strict payload and reject hidden outer fields.
- timestamp: 2026-08-21T05:15:00+03:00
  observation: Focused and full tests, workspace typechecks/build, creator smoke, lint (warnings only), and disposable PostgreSQL 17 migration/API/worker proofs passed. No paid or provider calls were made.
- timestamp: 2026-08-21T05:25:00+03:00
  observation: Re-audit found the final direct/internal path: routes parsed guest snapshots, but `GuestClaimService.startClaim` and `GuestClaimRepository.start` trusted their typed inputs before persisting a project and claim operation.
- timestamp: 2026-08-21T05:53:00+03:00
  observation: `GuestClaimService` now safe-parses the complete strict snapshot before presenter eligibility or any repository call. `GuestClaimRepository` repeats the parse before its transaction and when finalizing a persisted operation, so direct callers and malformed historic Template snapshots fail before persistence or version creation.
- timestamp: 2026-08-21T05:54:00+03:00
  observation: Adversarial unit and disposable PostgreSQL 17 tests reject missing template identity, hidden campaign values, and oversized offer data through direct service and repository calls. Project, claim-operation, quote, reservation, and render counts remain unchanged. Full workspace tests, typechecks, builds, creator smoke, and PG17 migration/RLS validation passed; no provider calls occurred.

## Eliminated

## Resolution

- root_cause: Refined twice: after strict Template writes and generation reads were added, direct internal guest-claim callers still trusted TypeScript types and could create a project and claim checkpoint before any strict Template snapshot parse.
- fix: GuestClaimService now parses every snapshot before eligibility or repository work; GuestClaimRepository repeats the strict parse before transaction/persistence and when turning a saved operation into a version. Invalid campaign errors have a stable API response, while valid claim replay remains idempotent.
- verification: Focused service, API and PG tests pass; adversarial PostgreSQL assertions prove malformed Template snapshots leave project/claim/quote/reservation/render counts unchanged. Full workspaces test/typecheck/build, creator smoke, lint (pre-existing warnings only), full database/API/worker PostgreSQL 17 suites, and Phase 2 disposable migration/RLS proof pass.
- files_changed: fb42f6b and fa2c60f contain the first two remediations; 8c3e449 contains the final service/repository guest-claim enforcement and adversarial tests.

## Prevention

- Why not caught: HTTP route validation was incorrectly treated as the sole untrusted-input boundary, despite reusable service and repository entry points accepting structurally typed snapshots.
- Guard: Full bounded `GuestClaimSnapshotSchema` parsing is now required by both service and repository write boundaries, with direct-call unit/PostgreSQL adversarial tests that assert no persistence or downstream generation work.
