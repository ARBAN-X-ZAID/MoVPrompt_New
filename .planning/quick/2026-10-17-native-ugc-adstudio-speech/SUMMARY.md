# Native UGC and Adstudio speech

2026-10-17. Implementation and local validation. Deployment remains conditional on the complete local worker run passing.

## Scope

- Only `female-product-review` v4 and `ad-studio-brand-ad` v2 gain native approved speech controls, generated adult character style, delivery, exact script and language-bound approval.
- Existing Seedance 2.5 adapter generates audio and video together. No added speech, cloning or lip-sync API. Model IDs remain server-only.
- Immutable speech settings match the project, brief, campaign recipe and quote context. Unsupported templates, unapproved/overlong scripts, portrait references in speaking mode and wrong models fail before provider submission.
- Preserve historical UGC v3 and Adstudio v1. The full original catalog hash with historical UGC substituted proves the other 63 original recipes unchanged. Product With Model Ad production files are excluded from this release.
- Speech review separately gates exact words, visible mouth synchronization and dialect even when the aggregate quality score passes. Final delivery preserves native audio and existing deterministic closing copy.

## Provider evidence and limits

- The first generated-character English UGC sample passed independent media review: score 98, speech synchronization 96, exact English script confirmed.
- A synthetic realistic character portrait was rejected by Seedance as `provider_person_reference_rejected`. No resubmission of that case. Speaking controls now offer generated realistic/illustrated characters only, with pre-charge validation and an explanatory upload limit.
- The first Arabic generated-character sample spoke the approved words but failed visible speech synchronization (65) because framing obscured the mouth. Release was held.
- The revised speaking prompt keeps the sharp visible face and product in one continuous shot until the script ends. A distinct Arabic validation sample passed: aggregate 94, speech synchronization 95, Kuwaiti dialect 95, exact script confirmed. The ending card is added deterministically. Frame review saved locally.
- Each adapter sample uses a durable one-submit guard. Resume only polls the existing operation. Sample directories and provider receipts remain local, outside Git.
- These are individual accepted samples, not a guarantee that every future generation will pass. Existing failure/refund and output acceptance gates remain active.

## Local checks

- Isolated release snapshot excludes the unrelated staged website/auth/proposal/media work in the user's checkout.
- Default release tests: 973 pass, 57 skipped. The pre-existing account-menu test requires `VITE_FEATURE_DEVELOPMENT_FREE_GENERATION=true`, matching local development configuration. No environment files are committed.
- All workspace typechecks and builds pass. ESLint: zero errors, 20 existing Fast Refresh warnings.
- Explicit FFmpeg follow-up: 29 pass, including missing native audio rejection, voice-renderer bypass, preservation of UGC closing copy, native Adstudio sound and crop/finishing regressions.
- Real isolated MongoDB catalog checks: 3 pass. Exactly two new versions publish, every historical record stays identical, replay is idempotent.
- Real isolated MongoDB worker regression: 1 pass. Native UGC loads immutable campaign recipes, checks selected asset ownership/checksum, rejects another owner and preserves legacy UGC behavior.
- API quote tests: approved native UGC and Adstudio pass. Stale approval and a non-2.5 model fail. Worker tests confirm exact approved script and `generateAudio: true` reach only the pinned model.
- Local API health and capabilities report MongoDB, R2, worker and template generation ready. API origin aligned with browser host to permit the local guest cookie.
- Browser speech controls checked at 375, 768, 1024 and 1440 in English/Arabic and light/dark. No horizontal overflow. Language and theme restored, viewport override reset.
- The complete browser workflow exposed missing UGC immutable recipes in the Mongo worker loader before any provider charge. Fixed the loader for native UGC only, added the real-Mongo regression, and submitted a new worker run. Its final result will be recorded below before deployment.

## Complete local workflow acceptance

- Local guest browser flow `f147b4e8-7d97-4c53-98a2-1f5b24c8d6db` claimed a privately checksummed product photo, persisted the approved script, obtained a quote and queued render `6ad3295efe385fb14ae91031` through the actual API and Mongo worker.
- The worker completed on quality attempt 0. The finished private R2 output reached the browser result screen, `readyState=4`, playing with `muted=false`, duration 8.064 seconds and a 480×854 watermarked preview. The saved generation selected 720p.
- Original adapter samples cover 720p English and Arabic; the complete queue/browser run covers the 720p native speech configuration and its smaller watermarked preview. No separate speech renderer was called.
- Evidence is saved locally under `output/native-ugc-validation-2026-10-17/full-flow/` and `ui/ugc-end-to-end-ready.jpg`. It is excluded from the source release.
- All conditional local release checks passed. Deployment is authorized by the user's original request and will use the isolated snapshot. Production acceptance is recorded separately after observing it.
