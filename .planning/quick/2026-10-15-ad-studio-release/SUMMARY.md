# Ad Studio release checks

2026-10-15 — release authorized by the user.

## Scope

Ad Studio navigation/catalog split plus the previously approved, not-yet-committed Product With Model Ad dependencies (custom form, brand snapshot, reference validation, v2 prompts/music, deterministic finishing and approved preview). Existing template recipes and form markup are preserved. The shared CreateScreen change only exports its existing prop type.

Excluded: generated outputs, local demonstration HTML/component, graph query cache, unrelated proposal/research files and unrelated progress notes. No credentials, environment changes or paid generation.

## Preflight

- Existing main/remote/Render baseline: `e93710b28ac2a0fc865641b787048307ff999d95`.
- Workspace tests: 917 passed, 52 skipped. Explicit FFmpeg follow-up: 21 passed, including nine opt-in cases skipped by the default run. Remaining skips require an isolated Mongo replica set or are existing UI skips.
- All nine workspace typechecks/builds passed; lint zero errors and 20 existing warnings.
- Staged diff whitespace and credential-pattern checks passed.
- Public live API baseline: 14 published templates, recorded IDs/versions/content hashes for post-release comparison.
- Actual Render services (not the old blueprint names): API `srv-damjap142hec739bbqt0`, worker `srv-dap961dg1s2s739skva0`, website `srv-damkknad0e5s73fqd4og`. All track main and have auto-deployed prior commits.

Push/deployment and live verification results will be recorded separately after observing them; this preflight is not a deployment-success claim.
