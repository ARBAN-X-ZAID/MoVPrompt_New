# Phase 3: Product and Service Golden Paths - Context

**Gathered:** 2026-08-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the beginner Template Mode journey for one real physical product and one real service business. This phase begins with link, upload, footage, or manual entry; lets the user confirm business facts; guides outcome, template, presenter, campaign settings, and final review; and hands the exact configuration to the Phase 1/2 quote, authentication, claim, and submission foundation. It does not implement provider output acceptance, editor rendering, campaign-pack exports, the production template catalog, Digital Twins, or Advanced Mode parity.

</domain>

<decisions>
## Implementation Decisions

### User and business outcome
- **D-01:** The primary user is a Kuwait business owner or staff member with no knowledge of prompts, models, timelines, codecs, or video editing.
- **D-02:** The user goal is to turn a real product or service into a truthful ready-to-generate campaign without re-entering information. The business goal is a support-free first completion path that demonstrates value before authentication.
- **D-03:** The top tasks are: add what is being promoted, confirm the facts, then choose the campaign result and generate. The next action must be understandable within five seconds on every screen.
- **D-04:** Phase success is measured by one complete product journey and one complete service journey preserving every selected and confirmed field through final review, authentication recovery, and submission.

### Source choice and fact confirmation
- **D-05:** The first screen asks one plain-language question: “What are you promoting?” It offers Product link, Business or service link, Upload photos or footage, and Enter details manually. Sample content is development-only and never presented as the user’s imported source.
- **D-06:** Product and service capture use source-specific fields but normalize into one campaign source and confirmed-fact contract before recommendations or generation. — **Reversibility:** costly — Changing the normalized contract later would require coordinated browser, API, persisted-version, claim, and generation-hash changes.
- **D-07:** After link import, the user sees a dedicated fact-review step before continuing. Each displayed fact carries one provenance value: Imported, Confirmed by you, or Added by you.
- **D-08:** Editing an imported value changes its provenance to Added by you. Selecting “Confirm details” changes unchanged imported values used by the campaign to Confirmed by you. The system never silently changes or invents facts.
- **D-09:** Product review prioritizes name, description, brand, price, offer, logo/colors, and product media. Service review prioritizes business/service name, description, service facts, location, booking link, WhatsApp number, price/offer, logo/colors, and real business media.
- **D-10:** Missing optional facts are visibly marked “Not added.” Required facts are minimal and depend on the chosen outcome; validation stays beside the field and preserves all entered values.
- **D-11:** Uploaded real footage is accepted as a source asset in this phase but is not presented as a presenter unless the user explicitly chooses Uploaded spokesperson and confirms person rights.

### Outcome, recommendation, and template truth
- **D-12:** Outcome is chosen before template for source-first users. Launch outcomes are WhatsApp orders, bookings, offer, launch, demonstration, education, announcement, trust or testimonial, and brand story.
- **D-13:** The creator shows up to three ranked recommendations first, each with a short “Why this fits” explanation based on vertical, outcome, available source media, presenter need, language, duration, and format. “Browse all templates” remains a secondary action.
- **D-14:** Template-first entry preserves the immutable selected template and asks for its required source inputs; source-first entry preserves confirmed facts and applies the selected recommendation. Both paths converge on the same draft contract and the same later screens.
- **D-15:** Every selectable template states expected result, required inputs, duration, supported delivery formats, presenter compatibility, preview type, and authoritative current cost state. Verified motion preview and static direction art remain visibly different.
- **D-16:** Play controls appear only for a verified template-specific motion preview. A static direction has no fake play icon, progress bar, or wording that implies a finished generated example.
- **D-17:** Development templates or unavailable combinations may be visible only when truthfully labeled and non-selectable. The golden paths prefer a smaller selectable set over a large misleading catalog.

### Presenter and campaign setup
- **D-18:** Presenter selection is a simple choice after template: No presenter, approved AI UGC presenter, or Uploaded spokesperson. No presenter is the default.
- **D-19:** AI UGC appears only when an approved cast and Arabic/English capability are actually available for that template. Uploaded spokesperson requires source footage plus explicit person-rights confirmation. Digital Twins stay hidden in v1.
- **D-20:** Campaign settings use progressive disclosure. Always show campaign language, outcome-specific CTA destination, tone, subtitles, audio, resolution, and ratio. Show price/offer when relevant, WhatsApp for order outcomes, and booking link/location for booking outcomes.
- **D-21:** Kuwait is fixed and explained rather than presented as a multi-country selector. KWD values use three decimal places. Interface language and campaign language remain independent.
- **D-22:** Defaults optimize first-time success: bilingual or current campaign language retained from the draft, subtitles on, audio on only when supported and useful, 720p recommended, 9:16 recommended, and no presenter unless explicitly chosen.

### Final review, states, and visual system
- **D-23:** Final review is a calm, scannable campaign summary, not a form dump. It groups Source, Campaign, Presenter and media, Delivery, Rights, and Price; every group has one Edit action returning to the exact relevant step.
- **D-24:** Review must show the actual selected template and preview truth, outcome, source, every confirmed fact used by generation, language, CTA destination, price, offer, presenter, format, resolution, audio, subtitles, rights state, and authoritative quote state.
- **D-25:** Generate remains disabled without a valid unexpired quote and required rights. Price retry, price change, worker pause, offline, upload failure, and unavailable capability retain the complete draft and present one clear recovery action.
- **D-26:** Every workflow state has one primary action and a safe secondary escape. Loading is honest and cancellable where the operation permits; empty and error states explain what happened and what to do next; success advances without a redundant confirmation screen.
- **D-27:** Reuse the creator shell, typography, spacing scale, calm neutral surfaces, amber action accent, semantic status colors, theme tokens, and RTL rules. The visual thesis is premium editorial restraint with the user’s product or business media as the dominant anchor—not a generic SaaS card dashboard.
- **D-28:** Motion is limited to step transitions, clear selection/focus feedback, and truthful loading/progress. Reduced-motion alternatives are mandatory.
- **D-29:** All labels remain visible, field errors are associated with fields, modals trap and return focus, status changes are announced, and touch targets remain at least 44 by 44 CSS pixels. Browser evidence covers 375, 768, 1024, and 1440 pixels in English/Arabic and light/dark.

