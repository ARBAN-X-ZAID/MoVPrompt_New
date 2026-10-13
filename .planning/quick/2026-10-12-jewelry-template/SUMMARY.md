# Jewelry Product Showcase — implementation and verification

Date: 2026-10-12

## Outcome

Implemented the user-approved black-studio jewelry advertisement as `jewelry-product-showcase`, selectable under Ecommerce in English and Arabic. Continued the previously authorized scoped GSD fallback because `/gsd-quick` is unavailable. Preserved the pre-existing query stamp modification and unrelated projects-go-live summary; no Git publication was performed.

- One selected subject photo, including a complete coordinated set in a single image. Exact piece count, arrangement, orientation, visible craftsmanship, metal/stone colors and existing engravings are locked. Missing photos, extra selections, unsupported roles/files and audio are rejected before quoting.
- Three versioned recipes: `jewelry-product-showcase-v2-8s`, `-15s`, `-20s`, with timings 2/2/2/2, 3/4/5/3 and 4/6/6/4 seconds. Close details progress through restrained glides, flowing reflections, full-item/set reveals and a stable closing hero; longer recipes are authored sequences rather than padded originals.
- No cloth/fabric, people/hands, artificial glitter, invented gemstones, unseen backs, transformed metal or new lettering. Muted worker requests use the existing server-configured Seedance 2.5 requirement and one prepared first frame. No model/key/settings replacement was introduced.
- Browser photo replacement preserves saved assets. Full-photo containment prevents cropping pieces out of the jewelry upload preview; this scoped change follows the UI/UX skill's consistent image-frame guidance.
- Graphify was used to locate the catalog/creator/provider relationships, then source and tests were inspected directly.

## Catalog and media

The shared catalog contains 13 launch templates, 39 duration variants and 63 total recipes. The other 50 internal recipes remain unchanged. Jewelry participates in the existing immutable `$setOnInsert` catalog publication path; historical versions and accepted outputs are retained.

The generated source is copied to `docs/template-demos/posters/v1/jewelry-product-showcase.png` (941×1672 PNG). Scoped publication:

```sh
bun run storage:publish-templates --template=jewelry-product-showcase
```

Published and verified only `templates/v1/jewelry-product-showcase.png` with SHA-256 `28be6ce118ee77bbb2a30e5a07acb4386089ca09a3e75a8bc9f0fed933876310`. Existing preview objects were not overwritten. The public route approves this exact PNG and rejects invented jewelry JPG/MP4 paths. Card/modal labels explicitly describe a static reference image, not a video preview. Database and API projection omit jewelry motion-preview metadata.

## Verification

- `bun run build:packages`: passed.
- `env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run test:workspaces`: passed, 798 tests; 49 skipped existing environment-dependent/gated cases. API projection, all three jewelry quotes, extra-photo/audio rejection, provider boundary, complete-set identity, prompt budgets, guest restoration and current template regressions covered.
- `bun run typecheck:workspaces`: passed.
- `bun run build:workspaces`: passed; existing large-chunk warning remains.
- `bun run lint`: zero errors, 20 existing Fast Refresh warnings.
- Final containment change: `bun run --cwd apps/web test --run src/features/create/templatePhotos.test.tsx` (10 passed), web typecheck/build and targeted ESLint passed.
- Sample prompt lengths with a confirmed jewelry name/CTA: 6,567 / 6,192 / 6,282 characters for 8/15/20 seconds, respectively; each leaves room within the existing 8,000-character provider contract for bounded retry instructions. Excessive confirmed facts remain rejected, never truncated.
- Rendered Playwright fixture flow: 16 combinations of 375/768/1024/1440 widths × English/Arabic × light/dark. Selected the published jewelry card, uploaded the PNG, checked one-file MIME restrictions and replacement, switched all three durations, verified selected 9:16, photo containment and RTL/theme state. Zero horizontal overflow/page errors. Reviewed representative mobile Arabic-dark and desktop English-light screenshots. Temporary evidence is `/tmp/jewelry-grid-<width>-<locale>-<theme>.png` and `/tmp/jewelry-create-<width>-<locale>-<theme>.png`; the fixture runner is `/tmp/movprompt-jewelry-ui-check.cjs`.

## Boundaries and release

Browser APIs were intercepted with isolated contract-validated catalog and capability fixtures; the real API/worker were not started. No live database writes, paid video requests, Git commit/push or deployment were made. The only external write was the explicitly scoped template poster upload/read-back verification.

Deploy matching web/API/worker artifacts together. Existing API runtime initialization publishes the new immutable catalog entry. Real provider output, jewelry identity/visual-quality acceptance and authenticated live billing remain separate verification gates; passing code/browser checks does not establish generated-media quality or production readiness.
