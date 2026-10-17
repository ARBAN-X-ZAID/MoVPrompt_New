# Final simplified form: local verification

## Code

- Removed More brand options and all fields/buttons inside it. Kept the persisted brand snapshot schema compatible, without deleting old confirmed facts or library records.
- Merged model selection, model photos and per-asset permissions into Product & model. Brand and Direction are sections 2 and 3.
- Updated custom-form catalog metadata to match the production component. Existing forms stay on the original CreateScreen; the local fixture uses the same new production component.
- Form inputs are validated and saved; product/model photos are sent in ordered reference mode. Visual choices are compiled into Seedance instructions. Exact CTA, logo and brand text are deterministic finishing layers. This is direction, not a guarantee of pixel-identical adherence.

## Unpaid checks

- Nine-workspace run: 907 passed, 43 skipped. Added two further regression tests afterward; focused new form suite: 28 passed. Focused restoration/claim/quote/mapper suite: 50 passed.
- Workspace typechecks/builds and repository lint passed; 20 existing Fast Refresh warnings and the existing large-chunk build warning remain.
- Existing 64 creative recipes retain their original serialized checksum. All 14 existing form markup regressions pass.
- Browser: uploaded newly generated purse and existing animated adult; verified missing model/permission gates; selected hold, 15s, 9:16, silence; unpaid compilation passed (6324 characters, zero paid calls).
- 16 combinations: 375/768/1024/1440, English/Arabic, light/dark; no horizontal overflow. Screenshot: output/product-model-ad/final-form/form.png.
- Saved 15s settings, ordered photo roles/checksums/permissions, old tagline and stable claim digest pass local-memory tests. API, provider and worker tests use mocks; native finishing tests exercise local FFmpeg.
- Full real MongoDB-backed browser-to-worker acceptance is NOT verified: configured Atlas is shared production, no isolated local replica set is available, and no database change was authorized. No production readiness claim is made.

## Separate authorized preview

User authorized one paid 15-second Seedance 2.5 attempt and a new luxury purse reference. Built-in image generation produced the purse; workspace and Downloads copies were saved. Compiled actual v1 15s template prompt is 6311 characters with product [Image 1], animated adult [Image 2], portrait, mute and seed 1195183607. A private exclusive-create dispatch guard prevents paid resubmission. No automatic paid retry.

The single authorized operation completed after approximately 450 seconds. Raw and finished outputs are saved in output/product-model-ad/preview-15s and Downloads/movprompt. The finished video adds only the exact CTA using worker modelAdLayers during its final three seconds.

Technical check: H.264, 720×1280, 24 fps, 15.041667 seconds, no audio stream; FFmpeg freeze detection (n=0.001,d=0.8) reports no freezes. Finished SHA256: de4a93dd42b4a89e8e3423741fd3e89f5ac9430c577764b19c72b883ddac6219.

Visual acceptance FAILED: sampled frames preserve a recognizable burgundy purse/material/hardware and show handling/detail motion, but the supplied illustrated adult is rendered realistically and the purse occludes her face at the close. Frame evidence: review-frames.jpg, frame-3s.png and frame-14s.png. This demonstrates that sent prompt instructions are not guaranteed output behavior.

Do not activate this as a verified template preview or claim production fidelity. No publish script was run; no R2 preview/poster keys, activation manifests or catalog records were changed. The product/model source photos alone were uploaded to private preview-test R2 keys for the explicitly authorized provider call. Keep immutable prompt/configuration and private dispatch/operation evidence. No paid retry.

Deliverable for review: /Users/arbaanq/Downloads/movprompt/product-model-ad-purse-15s.mp4 . New purse reference: /Users/arbaanq/Downloads/movprompt/luxury-purse-2026-10-14.png . Generated with built-in image generation: one complete burgundy leather purse, curved handle, gold fittings, neutral studio surface, no logos or people. Full video instructions: output/product-model-ad/preview-15s/prompt.txt.

No commit, push, deployment or MongoDB mutation.
