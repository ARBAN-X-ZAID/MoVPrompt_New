# Explicit display copy — implementation and local validation

2026-10-17. Branch `codex/explicit-display-copy`, isolated release checkout based on the deployed `d234674` snapshot. Root checkout staged work is preserved.

## Implemented

- Version 1 display-copy snapshot separates optional opening, offer and closing messages from factual product context and approved speech. Project, campaign, brief and quote context must agree. New template quotes require this policy.
- New drafts start blank. Clearing, changing purpose and changing template do not restore stock actions. Editable legacy drafts clear known English/Arabic stock actions and keep custom messages. Accepted historical versions remain immutable.
- CTA is optional through shared contracts and API eligibility. Automatic subtitles are disabled. The forms retain exact English/Arabic message text, including punctuation, numbers and typed spaces.
- Ordinary, UGC, Adstudio and Product With Model finishing use only requested messages. Empty messages create no promotional panel. Uploaded logos and product labels remain supported. Opening-only and offer-only finishing work independently.
- Generation prompts forbid generated promotional text/subtitles. Structured quality review requires explicit display-copy compliance; missing or false compliance is a hard failure even with high scores. Spoken-script and lip-sync checks remain in place.
- Make another version opens the editable form before a new generation.

## Local evidence

- Full suite with real local MongoDB and FFmpeg: 1,176 passed, 12 skipped. Skips are existing environment-specific cases; no failed tests.
- Typecheck and builds pass in every workspace. Changed-file ESLint and `git diff --check` pass. Existing bundle-size warning remains.
- Catalog-wide display combinations cover all 66 recipes, exact English/Arabic copy, clear, persistence snapshots, purpose/template switching, legacy defaults and mismatch rejection. API preflight tests prove blank CTA acceptance on published photo templates. FFmpeg tests verify empty/opening/offer/closing/both layers, timing and retained audio. Mongo worker checks verify owned immutable snapshots.
- Browser: saved local UGC project retained `20% off until Friday` and `خصم ٢٥٪ — اليوم فقط!` on reload; cleared fields were then saved blank. Approved spoken script is unchanged. UGC/Adstudio were inspected at 375/768/1024/1440, English/Arabic and light/dark. 32 screenshots and viewport metrics are saved locally. Narrow Arabic fields were checked using DOM bounds and rendered screenshots.
- Synthetic FFmpeg outputs and a visual contact sheet confirm blank frames have no banner and English/Arabic displays contain only supplied text. These are finishing proofs, not new AI-generated product videos.

## Real replacement blocked externally

- Local project: `6ad328eafe385fb14ae91028`.
- Preserved accepted version: `6ad328ecfe385fb14ae9102c` and render `6ad3295efe385fb14ae91031`.
- Replacement run: `6ad32ff1ae4cbd6f8391fcf8`, Seedance 2.5, same product/reference/generated realistic adult, 8s 720p and unchanged approved script. Offer and closing fields were empty, subtitles false.
- Provider rejected submission with `provider_balance_required`: the account requires a minimum USD 10 balance. No output or provider operation was accepted and customer charge is zero. No automatic retry or second paid request was made.
- Database accepted pointer still refers to the prior accepted version. No replacement has passed audio, lip-sync and visual review yet. Do not claim this video is corrected.
- User was asked to replenish the existing provider account. Deployment is not started because the approved plan requires replacement/media validation first. All three services must deploy the same reviewed commit after validation passes.

Local artifacts, excluded from Git: `/Users/Projects/VirtuProse/MoVPrompt_New/output/explicit-display-copy-2026-10-17/`. Logs: `/tmp/movprompt-display-full-tests.log`, `/tmp/movprompt-display-types.log`, `/tmp/movprompt-display-build.log`, `/tmp/movprompt-display-lint.log`.
