# Stalled generation recovered

## Cause and fix

The existing render `6aa93ecebde1319358bf6e45` reached Gateway at 12:49 UTC. Its first reconciliation job completed at 12:49:38, but MongoWorker ignored `singletonNextSlot`. The active poll held the unique singleton key and blocked insertion of its own successor. The duplicate-key error was treated as deduplication, leaving a processing run with no queued poll.

MongoWorker now transfers the singleton key from an active job owned by this worker to its queued successor inside one MongoDB transaction. Concurrent duplicate scheduling still permits only one queued successor. No provider submission or model configuration changed.

## Evidence

- Added the failing queue regression before implementation; it passes after the fix.
- Worker suite: 74 passed, 2 skipped. Worker typecheck passes.
- Real MongoDB replica-set regression with the production unique singleton index: one active job and exactly one queued successor; two concurrent duplicate calls were rejected. Only the isolated regression database was removed afterward.
- ESLint for the modified worker and test passes; `git diff --check` passes.
- Read-only Gateway status returned completed for the existing operation. Queued one recovery reconciliation job after checking there was no active/queued job for this run. No new paid generation was submitted.
- Existing run completed at 12:59:15 UTC with stage `ready`, no error, and a stable private output object key in R2 bucket `movprompt`.
- The user's browser automatically reached the campaign editor/export dialog. Read-only video inspection showed an 8.041667-second video, 480 × 864 pixels, readyState 4, actively playing, and no media error. The export dialog and user selection were left unchanged.

## Limits

Local development uses the configured acceptance reviewer; this recovery does not establish production AI review quality. This check verifies retrieval, R2 persistence, and browser playback of this existing video; it does not certify every format export, guest quota, or production journey. All repository changes remain local.
