# Live worker compatibility and portrait-only template UI

Continue the previously authorized unavailable-GSD fallback. User explicitly approved deploying the required worker/template compatibility changes on 2026-10-01; unrelated uncommitted UI work must not be published.

1. Diagnose newest saved-settings failure. Run `6abe11c99ea5b895425dc35d` rejected referenceRole/personRightsConfirmed before generation, matching the old production contract.
2. Restrict current launch-template UI choices to 9:16, selected for new drafts/template selection. Preserve historical accepted outputs and unrelated Advanced options.
3. Prepare an isolated worktree from deployed commit c82a59d, copy only required worker/shared-template compatibility changes and tests, build and test, then publish a dedicated branch for the Render worker. Do not commit, reset, or deploy unrelated primary-worktree edits.
4. Verify deployed identity/heartbeat and perform one authorized 15-second UGC generation through the website against the unchanged database. Use the approved animated reference, retain saved photos, and verify real output. Report any remaining gates accurately.

## Execution evidence

- Published worker/shared-contract compatibility only in isolated branch `codex/ugc-worker-compatibility`, commit `752076fd3a89b817f9027857d5fd5235dae030dd`. Primary uncommitted work preserved. Render worker `srv-dap961dg1s2s739skva0` now tracks this branch; deploy `dep-dav17mm0tbcc73d508bg` succeeded and worker started at 08:05:21 UTC. No database or credential changes.
- Isolated release validation: 286 tests passed, 13 skipped; affected package/worker builds and focused lint passed. Local web validation: 276 passed, 11 skipped, typecheck/build/focused lint passed. Launch-template UI now offers only selected 9:16, while Advanced and historical accepted outputs remain unchanged. This frontend change is local, not published with the worker release.
- Website test: user uploaded product and animated-character photos and confirmed rights. Verified both selected references, 15 seconds, 9:16, and submitted Generate once. New project `6abe147d9ea5b895425dc35f`, version `6abe14879ea5b895425dc364`, run `6abe148a9ea5b895425dc366`.
- Run passed configuration validation but failed at provider submission at 08:06:38 UTC: Vercel requires a minimum gateway balance of $10 and the current balance is insufficient. Error `provider_operation_failed`; no provider request ID, one failed attempt, chargedCredits 0, refundStatus not_required. No additional retry submitted and no video produced. This is a new account-funding blocker, not the prior reference-role schema failure.
- Browser rendered terminal failure; screenshot `/tmp/movprompt-ugc-website-final.png`. The website still displays the generic service failure copy rather than the private gateway-balance detail. Completion/playback/media-quality acceptance remains blocked until the user tops up Vercel. No top-up performed.
- Responsive DOM checks covered English/Arabic and light/dark at four requested sizes, but full-page screenshot sizing/stitching was ambiguous; do not treat those captures as comprehensive visual accessibility acceptance.
