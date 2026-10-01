# Recipe alignment and generation error placement

User requested this follow-up fix on 2026-10-01, continuing the previously approved unavailable-GSD fallback.

Plan:

1. Separate generation/quote errors from source-import errors and render an accessible error directly below Generate.
2. Reject mismatched browser/catalog recipe versions before saving or quoting, with accurate recovery copy; keep existing assets and facts.
3. Align the local testing model/profile with Seedance 2.5, rebuild server workspace artifacts and verify catalog publication in isolated tests.
4. Inspect the configured runtime read-only before any catalog mutation. The local environment points to a remote MongoDB database, so confirm whether it is an authorized test target before publishing there. Do not start a queue worker or paid provider job as part of diagnostics.
5. Run regression checks and record actual runtime verification separately from local test evidence.

## Completed — 2026-10-01

### Cause and fixes

- The browser compiled version-2 duration recipes while the configured Atlas testing catalog still published version 1. The legacy API validator therefore reported an older campaign recipe. This was a catalog/configuration mismatch, not an invalid uploaded photo.
- Source-import and generation errors previously shared one state field. Generation failures and quote errors now render directly below Generate, with an alert role and button description association. Import errors remain beside the import controls. UI/UX accessibility guidance informed this separation.
- Browser resolution checks the published recipe version and all three duration variants before saving/quoting. The API reports a retryable `template_catalog_outdated` error for mismatched catalogs instead of misleading older-campaign instructions.
- An unchanged saved campaign creates a new immutable working version when its template-version link is outdated; historical versions remain untouched. Save idempotency keys include the target template version. Regression tests cover both recovery and no-op saves.
- Local API/worker model settings are Seedance 2.5, with muted output and no Fast substitution. The local pricing profile name now reflects Seedance 2.5; pricing amounts were not changed or certified. Development startup rebuilds shared packages before loading the API and worker so server `dist` exports match browser recipe source.

### Authorized testing-database update

- User explicitly approved the configured remote Atlas testing database: “Yes, update that testing database.”
- Published only the 12 launch template roots and immutable version-2 recipes using `ensureMongoTemplateCatalog` with `prune: false`; 36 duration variants verified.
- Compared hashes of all 12 historical version-1 records before/after: unchanged. Preview object keys still point to their original version-1 examples.
- Live API read at `/api/v1/templates/fashion-product-showcase` returned HTTP 200, version 2, durations 8/15/20, and all three variants.
- No project or accepted-output migrations, worker queue draining, or paid video generations were performed. This is testing-database publication, not production deployment or generated-media acceptance.

### Verification

- Workspace builds and type checks passed.
- Workspace tests: 729 passed; 49 environment-gated tests skipped.
- Lint: 0 errors, 20 existing warnings. `git diff --check` passed.
- New regression coverage: catalog mismatch detection, unchanged saved-project template-link recovery, and English/Arabic quote/generation error placement.
- Browser checks verified feedback immediately after Generate at 375, 768, 1024, and 1440 CSS pixels without DOM horizontal overflow. Inspected English/light mobile and Arabic/dark desktop/tablet rendering. Focused follow-up checks are not a new full accessibility certification.
- Screenshots: `/tmp/movprompt-template-visual-shGCIQ/error-below-generate-mobile.jpg` and `/tmp/movprompt-template-visual-shGCIQ/error-1024-arabic-dark.jpg`.
- Temporary API/web verification servers stopped after checks. Restart the normal development stack with `bun run dev`, then refresh the page to load the aligned runtime and UI.

The Phase 04 human-calibration gate and separately authorized paid generated-media acceptance remain open.
