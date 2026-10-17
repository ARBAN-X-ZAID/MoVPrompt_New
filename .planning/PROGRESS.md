# MovPrompt Progress

Updated: 2026-10-15

## 2026-10-15: Ad Studio live release verified

- Committed and pushed `df7cdacb3972efefbee257c434ec32026fcfb137` to main: section split plus the previously approved Product With Model Ad dependencies. Existing form markup and original recipes preserved.
- All workspace tests/typechecks/builds passed; explicit synthetic FFmpeg checks passed. No paid generation submitted.
- Render web, API and worker deployed `df7cdac`; live API health is healthy and template readiness is true. Public catalog now contains 15 items: all 14 pre-release entries have identical content hashes, plus Product With Model Ad v2.
- Live browser verified 13 Templates / 2 Ad Studio cards, correct custom and UGC forms, draft-aware return navigation, legacy detail redirect with query preserved, English/Arabic and light/dark. Approved model-ad preview plays at 15.04 seconds. No real generation was submitted.
- Deployment evidence: [release report](./quick/2026-10-15-ad-studio-release/DEPLOYMENT.md). Unrelated local work remains unstaged.

## 2026-10-15: Separate Ad Studio from Templates

- Added explicit 13/2 catalog placement, Ad Studio desktop/mobile navigation and Arabic label, shared listing/detail routes, legacy redirects and draft-aware return links.
- Product With Model Ad and Female Product Review now belong exclusively to Ad Studio; all forms, recipes, IDs, audio and generation behavior remain unchanged by this navigation change.
- Verified 334 web tests (11 existing skips), web typecheck/lint/build, published/fallback filtering and 32 local responsive language/theme combinations. Preview playback and legacy redirects checked in the browser.
- Read-only local browser setup; no live DB write, paid generation, commit or deployment. [Full verification report](./quick/2026-10-15-ad-studio-section/SUMMARY.md).

## 2026-10-15: Product With Model Ad v2 — car arrival and music

- Added v2 8/15/20-second car introduction, exit, product detail and walking recipes with instrumental music. Retained the original custom v1 recipe and preserved all 64 original recipes and 14 existing forms.
- User-selected product/model references independently determine identity; no fixed purse, face or wardrobe copied from the example. Optional realistic fictional casting is separate from uploaded-model mode. Real-face uploads remain subject to provider acceptance; no identity substitution fallback.
- Updated browser persistence, API/worker validation, prompt compilation and delivery audio; instrumental output skips narration and requires an audio stream.
- Published the approved 15-second video and poster to new v2 R2 keys with checksum readback. Linked the preview in the catalog and custom form with user-controlled playback.
- No paid generation, production DB write, commit, push or deployment this turn. See [verification report](./quick/2026-10-15-model-ad-car-music/SUMMARY.md).

## 2026-10-14: Realistic fictional presenter/car video

- Generated a separate photorealistic fictional woman image. Verified current portrait-asset policy and obtained explicit user approval to generate the video's presenter from the prompt instead of uploading that external face.
- One accepted 15s Seedance 2.5 request through the existing Vercel key: purse reference only, native audio requested, no paid retries. Delivered 720×1280 / 24fps / 15.041667s with AAC stereo and no detected freeze. Sampled car exit/detail/walking and unobscured face reviewed; precise audio style/listening and production fidelity remain user acceptance gates.
- No website recipe/preview activation, database write or deployment. [Evidence](./quick/2026-10-14-photoreal-woman-reference/SUMMARY.md).

## 2026-10-14: Revised purse/car preview with music

- Authored revised 15s and 8s car-exit/purse-detail/walking prompt drafts; preserved the original silent website v1 recipe. Built-in video generation unavailable, so generated one accepted 8s Seedance 1.0 Pro Fast operation via the existing Vercel key. Fixed one pre-acceptance request-size rejection by compacting the start image; no paid generation retry.
- Added original locally authored instrumental music, normalized exact 720×1280 / 8.000s, verified audio stream and sampled illustrated continuity/car exit/detail/walking. No DB writes, preview activation or deployment.
- Evidence: [purse/car preview summary](./quick/2026-10-14-purse-car-ad/SUMMARY.md).

