# Release verification — 17 October 2026

Final commit: `59256e80dcab90f178ac925507a0f23a0a9b535b` (includes initial implementation `87761c9`). Published to origin/main without rewriting history. The unrelated primary checkout's staged work was not changed.

## Render

All three services visibly report Live at the final commit:

- Website: `dep-db9kjm1srm7s739km4ag`, 44.5 seconds
- API: `dep-db9kjm1srm7s739km2hg`, 2 minutes 9 seconds
- Worker: `dep-db9kjm1srm7s739km3k0`, 1 minute 35 seconds

`VITE_FEATURE_REFERENCE_LIBRARY=true` was saved on the website. `FEATURE_REFERENCE_LIBRARY=true` was saved on API and worker. Other environment values were preserved. Repository blueprint/example defaults remain off.

## Live checks

- Website: https://website-xrha.onrender.com/assets
- API health HTTP 200: MongoDB, R2 and generation runtime each report ok.
- Library availability HTTP 200: enabled=true.
- Anonymous library list HTTP 401. My assets redirects guests to sign-in with next=/assets.
- Fresh final web bundle loaded in browser. Adstudio has a product library picker, a second presenter picker when uploaded character mode is selected, and only the product picker when speech is enabled. Uploaded character choice is unavailable in speaking mode.
- Guest library access opens sign-in recovery with the configured draft retained. No live account was created and no production library/media mutation or generation was performed.
- Saved `evidence/live-adstudio-59256e8.png` from the live browser.

## Additional local queue acceptance

Executed the actual MongoWorker lease loop against an isolated real replica-set database, with the library reconciliation handler and an in-memory storage fixture. Both committed library jobs completed. Deletion produced a new working version and a review notice while preserving the old version, exact offer and approved speech. Zero provider calls. The isolated database was removed afterward. Actual private R2 bytes/copies and decoder verification were separately covered by the 8/8 integration tests.

The original local test project's accepted pointer remains `6ad328ecfe385fb14ae9102c` for project `6ad328eafe385fb14ae91028`.

Local API, worker and Vite were restarted at this release with library flags enabled. The local queue contained no queued/active generation jobs before restart. Paid generation remains deferred.
