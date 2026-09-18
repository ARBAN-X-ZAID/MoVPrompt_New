---
status: resolved
trigger: "Final independent Phase 03 post-fix review found that truncated image containers can pass verification and presenter choices do not reach provider generation requests."
created: 2026-08-21
updated: 2026-08-21
---

# Phase 3 Integrity Blockers

## Symptoms

- **Expected behavior:** Direct-uploaded JPEG/PNG/WebP assets are accepted only when fully decodable, and any eligible AI UGC or uploaded-spokesperson choice materially reaches the render provider configuration.
- **Actual behavior:** A 33-byte signature-and-IHDR-only PNG is accepted as a valid image, while presenter state is validated and saved but omitted from `buildPortableGenerationConfiguration` and the worker provider request.
- **Error:** No runtime exception; these are fail-open integrity gaps detected by the final independent code review.
- **Timeline:** Found after the third Phase 03 code-review fix iteration on 2026-08-21.
- **Reproduction:** Call the image verifier with a truncated PNG containing only signature and IHDR; inspect the portable generation configuration and `ProviderGenerationRequest` for a campaign with AI UGC or uploaded spokesperson selected.

## Current Focus

- hypothesis: Image validation parses headers without proving complete decode, and presenter information lacks a canonical server-to-worker provider contract.
- test: Add failing tests for truncated/non-decodable containers and for presenter propagation from immutable project configuration through render lifecycle to the provider adapter.
- expecting: Invalid images fail with `invalid_asset_content`; presenter selections either reach an explicit supported provider request field or fail closed before quote/start when the capability cannot honor them.
- next_action: complete
- reasoning_checkpoint: Do not fake presenter support or silently discard a paid campaign input; preserve existing product/template source truth and immutable-version boundaries.
- tdd_checkpoint: pending

## Evidence

- timestamp: 2026-08-21T02:15:00+03:00
  observation: Final independent Phase 03 review reported two blocking integrity defects after all normal focused and full suites passed.
- timestamp: 2026-08-21T02:24:00+03:00
  observation: The production worker registers only video adapters. `ProviderGenerationRequest` has no presenter or footage field, while the API eligibility path can accept both AI UGC and uploaded-spokesperson modes. The current image verifier derives dimensions from container headers and has no full decoder.
- timestamp: 2026-08-21T02:31:00+03:00
  observation: Red tests reproduced both defects: a PNG signature plus IHDR-only payload, a JPEG SOF-only payload, and a WebP VP8X-only payload were all accepted; a validly consented uploaded-spokesperson campaign received a quote despite no presenter field in the worker request.
- timestamp: 2026-08-21T02:39:00+03:00
  observation: `bun run test:all` passed (web 194, API 116, worker 67); workspace typecheck and builds passed; creator smoke passed (12); bundle check passed (247,850 gzip bytes). A fresh migrated PostgreSQL 17 database passed the guest-claim presenter test (6 tests). No provider request was submitted.

## Eliminated

## Resolution

- root_cause: Header-only inspection treated image metadata as proof of media validity; independently, Template Mode presented and authorised modes that no registered Seedance adapter or `ProviderGenerationRequest` could render.
- fix: Images are now preliminary-bounded then fully decoded by a single-threaded, timeout- and allocation-bounded FFmpeg process before verification. Template Mode hides non-renderable presenter choices and the server rejects any non-none presenter at guest claim, quote and start-render with a clear recovery message before a charge or provider call.
- verification: Red reproduction tests passed after the fix for incomplete PNG/JPEG/WebP, direct signed-upload completion, mirrored import, and both presenter quote/start paths. Full unit, build, typecheck, creator smoke, bundle and PostgreSQL guest-claim verification passed.
- files_changed: apps/api/src/asset-content-verifier.ts; apps/api/src/asset-content-verifier.test.ts; apps/api/src/assets.test.ts; apps/api/src/campaign-eligibility.ts; apps/api/src/{creator-routes,generation-routes,generation-service,generation-service.test,generation.test,guest-claim-service,guest-claim-service.postgres.test,runtime-services}.ts; apps/web/src/features/create/CreateStudio.tsx
