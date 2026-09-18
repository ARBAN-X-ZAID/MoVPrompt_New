---
phase: 02-guest-authentication-and-data-integrity
verified: 2026-08-19T22:55:35Z
status: human_needed
score: 3/4 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Email, configured social sign-in, cancelled auth, duplicate callback, and password reset journeys preserve or recover the correct campaign without duplication."
    test: "Complete email, Google, and Apple Generate-time authentication with one real guest campaign; cancel once, replay one callback, and complete password reset."
    expected: "Every return restores the exact pending campaign, cancellation changes nothing, and callback replay creates no duplicate claim, project, run, or charge."
    why_human: "Deterministic stubs and unit/integration tests cover the transitions, but configured external identity-provider and delivered-email journeys were not exercised in this verification."
human_verification:
  - test: "Complete the Generate-time email, Google, and Apple journeys with a real guest campaign, including one cancellation and one callback replay."
    expected: "The exact campaign returns, cancellation changes nothing, and the replay creates no duplicate cloud records."
    why_human: "Google and Apple are intentionally hidden until configured, and no external OAuth or delivered-email action was authorized during this run."
  - test: "Claim two real local images, cancel during image 1 or 2, then retry one deliberately failed image and refresh an expired signed preview URL."
    expected: "The local draft remains unchanged after cancel/failure, retry targets only the failed image, and the private preview refreshes from its stable object key."
    why_human: "The browser claim surface and object-storage lifecycle require a signed-in interactive transition; focused tests cover the invariant but not the complete rendered journey."
  - test: "Inspect the real claim state at 375, 768, 1024, and 1440 in English and Arabic, light and dark, using keyboard and a screen reader."
    expected: "Stages announce once, cancel remains usable, focus returns to Generate, and no layout or RTL overflow occurs."
    why_human: "The source/review matrix and Retry-price focus are browser-verified, but the authenticated claim state itself was not available across the full matrix."
---

# Phase 2: Guest, Authentication, and Data Integrity — Verification Report

**Phase Goal:** Let a guest configure freely, authenticate at Generate, and recover the exact campaign and owned assets safely.  
**Verified:** 2026-08-19T22:55:35Z  
**Status:** HUMAN VERIFICATION REQUIRED  
**Re-verification:** No — initial goal-backward verification after code-review fixes.

## Goal Achievement

### Observable Truths

| # | Roadmap truth | Status | Evidence |
|---|---|---|---|
| 1 | Email, configured social sign-in, cancelled auth, duplicate callback, and password reset preserve or recover the correct campaign without duplication. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Safe return paths, server-controlled provider availability, deterministic Google/Apple stubs, exact draft recovery, replay-safe claims, and truthful email failures are implemented and tested. Real configured OAuth and delivered-email journeys were not exercised. |
| 2 | Guest media remains local until claim; authenticated media is private, owner-scoped, checksum-verified, and reusable after URL expiry. | ✓ VERIFIED | `guestDraftStore` retains seven-day blobs; `claimGuestAssets` performs checkpointed private upload; asset routes validate type, size, checksum and ownership before storage/signing; the source persistence receipt prevents premature cleanup. Focused claim-stage behavior passed. |
| 3 | Another user cannot read, claim, reference, download, or mutate the campaign, asset, run, or output through HTTP or PostgreSQL. | ✓ VERIFIED | Owner predicates, `withUserTransaction`, forced RLS, composite ownership keys, restricted-role checks, cross-owner HTTP tests, and the Phase 2 PostgreSQL probe all pass. |
| 4 | Source/import/upload failure keeps the exact local draft and gives a clear safe recovery action. | ✓ VERIFIED | Recovery tests preserve the exact link draft and checkpoint through mirror failure, target the failed local asset, treat abort separately, and clear local data only after verified persistence. Browser review retains editing and exposes Retry price. |

