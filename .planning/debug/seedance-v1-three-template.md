---
status: resolved
trigger: "Test real video creation with three chosen templates using Seedance v1 Pro Fast and make those templates work end to end."
created: 2026-08-30
updated: 2026-08-30
---

## Symptoms

- expected: For this bounded development test, generate one real 2-second 480p Seedance v1 clip for each of three selected templates, validate the media, and publish only truthful playable template previews.
- actual: Food & Beverage and Luxury already had unrelated preset clips, while WhatsApp had no playable clip. The first smoke configuration also inherited a stale `720x1280` override while requesting `480p`.
- errors: The stale override failed locally with `gateway_video_resolution_mismatch:720x1280:expected_480x864_for_9:16_480p` before any provider charge. The raw WhatsApp output later failed visual review because it invented illegible lettering.
- timeline: The cheap local model profile was added on 2026-08-21. Three bounded paid proofs and the template integration were completed on 2026-08-30.
- reproduction: Run the guarded Gateway video smoke with an explicit 480p profile and a public 480x864 product reference, inspect all frames, then open each corresponding template preview in the local browser.

## Current Focus

- hypothesis: The provider path is healthy, but stale smoke resolution settings and truthful-preview mapping prevent the selected templates from being usable demonstrations.
- test: Run zero-cost template preflight, submit exactly three explicit 2-second 480p Fast jobs, decode every MP4, inspect contact sheets, and load every published preview in Chromium.
- expecting: Three unique MP4s with exact Kinza source identity, no technical errors, matching poster frames, and browser `readyState=4`.
- next_action: none

## Evidence

- Gateway auth accepted the development key. Balance before the three paid renders: USD 15.2018715.
- Zero-cost creative preflight passed all 50 templates across 600 prompt/configuration cases.
- `food-beverage`: completed in 27.3 seconds; 480x864 H.264; 2.041667 seconds; 892,705 bytes; USD 0.0194.
- `whatsapp-sales-ad`: completed in 22.7 seconds; 480x864 H.264; 2.041667 seconds; 989,276 raw bytes; USD 0.0194. The original failed visual truth review after 0.8 seconds, so the public preview uses only the clean generated interval with a deterministic, exact `Order on WhatsApp` CTA layer.
- `luxury-product-reveal`: completed in 20.9 seconds; 480x864 H.264; 2.041667 seconds; 763,452 bytes; USD 0.0194.
- Total provider spend: USD 0.0582. Gateway balance after: USD 15.1436715.
- FFprobe confirmed H.264, yuv420p, 480x864, 24 fps for all three originals. Full FFmpeg decode completed with zero errors for all three public previews.
- Browser verified all three local preview URLs at 480x864, no media errors, and `readyState=4`; console error count was zero.
- Responsive browser checks passed at 375, 768, 1024, and 1440 pixels with no horizontal overflow. Mobile Arabic dark-mode dialog stayed within the 375x812 viewport.
- Template-to-Create handoff reached `/create?template=luxury-product-reveal` and opened the campaign source step.
- Focused media/catalog/project tests passed: 13/13. Web TypeScript build and Vite production build passed.


## Eliminated

- Invalid Gateway credentials: eliminated by authenticated balance and three completed operations.
- Unsupported Fast model or image-to-video operation: eliminated by three completed `bytedance/seedance-v1.0-pro-fast` jobs.
- Corrupt or browser-incompatible output: eliminated by FFprobe, full decode, and Chromium media metadata.
- Duplicate template imagery: eliminated for the selected three by unique generated MP4 and matching poster paths.
- Fake generated CTA text in the published WhatsApp preview: eliminated by rejecting that raw interval and applying the exact CTA deterministically.


## Resolution

- root_cause: The selected cards were not backed by their own truthful generated media; one had no video, two used unrelated presets, and the smoke environment carried an incompatible resolution override. Adding a twelfth playable preview also exposed a first-page grouping assumption that hid static campaign directions.
- fix: Generated three explicit Seedance v1 Fast product clips, quality-reviewed them, created matching posters, deterministically repaired the WhatsApp CTA preview, mapped the three real assets, and made the catalog show all verified previews plus at least one additional direction.
- verification: 13 focused tests, TypeScript, production build, FFprobe/full decode, Chromium playback metadata, console logs, template-to-Create navigation, and responsive English/Arabic light/dark checks.
- files_changed: `apps/web/public/template-previews/generated/*`, `apps/web/src/features/create/templateMedia.ts`, `apps/web/src/features/create/templateMedia.test.ts`, `apps/web/src/features/create/TemplateGrid.tsx`, `apps/web/src/features/create/TemplateGrid.test.tsx`, `apps/web/src/features/create/creator.css`.

## Scope boundary

This resolves the three-template paid provider proof and local playable-template experience. It does not claim that the full PostgreSQL/worker/private-storage authenticated generation path is running on this Mac: Docker is not installed, the portable API at port 8787 is offline, and the browser correctly keeps the local catalog in preview-only fallback. Project-row persistence and dashboard output visibility remain a separate full-stack environment gate.
