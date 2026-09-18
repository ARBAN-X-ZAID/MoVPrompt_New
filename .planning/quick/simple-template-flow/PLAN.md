# Simple five-template creation flow

Status: one-private-bucket implementation approved and executed on 2026-09-15. The later explicit request authorized two new paid Salon/App demo videos; both are now complete. Keep changes local; no commit, push, deployment, or deletion of existing media. The previously approved GSD bypass remains applicable. The compact form/category redesign below is still remaining scope; current recipe compatibility and cinematic preview updates are documented in `../template-compatibility/SUMMARY.md`.

## Intended experience

Choose category → choose its single template → upload an image or import a URL → confirm a few details → Generate → watch preview → sign in to download → find the video in My Projects.

Category and template selection occupy one screen. Source and details occupy the next screen with a compact summary beside the Generate button. Remove the separate long facts/settings/review sequence from default Template Mode. Advanced Mode remains a separate workspace.

## Current implementation and remaining work

- The launch catalog already selects exactly five IDs. The current grid filters by business vertical rather than presenting the requested five categories.
- Predefined directions already live in `packages/creative-engine/src/catalog.ts`; `prompt-compiler.ts` assembles the generation prompt. Strengthen these into dedicated versioned recipes and ensure the server controls the visual recipe.
- `CampaignSetupStep.tsx` still shows five sections, including a disabled Kuwait selector, presenter controls, ratios, resolution, and audio/subtitle switches. `FactReviewStep.tsx` also renders empty optional fields. These cause unnecessary form length.
- R2-only storage, guest ownership, watermarking, account claiming, and project retrieval have local code. They require real R2 and end-to-end verification; code presence is not acceptance evidence.
- The funded perfume test produced a valid two-second video. It was text-to-video and does not prove uploaded-image fidelity or the full worker/R2/download flow.
- R2 account/access credentials are saved locally. Bucket names and the public preview domain are still missing. No credentials belong in this plan or public configuration.

## 1. Complete storage setup first

User selected one bucket, `movprompt`, on 2026-09-15. Its name is now configured in the ignored local `.env`. Use one private bucket with separate object prefixes for assets, outputs and approved template previews; serve demos through a narrow API route. No public R2 preview domain is required for this design. Preserve existing Gateway/MongoDB/auth/SMTP credentials.

```dotenv
R2_ASSETS_BUCKET=movprompt
R2_OUTPUTS_BUCKET=movprompt
R2_TEMPLATE_PREVIEWS_BUCKET=movprompt
R2_TEMPLATE_PREVIEWS_BASE_URL=
```

Before activation, remove the current distinct-bucket validation and mandatory public-domain requirement. Audit every bucket-based authorization assumption so media roles are distinguished by validated object prefixes and database ownership. Keep guest clean-master denial and authenticated ownership checks. Add a public API demo route restricted to the five approved template IDs, fixed versions, and video/poster types; it must never accept arbitrary customer object keys. Update frontend media URLs and the publication script to use this route or signed verification instead of a public R2 domain. Keep the bucket private. Validate CORS and scoped read/write credentials. Run `bun run storage:check` to check actual upload, checksum, private access, signed download, and probe deletion. Do not create resources or alter existing customer objects implicitly.

## 2. Write behavior tests before application edits

Cover five categories/one template each, conditional required fields, optional empty facts omitted, draft preservation, URL-import confirmation, reference-image validation, server-controlled recipe versions, and duplicate generation clicks. Extend guest/claim/security tests for the new UI journey rather than duplicating existing implementation tests.

Test authenticated retrieval after refresh/login, guest clean-master denial, concurrent/idempotent claiming, preservation after authentication cancellation/error/30-second timeout, and signed-URL renewal. Preserve existing durable queue, quotas, cleanup, and local-development bypass behavior.

## 3. Present exactly five categories

| Category | Single template | Default visual direction | Duration |
|---|---|---|---|
| Luxury products | Luxury Product Reveal | Cream pedestal, warm gold highlights, restrained reveal | 8 seconds |
| WhatsApp sales | WhatsApp Sales Ad | Clear product-first reveal and ordering close | 8 seconds |
| Food and beverage | Food and Beverage | Accurate food/drink detail and appetising natural light | 8 seconds |
| Salon services | Salon Booking Offer | Cream/blush editorial beauty film, warm gold fixtures and calm precision movement | 8 seconds |
| Apps and services | App/Service Promotion | Uploaded interface/service image on a phone, midnight navy studio and champagne rim light | 8 seconds |

Remove unrelated category filters, unnecessary search/show-more controls, extra template recommendations, and disabled premium/payment messaging from this five-choice flow. Each category shows its one template, preview availability, a short description, and a clear Use template button. Keep current colors and accessible selection states.

## 4. Define five reusable prompts

