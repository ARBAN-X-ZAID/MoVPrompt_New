---
phase: 2
slug: guest-authentication-and-data-integrity
status: evidence_partial
nyquist_compliant: false
created: 2026-08-19
updated: 2026-08-19
---

# Phase 2 — Validation Strategy and Audit

> Phase 2’s automated behavioral checks are green. The phase is not marked Nyquist-compliant yet because the real rendered browser journey through the local API, private storage, email delivery, and configured social providers has not been observed. Those checks remain manual-only rather than inferred from code or unit tests.

## Test Infrastructure

| Property | Verified setup |
|---|---|
| Framework | Vitest 4.1.10; Testing Library/jsdom; Hono API tests; PostgreSQL 17 integration tests; pg-boss worker tests |
| Browser storage | IndexedDB/localStorage test seams in `apps/web` |
| Database evidence | Guarded disposable PostgreSQL 17 database only; migration script rejects non-local/shared targets before `psql` |
| Storage evidence | Private object/key, metadata, checksum, owner-refresh API tests; no real cloud bucket contacted |
| Full commands | `bun run test:all`, `bun run typecheck`, `bun run db:check` |
| Phase-specific commands | Listed in the audit trail below; all commands were executed without paid/provider calls |

## Requirement Coverage

| Requirement | Behavioral evidence | Status |
|---|---|---|
| AUTH-01 | Seven-day local campaign persistence, full Generate-time auth UI, recovery-state tests | ✅ automated green |
| AUTH-02 | Generate-time auth gate, exact bilingual copy, safe return behavior | ✅ automated green |
| AUTH-03 | Server capability visibility plus deterministic Google/Apple callback and replay seams | ✅ automated green; live provider redirect open |
| AUTH-04 | Deferred first-campaign verification policy and quiet workspace reminder | ✅ automated green |
| AUTH-05 | Same-origin password-reset return contract and neutral reset copy | ✅ automated green; real mail delivery open |
| AUTH-06 | Cancel, offline, retry, mismatch and expiry preserve local campaign state | ✅ automated green |
| AUTH-07 | Immutable snapshot/digest, exact configuration comparison, replay-safe recovery | ✅ automated green |
| AUTH-08 | User/intent idempotency, concurrent claim/callback protection, replay receipt reuse | ✅ automated green |
| AUTH-09 | Seven-day expiry, generic cross-account denial, cleanup lease protection | ✅ automated green |
| AUTH-10 | PostgreSQL claim lifecycle, forced owner RLS, private stable-key/checksum receipts | ✅ automated green |
| SOURCE-04 | Atomic rate limits plus shared SSRF/redirect/MIME/byte/timeout policy | ✅ automated green |
| SOURCE-05 | Owner-scoped upload, magic-MIME/head/checksum verification, signed URL refresh denial | ✅ automated green |
| SOURCE-06 | Partial asset/source failure, retry, local-blob retention and recovery states | ✅ automated green |
| SOURCE-07 | Source fingerprint and immutable version invalidation preserve accepted history | ✅ automated green |
| PROJ-06 | API, PostgreSQL/RLS and private-asset cross-user denial matrix | ✅ automated green |

## Per-Task Verification Map

| Task | Plan | Requirements | Behavioral command / artifact | Status |
|---|---:|---|---|---|
| 02-01-01 | 01 | AUTH-07, AUTH-08, AUTH-10 | `apps/api/src/guest-claim-service.postgres.test.ts` against disposable PG17 | ✅ green |
| 02-01-02 | 01 | AUTH-08, AUTH-10 | `bash scripts/infra/validate-phase2-migrations.test.sh`; guarded migration/RLS harness | ✅ green |
| 02-01-03 | 01 | AUTH-07, AUTH-08, AUTH-10 | Claim start/resume/finalize and concurrent replay tests on disposable PG17 | ✅ green |
| 02-02-01 | 02 | AUTH-01, AUTH-02, AUTH-06, AUTH-07 | `guestDraftStore`, `guestClaimSnapshot`, `guestClaimRecovery` tests | ✅ green |
| 02-02-02 | 02 | AUTH-07, AUTH-09 | Seven-day expiry, receipt validation and one-time local cleanup tests | ✅ green |
| 02-03-01 | 03 | AUTH-02, AUTH-03, AUTH-04 | Auth capability/configuration contract tests | ✅ green |
| 02-03-02 | 03 | AUTH-03, AUTH-06, AUTH-07, AUTH-08 | `auth-provider-stubs` deterministic callback/replay tests on disposable PG17 | ✅ green |
| 02-03-03 | 03 | AUTH-02, AUTH-05, AUTH-06 | `authProviders`, `returnPath`, auth/recovery UI tests | ✅ green |
| 02-04-01 | 04 | AUTH-10, SOURCE-05, PROJ-06 | `assets` API plus storage suite | ✅ green |
| 02-04-02 | 04 | AUTH-07, AUTH-09, SOURCE-05, SOURCE-06 | `creatorAssets` and `guestClaimRecovery` resume/retention tests | ✅ green |
| 02-04-03 | 04 | AUTH-07, AUTH-10, SOURCE-05, PROJ-06 | Asset replay/checksum/owner denial tests | ✅ green |
| 02-05-01 | 05 | SOURCE-04 | `request-rate-limiter` unit and disposable PG17 tests | ✅ green |
| 02-05-02 | 05 | SOURCE-04, SOURCE-05 | `source-scanner`, `remote-image-fetcher`, assets tests | ✅ green |
| 02-05-03 | 05 | SOURCE-04 | Runtime quota/configuration fail-closed tests | ✅ green |
| 02-06-01 | 06 | AUTH-10, SOURCE-07 | `source-change-service` and PG17 creator-route tests | ✅ green |
| 02-06-02 | 06 | AUTH-07, SOURCE-06, SOURCE-07 | Project output/recovery browser-state tests | ✅ green |
| 02-06-03 | 06 | AUTH-06, SOURCE-06 | Bilingual source/recovery action tests | ✅ green |
| 02-07-01 | 07 | AUTH-09, AUTH-10, SOURCE-05 | `abandoned-claim-cleanup` worker tests | ✅ green |
| 02-07-02 | 07 | AUTH-10, PROJ-06 | Guarded PG17 migrations and restricted-role RLS script | ✅ green |
| 02-07-03 | 07 | AUTH-08, AUTH-09, AUTH-10, SOURCE-05, PROJ-06 | Two-user API/DB claim, source and ownership matrix | ✅ green |
| 02-08-01 | 08 | AUTH-01, AUTH-02, AUTH-03, AUTH-04 | `AuthGateDialog`, `AuthCopy`, `CreatorShell` UI tests | ✅ green |
| 02-08-02 | 08 | AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, SOURCE-06 | `GuestAuthRecovery`, `returnPath`, bilingual recovery tests | ✅ green |
| 02-08-03 | 08 | AUTH-01..10, SOURCE-04..07, PROJ-06 | [02-BROWSER-EVIDENCE.md](02-BROWSER-EVIDENCE.md), redaction guard, local rendered UI matrix | ⚠️ partial — service-backed browser path open |

