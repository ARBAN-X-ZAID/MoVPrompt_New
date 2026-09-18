# Phase 3 Provisioned UAT Evidence

**Observed:** 2026-08-21

## Status

**PASS — Phase 03 provisioned UAT completed on a disposable local stack.**

PostgreSQL 17, private MinIO storage, Mailpit, the Hono API, Better Auth, and a restricted-role worker heartbeat were assembled together. Render dispatch stayed paused by a one-hour outbox poll interval, so the test could prove durable submission without contacting an AI provider.

No provider submission, provider request, provider attempt, or paid cost was made.

## Observed product path

- A real local Kinza product image was uploaded through the private asset API.
- The stored object matched the submitted SHA-256 checksum and byte size.
- Guest claim start, asset checkpoint, finalization, and replay returned one project.
- A stable private object key replaced the browser-local image before immutable version creation.
- The authoritative quote was non-estimate, configuration-bound, and priced at 80 credits for an 8-second 720p product-fidelity campaign.
- Replaying the same render idempotency key returned the same durable run.
- The Projects response exposed the same latest run and `generating` project state.
- Cancelling twice before provider acceptance returned the same cancelled run, restored the starter entitlement, left the credit ledger empty, and left provider-attempt count at zero.

## Observed service path

- A manually confirmed Kuwait booking-service campaign used a real service reference image.
- Private upload, checksum verification, claim finalization, immutable version creation, version replay, quote, and render replay all passed.
- The authoritative quote was non-estimate, configuration-bound, and priced at 120 credits for a 12-second 720p campaign.
- Service facts, bilingual campaign language, CTA, KWD price, delivery settings, and rights remained in the strict persisted payload.
- Cancellation before provider acceptance restored the same starter entitlement exactly once and produced no ledger entry or provider attempt.

## Browser evidence

- A fresh guest uploaded the Kinza image in `/create`, reviewed its exact name, description, brand, and three-decimal KWD price, and reached outcome recommendations without prompts or model choices.
- The browser initially exposed a real mismatch: local uploaded media was not counted for a guest price estimate. The server continued to fail closed.
- The fix now lets declared guest JPEG/PNG/WebP media satisfy estimate-only input disclosure while authenticated quote/start still require the owned private object, checksum, MIME, size, and namespace.
- Product-aware ranking now recommends category-matched templates before unrelated specialist templates, with broad product templates as the safe fallback.
- The corrected live browser returned an 80-credit guest estimate, preserved the exact campaign on final review, opened authentication only after Generate, and retained the campaign after the auth dialog was closed.
- The final browser console contained no errors or warnings.

## Database and isolation evidence

- A fresh migration run uncovered missing restricted-role privileges on the two guest-claim tables.
- Migration `0021_guest_claim_role_privileges.sql` grants only the API permissions needed for owner-scoped claim lifecycle and only the worker permissions needed for abandoned-claim reconciliation; PUBLIC remains revoked.
- The guarded migration script created a fresh disposable PostgreSQL 17 database, applied all migrations twice, checked RLS and role privileges, and dropped the database successfully.

## Regression evidence

- Full workspace tests: 463 passed, 43 environment-guarded skips.
- Web: 52 files, 201 tests passed.
- API: 19 files passed, 124 tests passed; focused generation service: 34 passed.
- Worker: 15 files passed, 67 tests passed.
- Contracts, database, storage, providers, creative engine, and auth suites passed.
- All workspace typechecks and builds passed.
- Creator smoke: 12/12 passed.
- Initial bundle: 247,848 gzip bytes against a 307,200-byte limit.
- Evidence redaction and `git diff --check` passed.

## Scope boundary

This evidence proves Phase 03 through a durable queued render with dispatch paused. It does not claim that a real AI video completed. Provider submission, output recovery, media normalization, quality acceptance, and settlement under provider failure belong to Phase 04.