## 2026-10-14: Product/model merged form and purse preview

- Removed the complete additional brand options UI, merged product/model inputs, and synchronized custom-form metadata; preserved old saved snapshots and all existing forms/recipes.
- Unpaid checks: 907 workspace tests passed / 43 skipped; 28 final focused form tests and 50 focused restoration/claim/quote tests passed, typechecks/builds/lint passed, and 16 responsive language/theme layouts passed. Shared production Atlas remains untouched; actual database-backed acceptance is unverified.
- One separately authorized 15s Seedance 2.5 purse/model video completed: 720×1280, 24fps, 15.041667s, silent, no detected freeze. Visual acceptance failed because the illustrated model became realistic and the purse obscures her face at the close. Saved for user review; no preview activation/publication or paid retry.
- Evidence: [final-form report](./quick/2026-10-14-product-model-ad-final-form/SUMMARY.md).

## 2026-10-14: Simpler Product With Model Ad form

- Removed saved-kit selection and the separate product-category question from the new custom form. Wearing actions supply the necessary internal category. Optional details are collapsed without clearing saved facts or brand snapshots; existing template forms remain unchanged.
- 26 focused tests, web typecheck/lint/build and 16 responsive language/theme combinations passed. Local 15-second configuration validation passed with zero paid calls. No database writes or deployment.
- Evidence: [simplification summary](./quick/2026-10-14-product-model-ad-simplify/SUMMARY.md).

## 2026-10-13: Jewelry closing-motion correction

- Jewelry recipe v3 retains the eight-second opening, adds a pronounced 4–6s diagonal reveal and continues camera/light motion through the final frame. Removed the conflicting resolver instruction to freeze the closing shot. Longer visual directions are preserved; their recipe IDs advance with the immutable template revision.
- Locally rendered the new silent eight-second preview from `Downloads/gold.png`, with zero provider calls. All 120 opening frames match the previous animation; all 120 closing frames are distinct. Verified 720×1280 / 30 fps / exactly 8 seconds / no audio and complete-set closing visibility.
- Published/read-back verified `templates/v3/jewelry-product-showcase-animation.mp4`; real R2-backed API returned the matching checksum. Historical v2 media remains accessible.
- Verification: 283 scoped tests passed; creative-engine build, web/API type checks, web production build and targeted lint passed. All 16 fixture-browser combinations passed preview playback and overflow checks. No live generation/database mutation, commit/push or deployment.
- Evidence: [motion correction summary](./quick/2026-10-13-jewelry-motion/SUMMARY.md).

## 2026-10-12: Jewelry preview replaced with local animation

- Replaced the active jewelry preview with an eight-second animation made entirely from `Downloads/gold.png`. Macro detail, adjacent contour glide, wider reveal and a stable complete-set ending follow the existing four-beat direction. No Seedance footage, AI-provider calls or generation charges were used for this replacement.
- Media is 720×1280 / 30 fps / exactly 8 seconds / no audio stream. Published and checksum-verified `templates/v2/jewelry-product-showcase-animation.mp4`; real R2-backed API returned the matching MP4. The old preview is retained only for historical links. Recipe v2 and all three duration options are unchanged.
- Affected tests: 23 passed. Workspace type checks and builds passed; lint zero errors / 20 existing warnings. Browser and media evidence is recorded in the scoped summary. No database mutations, commit/push or deployment.
- Evidence: [local animation summary](./quick/2026-10-12-jewelry-animation/SUMMARY.md).

## 2026-10-12: Jewelry motion preview