## Validation Audit — 2026-08-19

### Commands actually run

```text
# Focused non-PostgreSQL Phase 2 suites
bun run --cwd apps/api test -- guest-claim-service creator-routes auth-provider-stubs request-rate-limiter source-scanner remote-image-fetcher source-change
bun run --cwd apps/api test -- assets
bun run --cwd packages/storage test
bun run --cwd apps/worker test -- abandoned-claim-cleanup
bun run --cwd apps/web test -- guestDraftStore guestClaimRecovery guestClaimSnapshot creatorAssets creatorProjectOutput GuestAuthRecovery AuthGateDialog AuthCopy authProviders returnPath

# Disposable PostgreSQL 17 proof
bash scripts/infra/validate-phase2-migrations.test.sh
MOVPROMPT_PHASE2_ADMIN_DATABASE_URL=postgresql://…@127.0.0.1:55432/postgres bash scripts/infra/validate-phase2-migrations.sh
MOVPROMPT_TEST_DATABASE_URL=postgresql://…/movprompt_phase2_test_nyquist_* bun run --cwd apps/api test -- guest-claim-service.postgres creator-routes.postgres request-rate-limiter.postgres auth-provider-stubs
MOVPROMPT_TEST_DATABASE_URL=postgresql://…/movprompt_phase2_test_nyquist_* bun run --cwd packages/db test -- creator-data-plane.postgres

# Type and evidence checks
bun run --cwd apps/web typecheck
bun run --cwd apps/api typecheck
bun run --cwd apps/worker typecheck
bun run --cwd packages/db typecheck
node scripts/infra/check-phase2-evidence-redaction.mjs
git diff --check
```

### Results

| Metric | Result |
|---|---:|
| Focused API tests | 43 passed; environment-gated cases then rerun on disposable PG17 |
| Focused web tests | 38 passed |
| Focused worker tests | 6 passed |
| Focused storage tests | 6 passed |
| Disposable PostgreSQL 17 API/DB tests | 15 passed; 1 unrelated environment-gated test skipped |
| Guarded PostgreSQL migration and RLS proof | passed |
| Typechecks | web, API, worker and DB passed |
| Evidence redaction / diff check | passed |
| Added validation tests in this audit | none — existing tests were behavioral and executable |

## Manual-Only External Evidence Still Required

These are deliberately not converted to passing claims. They require an operational local or staging stack with private object storage, mail delivery, and configured OAuth credentials:

1. In a real browser, create a two-image guest campaign; choose Generate; authenticate by email; confirm the claimed project/version, media checksums and exact campaign fields match before local draft cleanup.
2. Cancel auth, deliberately fail one asset transfer, retry, go offline, and confirm the original local blobs remain until the canonical claim receipt succeeds.
3. Complete configured Google and Apple redirects, replay the callback in a second tab, and confirm only one project/claim is present.
4. Sign in as a second user in the same browser and confirm the first user’s claimed draft, project and private media remain invisible.
5. Refresh an expired owner download URL; confirm owner recovery works and another user receives a generic denial.
6. Run the full 375/768/1024/1440, English/Arabic, light/dark keyboard, focus-trap, reduced-motion, console and accessibility-tree matrix against the live claim flow.

## Sign-Off

- [x] Every Phase 2 requirement has a focused automated behavioral test and the tests ran green.
- [x] Guarded PostgreSQL 17 migration/reapply/drop and restricted-role RLS proof ran green.
- [x] Two-user claim/project/asset ownership behavior ran on disposable PostgreSQL 17.
- [x] Worker abandoned-claim cleanup behavior ran green.
- [x] Local rendered UI evidence and evidence-redaction check passed.
- [ ] Service-backed browser, real email delivery, real OAuth redirect, and real private-storage evidence is still outstanding.
- [ ] `nyquist_compliant: true` must wait for the manual-only external evidence above.

**Decision:** `evidence_partial` is intentional. Automated integrity coverage is complete; live rendered integration proof is not yet available and must not be represented as complete.
