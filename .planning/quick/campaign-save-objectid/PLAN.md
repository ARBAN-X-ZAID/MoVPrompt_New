# Campaign save: local image identity and MongoDB ObjectId mapping

Approved local bug fix, 2026-09-15. Direct execution uses the user's earlier explicit approval to bypass the unavailable GSD commands. No commit, push, deployment or additional paid generation.

1. Reproduce the failure with a browser UUID and the native ObjectId returned by MongoDB.
2. Keep the browser ID for blob and manifest correlation; use the native ID for API requests and persisted project image references. Preserve identity, ownership and checksum validation.
3. Give edited unfinished drafts a new immutable save intent. Preserve the superseded attempt and its assets, retain one project and reject stale requests. Completed claims cannot be replaced.
4. Verify unchanged retries, changed images, concurrent retries/finalization, native MongoDB records, and an actual API image upload/checksum/save/private retrieval against R2.
5. Run API/web tests, type checks and build checks. Inspect the user's current draft without clicking Generate. Keep the local dev stack available for the user's test.
