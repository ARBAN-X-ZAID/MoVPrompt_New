# Template media

The public catalog contains eleven image-first Seedance recipes: the ten supplied recipes plus New York Billboard Takeover. Their static posters are stored under `docs/template-demos/posters/v1/`.

The recipes live in `packages/creative-engine/src/catalog.ts`. The server compiler in `prompt-compiler.ts` combines the pinned recipe with confirmed campaign facts and subject-specific identity locks. Each project keeps its immutable template and prompt version. Historical versions remain in MongoDB when a template leaves the public launch set.

Read `TEMPLATE_PROMPTS.md` for all eleven scene plans. Results use the same scene order and visual direction, while generated pixels may vary.

Run `python3 scripts/infra/generate-template-posters.py` to recreate the original ten deterministic posters. Run `bun run storage:publish-templates` to upload and checksum-verify all current posters and verified preview videos in R2.

Three approved Seedance 2.5 motion previews currently live under `docs/template-demos/videos/v1/` and R2 `templates/v1/<template-id>.mp4`: Premium Phone Reveal, Restaurant Food Hero Shot, and Fashion Product Showcase. Perfume Advertisement and Real Estate Property Advertisement remain approved batch targets, but their first requests were rejected before generation because the Gateway balance fell below Vercel's $10 minimum. Those cards and the other sibling templates remain poster-only and display “Video preview coming later.”

New York Billboard Takeover is implemented as `new-york-billboard-takeover-v1`, with a neutral reference asset, poster, dedicated one-shot generation command and fail-closed discovery category. Its first authorized request was rejected before generation with `402 insufficient_funds` at a Gateway balance of USD 8.49. No retry occurred. The Advertising tab stays disabled and the card stays hidden until a separately authorized funded request uploads and verifies the MP4 and poster; successful verification updates the preview activation manifest.

The guarded `bun run templates:generate-category-demos` command requires `MOVPROMPT_CONFIRM_FIVE_CATEGORY_DEMOS=YES`, dispatches at most those five paid requests with zero provider retries, validates each MP4 with FFprobe, uploads it to R2, and verifies the stored checksum. Existing completed files and dispatch records prevent accidental repeat charges.

The separate `bun run templates:generate-advertising-demo` command requires `MOVPROMPT_CONFIRM_ADVERTISING_DEMO=YES`. A rejected or uncertain dispatch cannot retry automatically. The first insufficient-funds attempt is preserved under `artifacts/template-demos/`; only a separately authorized, previously uncharged retry can run by also setting `MOVPROMPT_RETRY_UNCHARGED_ADVERTISING_DEMO=YES`.

After funding, only an earlier `insufficient_funds` rejection can be resumed with both `MOVPROMPT_CONFIRM_FIVE_CATEGORY_DEMOS=YES` and `MOVPROMPT_RETRY_UNCHARGED_CATEGORY_DEMOS=YES`. Successful previews remain skipped, and every recovery attempt receives a separate dispatch and provider log.