**Score:** 3/4 truths verified; 1 present and wired but awaiting real external behavior evidence.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/contracts/src/guest-claims.ts` | Stable guest-claim snapshot, checkpoint, asset, and receipt contracts | ✓ VERIFIED | Substantive Zod boundary exported through contracts and consumed by web/API. |
| `apps/api/src/guest-claim-service.ts` | Replay-safe owner-scoped claim orchestration | ✓ VERIFIED | Digest/idempotency checks, exact owner binding, resumable assets, and finalize guards are wired to API routes. |
| `apps/api/src/guest-claim-repository.ts` | PostgreSQL claim lifecycle and cleanup leases | ✓ VERIFIED | Uses owner-scoped transactions, immutable receipt fields, exclusive cleanup leases, and finalized-claim immunity. |
| `apps/web/src/features/create/guestDraftStore.ts` | Seven-day exact JSON/blob persistence | ✓ VERIFIED | Tests prove full-field restoration and simultaneous JSON/blob expiry without renewing TTL. |
| `apps/web/src/features/create/creatorAssets.ts` | Abortable private asset claim and preview refresh | ✓ VERIFIED | One signal flows through reservation/upload/verification/finalize; failed asset identity and owned preview refresh remain exact. |
| `apps/api/src/source-scanner.ts` and `remote-image-fetcher.ts` | SSRF-safe, bounded public scanning and mirroring | ✓ VERIFIED | Public-IP pinning, redirect/DNS revalidation, MIME/magic/byte/time limits, and PostgreSQL rate limits are wired. |
| `apps/web/src/features/create/GuestClaimProgress.tsx` | Honest claim status and safe cancellation | ✓ VERIFIED | One polite live region, factual stages, no fake percentage/provider timing, and a native cancel action. |
| `packages/db/migrations/0015_guest_claim_operations.sql` and `0016_request_rate_limits.sql` | Durable claim and abuse-control schema | ✓ VERIFIED | Disposable PostgreSQL 17 migration/RLS probe passed and reran migrations idempotently. |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `CreateStudio.tsx` | `guestDraftStore.ts` | Save before auth and recover by stable draft/pending intent | ✓ WIRED | Exact campaign configuration and rights state survive auth cancellation/return. |
| `CreateStudio.tsx` | `creatorAssets.ts` | `claimGuestAssets({ snapshot, blobs, signal, onProgress })` | ✓ WIRED | Controller identity guards UI updates; abort and stage callbacks reach the rendered claim surface. |
| `creatorAssets.ts` | `/api/v1/drafts/claim` and private asset routes | Idempotency key, checkpoint resume, checksum-verified upload | ✓ WIRED | Browser never treats signed URLs as authority and does not delete blobs before verified receipt/persistence. |
| Auth callback | Guest claim service | Safe same-origin return plus stable pending generation ID | ✓ WIRED | Deterministic provider tests prove cancellation/hostile return rejection and replay-safe claim semantics. |
| Source scanner/mirror routes | PostgreSQL limiter and pinned fetchers | Server-side quota before outbound transport | ✓ WIRED | Private/metadata addresses and unsafe redirects are rejected; mirror ownership is checked before fetch. |
| API repositories | PostgreSQL RLS | `withUserTransaction` and owner composite keys | ✓ WIRED | Restricted-role database probe and cross-owner HTTP tests pass. |

## Data-Flow Trace

| Data | Source | Destination | Status |
|---|---|---|---|
| Guest campaign JSON and blobs | IndexedDB seven-day draft | Auth handoff and claim snapshot | ✓ FLOWING |
| Pending generation intent | Stable browser UUID | Claim idempotency and callback recovery | ✓ FLOWING |
| Claimed image identity | Local asset ID + SHA-256 manifest | Owner/project private object key and immutable version | ✓ FLOWING |
| Refreshed preview | Stable DB bucket/object key | Short-lived signed GET response | ✓ FLOWING |
| Recovery state | Server checkpoint/error classification | Retry, Replace image, or retained-draft notice | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Auth cancellation/offline/mismatch retains local facts | `bun run --cwd apps/web test -- src/features/create/GuestAuthRecovery.test.tsx -t "keeps local draft facts attached"` | 1 passed | ✓ PASS |
| Claim progress follows real checkpoint order and one signal | `bun run --cwd apps/web test -- src/features/create/creatorAssets.test.ts -t "reports factual private-claim stages"` | 1 passed | ✓ PASS |
| Cross-owner asset lookup reveals nothing | `bun run --cwd apps/api test -- src/assets.test.ts -t "does not reveal a project owned by another account"` | 1 passed | ✓ PASS |
| Link/mirror failure preserves draft until retry persistence | `bun run --cwd apps/web test -- src/features/create/guestClaimRecovery.test.ts -t "keeps a guest link draft"` | 1 passed | ✓ PASS |
| Auth email delivery failure is truthful and retryable | `bun run --cwd packages/auth test -- test/auth-email.test.ts -t "returns a retryable"` | 1 passed | ✓ PASS |

## Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| Phase 2 migrations, schema invariants, and RLS | `MOVPROMPT_PHASE2_ADMIN_DATABASE_URL=postgresql://127.0.0.1:55432/postgres bash scripts/infra/validate-phase2-migrations.sh` | Fresh PostgreSQL 17 database migrated twice; portable DB and RLS checks passed; disposable database removed | ✓ PASS |

## Integrated Workspace Gate

