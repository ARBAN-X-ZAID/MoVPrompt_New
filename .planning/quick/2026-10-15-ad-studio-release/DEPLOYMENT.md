# Ad Studio live deployment

2026-10-15. User-authorized commit/push/deploy completed.

- Commit: `df7cdacb3972efefbee257c434ec32026fcfb137`, pushed to origin/main without force.
- Website: `dep-db87j7cs728c73fp0vbg` on `srv-damkknad0e5s73fqd4og` — live.
- API: `dep-db87j6cs728c73fp0sq0` on `srv-damjap142hec739bbqt0` — live, deployment log confirms the exact commit and successful startup.
- Worker: `dep-db87j6ss728c73fp0u20` on `srv-dap961dg1s2s739skva0` — live.

## Acceptance evidence

- Public catalog: 15 entries, including Product With Model Ad v2. All 14 prior entries retain identical SHA-256 hashes of their public JSON, IDs and versions.
- Live browser: Templates shows 13 of 13; Ad Studio shows 2 of 2.
- Product With Model Ad opens its custom product/model/brand/direction form with music, portrait and 8/15/20 choices.
- UGC opens its existing form, separate product/character groups, silent output and 8/15/20 choices.
- Change template returns to Ad Studio with the draft query preserved; cross-section navigation retains that query.
- Old `/templates/product-with-model-ad?from=release-check` redirects to `/ad-studio/product-with-model-ad?from=release-check`.
- Approved model-ad preview reaches readyState 4, advances playback and reports 15.041667 seconds; URL uses the existing v2 car preview key.
- English/Arabic and light/dark checked live; original language/theme restored. Full responsive matrix was verified locally before release.
- `/api/v1/health` returns 200 with MongoDB, R2 and generation-runtime healthy. `/api/v1/capabilities/video` returns 200 with templateReady true.
- Screenshot: `output/ad-studio-live-release.png`.

## Validation and limits

Preflight: 917 passing default workspace tests, all workspace typechecks/builds, lint without errors; 21 explicit FFmpeg tests pass. See SUMMARY.md for skips and existing warnings.

No paid generation, user project mutation, environment/credential change, pricing change or database switch. Existing production outputs were not regenerated. Service readiness is not a guarantee of future provider success. An existing API startup warning reports unconfigured SMTP; unrelated to this release and unchanged.

Post-deployment evidence remains a local documentation update to avoid an unnecessary documentation-only redeployment. Unrelated local changes and artifacts remain preserved and unstaged.