- Generated one authorized 8-second Seedance 2.5 preview with the existing Vercel key, one gold-set photo, vertical 720×1280 and no audio. No paid retries.
- The raw closing scene duplicated a bracelet, so only its generated detail opening was used. The finished preview ends with a deterministic original-photo hero; this finishing is disclosed in the website and metadata, not presented as raw generation fidelity.
- Published/read-back verified `templates/v2/jewelry-product-showcase.mp4`, exactly 8 seconds. Linked it to jewelry recipe v2; retained its v1 PNG poster and all twelve historical video keys. Previously published poster-only versions can show the verified preview without rewriting their stored recipes.
- Verification: 801 workspace tests passed, 49 skipped; workspace type checks/builds passed; lint zero errors / 20 existing warnings. Real R2-backed API preview check passed. All 16 fixture-browser combinations passed playback, one-photo flow, durations, RTL/theme and overflow checks.
- No live database writes, commit/push or deployment. This section supersedes the earlier poster-only/no-paid-preview status below. Full raw-model product fidelity is not established by this finished demonstration.
- Evidence: [preview summary](./quick/2026-10-12-jewelry-preview/SUMMARY.md).

## 2026-10-12: Jewelry Product Showcase

- Added the approved luxury jewelry template under Ecommerce, with separate 8-, 15-, and 20-second recipes, exactly one selected subject photo, 9:16 campaign selection and muted output. Close-detail shots, flowing reflections and a black lacquer studio preserve the uploaded item or complete set; no cloth, people or invented pieces.
- The shared catalog now has 13 launch templates / 39 duration variants / 63 total recipes. The other 50 internal recipes and existing launch preview keys remain unchanged. Existing immutable publication runs on API runtime initialization; no live database mutation was performed in this task.
- Published and SHA-256 verified the static gold-set poster at R2 `templates/v1/jewelry-product-showcase.png`. Jewelry remains explicitly poster-only: no generated-motion preview, original-preview duration or historical-preview recipe version is invented.
- Verification: 798 workspace tests passed, 49 environment-dependent/previously gated tests skipped; workspace type checks and builds passed. ESLint has zero errors and 20 existing Fast Refresh warnings. The final full-photo UI adjustment also passed its 10 focused tests, web typecheck/build and targeted lint.
- Browser fixture checks passed at 375, 768, 1024 and 1440 pixels in English/Arabic and light/dark: selectable card, one-file upload, replacement control, all duration choices, selected 9:16, uncropped jewelry photo and no horizontal overflow or page errors. These checks used an isolated catalog/capability fixture, not the live database or a provider.
- No paid video, Git commit/push or deployment was performed. Deploy matching web/API/worker builds together before live generation; actual generated-media quality remains unverified.
- Scoped evidence: [jewelry summary](./quick/2026-10-12-jewelry-template/SUMMARY.md).

Earlier sections below are historical snapshots, not current catalog counts or deployment claims.

## 2026-09-18: Template Mode launch cleanup

- Temporarily hid the **Switch to Advanced** handoff and the remaining public **Advanced** navigation links. The `/advanced` route and workspace remain in the codebase for later activation.
- Documented the Render deployment source requirement and the hosted customer-upload path through the Render API, private R2 storage and MongoDB ownership records in `docs/runbooks/RENDER.md`.

This is the compact, chat-independent resume file. Product rules remain in `AGENTS.md` and `.planning/PROJECT.md`; scope and exit criteria remain in `.planning/ROADMAP.md`; detailed evidence remains in the Phase 04 plans, summaries, and validation files.

## Ten-template catalog implementation

