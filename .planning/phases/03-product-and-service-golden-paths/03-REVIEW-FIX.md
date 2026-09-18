---
phase: 03-product-and-service-golden-paths
fixed_at: 2026-08-21T01:57:00+03:00
review_path: .planning/phases/03-product-and-service-golden-paths/03-REVIEW.md
iteration: 3
findings_in_scope: 17
fixed: 17
skipped: 0
status: all_fixed
verification_location: main checkout
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-08-21T01:57:00+03:00
**Source review:** [03-REVIEW.md](03-REVIEW.md)  
**Iteration:** 3
**Verification location:** Main checkout (`codex/production-rebuild`)

## Summary

- Findings in scope: 17
- Fixed: 17
- Skipped: 0
- Paid provider calls: none

Iterations 1 and 2 remain fixed. This final review iteration closes the four remaining critical/warning findings below.

## Iteration 3 Fixed Issues

### CR-01: Direct image completion trusted the caller-declared MIME type

**Files modified:** `apps/api/src/asset-content-verifier.ts`, `apps/api/src/asset-routes.ts`, `apps/api/src/asset-repository.ts`, `apps/api/src/app.ts`, and `apps/api/src/assets.test.ts`.

**Commit:** `18f2a9e`

**Applied fix:** Signed-upload completion now re-reads the private object with a bounded size limit and verifies the actual JPEG, PNG, or WebP bytes: format magic, decodable structural dimensions, checksum, and image bounds. Arbitrary bytes labelled `image/png` now fail with HTTP 422 before a guest asset can be marked verified. Validated image dimensions are persisted for direct uploads.

### CR-02: Protected clinic, practitioner, and transformation inputs could be satisfied by unverified data

**Files modified:** `apps/api/src/generation-service.ts` and `apps/api/src/generation-service.test.ts`.

**Commit:** `4ec5417`

**Applied fix:** Templates requiring any clinic identity, service/claim, practitioner qualification, or real-transformation consent input now fail closed at quote and render start. The service deliberately does not treat a generic name, URL, string, or image as verified; protected templates remain unavailable until immutable, authoritative verification and consent records exist.

### CR-03: Footage migration would reject readable legacy WebM asset and claim rows

**Files modified:** `packages/db/migrations/0019_tighten_footage_verification.sql` and `packages/db/test/footage-migration.postgres.test.ts`.

**Commit:** `671fbd8`

**Applied fix:** The new MP4/MOV constraints are installed `NOT VALID`: PostgreSQL enforces them for new/updated rows while preserving existing, readable WebM assets and guest claims for explicit reconciliation. A disposable PostgreSQL 17 proof creates legacy rows, applies the migration, proves legacy rows survive, rejects new WebM, accepts MP4, and drops the temporary database.

### WR-01: Image references accepted MIME-less or non-image upload records

**Files modified:** `apps/web/src/features/create/templates.ts`, `projectStore.ts`, `CreateStudio.tsx`, and focused web fixtures/tests.

**Commits:** `5163ece`, `baf9de2`

**Applied fix:** Preflight, legacy mapping, portable project mapping, and Advanced handoff now accept only explicit `image/jpeg`, `image/png`, or `image/webp` references. MIME-less rows fail closed; the sample product and shared test fixtures declare their media type explicitly.

## Iteration 2 Fixed Issues

### CR-01: Footage completion trusted upload metadata instead of verified media bytes

**Files modified:** `apps/api/src/footage-verifier.ts`, `apps/api/src/asset-routes.ts`, `apps/api/src/asset-repository.ts`, asset/claim contracts and schema migration `0019_tighten_footage_verification.sql`, plus focused tests.

**Commit:** `e263c95`

**Applied fix:** Direct signed uploads and proxy uploads now use one bounded server-side verifier. It re-reads the private object where required, validates the stored checksum and ISO base-media signature, runs FFprobe against a temporary bounded file, permits only MP4/MOV plus supported video codecs, and persists the probe-derived duration only when it is at most ten minutes. Missing verifier tooling fails closed. Faked MP4 headers, spoofed checksums, unavailable FFprobe, and overlong media are covered by tests.