Shared rule: use the selected, verified image as the authoritative subject reference throughout. Preserve visible shape, proportions, colors, packaging, labels, logo, interface, and identity. The recipe controls setting, framing, camera, lighting, pacing, and transitions. Never infer facts, offers, scarcity, ingredients, results, or app functionality from a template. Use only user-confirmed facts. Leave safe space for factual copy; do not ask the video model to invent text or logos.

These are proposed base recipes; the compiler adds the selected reference, confirmed facts, duration, and supported output settings. No user-written prompt is required.

### Luxury Product Reveal

Create an eight-second vertical luxury reveal of the exact subject in the uploaded reference image. Place it in a restrained cream studio with a simple pedestal and warm gold edge lighting. Open on the recognizable subject, move gently toward an accurate material detail, and finish on a stable hero composition with clear negative space. Preserve its geometry, color, packaging and existing labels. Introduce no extra products, people, unsupported effects, claims or generated lettering.

### WhatsApp Sales Ad

Create an eight-second vertical sales video using the exact uploaded product as the hero. Open with a clear product view, use two controlled close/detail movements, and finish with a readable product composition and space for a WhatsApp ordering message. Keep the background clean and the motion energetic without obscuring identity. Include an offer only when confirmed by the user. Do not invent discounts, prices, availability, urgency, accessories or contact information.

### Food and Beverage

Create an eight-second vertical food or beverage video centered on the exact dish, drink or packaging in the uploaded image. Use appetising natural light, a gentle close-up of visible texture, and a clean final serving/product composition. Preserve the actual ingredients, portions, vessel, packaging and colors visible in the reference. Do not invent toppings, ingredients, steam, fizz, pouring actions or freshness claims that are unsupported by the supplied media and confirmed facts.

### Salon Booking Offer

Create a twelve-second vertical salon booking video from the supplied salon, service or real-work image. Establish the confirmed setting or service, reveal accurate visible details with calm camera motion and soft beauty lighting, and end on a clean composition with space for a booking invitation. Preserve the actual environment and supplied subject. Do not invent staff, customers, treatments, facilities, before/after results, prices or promotional promises. Do not fabricate a process that is absent from the reference.

### App/Service Promotion

Create a twelve-second vertical promotion using the uploaded app screenshot or service image. Introduce the real interface or service identity, emphasize one user-confirmed benefit through restrained framing and transitions, and end on a stable composition with space for a simple next step. Keep screenshot content and brand details unchanged. Do not redraw interface text, invent screens, interactions, features, testimonials or outcomes. Use motion around the supplied image when there is insufficient evidence for a real interaction.

Keep the executable recipes in `packages/creative-engine/src/catalog.ts` and their compiler in `packages/creative-engine/src/prompt-compiler.ts`. Record template ID/version, compiler/prompt version, confirmed facts and render parameters with each immutable project version. Reject incompatible reference inputs before provider submission. Verify the configured model's required image transport; the current adapter supplies an inline first-frame JPEG, which needs compatibility evidence or adjustment to a temporary signed R2 image URL.

Recipes target consistent visual direction; AI results are not pixel-identical reproductions of demo videos. Defaults such as “Today only”, “Made fresh”, and “Done in a few taps” must not become unconfirmed customer claims.

## 5. Replace the large form with necessary details

Show Upload image as the primary choice and Use a product/business link as the secondary choice. A URL must yield a verified image or ask for an upload; it cannot silently proceed without a usable reference. Prefill imported values and require confirmation of facts used in the output.

Always show the chosen image, an editable product/service name, and campaign language. Show only these additional fields when relevant:

| Template | Additional visible fields |
|---|---|
| Luxury | None required beyond image/name; optional short caption or offer |
| WhatsApp | WhatsApp number; optional confirmed offer |
| Food and beverage | Ordering destination only if the selected action promises ordering; optional confirmed offer |
| Salon | One booking destination: working booking link or WhatsApp number; optional confirmed offer |
| App/Service | One short confirmed benefit; optional website/app link |

Use clear labels such as “What are you promoting?”, “Video language”, “WhatsApp number”, “Where can customers book?”, and “Offer (optional)”. Do not ask for the same contact or offer twice. Use the confirmed name as the identity when a separate brand/logo is unnecessary; align server required-input checks with the minimal form.

Put description, logo, brand color, and optional location inside Add optional details. Omit empty values rather than generating facts. Keep customer-product price and all payment/token controls absent for this development flow.

Apply Kuwait, vertical 9:16, template duration, and supported 720p defaults internally. Remove market, presenter, scene/camera controls, ratio/resolution selectors, and unavailable audio/subtitle switches from the default form. Keep the existing configured model unless compatibility evidence requires a change. Do not promise music, speech or subtitles from the currently tested silent model; audit and align recipe capabilities, compiler and worker behavior accordingly without introducing another provider.

Finish with one compact summary, image-rights confirmation, and Generate video button. Keep labels, inputs and helper messages aligned; use mobile single-column layout, keyboard focus, near-field errors and visible progress. Existing colors remain, with modest motion respecting reduced-motion preferences.

## 6. Save and claim generated videos