The final merged Phase 2 tree passed `bun install --frozen-lockfile`, repository lint with 0 errors (20 existing Fast Refresh warnings), every workspace typecheck, every workspace test, every workspace build, and the web bundle gate.

- Web: 40 files / 144 tests passed.
- API: 80 passed / 12 environment-gated PostgreSQL tests skipped in the generic run.
- Worker: 67 passed / 9 environment-gated tests skipped.
- DB: 6 passed / 12 environment-gated tests skipped.
- Auth: 8 passed / 3 environment-gated tests skipped.
- Contracts 8, storage 6, providers 20, and creative engine 16 tests passed.
- Web initial bundle: 246,965 gzip bytes against a 307,200-byte limit.
- PostgreSQL-gated Phase 2 behavior is covered separately by the successful disposable PostgreSQL 17 probe above.

## Requirements Coverage

| Requirement | Status | Evidence |
|---|---|---|
| AUTH-01 | ✓ SATISFIED | Public creator supports complete guest draft before account creation. |
| AUTH-02 | ✓ SATISFIED | Generate opens the contextual email-first auth gate; auth is not required to configure. |
| AUTH-03 | ? NEEDS HUMAN | Provider controls fail closed and deterministic callbacks preserve the campaign, but real configured Google/Apple returns were not run. |
| AUTH-04 | ✓ SATISFIED | First-campaign verification policy is server-controlled and deferred; UI copy explains later verification. |
| AUTH-05 | ? NEEDS HUMAN | Reset route and truthful delivery boundary are implemented/tested; real delivered reset email was not run. |
| AUTH-06 | ✓ SATISFIED | Cancellation retains the unchanged draft and returns focus to Generate. |
| AUTH-07 | ✓ SATISFIED | Exact template, facts, language, campaign, rights, media manifest, and pending intent are snapshot-bound. |
| AUTH-08 | ✓ SATISFIED | Callback/claim replay and digest conflict handling are idempotent; no duplicate claim/project/version is created. |
| AUTH-09 | ✓ SATISFIED | Seven-day JSON/blob expiry and wrong-account claim rejection are tested. |
| AUTH-10 | ✓ SATISFIED | Authenticated source of truth is PostgreSQL/private storage; browser state is recovery cache only. |
| SOURCE-04 | ✓ SATISFIED | SSRF, redirect/DNS, media, size, timeout, and request-rate boundaries are implemented/tested. |
| SOURCE-05 | ✓ SATISFIED | Authenticated mirroring validates owner, MIME, bytes, checksum, and private object persistence. |
| SOURCE-06 | ✓ SATISFIED | Import/claim failure preserves local draft and exposes explicit recovery actions. |
| SOURCE-07 | ✓ SATISFIED | Source replacement creates a new version and invalidates stale output. |
| PROJ-06 | ✓ SATISFIED | Cross-user HTTP, storage, claim, and PostgreSQL isolation tests pass. |

No Phase 2 requirement is orphaned from the eight plans.

## Anti-Patterns Found

No untracked `TBD`, `FIXME`, or `XXX` debt marker was found in the Phase 2 implementation surface. No fake claim percentage, provider/model disclosure, signed-URL persistence, empty success handler, or silent error-to-success conversion was found.

One non-blocking cleanup note remains: a duplicated unreachable `return` follows the rights-validation branch in `CreateStudio.tsx`. It does not change runtime behavior and is not a phase-goal gap.

## Human Verification Required

### 1. Real authentication providers and email delivery

Complete email, Google, and Apple Generate-time authentication, cancel once, replay one callback, and use password reset.

**Expected:** Exact draft recovery, no duplicate cloud records, safe cancellation, and a delivered reset link returning only to an approved MovPrompt route.

### 2. Real private-asset claim and recovery

Claim two local images, cancel during the first attempt, retry one deliberately failed image, then let a signed preview expire and refresh.

**Expected:** No local data loss, no duplicate objects, retry targets only the failed image, and the preview refreshes from its stable private key.

### 3. Claim-state accessibility matrix

Inspect that real claim transition across 375, 768, 1024, and 1440 in English/Arabic and light/dark with keyboard and screen reader.

**Expected:** One factual announcement at a time, usable Cancel, focus restoration, correct RTL, and no overflow.

## Gaps Summary

No implementation blocker was found. All eight plans are executed, code review is clean, the security audit reports 40/40 planned threats closed, targeted behavior tests pass, and the guarded PostgreSQL 17 probe passes. Phase 2 must remain open because its external OAuth/email and real browser private-claim evidence has not been observed; automated evidence cannot honestly replace those checks.

---

_Verified: 2026-08-19T22:55:35Z_  
_Verifier: Codex (gsd-verifier inline execution)_
