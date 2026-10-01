# Shared worker photo-role failure

Continue the user's approved unavailable-GSD fallback for the duration/photo work. Preserve all existing uncommitted changes.

## Evidence

- Reported run failed before provider submission with `invalid_generation_configuration`: unrecognized `referenceRole` at `references[0]`.
- The exact persisted configuration passes the current built shared schema, duration assertion, and prompt compiler (4,121 characters).
- The configured Atlas database has two fresh worker heartbeats: one local and one named `movprompt-production-worker` in production, with different configuration fingerprints. The queue claims any eligible job without environment/version isolation. A stale worker consuming the same queue is the likely explanation; terminal jobs clear lease ownership, so this record alone does not prove which worker claimed it.
- User declined switching to a separate testing database. Do not change database configuration or update/pause the remote worker without further authorization.

## Work

1. Reuse the public generation schema in the worker rather than maintaining a duplicate validator.
2. Add explicit 15-second single-subject and UGC subject/character tests, including malformed reference rejection.
3. Provide safe, clearer public copy for invalid stored generation configuration; do not expose raw validation or provider details.
4. Generate synthetic adult character and generic unbranded product photos and save in Downloads/movprompt.
5. Verify local changes without paid submissions. Live browser-to-completed-video testing remains blocked until worker alignment is authorized; do not claim mocked tests prove actual generated media.

## Requested live tests

- Fashion Product Showcase, 15 seconds, shirt.jpeg, one subject reference.
- Female Product Review / UGC, 15 seconds, one generated product plus one generated adult character reference.
- User authorized one of each and no extra paid retries, but has not provided a USD cap. Obtain a confirmed cost boundary before submitting; preparation failures are not the same as provider-accepted paid failures.

## Follow-up authorization and access — 2026-10-01

User approved proceeding after the request to temporarily pause the other worker when idle, perform the single-photo and UGC tests at 9:16 / 15 seconds, and restore the worker afterward. Database isolation remains declined. Read-only preflight found zero active runs and zero active jobs, with both local and production heartbeats still fresh.

The configured production worker is a Render deployment (`movprompt-worker-zaid`). No Render CLI/access token is configured in this workspace, the available browser shows Render sign-in, and Chrome is unavailable. Requested user sign-in in the opened Render browser. No worker has been paused and no video job submitted. Recheck idle state after gaining access, then verify the exact worker before any pause.

User has now signed in. Live dashboard identifies the actual worker as `MoVPrompt_New`, service `srv-dap961dg1s2s739skva0`, in MovPrompt / Production (the repository's blueprint name differs). Its current deployment is commit `c82a59d`, deployed five days earlier. Read-only preflight again found zero active runs/jobs. Proceed only with temporary pause/test/restore; no deployment or database change is authorized.

Suspension requested through Render's confirmation dialog. **Restore this exact worker before finishing or reporting a blocker.** Verify heartbeat stops before any local test generation; verify heartbeat resumes after restoration. Do not leave it suspended between turns.

Render confirmed Suspended; production heartbeat became stale. Shirt uploaded through native chooser by user (browser automation cannot control Codex native dialogs), then settings verified through rendered UI: Fashion Product Showcase, one selected shirt.jpeg, 9:16, 15 seconds. Generate clicked once. Run `6abe013ca698bc28a13ce38a`, project `6abe00d5a698bc28a13ce383`, was accepted by Vercel AI Gateway and queued on 2026-10-01 at 06:44 UTC. Do not submit a replacement while this operation is unresolved.

## Live outcome and restoration

- Shirt completed on its first attempt at 06:47:48 UTC. Saved output verified with private R2 read and FFprobe (in-memory stream, no signed URLs logged): H.264, 720x1280, 24 fps, 15.041667 seconds, no audio stream. Accepted-version pointer matches. Browser guest preview plays at 480x854 with watermark; sampled frame preserves shirt stripes/pocket, not a full professional creative-quality certification.
- User uploaded both UGC PNGs into their separate groups. Verified one subject plus one character, character rights confirmation, 9:16, 15 seconds; clicked Generate once. Run `6abe01c6a698bc28a13ce394`, project `6abe0165a698bc28a13ce38c`, failed after acceptance because the provider flagged the character input as potentially containing a real person. The image was synthetic; do not evade filtering or silently remove/change it. No second attempt submitted.
- Both seeds persist; both immutable configurations retain duration, aspect ratio, audio=false and ordered roles. Each has exactly one render attempt. UGC has no output, chargedCredits=0, refundStatus=refunded. Provider cost telemetry is absent, so no claim of zero provider cost.
- Resumed the exact Render worker via Resume Background Worker after both runs were terminal. Render rebuilt the same existing commit as part of resume (trigger Resumed), then reports Live at `c82a59d`. Fresh production heartbeat verified at 06:55:35 UTC. No deployment of local changes, database switch, or environment edit occurred. Mixed-version queue remains unsafe for further uncoordinated tests.
- Follow-up fix classifies this specific rejection, safely maps historical generic failures on read without rewriting attempts, localizes recovery guidance, and keeps failures below Generate after reopening. UI/UX accessibility guidance also replaces raw photo/consent validation codes with readable instructions.
