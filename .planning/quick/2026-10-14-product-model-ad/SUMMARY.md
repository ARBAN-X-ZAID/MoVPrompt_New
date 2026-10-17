# Product With Model Ad — unpaid implementation report

Date: 14 October 2026

## Outcome

The new template is implemented locally and available for review in an isolated development form. Unpaid code, request, browser and media-finishing checks passed. Production activation remains pending. No paid preview was generated, no live database was changed, and nothing was committed, pushed or deployed.

The user chose **Implement and run unpaid tests only**. Paid provider calls: **0**. Video-generation spend: **USD 0**.

## Implemented

- A separate Product With Model Ad form with versioned metadata for 24 fields. All existing templates continue using their original form component.
- Product name, category, confirmed details and 1–3 product photos. Presenter choice: one consistent illustrated adult or 1–3 uploaded adult references. Each model photo needs rights confirmation.
- Reusable brand kits: name, logo, two colors, tagline, description, audience, up to three selling points, style, font style, website and Kuwait WhatsApp contact.
- Owner-scoped MongoDB saving, immutable kit revisions, replay-safe saves and revision-conflict handling. Each campaign keeps its own snapshot; later library edits cannot change that campaign.
- Private R2 library logo copies that survive cleanup of the source campaign. Reuse verifies the checksum and attaches a campaign-owned copy. The logo stays out of AI references and is placed exactly during finishing.
- Studio/lifestyle settings and present/hold/wear actions with category validation. Opening message, main selling point, real offer, CTA and English/Arabic/bilingual message selection.
- Separate 8/15/20-second recipes, silent 9:16 output. Beat totals are 1/2/3/2, 3/4/5/3 and 4/6/6/4 seconds.
- Ordered product/model mappings in reference mode, with no competing first frame. The existing Vercel adapter is reused; provider settings remain server-side.
- Custom settings and kit snapshots persist through guest drafts and project versions and participate in quote identity and stable generation seeds.
- API preflight and worker revalidation of stored settings, ownership, checksums, roles, rights and model requirements. Oversized prompts or unreadable closing copy are rejected before charging; facts are never silently truncated.
- Deterministic opening/closing message layers, exact logo placement and audio removal. Existing templates keep their original finishing path.
- Offline catalog manifest and a guarded local-only catalog command. Public discovery and production initialization keep the new template gated while its verified preview is absent.

## Existing-template isolation

All **64 existing recipes** retain this serialized SHA-256:

`5b89b79ba366eb81b31061d7a9e9454e72ed1b4cf39353ce2f1c667a4405e5b5`

Rendered-markup comparisons for all **14 existing forms** passed. Their prompts, photo rules, durations, preview keys and provider choices remain unchanged.

Two test assumptions were corrected without changing their interfaces: the photo-policy test checks whether a policy supports character references; the homepage test follows its existing 13-card pagination and clicks the existing Show more action before expecting all 14 previews.

## Automated results

| Workspace | Passed | Skipped |
|---|---:|---:|
| Web | 314 | 11 |
| API | 196 | 25 |
| Worker, including native FFmpeg tests | 119 | 0 |
| Creative engine | 183 | 0 |
| Providers | 39 | 0 |
| Contracts | 13 | 0 |
| Database | 9 | 7 |
| Storage | 18 | 0 |
| Auth | 12 | 0 |
| **Total** | **903** | **43** |

All workspace type checks and builds passed. ESLint passed with **zero errors** and 20 existing Fast Refresh warnings. The existing large-chunk build warning remains. `git diff --check` passed.

The 32 database/API integration skips require a MongoDB test replica set. The local Docker daemon is unavailable, and the configured Atlas database is shared, so those tests were not redirected there. Brand-kit ownership, revisions, replay and transactional boundaries were checked with isolated fixtures. The other 11 skips are existing disabled project-deletion UI tests.

These results do not prove a live MongoDB/R2 claim or a production accepted output.

## Browser and media checks

The browser test uploaded the existing bottle photo and animated adult character from Downloads, selected the uploaded-model option, confirmed permission and validated all three durations. Generate stayed disabled before permission was checked. Generate in this isolated fixture compiles and validates only; it never submits an AI request.

The form, photo selection, model controls, brand-kit save state, duration changes and feedback were checked. All **16** width/language/theme combinations—375/768/1024/1440 pixels, English/Arabic and light/dark—fit within the viewport. Arabic direction was RTL. Keyboard navigation reached the named product field with visible focus. This is scoped accessibility evidence, not a full WCAG certification.

Screenshots: `output/product-model-ad/local-ui/`, including `final-desktop.jpg` and each width/language/theme capture.

Native FFmpeg tests used synthetic local clips containing audio. Finishing preserved 8/15/20-second duration and portrait dimensions while removing every audio stream. English/Arabic/bilingual message layers and verified-logo loading passed. Synthetic clips were not published as template previews.

## Seedance compatibility

The existing local **Seedance 1.0 Pro Fast** adapter passed an unpaid, mocked 8-second single-image request check. It correctly rejected 15/20 seconds, separate product/model references and substitution for a recipe requiring Seedance 2.5 before provider submission.

The full template uses the existing **Seedance 2.5 through Vercel** path. Its ordered-reference requests passed mocked checks for all three durations. No real Seedance generation was submitted, so generated-media quality remains unverified.

## Remaining release gates

1. Verify the new persistence/claim journey against an authorized isolated MongoDB replica set and private storage.
2. After spending authorization, generate and review the real 8-second preview. No automatic paid test retries.
3. Check generated duration, dimensions, silence, product/model identity, contact, exact branding and the complete timeline.
4. Publish the approved catalog and verified preview association, then activate the public card and deploy matching web/API/worker versions.

The project-wide Phase 4 human-quality acceptance gate remains incomplete. Existing accepted outputs and historical template versions were not modified.

## Local review

`http://127.0.0.1:8188/product-model-ad-test.html`

This development page is marked as an unpaid fixture, blocks other network requests and is excluded from the production build. The regular route is `create?template=product-with-model-ad`; it requires the matching published catalog and normal generation readiness, which were not changed on the shared database.
