# Deployment acceptance

2026-10-17, verified after the conditional local checks passed.

Commit `d2346745e815988dfe24d9802cdbeff7648fa52d` was pushed to origin/main without force from the isolated `codex/native-ugc-speech` worktree. The user's staged checkout work was preserved and excluded.

| Service | Render deployment | Result |
| --- | --- | --- |
| Website `srv-damkknad0e5s73fqd4og` | `dep-db9ilirm8hqs73ahgqs0` | Live, exact commit |
| API `srv-damjap142hec739bbqt0` | `dep-db9ilirm8hqs73ahgp3g` | Live, exact commit |
| Worker `srv-dap961dg1s2s739skva0` | `dep-db9ilirm8hqs73ahgq5g` | Live, exact commit |

## Public acceptance

- `https://movprompt-new.onrender.com/api/v1/health`: HTTP 200, MongoDB, R2 and generation-runtime all `ok` at 08:02:23 UTC.
- `/api/v1/capabilities/video`: `templateReady=true`, lengths 8, 15 and 20 seconds.
- Public catalog: 16 templates. Only `female-product-review` (v3 to v4) and `ad-studio-brand-ad` (v1 to v2) changed. The other 14 full public template objects, including IDs and version IDs, compare identically to the pre-release snapshot.
- Live Adstudio form shows generated adult style, Character speaks, speech language, generic delivery, exact script, word limit and language-bound approval. Empty/unapproved speech blocks generation.
- Live UGC form exposes speech controls. Live jewelry form has no speech control and retains its original silent-photo instructions.
- Local browser completed a real 720p Seedance 2.5 queue run on quality attempt 0. The saved clean MP4 is 720×1280 with an audio stream and duration 8.064s. Its smaller watermarked preview plays with sound in the local result screen.
- Live API had a brief 503 during deployment handover, then all dependency checks became healthy. No environment or credential changes were made in production.

## Evidence and limits

Local media and JSON evidence are in `output/native-ugc-validation-2026-10-17/`, excluded from Git. Live form screenshot: `ui/deployed-adstudio-speech.jpg`. English and Kuwaiti Arabic adapter samples passed, as did the complete local browser/API/Mongo/worker/output flow. No paid generation was submitted in production.

Speaking mode currently uses generated characters because Seedance rejected an uploaded realistic portrait. No new TTS, voice-cloning or lip-sync service was added. Individual successful samples do not guarantee every future render; the strict speech/audio and existing failure/refund gates remain enabled.

This post-release acceptance note remains local to avoid a documentation-only redeployment.
