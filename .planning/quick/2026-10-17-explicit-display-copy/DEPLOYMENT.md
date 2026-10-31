# Deployment acceptance

2026-10-17. The user deferred paid Seedance replacement testing because credits cannot currently be added, then explicitly requested deployment. This supersedes the earlier deployment hold in SUMMARY.md. No paid retry was submitted.

Commit `76320e44d43bc891ace76e54bb0d7dab77c44936` was pushed without force to origin/main from the isolated release checkout. Root checkout staged work was preserved.

| Service | Render deployment | Result |
| --- | --- | --- |
| Website `srv-damkknad0e5s73fqd4og` | `dep-db9japlg1s2s73ag4omg` | Live, exact commit |
| API `srv-damjap142hec739bbqt0` | `dep-db9japdg1s2s73ag4mt0` | Live, exact commit |
| Worker `srv-dap961dg1s2s739skva0` | `dep-db9japlg1s2s73ag4nv0` | Live, exact commit |

## Live checks

- API health, video capabilities, public templates and version endpoints returned HTTP 200 after rollout.
- MongoDB, R2 storage and generation-runtime dependencies report `ok`; `templateReady=true`. Provider account balance is not proven by infrastructure readiness.
- All 16 public template objects compare identically before/after this policy release. Existing visual recipes and public version IDs are unchanged.
- Live Adstudio displays the optional message section, blank fields and no automatic subtitle guidance. Sequential English typing preserves `20% off until Friday`; Arabic input preserves `خصم ٢٥٪ — اليوم فقط!`. Clearing both leaves them blank.
- Live UGC offer/closing fields start blank and are not required. Character and speech controls remain present. Ordinary jewelry closing field is blank/optional and has no speech controls.
- Website/API/worker Render dashboards each show the full release commit as their last successfully deployed commit.

## Evidence and limits

Artifacts: `/Users/Projects/VirtuProse/MoVPrompt_New/output/explicit-display-copy-2026-10-17/deployment/`, including Render status, health/capability/catalog snapshots and `live-adstudio.jpg`.

Prior local regression: 1,176 passed, 12 skipped; typecheck, builds and changed-file lint passed. No environments, secrets or provider balances were changed. The original local video remains preserved and is not claimed corrected. Paid real-media replacement/audio/lip-sync validation remains deferred at the user's request.

This post-deployment note remains local to avoid a documentation-only redeployment.

## Adstudio message-field styling follow-up

Commit `8662accefa4872e33d73c5639f5902792d4a13ad` fixes only the offer/closing field UI and records its GSD context. All three automatic deployments are Live on that exact commit: website `dep-db9jeorm8hqs73ai5srg`, API `dep-db9jeorm8hqs73ai5r3g`, worker `dep-db9jeorm8hqs73ai5s5g`.

Live DOM inspection confirms that both message controls match the existing form's radius, padding, type size and background. Their values remain blank and optional. Optional badges, descriptions and counters are displayed. Web typecheck/build/file lint pass. No tests or paid generations were added/run for this styling request. Screenshot and deployment evidence: `/Users/Projects/VirtuProse/MoVPrompt_New/output/adstudio-message-ui-2026-10-17/`.