### the agent's Discretion
- Exact component boundaries and whether the normalized fact editor is one reusable component or a small composed set.
- Exact recommendation scoring weights, provided the explanation is deterministic and testable.
- Exact responsive composition and restrained transition timings within the existing token system.
- Exact plain-language microcopy beyond the locked meanings above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and requirements
- `.planning/PROJECT.md` — Kuwait-first beginner product, locked business strategy, architectural constraints, and launch boundaries.
- `.planning/ROADMAP.md` § Phase 3 — phase goal, requirements, success criteria, and planned sequence.
- `.planning/REQUIREMENTS.md` § Business and Product Sources — SOURCE-01 through SOURCE-03.
- `.planning/REQUIREMENTS.md` § Template Mode and Campaign Setup — CREATE-01 through CREATE-10.

### Prior phase contracts
- `.planning/phases/01-production-truth-foundation/01-CONTEXT.md` — authoritative price, availability, progress, and no-simulated-success UX contract.
- `.planning/phases/02-guest-authentication-and-data-integrity/02-CONTEXT.md` — exact draft recovery, Generate-time authentication, private claim, and ownership contract.
- `.planning/phases/02-guest-authentication-and-data-integrity/02-VERIFICATION.md` — automated Phase 2 evidence and remaining human-provider verification debt that must not be represented as passed.

### Architecture and conventions
- `.planning/codebase/ARCHITECTURE.md` — portable creator data flow and source-import integration points.
- `.planning/codebase/STRUCTURE.md` — locations for creator UI, contracts, API routes, tests, and template media.
- `.planning/codebase/CONVENTIONS.md` — TypeScript, validation, security, ownership, and module conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/features/create/CreateStudio.tsx`: existing source, template, details, review, auth, progress, and editor orchestration; should be decomposed through focused helpers rather than expanded as another monolith.
- `apps/web/src/features/create/CreatorProgress.tsx`: accessible step progress foundation.
- `apps/web/src/features/create/TemplateGrid.tsx` and `TemplatePreviewDialog.tsx`: catalog discovery and preview truth boundaries.
- `apps/web/src/features/create/types.ts`: current project, source, campaign, media, presenter, ratio, and resolution types that need normalized fact provenance and the expanded outcome set.
- `apps/web/src/features/create/guestDraftStore.ts`, `guestClaimSnapshot.ts`, and `guestClaimRecovery.ts`: seven-day local draft, exact claim, and callback recovery foundation from Phase 2.
- `apps/web/src/lib/api/portableApiClient.ts`: portable source scan, template, project, quote, and render boundary.
- `apps/api/src/source-scanner.ts` and `remote-image-fetcher.ts`: hardened product/business import and media mirroring.
- `packages/creative-engine/src/catalog.ts`: Kuwait template recipes and recommendation inputs.

### Established Patterns
- Guest state stays in IndexedDB; authenticated PostgreSQL/project versions are authoritative.
- Public inputs and persisted configuration are Zod-validated; signed URLs are response-only.
- Quotes bind the complete immutable configuration and fail closed without runtime readiness.
- Template media distinguishes verified motion previews from static visual directions.
- UI reuses semantic theme variables, amber action emphasis, RTL direction, reduced motion, and plain recovery copy.

### Integration Points
- Extend shared contracts before browser state so source facts, provenance, campaign goals, presenter mode, and review payload stay consistent across web/API/claim/version/generation hashing.
- Normalize both template-first and source-first entry inside draft creation/recovery before recommendations are calculated.
- Keep Phase 3 submission on the existing Phase 1/2 quote and guest-claim services; do not add a parallel Generate path.
- Persist only stable asset metadata and normalized facts in project versions; do not persist remote, blob, or signed preview URLs.

</code_context>

<specifics>
## Specific Ideas

- The experience should feel like a high-end consumer product: calm, direct, media-led, and forgiving, while retaining MovPrompt’s existing brand rather than copying Apple or Higgsfield.
- Recommendations should answer “Why is this right for my goal?” without exposing model or provider language.
- Product and service journeys may ask different facts, but the user should feel they are using one coherent creation product.

</specifics>

<deferred>
## Deferred Ideas

- Provider output acquisition, technical/visual quality acceptance, retries, and settlement remain Phase 4.
- Project history, accepted/working version recovery, retry management, and dashboard consolidation remain Phase 5.
- Deterministic editor rendering and four-format campaign pack remain Phase 6.
- Eighteen rights-cleared production templates and database-published unique previews remain Phase 7.
- Full Arabic/RTL product localization and clinic commercial safeguards remain Phase 8, while Phase 3 still proves Arabic and bilingual golden-path behavior.
- Digital Twins remain v2 and are not exposed in this phase.

</deferred>

---

*Phase: 03-product-and-service-golden-paths*
*Context gathered: 2026-08-20*