- The public launch catalog now contains exactly ten version-one Seedance recipes in five supplied categories: mobile/electronics, food/restaurants, clothing/fashion, beauty/cosmetics, and real-estate/business services.
- The full internal creative catalog contains 60 recipes. The previous five launch templates remain resolvable for historical projects but are no longer public choices.
- MongoDB migration evidence on 2026-09-17: 10 published templates, 5 archived legacy templates, 5 retained legacy current versions, and 15 retained version documents total.
- Ten purpose-specific 1080x1350 JPEG posters are published under R2 `templates/v1/`. Premium Phone Reveal, Restaurant Food Hero Shot, and Fashion Product Showcase also have verified 8-second 720x1280 Seedance 2.5 MP4 previews, real video-frame posters, signed R2 reads, and matching SHA-256 checksums.
- The approved Perfume Advertisement and Real Estate Property preview requests were rejected before generation with Gateway `402 insufficient_funds` after the balance fell to USD 8.49; Vercel requires a minimum USD 10 balance before accepting another video request. No retries were made, and both cards remain honestly poster-only.
- Browser evidence covers all ten cards and R2 posters at 375, 768, 1024, and 1440 pixels with zero horizontal overflow; English/Arabic, light/dark, template selection, local upload, campaign settings, and review were checked. Generation was not submitted.
- Validation: 627 workspace tests passed, workspace type checks passed, production builds passed, and ESLint completed with zero errors and 20 existing Fast Refresh warnings.
- The user explicitly authorized one paid preview per category. Three paid previews completed; two uncharged submissions were rejected for insufficient balance. No Git commit, GitHub push, or deployment was made.
- Public template selection now shows only the three recipes with verified playable R2 previews. The seven poster-only recipes remain versioned internally for historical compatibility and can be exposed after matching previews are approved.

## Durable snapshot

- Branch: `codex/production-rebuild`
- Upstream: `origin/codex/production-rebuild`
- Preserved code snapshot: `d2ce4116ad5d2ac2ae9fbac3deabf6018dbfee01`
- At that snapshot, local hero tests, web typecheck, targeted lint, and the production web build passed.
- `.claude/`, `.codex/`, and `.gsd/` are pre-existing local tool directories. They are not project continuity artifacts and must remain unstaged.

## Exact current position

| Work | Status | Durable evidence |
|---|---|---|
| Phase 04-01: durable lifecycle, private output, truthful state | Complete | [`04-01-SUMMARY.md`](./phases/04-durable-generation-and-accepted-quality/04-01-SUMMARY.md) |
| Task 04-02-01: calibration import, schema, metrics, validator | Implemented | Commits `a8c859e`, `0d38c3c` |
| Task 04-02-02: calibrated acceptance and bounded retries | Implemented; automatic acceptance remains fail-closed without approved calibration | Commits `dab7fd2`, `fa84038`, `90f6f36` |
| Task 04-02-03: qualified-human Kuwait calibration | **Blocking and incomplete** | [`04-02-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-02-PLAN.md) |
| Phase 04-03: settlement proof and production canary | Not started | [`04-03-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-03-PLAN.md) |

Phase 04-02 and Phase 04 are not complete.

## Latest non-billable proof

Run on 2026-08-21 with the paid-provider confirmation variable removed:

```bash
env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run eval:phase04
```

Result: PASS — 9 provider tests; 39 worker tests passed with 2 intentionally skipped; 35 API tests; 2 database tests. No paid provider call was authorized or made.

## Blocking evidence that is absent

- `apps/worker/src/__fixtures__/kw-video-48-v1.calibration.json`
- `.planning/phases/04-durable-generation-and-accepted-quality/04-02-SUMMARY.md`
- `docs/runbooks/PHASE4_PAID_CANARY.md`
- `.planning/phases/04-durable-generation-and-accepted-quality/04-CANARY-EVIDENCE.md`

Automation cannot fabricate, duplicate, infer, or self-approve reviewer labels. Task 04-02-03 requires two genuinely independent qualified-human reviews per candidate, locked submissions, qualified adjudication, role attestations, exact checksums/versions, an authorized approval record, and validator-passing agreement/false-accept thresholds.

## Next safe action

