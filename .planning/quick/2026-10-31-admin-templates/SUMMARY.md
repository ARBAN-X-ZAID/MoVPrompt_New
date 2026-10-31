# Admin templates — local implementation

- Removed the standalone `ad-studio-brand-ad` slug from the admin list query and its count. No template records, recipes, or campaigns were deleted.
- Replaced the generic detail heading with a top-left back link, template name and description. Added a restrained responsive preview/settings layout using the UI/UX skill's hierarchy, navigation and labelled-form guidance.
- Added English and Arabic name editing with validation, cancel, pending/error feedback, retry idempotency, revision checks, and audit logging. Names are display overrides on the catalog head; public list/detail reads use them while historical recipe versions remain unchanged.
- Work is isolated in the `admin-template-ui` worktree based on `76440ba`; other checkouts' existing edits were not modified.

## Verification

- Focused web tests: 12 passed.
- Focused API tests: 6 passed, 1 opt-in MongoDB test skipped.
- All workspace type checks and builds passed.
- Lint: no errors, 20 existing Fast Refresh warnings.
- Rendered browser checks: 375, 768, 1024 and 1440px, English/light and Arabic/dark; no horizontal overflow. Inspected screenshots; save-name flow updates the displayed heading.
- Browser API responses and preview image were synthetic fixtures. No live database acceptance, deployment, or paid generation was performed.
