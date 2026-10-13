# Template media

## Current jewelry animation (2026-10-13)

The selected preview is now `videos/v3/jewelry-product-showcase-animation.mp4`, published and checksum-verified at R2 `templates/v3/jewelry-product-showcase-animation.mp4`. Jewelry recipe v3 preserves the opening two beats, makes seconds 4–6 a pronounced diagonal reveal, and keeps camera and reflected light moving through seconds 6–8. The shared resolver no longer adds a conflicting frozen closing hold to this eight-second variant. The 15/20-second visual directions are unchanged.

The first 120 raw frames exactly match the previous local animation; the last 120 are all distinct. Media checks confirm 8 seconds, 720×1280, 30 fps, no audio. The complete supplied set remains visible in the closing composition. The adjacent prompt and JSON record the direction, source/output hashes and evidence. No provider calls or database writes occurred. The preview object is uploaded; selecting this revision on the hosted website still requires deploying the matching code.

## Previous local jewelry animation (2026-10-12, superseded)

The previous local jewelry preview is `videos/v2/jewelry-product-showcase-animation.mp4`, published at the matching `templates/v2/` R2 key. All 240 frames were animated locally from the user's `Downloads/gold.png`: four two-second beats following the then-current eight-second direction. It is 720×1280, 30 fps, exactly eight seconds, with no audio stream. No Seedance footage, AI calls or paid generation were used for that replacement. This revision and the previous preview below are historical and are no longer selected by template cards.

Reproduce the animation locally with `bun scripts/infra/animate-jewelry-template-preview.ts /absolute/path/to/gold.png`. The approved reference has SHA-256 `28be6ce118ee77bbb2a30e5a07acb4386089ca09a3e75a8bc9f0fed933876310`. Publishing is a separate step after media inspection: `bun run storage:publish-templates --template=jewelry-product-showcase`. See adjacent JSON for the output hash and four-shot timing.

## Previous jewelry preview (2026-10-12, superseded)

Jewelry Product Showcase has an 8-second, silent, 720×1280 preview at `videos/v2/jewelry-product-showcase.mp4` and R2 `templates/v2/jewelry-product-showcase.mp4`, explicitly associated with recipe v2. Its generated detail opening is followed by a photo-locked original-set ending: the raw model ending duplicated a bracelet and was not published. The v1 PNG poster is retained. See its adjacent JSON for checksums and finishing details.

The activation manifest now includes thirteen launch previews. The twelve older previews keep their original v1 keys. No 15/20-second jewelry preview is implied. The single-call tooling is `MOVPROMPT_CONFIRM_JEWELRY_DEMO=YES bun --env-file=.env scripts/infra/generate-jewelry-template-demo.ts`; it refuses existing dispatches/outputs and does not publish unreviewed media. Do not rerun a paid request without separate authorization.

The following earlier batch notes are historical, not the current catalog or balance.

The public catalog contains eleven image-first Seedance recipes: the ten supplied recipes plus New York Billboard Takeover. Their static posters are stored under `docs/template-demos/posters/v1/`.

The recipes live in `packages/creative-engine/src/catalog.ts`. The server compiler in `prompt-compiler.ts` combines the pinned recipe with confirmed campaign facts and subject-specific identity locks. Each project keeps its immutable template and prompt version. Historical versions remain in MongoDB when a template leaves the public launch set.

Read `TEMPLATE_PROMPTS.md` for all eleven scene plans. Results use the same scene order and visual direction, while generated pixels may vary.

Run `python3 scripts/infra/generate-template-posters.py` to recreate the original ten deterministic posters. Run `bun run storage:publish-templates` to upload and checksum-verify all current posters and verified preview videos in R2.

Three approved Seedance 2.5 motion previews currently live under `docs/template-demos/videos/v1/` and R2 `templates/v1/<template-id>.mp4`: Premium Phone Reveal, Restaurant Food Hero Shot, and Fashion Product Showcase. Perfume Advertisement and Real Estate Property Advertisement remain approved batch targets, but their first requests were rejected before generation because the Gateway balance fell below Vercel's $10 minimum. Those cards and the other sibling templates remain poster-only and display “Video preview coming later.”

New York Billboard Takeover is implemented as `new-york-billboard-takeover-v1`, with a neutral reference asset, poster, dedicated one-shot generation command and fail-closed discovery category. Its first authorized request was rejected before generation with `402 insufficient_funds` at a Gateway balance of USD 8.49. No retry occurred. The Advertising tab stays disabled and the card stays hidden until a separately authorized funded request uploads and verifies the MP4 and poster; successful verification updates the preview activation manifest.

The guarded `bun run templates:generate-category-demos` command requires `MOVPROMPT_CONFIRM_FIVE_CATEGORY_DEMOS=YES`, dispatches at most those five paid requests with zero provider retries, validates each MP4 with FFprobe, uploads it to R2, and verifies the stored checksum. Existing completed files and dispatch records prevent accidental repeat charges.

The separate `bun run templates:generate-advertising-demo` command requires `MOVPROMPT_CONFIRM_ADVERTISING_DEMO=YES`. A rejected or uncertain dispatch cannot retry automatically. The first insufficient-funds attempt is preserved under `artifacts/template-demos/`; only a separately authorized, previously uncharged retry can run by also setting `MOVPROMPT_RETRY_UNCHARGED_ADVERTISING_DEMO=YES`.

After funding, only an earlier `insufficient_funds` rejection can be resumed with both `MOVPROMPT_CONFIRM_FIVE_CATEGORY_DEMOS=YES` and `MOVPROMPT_RETRY_UNCHARGED_CATEGORY_DEMOS=YES`. Successful previews remain skipped, and every recovery attempt receives a separate dispatch and provider log.
