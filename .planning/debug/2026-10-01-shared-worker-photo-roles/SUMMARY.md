# Photo-role preparation failure — partial resolution

## Result

The reported failure occurred before provider submission. The stored error is `invalid_generation_configuration`, rejecting `references[0].referenceRole`. The exact saved configuration passes the current built contracts and compiler, so removing the photo or changing its content is not the remedy.

Two fresh workers share the configured queue: a local worker and `movprompt-production-worker` advertising the production environment with a different fingerprint. The queue has no environment/version partition. An older worker processing the new configuration is the likely cause; completed job records clear the lease owner, so the specific consumer cannot be proven from that record alone.

The user declined a separate testing database, then authorized temporarily pausing the other worker for the two tests and restoring it. Database settings were not changed. The exact Render worker was suspended after an idle check and restored after both tests became terminal. Render now reports Live on its original commit with a fresh heartbeat. Local fixes were not deployed. Do not blindly submit more jobs into the restored mixed-version queue.

## Real end-to-end results

- **Single photo completed:** Fashion Product Showcase, shirt.jpeg, 9:16, 15 seconds. Run `6abe013ca698bc28a13ce38a`, project `6abe00d5a698bc28a13ce383`. One accepted attempt; stable seed persisted; correct accepted-version pointer. Private saved media was verified with FFprobe: 720x1280, H.264, 24 fps, 15.041667 seconds, no audio stream. Browser guest preview plays (watermarked, 480x854). A sampled detail frame preserves the striped shirt and pocket. Full aesthetic/fidelity acceptance is still a human-review gate.
- **Two-photo UGC did not complete:** Female product review, one product and one synthetic character, confirmed character rights, 9:16, 15 seconds. Run `6abe01c6a698bc28a13ce394`, project `6abe0165a698bc28a13ce38c`. Provider accepted the operation then rejected the character reference as potentially containing a real person. No output. Exactly one attempt; no paid retry. Both ordered roles and the seed remain saved. This observation does not establish that every character reference is rejected globally.
- Application chargedCredits=0 for both development tests; UGC refundStatus=refunded. No provider cost telemetry was returned/persisted, so provider-side charges remain unverified.
- Native file selection was user-assisted; browser automation verified the uploaded files, roles, consent and settings and submitted both jobs through the UI.
- Restoration: Render service `srv-dap961dg1s2s739skva0` / `MoVPrompt_New` is Live on `c82a59d`; resume triggered a build of that same commit. Production heartbeat verified fresh at 2026-10-01T06:55:35Z. Production capability alignment remains outstanding.

Further UGC acceptance requires an explicit decision: use the optional generic presenter without a character reference, or investigate a supported character-reference route. Either differs from the requested two-photo test; do not silently substitute, evade provider filtering, or run another paid attempt without approval.

## Local changes

- Worker now uses the shared `GenerationConfigurationSchema` rather than a duplicate schema, keeping API and worker photo-role validation together.
- Added 15-second single-reference fashion and two-reference UGC submission-contract tests, plus rejection checks for unknown roles, unexpected reference fields, and missing character consent.
- Public run errors explain that saved settings could not be read, preserve the user's photos/details, and suggest support if repeated; internal schema details remain redacted.
- Specific provider person-reference failures now have a stable error code and safe explanation, including historical generic errors on read. No raw request identifiers reach the browser. English/Arabic guidance survives reopening and appears directly below Generate, not beside link import. Raw missing-photo and character-consent quote codes are replaced by accessible instructions.

## Test assets

Generated using the built-in image-generation tool; wholly synthetic adult character and generic unbranded item. Both images were inspected and saved without overwriting existing files.

- Existing shirt: `/Users/arbaanq/Downloads/movprompt/shirt.jpeg`
- Character: `/Users/arbaanq/Downloads/movprompt/ugc-character-2026-10-01.png`
- Product: `/Users/arbaanq/Downloads/movprompt/ugc-product-2026-10-01.png`

Character prompt:

> Use case: photorealistic-natural. Asset type: adult character identity reference for a UGC product-ad software test. Generate ONE photorealistic portrait photograph of a fictional adult woman, approximately 30 years old, dark shoulder-length hair, warm brown eyes, wearing a plain modest cream long-sleeve blouse. Waist-up, face unobstructed, facing camera with a relaxed closed-mouth smile, both hands relaxed and empty, natural skin texture. Simple softly lit neutral home-studio background, daylight, realistic smartphone-camera appearance. One person only. No product, no jewelry, no branding, no text, no watermark. This is a wholly synthetic character, not any real person. Portrait aspect ratio.

Product prompt:

> Use case: product-mockup. Asset type: single product identity reference for a UGC ad software test. Generate ONE photorealistic studio product photograph of a compact cylindrical reusable insulated stainless-steel water bottle, matte pale sage finish, plain matching screw-top cap, simple seamless silhouette. Entire bottle and cap visible, upright on a neutral warm off-white surface, subtle realistic contact shadow, clean background, soft daylight, sharp physically plausible material texture. One object only. No person or hands, no packaging, no logos, no labels, no words, no text, no watermark. Front three-quarter product view, portrait composition with space around the bottle. Generic unbranded test item, not a real branded product.

## Verification so far

- Focused worker/API suites: 80 tests passed.
- Full workspaces: 735 tests passed, 49 environment-gated tests skipped; builds and type checks passed; lint had 0 errors and 20 existing warnings. `git diff --check` passed.
- Read-only validation of the actual failed persisted configuration: schema accepted, duration variant accepted, compiled prompt 4,121 characters.
- Follow-up regression suites: provider/API focused tests passed (18 + 59); all workspaces passed before the final browser-restoration refinement. Final web suite adds two recovery tests, bringing the combined total to 745 passed / 49 environment-gated skipped. Builds and type checks pass; lint has 0 errors and 20 existing warnings.
- Rendered live UGC campaign verified in English and Arabic: provider-specific alert directly follows Generate; both photos, consent, 15 seconds and 9:16 remain selected. These follow-up checks do not replace the earlier 375/768/1024/1440 layout checks or constitute full accessibility certification.
- Actual single-photo output is verified as above. Two-photo UGC generated-media acceptance remains blocked by provider rejection, and Phase 04 qualified-human calibration is unchanged.
