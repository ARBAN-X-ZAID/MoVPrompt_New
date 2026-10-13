# Jewelry release — 2026-10-13

User authorized commit, push and deployment of the jewelry template and revised moving eight-second preview.

## Release verification

- Full workspace suite: 802 passed, 49 existing gated tests skipped. The initial parallel attempt hit resource-related timeouts; sequential workspace execution with one test worker and 30-second timeouts passed, without changing test assertions or application code.
- All workspace type checks and production builds passed. Lint: zero errors, 20 existing Fast Refresh warnings. Staged diff whitespace checks passed; no environment files, provider diagnostics or signed URLs are staged. Removed historical account balance values from media metadata before publication.
- Prior scoped media/browser validation remains recorded in the motion summary: 8 seconds, silent, 720×1280, opening unchanged, moving closing frames; real R2/API checksum match; 16 fixture-browser cases passed.
- Render worker is already connected to `main`, last live revision `367b795`; older local documentation about its compatibility branch is stale. Existing service configuration is being preserved.
- Baseline live API is healthy and generation-ready, with 12 templates and no jewelry entry. Deployment must publish the new immutable catalog entry and expose its v3 preview route.
- Existing GitHub secret-scan job fails because its Gitleaks licence is absent. No security controls were changed or disabled.

## Status

Release checks passed. Commit/push and Render/live acceptance verification follow; do not infer live publication from this pre-deployment record.
