# Generation index repair and monitoring — complete

## Root cause

The unique render-attempt index used `runId`, but native MongoDB records use `renderRunId`. Distinct runs at attempt zero therefore collided on a null indexed field. The same obsolete field existed on credit reservations. Submission identity and attempt writes shared a transaction, so the attempt failure also lost Gateway tracking. The queue retried while the run did not expose its failure to the browser.

## Changes

- Establish correct unique `renderRunId` indexes before dropping obsolete indexes; concurrent, repeatable startup repair, without deleting application data or media.
- Save the attempt before contacting Gateway. Persist accepted tracking independently of subsequent attempt/economic transactions. Reconciliation repairs the dependent record and follows the existing provider request.
- Persist unexpected safe errors on runs; bounded retries reach an explicit terminal state. Add correlated submission, provider status, processing, R2, quality, completion and retry/error logs. No credentials, URLs, full prompts or provider payloads in these logs.
- Exclude server-derived project flags from saved recipes. Normalize the optional no-presenter value so hydration does not create a draft version during generation.
- Document monitoring in `docs/generation-monitoring.md` and README.

## Stopped old run

Stopped local run `6aa954913b8d195d05fb26db` and its queued retries, preserving campaign/media data. The old transaction had lost the remote tracking ID; cancellation of any old Gateway operation could not be confirmed. No old request was resubmitted for testing.

## Automated evidence

- MongoDB integration/index tests: 3 passed, including repeated migration, distinct runs at attempt zero, same-attempt uniqueness, accepted ID surviving a real dependent write failure, concurrent idempotent repair and identity conflict rejection. Disposable test database only.
- Worker suite: 82 passed, 3 integration tests skipped without their opt-in environment. Tests cover preflight before submit, safe error logging, bounded terminal failure and retry reconciliation without resubmission.
- API generation suite: 42 passed.
- Web suite: 268 passed across 69 files, including read-only flag stripping and presenter normalization regressions.
- DB, API, worker and web typechecks passed; targeted ESLint passed; shared DB and web builds passed. Existing bundle-size warning remains.

## Exactly one authorized real test

Browser selected App and service promotion and uploaded `/Users/arbaanq/Downloads/s24U.jpg`. Explain how it works, English, no presenter, 9:16, 720p, eight-second recipe v3. Generate clicked once.

- Project: `6aa9585ab0706de5b577c99d`.
- Run: `6aa9585cb0706de5b577c9a3`.
- Gateway accepted one tracked attempt, number zero. Provider status moved processing → completed; no worker retry or new paid video requested.
- End-to-end completion: 90.681 seconds. Clean master and watermarked preview saved in R2 bucket `movprompt`.
- Configured local development quality reviewer accepted; this was not a production AI quality audit or an identical-output guarantee.
- Saved project lists Ready in My Projects. Refresh restores editor and playback: readyState 4, no media error, duration 8.041667 seconds.
- Clean browser export downloaded `/Users/arbaanq/Downloads/s24U-9x16.mp4`: H.264, 704×1248, 8.041667 seconds, 3,028,869 bytes. Download checksum and size match R2 metadata.
- The browser exposed an autosave default-normalization bug during this test. After adding its regression/fix, reconnected this named completed project to the rendered version only after verifying the intervening version differed solely by the optional default presenter. Immutable versions and media were retained. Confirmed accepted/working pointer matches the completed run and refresh works.

Current test logs: `/tmp/movprompt-generation-monitor.log`. Future `bun run dev` starts print monitoring logs automatically.

All changes remain local. No commit, push, deployment, purchase, additional demo generation, or deletion of existing storage data.
