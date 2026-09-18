# Completed locally — 2026-09-15

## Findings and fixes

- Hidden `logo_or_brand_name` requirements rejected otherwise valid image campaigns. All five launch recipes now publish version 3 with optional brand names and offers. Image/name/CTA remain required, and actual WhatsApp/booking destinations remain required for those campaign goals.
- Public catalog records use ObjectIds, but browser recipe lookup/create URLs use slugs. The mapper now returns the slug, preventing App/Salon selections from falling back to Luxury.
- Changing templates retained unsupported campaign purposes. Selection now preserves a purpose only when the new recipe supports it; confirmed business facts/images stay intact.
- Fixed visual directions and durations replace stale draft visual instructions at generation assembly. Briefs persist recipe/prompt version, visual system and scene snapshot. The API checks published version-3 visual snapshots against MongoDB before quote/start. Legacy versions remain stored.
- Vite workspace prebundling retained old recipe data after builds. Excluding contracts/creative-engine from dependency optimization makes local updates visible.
- Empty image-required templates start with photo upload rather than manual service entry.

## Approved two-video batch

Exactly two paid image-to-video calls completed; no paid retries or extra customer generation. The currently configured Seedance v1 pro fast model was preserved. Each Gateway balance delta was $0.1648; total $0.3296.

- Salon: cream/blush salon interior, warm gold details, restrained camera movement.
- App/Service: supplied interface on a smartphone, midnight-navy studio, ivory pedestal, champagne rim and blue halo.
- Both videos: H.264, 704×1248, approximately 8.042 seconds, muted. Source images, exact compiled prompts and sanitized manifests are saved under `docs/template-demos/`.
- Published new media at `templates/v3/{id}.mp4/.jpg` in private R2 bucket `movprompt`, verified signed reads against SHA-256. Older v1 media remains stored. The narrow API demo allowlist permits only these two v3 demos.
- Inspected frames across both videos and their browser previews. Salon's Use template link opens the correct service/upload creator.

## Verification

- Tests were added and observed failing before the initial recipe fix, ID mapping fix and v3-preview route implementation.
- Creative-engine: 25 passed.
- Web: 220 passed; build/typecheck passed.
- API: final standard suite 139 passed, 8 opt-in Mongo tests skipped; focused generation-service suite 42 passed and demo-route suite 4 passed.
- Worker: 73 passed, 2 skipped. Workspace typechecks passed; latest API/web checks passed. Lint: 0 errors, 20 existing Fast Refresh warnings. Build retains the existing large-chunk warning.
- The reported `c9a2985b-3166-4d5f-8114-c2c1e039286a` campaign passes server-pinned recipe estimation, shows Ready to generate in the browser, and reached enabled Generate campaign after review without another paid call.

The complete customer upload → durable worker → quality review → account claim → clean download journey was not rerun in this task. The approved paid batch tested the two demo generations directly through Gateway and R2 publishing. Do not describe this as full production acceptance.

Different images preserve the chosen recipe/style; AI pixels and motion cannot be guaranteed identical. The larger compact-form/category redesign in the earlier plan remains unfinished. No GitHub push, commit, deployment, purchase/top-up or media deletion occurred.