1. Humans complete and approve the exact Task 04-02-03 calibration process.
2. Import that genuine evidence through the implemented validator and rerun the non-billable `eval:phase04` command above.
3. Only after exact-version calibration is approved may Phase 04-03 proceed.
4. Task 04-03-03 still requires a separate, new authorization in the form `Authorize one Seedance 2.5 canary up to USD <cap>`. Prior discussion, account balance, or calibration approval is not paid-call permission.

## Not proven

- Qualified-human calibration approval
- Phase 04-02 or Phase 04 completion
- A real Seedance 2.5 acceptance canary
- Production deployment or production readiness
- Live end-to-end settlement, restart, browser, and accepted-output evidence

## Safe resume read order

1. `AGENTS.md`
2. `.planning/PROJECT.md`
3. `.planning/STATE.md`
4. This `.planning/PROGRESS.md`
5. Phase 04 in `.planning/ROADMAP.md`
6. [`04-01-SUMMARY.md`](./phases/04-durable-generation-and-accepted-quality/04-01-SUMMARY.md)
7. [`04-02-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-02-PLAN.md)
8. [`04-03-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-03-PLAN.md)
9. [`04-VALIDATION.md`](./phases/04-durable-generation-and-accepted-quality/04-VALIDATION.md)

Repository files and Git history are authoritative. Codex chat history is not.

## 2026-10-14: Product With Model Ad — local implementation

- Implemented the separate custom form, versioned 8/15/20-second silent portrait recipes, reusable MongoDB/R2 brand kits, immutable campaign snapshots, exact branding layers and API/worker validation.
- Verified all 64 existing recipes against their unchanged serialized hash and all 14 existing forms against their original rendered markup. Existing previews and generation settings remain unchanged.
- Unpaid verification: 903 tests passed, 43 skipped; all workspace type checks and builds passed; lint has zero errors and the 20 existing warnings. Native local media tests preserve duration and remove audio. All 16 responsive English/Arabic/light/dark combinations fit within the viewport.
- Real MongoDB/R2 integration is unverified because the local Docker daemon is unavailable; the shared Atlas database was not used for tests. Seedance 1.0 compatibility was tested with mocked requests and cannot support this template's multiple references or 15/20-second variants.
- The user declined paid testing. No new preview or real provider generation was submitted; spend was USD 0. Public activation, preview publishing and deployment remain pending, and Phase 4 human-quality acceptance is unchanged.
- Detailed report: [`Product With Model Ad unpaid report`](./quick/2026-10-14-product-model-ad/SUMMARY.md).

## 2026-09-17: Four-category template discovery

- Added `new-york-billboard-takeover-v1` as master recipe 61 and public launch recipe 11, with four fixed scenes, identity constraints, deterministic overlay space, and English/Arabic catalog copy.
- Added typed discovery categories and replaced overlapping Shops/Ecommerce filtering with All, Electronics, Food, Ecommerce, and Advertising. Business verticals remain unchanged for campaign compatibility.
- Added the advertising poster/reference assets, R2 route and publishing support, MongoDB catalog metadata, and a guarded single-request Seedance generator.
- The one authorized advertising request was rejected before generation with `402 insufficient_funds` at USD 8.49; no retry occurred and no video was uploaded.
- Motion-preview activation remains fail-closed through `verified-preview-manifest.ts`. The Advertising category now exposes the verified poster-only New York Billboard Takeover recipe as a selectable template and labels its video preview as coming later; all other unapproved poster-only recipes remain hidden.
- Full workspace verification passed after the provider rejection: 635 tests passed with 34 intentional skips, all workspace type checks and builds passed, and ESLint reported zero errors with 20 existing Fast Refresh warnings.
- Browser verification passed at 375, 768, 1024, and 1440 pixels with no horizontal overflow; English/Arabic, light/dark, category filtering, and three playable previews were inspected. After enabling the poster-only Advertising recipe, 18 focused web tests, web typecheck, targeted ESLint, and the production web build passed. A live browser check confirmed four cards under All, one card under Advertising, and successful navigation to `/create?template=new-york-billboard-takeover`.
