# Product With Model Ad v2

Implemented only this custom template's revised direction and music. Other templates retain their recipes, forms, silent output and preview keys.

## Behavior

- Version 2 timelines: 8s = 1/2/3/2; 15s = 3/4/4/4 matching the approved story; 20s = 4/6/6/4.
- Product introduction, natural car exit, supplied detail in motion, walking close. Product handling adapts to hold/wear/present and actual size/construction. No mandatory purse hardware, colors or presenter appearance.
- Exact ordered product and character references remain independent; adult rights checks retained. Selecting uploaded model mode requires references. Generic realistic/illustrated casting requires unselecting character references without deleting saved assets.
- Music is enabled in project/configuration/quote snapshots and validated by API, compiler and worker. Native music survives finishing; no campaign narration replacement. Missing audio fails delivery validation.
- Existing custom v1 recipe retained in source. New immutable catalog ID derives from version 2. Existing database version documents use set-on-insert and are not overwritten. No database server was started or migration executed this turn.

## Preview

Approved existing video: `templates/v2/product-with-model-ad-car-15s.mp4`.
Poster: `templates/v2/product-with-model-ad-car.jpg`.
Both uploaded and downloaded for SHA-256 verification. Video checksum: `eae401bd749002ed3e1ff267b181c7edb4fac2da2e2facc78f617d56fdb2e0f0`.
Evidence: `output/product-model-ad/photoreal-car-15s/published-v2.json`.
Preview is explicitly a 15-second example, not a promise that new uploads reproduce its identities or exact frames.

## Verification

- Final full workspace run: 912 passed, 43 skipped, zero failures (`MOVPROMPT_TEST_FFMPEG=true bun run test:workspaces`). Skips comprise 32 tests requiring an isolated MongoDB environment and 11 pre-existing disabled UI tests.
- All nine workspace type checks and builds passed; lint: zero errors, 20 existing Fast Refresh warnings. Existing large-bundle warning remains.
- Original 64-recipe hash and 14 original-form markup regressions passed.
- Tests cover ordered references, no example identity hard-coding, three timelines, prompt size, audio-enabled worker requests, Seedance 2.5 requirement, quote identity, uploads/rights, persistence and old preview associations.
- Local production-component fixture: 15-second validation passed, 6,540-character synthetic-product prompt, zero paid calls. Preview played to 15.041667 seconds with readyState 4.
- English/light and Arabic/dark tested at 375, 768, 1024 and 1440 pixels: no horizontal overflow. Native click-to-play controls follow UI/UX skill guidance. Screenshot: `output/product-model-ad/photoreal-car-15s/form-v2.png`.
- Local fixture blocks generation and database mutations. A separate loopback server exposes only read-only preview routes for actual stored-media playback.

## Limitations / release

No new paid media was generated. Arbitrary photorealistic face uploads are not proven accepted by the provider; the UI explains possible rejection and does not substitute another person. Existing approved example used prompt-created casting, not an uploaded face.

Code is local and uncommitted. Live website/API/worker release has not occurred. Deploy the matching API and worker together; normal catalog initialization will publish the new immutable v2 document. Actual authenticated MongoDB-backed generation remains a separate acceptance check.