Authenticated: verified image → private R2 asset → MongoDB project/version/job → worker/Gateway → private R2 clean master and watermarked preview → MongoDB stable media keys → My Projects.

Guest: the same pipeline saves media to R2 immediately under server-issued guest ownership. Show only the watermarked preview. Download opens sign-in/signup. Successful authentication transactionally claims the unexpired projects and resumes the original download. Claiming changes ownership; it does not regenerate or unnecessarily copy the video to another R2 folder. MongoDB ownership predicates protect the stable object keys, and My Projects is the user's logical library.

Keep retries/idempotency, active-render claiming recovery, seven-day unclaimed retention, race-safe cleanup and native ObjectId storage. Account authentication has a 30-second success/error deadline and preserves the original project on failure or cancellation. Local application payment and guest quotas stay disabled; actual Gateway use still consumes provider credits.

## 7. Use the existing funded video for one testing preview

Inspect and use `artifacts/gateway-smoke/single-funded-test-1789460045236.mp4` for Luxury Product Reveal, extract a matching poster, and update the publication manifest. Label it as a short testing example; it is not an eight-second image-fidelity acceptance result. Match the proposed Luxury visual recipe to its cream/gold direction.

Keep semantically matching existing media for the other categories, with illustrative App/Service and Salon guides clearly identified. Never reuse the perfume video as an unrelated category's demo. No additional paid demo videos are authorized. Publish approved videos/posters through the updated `bun run storage:publish-templates` command into the private `movprompt` bucket when implementation/publication is approved. Runtime previews are served from R2 through the restricted API demo route, with clear unavailable states instead of local fallbacks.

## 8. Verify and deliver

2026-09-15 save-boundary repair: browser image UUIDs now correlate with canonical MongoDB asset ObjectIds throughout upload/completion, resumed claims, and persisted image references. Edited unfinished drafts start a new immutable claim intent against the same project, preserving prior attempt history. MongoDB and real R2 image upload/checksum/finalize/private retrieval checks passed. See `../campaign-save-objectid/SUMMARY.md`. No additional paid generation was submitted.

Run affected tests, workspace type/build checks and lint. Manually test all five category flows, image and URL sources, required-field errors, duplicate clicks, generation progress/failure, preview playback, signup/sign-in/download recovery, My Projects refresh/login, deletion and signed-URL renewal. Check English/Arabic, light/dark, and 375/768/1024/1440 widths.

After R2 activation and separate approval for a paid uploaded-image generation test, verify browser → API → MongoDB → durable worker → Gateway → R2 → account claim → downloaded video. Inspect the reference fidelity, saved master, watermark and actual downloaded file. Do not issue more paid calls under the earlier one-test authorization. Report passed checks separately from credential-dependent or provider-dependent checks.

Update this plan's progress and setup documentation during approved implementation. Acceptance requires the real complete journey, not mocked tests alone.

## Pending answers

1. Answered: five reusable prompts and existing demos. No additional paid demo videos are requested or authorized.
2. Answered: one bucket named `movprompt`, private with approved demos served through the API. No public preview domain is needed. Existing credentials and all three bucket settings are configured in the ignored `.env`; one-bucket runtime validation, demo API routes and publication tooling are implemented.

## One-bucket delivery evidence

- Storage regression tests were written first and reproduced the mandatory-preview-domain failure before implementation.
- The live `bun run storage:check` passed signed upload/download, checksum/metadata, unsigned protocol read denial, and deletion of its unique temporary probe against `movprompt`.
- All five existing demo videos and posters were uploaded to `templates/v1/` and verified by private signed reads. Luxury uses the previously funded two-second perfume result; no paid generation was performed.
- Public demo routes allowlist fixed v1 filenames only. They redirect to temporary signed URLs with no-store; customer media uses the existing database ownership checks.
- Browser testing found API ObjectIds were being matched against local slugs, making non-Luxury templates inherit Luxury media. A failing regression test was added, then the mapper was fixed to match the published slug while retaining the MongoDB ID. Salon now plays its own 12-second 480x854 guide, with no media error. All ten demo/poster API reads returned 200; unknown demo names returned 404. CORS redirect regression passed.
- Worker startup exposed another obsolete public-domain requirement in provider readiness. Its local-profile test reproduced the failure, then the requirement was removed. After restart the worker started successfully; `/api/v1/health` returned 200 with MongoDB/R2/generation-runtime dependencies healthy, and generation availability reported ready. No video-generation request was submitted for this verification. Test servers were stopped afterward to leave local ports available for the user.
- Existing asset/output paths distinguish assets and outputs inside each owner/project namespace. Shared-bucket cleanup enumerates that namespace once and never touches demos.
- Workspace tests/builds and lint passed. Lint retains 20 existing warnings; opt-in Mongo integration suites remain outside the standard test run. Browser Luxury preview loaded and played fully (480x864, 2.041667 seconds, no media error).
- The complete uploaded-image generation/account-claim/download journey was not rerun, because no new paid generation is authorized.