### CR-02: Beginner capability was browser-hardcoded rather than derived from template policy

**Files modified:** `apps/api/src/generation-service.ts`, `packages/contracts/src/generation.ts`, `apps/web/src/features/create/useTemplateQuotes.ts`, `CreateStudio.tsx`, review/template helpers, and focused API tests.

**Commits:** `6dcb8a5`, `5082bf3`

**Applied fix:** Beginner template quotes now resolve their semantic video capability from the immutable published template policy. Manual/service templates select `video.cinematic` only when that policy permits it; image-required templates select product fidelity and remain blocked without an image. Authenticated project-version quotes apply the same server policy. The browser no longer sends a hardcoded template capability or any provider/model identifier.

### CR-03: Withdrawn uploaded-spokesperson consent left a selected presenter in saved state

**Files modified:** `apps/web/src/features/create/PresenterChoice.tsx` and `PresenterStep.test.tsx`.

**Commit:** `bdeba36`

**Applied fix:** Removing the acknowledgement immediately emits and persists `{ mode: "none" }`, returns the control to No presenter, and removes the consent UI. The reload path is covered by a controlled re-render test.

### WR-01: A stale generation quote could remain usable while template lookup was pending

**Files modified:** `apps/web/src/features/create/useTemplateQuotes.ts`, `templateQuoteState.ts`, and focused tests.

**Commit:** `5082bf3`

**Applied fix:** The shared quote is synchronously set to loading and cleared before the asynchronous template-version lookup begins. Review and Generate therefore fail closed immediately after price, duration, or ratio changes.

### WR-02: Advanced handoff placed MOV footage in image-reference inputs

**Files modified:** `apps/web/src/features/create/projectStore.ts`, `CreateStudio.tsx`, and focused tests.

**Commit:** `98e9972`

**Applied fix:** The Advanced handoff now passes only still-image references. Footage is deliberately omitted until Advanced has a dedicated supported footage field; the mixed image-and-MOV test proves that only the image survives the handoff.

## Iteration 1 Findings Still Fixed

- CR-01: accepted footage claim persistence and presenter eligibility
- CR-02: fact-only manual service campaigns where the template permits them
- CR-03: booking URL distinct from WhatsApp eligibility
- WR-01: campaign setup quote refresh state
- WR-02: verified uploaded-spokesperson availability
- WR-03: durable source keys after guest claim
- WR-04: published catalog availability before template selection
- WR-05: keyboard-operable source radio groups

## Verification Evidence

Focused verification in the main checkout:

- API: 17 asset-route tests passed, including an arbitrary-byte `image/png` completion rejection; 30 generation-service tests passed, including quote/start protected-input rejections.
- Web: 22 tests passed across strict image-reference preflight, legacy mapping, and Advanced/portable handoff coverage.
- PostgreSQL 17: 1 disposable migration proof passed against `postgresql://127.0.0.1:55432/postgres`; it created and dropped an isolated database containing legacy WebM asset and guest-claim rows.
- No paid provider calls were made.

Required broader verification:

- Web, API, worker, and contracts typechecks passed.
- `apps/web` suite: 52 files, 194 tests passed.
- `apps/api` suite: 17 files, 111 tests passed; 3 files / 13 tests skipped by their PostgreSQL environment guards.
- `apps/worker` suite: 15 files, 67 tests passed; 2 files / 9 tests skipped by their PostgreSQL environment guards.
- `packages/contracts` suite: 2 files, 12 tests passed.
- Creator smoke: 3 files, 12 tests passed.
- Full workspace typecheck and production builds passed. Vite emitted existing large-chunk advisory warnings only.
- Web bundle guard passed: 247,848 gzip bytes against a 307,200-byte limit.

Verification ran in the main checkout (`codex/production-rebuild`), including the explicitly provisioned disposable PostgreSQL 17 migration test. No existing database or user data was touched.

## Remaining Blockers

No critical or warning finding in the three cumulative Phase 03 reviews remains open. Browser UAT and full release evidence remain separate phase-verification work. No provider calls or paid generations were made.

---

_Fixed: 2026-08-21T01:57:00+03:00_
_Fixer: the agent (gsd-code-fixer)_  
_Iteration: 3_
