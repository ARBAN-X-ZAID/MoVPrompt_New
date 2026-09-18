# Campaign save ObjectId fix

## Follow-up: post-save receipt verification, 2026-09-15

The user's next retry successfully verified both images in R2 and finalized claim `6aa935da2ef6987728ca5d59`, creating MongoDB version `6aa935dd2ef6987728ca5d5c` under the existing project. The browser still reported the generic save failure after this boundary. Receipt comparison included optional `undefined` fields retained by IndexedDB even though HTTP JSON omitted them. A regression test reproduced `configuration_mismatch`.

Snapshots now store/hash the exact JSON payload. Receipt verification ignores undefined object properties for existing checkpoints without weakening checks for actual missing or changed values. Active claims cancel/suppress queued background autosave; resumed snapshots use the checkpoint's pending intent so older UI state cannot replace a successful claim. Sanitized claim error code/status/request ID diagnostics were added without URLs or credentials.

The browser also showed changed delivery settings after the completed initial claim. When the selected media still matches the checkpoint, recovery now reads the completed operation and retrieves its original receipt without replaying claim/start with changed form settings. The existing persistence path then saves current edits and canonical media references in a child version. An added regression verifies completed recovery skips claim/start and keeps both local correlation and native asset identity. Changed media does not reuse an unrelated completed receipt.

The regression now passes; all 220 web tests, web type checks, focused lint and the build pass. No new paid generation was submitted. The earlier R2 integration proved upload/finalization, but did not cover browser receipt verification; that gap is covered by the new regression. A complete newly generated video remains unverified in this follow-up.

The failed draft had already created a MongoDB project and reserved asset, but the web client rejected the returned native ObjectId because the manifest held a browser UUID. The completion endpoint also compared these identities directly and forwarded the native ID where the claim repository expected the manifest's local ID. Those boundaries now translate and validate the identities correctly. Browser-local IDs remain correlation metadata; MongoDB asset documents retain only their native `_id`.

An edited, unfinished draft now receives a new save intent. The previous operation and assets remain as history with a superseded marker, the new operation retains the existing project, stale intents cannot resume or finalize, and successful immutable versions cannot be replaced. Transactional writes serialize retries and finalization. Replacement is blocked while cleanup has leased an asset.

Verified locally:

- The original regression test failed before the mapping fix and passed afterward.
- API asset completion accepts the correctly mapped UUID/ObjectId pair and passes the original manifest ID to the claim service.
- Actual MongoDB replica-set tests verify idempotent retries, owner rejection, altered-data rejection, changed-image recovery, concurrent duplicate starts and finalizations, retained history, one project/version, native `_id`, and rejection of superseded/completed intents.
- The opt-in R2 integration test uploaded a new PNG through the API, verified its bytes/checksum, completed and finalized the claim, and retrieved the private image through a signed URL. Only that newly created test image and isolated test database were removed. Existing user storage was untouched.
- Standard API and web suites passed. A further web regression checks successful and resumed claims preserve local blob identity while returning canonical asset IDs.
- API/web type checks and builds passed; focused lint and `git diff --check` passed. The additional finalization-versus-replacement race test passed against local MongoDB.
- The existing user draft stayed open. After refreshing connection/availability, the browser showed “Everything is ready” and an enabled Generate campaign button. The previous error text is from the earlier attempt and clears when the user retries.

No new Gateway generation was submitted. These checks prove the repaired save/upload boundary; a new full video-generation run remains the user's test. No Git push or deployment occurred.

Repeat focused checks:

```sh
MOVPROMPT_TEST_MONGO=true MOVPROMPT_TEST_R2=true bun --env-file=../../.env run --cwd apps/api test --run src/mongo-guest-claim.integration.test.ts src/assets.test.ts
bun run --cwd apps/web test --run src/features/create/creatorAssets.test.ts src/features/create/creatorProjectAssets.test.ts
```
