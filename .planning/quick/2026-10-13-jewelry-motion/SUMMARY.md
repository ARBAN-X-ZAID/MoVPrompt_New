# Jewelry motion correction — 2026-10-13

## Result

The old animation froze camera and lighting after 6.65 seconds and barely changed framing during the wide reveal. The new eight-second recipe preserves seconds 0–4, reveals the set visibly during seconds 4–6, and continues camera and reflected-light motion through seconds 6–8. The resolver's conflicting stable-hold suffix is removed for jewelry v3 at eight seconds. Historical versions remain immutable; 15/20-second visual directions are unchanged.

The replacement is a local photo animation from `Downloads/gold.png`, not an AI-generated 3D reconstruction. No Seedance or other provider was called. The existing photo composition and pieces are preserved.

## Media and publication

- Output: `docs/template-demos/videos/v3/jewelry-product-showcase-animation.mp4`.
- Saved copy: `/Users/arbaanq/Downloads/movprompt/gold-jewelry-animation-8s-motion-2026-10-13.mp4`.
- Eight seconds, 720×1280, 30 fps, 240 frames, no audio stream, 2,014,504 bytes.
- All 120 opening PNG frames exactly match the old local animation. All 120 closing PNG frames have distinct hashes. Contact sheet inspected: progressive reveal and all supplied pieces complete in the closing view.
- SHA-256: `4c8af1b666bf15515bee5b29262babe956b7395c5cd58797e0634abbf7865533`.
- Published and checksum-verified `templates/v3/jewelry-product-showcase-animation.mp4` plus unchanged v1 poster. Real R2-backed preview API handler returned HTTP 200, video/mp4, matching byte count and checksum.
- Preview selection now points to v3; both historical v2 jewelry videos remain allowlisted.

## Verification

- Creative engine: 155 tests; scoped API: 74; DB catalog: 2; web media/grid/photos: 22; worker preflight/lifecycle: 30. Total 283 passed.
- Creative-engine build, web/API type checks, web production build and targeted ESLint passed. Web build retains its chunk-size warning.
- Sixteen isolated browser cases passed: 375/768/1024/1440 pixels × English/Arabic × light/dark. New MP4 playback, exact media dimensions/duration, muted state, no horizontal overflow and no page errors checked; first case played through 7.3 seconds.
- Browser catalog/auth/capabilities used fixtures. Separate storage/API verification used actual R2. No full API or worker runtime, live DB writes or paid video generation.
- Screenshot evidence: `/tmp/jewelry-motion-375-en-light.png`, `/tmp/jewelry-motion-1440-ar-dark.png`; contact sheet `/tmp/jewelry-motion-contact.png`.

## Delivery boundary

The object is uploaded and local code selects it. No commit, push or deployment occurred. Deploy matching web/API/worker code before claiming the hosted website uses this revision. Existing uncommitted work was preserved.
