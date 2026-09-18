# Phase 3: Product and Service Golden Paths - Research

**Researched:** 2026-08-20  
**Domain:** Truth-preserving, beginner Template Mode flows across React, shared Zod contracts, Hono source import, and durable guest claims  
**Confidence:** HIGH for the existing integration surface; MEDIUM for UX implementation guidance

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The primary user is a Kuwait business owner or staff member with no knowledge of prompts, models, timelines, codecs, or video editing.
- **D-02:** The user goal is to turn a real product or service into a truthful ready-to-generate campaign without re-entering information. The business goal is a support-free first completion path that demonstrates value before authentication.
- **D-03:** The top tasks are: add what is being promoted, confirm the facts, then choose the campaign result and generate. The next action must be understandable within five seconds on every screen.
- **D-04:** Phase success is measured by one complete product journey and one complete service journey preserving every selected and confirmed field through final review, authentication recovery, and submission.
- **D-05:** The first screen asks one plain-language question: “What are you promoting?” It offers Product link, Business or service link, Upload photos or footage, and Enter details manually. Sample content is development-only and never presented as the user’s imported source.
- **D-06:** Product and service capture use source-specific fields but normalize into one campaign source and confirmed-fact contract before recommendations or generation. — **Reversibility:** costly — Changing the normalized contract later would require coordinated browser, API, persisted-version, claim, and generation-hash changes.
- **D-07:** After link import, the user sees a dedicated fact-review step before continuing. Each displayed fact carries one provenance value: Imported, Confirmed by you, or Added by you.
- **D-08:** Editing an imported value changes its provenance to Added by you. Selecting “Confirm details” changes unchanged imported values used by the campaign to Confirmed by you. The system never silently changes or invents facts.
- **D-09:** Product review prioritizes name, description, brand, price, offer, logo/colors, and product media. Service review prioritizes business/service name, description, service facts, location, booking link, WhatsApp number, price/offer, logo/colors, and real business media.
- **D-10:** Missing optional facts are visibly marked “Not added.” Required facts are minimal and depend on the chosen outcome; validation stays beside the field and preserves all entered values.
- **D-11:** Uploaded real footage is accepted as a source asset in this phase but is not presented as a presenter unless the user explicitly chooses Uploaded spokesperson and confirms person rights.
- **D-12:** Outcome is chosen before template for source-first users. Launch outcomes are WhatsApp orders, bookings, offer, launch, demonstration, education, announcement, trust or testimonial, and brand story.
- **D-13:** The creator shows up to three ranked recommendations first, each with a short “Why this fits” explanation based on vertical, outcome, available source media, presenter need, language, duration, and format. “Browse all templates” remains a secondary action.
- **D-14:** Template-first entry preserves the immutable selected template and asks for its required source inputs; source-first entry preserves confirmed facts and applies the selected recommendation. Both paths converge on the same draft contract and the same later screens.
- **D-15:** Every selectable template states expected result, required inputs, duration, supported delivery formats, presenter compatibility, preview type, and authoritative current cost state. Verified motion preview and static direction art remain visibly different.
- **D-16:** Play controls appear only for a verified template-specific motion preview. A static direction has no fake play icon, progress bar, or wording that implies a finished generated example.
- **D-17:** Development templates or unavailable combinations may be visible only when truthfully labeled and non-selectable. The golden paths prefer a smaller selectable set over a large misleading catalog.
- **D-18:** Presenter selection is a simple choice after template: No presenter, approved AI UGC presenter, or Uploaded spokesperson. No presenter is the default.
- **D-19:** AI UGC appears only when an approved cast and Arabic/English capability are actually available for that template. Uploaded spokesperson requires source footage plus explicit person-rights confirmation. Digital Twins stay hidden in v1.
- **D-20:** Campaign settings use progressive disclosure. Always show campaign language, outcome-specific CTA destination, tone, subtitles, audio, resolution, and ratio. Show price/offer when relevant, WhatsApp for order outcomes, and booking link/location for booking outcomes.
- **D-21:** Kuwait is fixed and explained rather than presented as a multi-country selector. KWD values use three decimal places. Interface language and campaign language remain independent.
- **D-22:** Defaults optimize first-time success: bilingual or current campaign language retained from the draft, subtitles on, audio on only when supported and useful, 720p recommended, 9:16 recommended, and no presenter unless explicitly chosen.
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

### Deferred Ideas (OUT OF SCOPE)
- Provider output acquisition, technical/visual quality acceptance, retries, and settlement remain Phase 4.
- Project history, accepted/working version recovery, retry management, and dashboard consolidation remain Phase 5.
- Deterministic editor rendering and four-format campaign pack remain Phase 6.
- Eighteen rights-cleared production templates and database-published unique previews remain Phase 7.
- Full Arabic/RTL product localization and clinic commercial safeguards remain Phase 8, while Phase 3 still proves Arabic and bilingual golden-path behavior.
- Digital Twins remain v2 and are not exposed in this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| SOURCE-01 | Start from product URL, business/service URL, photos, real footage, or manual entry. | Normalize the existing scanner, guest assets, and a new manual/footage source branch before recommendation. |
| SOURCE-02 | Review/correct business facts. | Contract-first fact array with source-specific field definitions and editable provenance. |
| SOURCE-03 | Mark every business fact imported, user-confirmed, or manually entered. | Existing `ConfirmedFactSchema` is the correct seed; carry it through draft, version, claim, quote, and review. |
| CREATE-01 | Complete Template Mode without technical generation terminology. | Keep provider/capability identifiers out of new UI; reuse semantic quote and template surfaces. |
| CREATE-02 | Converge product-first and template-first without loss. | One normalized draft plus a pure convergence test matrix. |
| CREATE-03 | Choose every locked outcome. | Extend the shared outcome taxonomy before UI labels, filtering, and creative-engine validation. |
| CREATE-04 | Receive evidence-based template recommendations. | Deterministic ranking helper with input-based explanation and an explicit fallback. |
| CREATE-05 | See truthful selectable-template details and cost state. | Extend view model with requirements, delivery/presenter support, selectability and quote state. |
| CREATE-06 | Keep motion previews truthful. | Retain the existing verified-motion/static-direction separation and test it at recommendation/review entry. |
| CREATE-07 | Choose allowed presenter modes only. | Make availability data-driven; keep Digital Twins absent from the Template Mode selector. |
| CREATE-08 | Set Kuwait/localized campaign settings. | Outcome-aware settings form, KWD validation/formatting, preserved independent UI/campaign language. |
| CREATE-09 | Review exact configuration and price. | Build grouped review from the normalized draft, not a second summary model. |
| CREATE-10 | Provide clear tasks plus complete interaction states. | Define per-step state model and browser/test matrix before implementation. |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Use the existing React/Hono/PostgreSQL/Better Auth/pg-boss/S3 architecture; do not redesign it.
- Parse untrusted input with Zod, preserve owner-scoped authenticated mutation rules, use idempotency where a mutation can duplicate state, and never persist signed URLs.
- Keep provider model IDs server-only; guest blobs remain in IndexedDB until checksum-verified server upload succeeds.
- Follow TypeScript conventions: semicolons, double quotes, trailing commas, two-space indentation, explicit dependency factories, Zod schemas, and server-side `.js` ESM imports.
- UI planning must preserve the established creator shell/tokens rather than introduce a new visual language. It must cover visible labels, field-associated errors, focus handling, accessibility, responsive rendering, light/dark, English/Arabic, and browser evidence.
- Use the repository’s GSD execution workflow; only the Phase 03 research artifact is changed by this research task.

## Summary

Phase 3 should be a contract-first vertical slice, not a rebuild of creation or generation. The repository already has a protected URL scanner, durable guest asset claim, source-fingerprint invalidation, server-issued quote, and Generate-time authentication. The new work is to make source choice, fact provenance, source-specific review, outcome-first recommendations, presenter eligibility, campaign setup, and final review all operate on one normalized configuration. [VERIFIED: `apps/api/src/source-scanner.ts:229-283`; `apps/web/src/features/create/guestDraftStore.ts:210-238`; `apps/web/src/features/create/projectStore.ts:91-203`; `apps/web/src/features/create/CreateStudio.tsx:1034-1191`]

The existing creator proves useful foundations but cannot meet the phase unchanged: it has three source tabs, displays a sample product to users, uses one broad details form, has no dedicated fact-confirmation state, and serializes a narrower product/campaign shape than the locked contract requires. The current shared source kind and fact provenance enums are the correct starting point, but the goal, product, template, and project view models must expand together before a UI split. Existing values, quoted verbatim: `"product_url", "business_url", "product_upload", "service_manual", "real_footage"`; `"imported", "user_confirmed", "manual"`; and `"whatsapp_orders", "bookings", "launch", "offer", "demonstration", "trust"`. [VERIFIED: `packages/contracts/src/creator.ts:9-29`; `packages/contracts/src/creator.ts:299-325`; `apps/web/src/features/create/types.ts:75-125`; `apps/web/src/features/create/CreateStudio.tsx:1527-1587`]

**Primary recommendation:** Extend the shared normalized campaign contract and its pure mapping/validation tests first; then replace the current `source → template → details` orchestration with small source, facts, outcome/recommendation, setup, and review steps that all read/write that one contract and call the existing guest-claim/quote/submit path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Source choice, manual entry, fact editing, recommendation explanation, setup, review | Browser / Client | API / Backend | The browser owns progressive disclosure and draft interaction; it must not invent or transform source facts. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:1525-1606`] |
| URL import and public-web safety | API / Backend | Browser / Client | The API owns bounded public fetch, URL policy, redirect/DNS validation, and rate limits; the browser only submits a URL. [VERIFIED: `apps/api/src/source-scanner.ts:229-283`; `apps/api/src/creator-routes.ts:503-549`] |
| Fact/source/provenance contract | Shared contracts | Browser / Client, API / Backend | Zod contracts are the safe boundary used by UI and the scan response. [VERIFIED: `packages/contracts/src/creator.ts:295-328`] |
| Draft, immutable version, guest claim, and quote binding | Database / Storage | API / Backend, Browser / Client | The claim snapshot and project-version payload preserve canonical configuration while private objects remain server-owned. [VERIFIED: `apps/web/src/features/create/guestClaimSnapshot.ts:27-40`; `apps/web/src/features/create/projectStore.ts:157-203`] |
| Template eligibility and recommendation inputs | Shared creative engine | Browser / Client | The engine/catalog is the source of template capabilities; client ranking turns those facts into an explainable order. [VERIFIED: `packages/creative-engine/src/types.ts:63-94`; `packages/creative-engine/src/catalog.ts:179-209`] |
| Template preview truth | Browser / Client | CDN / Static | The UI may play only the catalogued verified clip and must visibly distinguish static direction artwork. [VERIFIED: `apps/web/src/features/create/templateMedia.ts:13-88`; `apps/web/src/features/create/TemplateGrid.tsx:258-305`] |

## Standard Stack

### Core

| Library / system | Current version | Purpose in Phase 3 | Why standard here |
|---|---:|---|---|
| React + TypeScript | 18.3.1 / 5.9.3 | Controlled multi-step creator state and accessible form rendering. | It is the existing web runtime; retain a single controlled draft rather than adding another form library. [VERIFIED: `apps/web/package.json:66-95`] |
| Zod shared contracts | 4.4.3 | Validate normalized source/facts/templates at public boundaries. | Existing contracts already define source scanning, template, and project-version boundaries. [VERIFIED: `apps/web/package.json:79-95`; `packages/contracts/src/creator.ts:62-328`] |
| Hono API + source scanner | 4.12.32 | Keep link imports behind the existing server safety boundary. | Do not expose remote fetch or parsing to the browser. [VERIFIED: `apps/api/package.json:17-35`; `apps/api/src/source-scanner.ts:229-283`] |
| Existing guest draft, claim, project version, and quote services | workspace code | Preserve configuration across auth and accepted submission. | These already implement the Phase 1/2 authority boundary. [VERIFIED: `apps/web/src/features/create/guestDraftStore.ts:210-238`; `apps/web/src/features/create/projectStore.ts:225-303`] |

### Supporting

| Existing component/system | Purpose | When to use |
|---|---|---|
| `CreatorProgress` | Accessible step position. | Reuse with the expanded step list; do not draw a second progress component. [VERIFIED: `apps/web/src/features/create/CreatorProgress.tsx:7-45`] |
| Existing dialog primitive | Preview, auth, and rights/focus handling. | Use for verified preview only and any modal-level confirmation; preserve focus return. [VERIFIED: `apps/web/src/features/create/TemplatePreviewDialog.tsx:23-62`] |
| Vitest + Testing Library + jsdom | Component/contract regression coverage. | Use for deterministic flow, state, and accessibility assertions before browser QA. [VERIFIED: `apps/web/vitest.config.ts:5-20`; `apps/web/package.json:81-95`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| A normalized in-repo contract | A separate wizard-state library | Do not add one: the phase’s costly boundary must already serialize through guest draft, claim snapshot, project version, quote configuration, and generation recipe. [VERIFIED: `apps/web/src/features/create/contracts.ts:56-138`; `apps/web/src/features/create/projectStore.ts:178-203`] |
| Existing scanner/mirror | Client-side scraping or a second importer | Do not add one: it would bypass public-address, redirect, size, content-type, and rate-limit policy. [VERIFIED: `apps/api/src/source-scanner.ts:236-281`; `apps/api/src/creator-routes.ts:503-549`] |
| Existing dialog/video truth model | Generic preview cards or simulated player chrome | Do not add one: static directions already use a details link while verified media alone gets Play. [VERIFIED: `apps/web/src/features/create/TemplateGrid.tsx:286-305`] |

**Installation:** None. This phase should install no external package.  
**Package Legitimacy Audit:** Not applicable—no package is recommended for installation.

## Architecture Patterns

### System Architecture Diagram

```text
Entry: /create (source-first)             Entry: /create?template=… (template-first)
             |                                          |
             v                                          v
 [Source chooser: link / photos-footage / manual]   [Immutable chosen template]
             |                                          |
             +----------> [Normalized campaign draft] <+
                                  |
                     URL only -->|--> API source scanner --> imported facts/media candidates
                                  |                         (public-network policy + rate limit)
                                  v
                       [Fact review + provenance]
                                  |
                                  v
                 [Outcome -> deterministic recommendations]
                                  |
                                  v
                    [Template + presenter + campaign setup]
                                  |
                                  v
       [Final grouped review + authoritative quote/recovery state]
                                  |
                       Generate / auth handoff
                                  v
      Existing IndexedDB guest draft -> claim -> private assets/project version -> quote -> submit
```

The scanner must remain the sole URL-import boundary: it validates public HTTP(S), reads bounded HTML through the shared policy, extracts facts, and returns user-review warnings. [VERIFIED: `apps/api/src/source-scanner.ts:236-281`]

### Recommended Project Structure

```text
packages/contracts/src/
├── creator.ts                 # normalized fact/source/presenter/template display schemas
apps/web/src/features/create/
├── campaignFacts.ts           # pure provenance and requirement helpers
├── recommendationEngine.ts    # deterministic score + “Why this fits” output
├── SourceChoiceStep.tsx       # link, photos/footage, manual choice
├── FactReviewStep.tsx         # source-specific editable facts
├── CampaignSetupStep.tsx      # presenter and progressive settings
├── CampaignReviewStep.tsx     # grouped review and exact-step Edit actions
└── CreateStudio.tsx           # route orchestration, existing persistence/claim/quote handoff
packages/creative-engine/src/
└── types.ts / catalog.ts      # capability and template metadata supporting selection
```

The filenames are implementation recommendations, not existing files. Keep `CreateStudio.tsx` as orchestration because it already owns draft restore, quote retrieval, claim, and submission; move new pure/domain UI out rather than enlarging its 1,609-line surface. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:238-455`; `apps/web/src/features/create/CreateStudio.tsx:1504-1609`]

### Pattern 1: One normalized source/fact contract before recommendations

**What:** Add a shared schema representing source kind, every factual field used by campaign output, its provenance, asset role, rights state, and selected value. Map scanner output, manual entry, photos, and footage into this contract. Keep source-specific field definitions as UI metadata, not independently persisted shapes.

**Why:** `ConfirmedFactSchema` already establishes the correct three-way provenance. Verbatim existing contract: `provenance: z.enum(["imported", "user_confirmed", "manual"])`. The current `CreatorProduct` only has `sourceType`, `sourceUrl`, `name`, `description`, `price`, `brand`, and `images`, while service fields live separately on the project; that cannot retain every required fact as a reviewable provenance-bearing field. [VERIFIED: `packages/contracts/src/creator.ts:299-315`; `apps/web/src/features/create/types.ts:75-125`]

**Implementation rule:** A user edit creates a new fact object with the entered value and `manual` provenance; “Confirm details” only transitions untouched imported campaign facts to `user_confirmed`. Do not overwrite source values in-place and do not derive provenance from visual state. [VERIFIED: `packages/contracts/src/creator.ts:299-315`]

```ts
// Pattern skeleton — new identifiers are intentionally descriptive, not a copied API.
type NormalizedCampaignFact = {
  field: FactField;
  value: string;
  provenance: FactProvenance;
};

function updateFact(draft: NormalizedCampaignDraft, change: FactChange) {
  // return a new draft; preserve all unrelated facts and assets
}
```

### Pattern 2: Contract migration is a vertical boundary, not a browser-only type change

**What:** Update contracts, web draft serializer/restorer, portable project mapper, project/claim recipes, quote configuration, and creative brief together in the first plan wave.

**Why:** The existing pipeline serializes the project into `configuration.creatorProject`, `productRecipe`, `campaignRecipe`, and a generation `creativeBrief`, then later rehydrates it. Existing code explicitly clears volatile URLs from stable configuration. [VERIFIED: `apps/web/src/features/create/projectStore.ts:157-203`; `apps/web/src/features/create/portableProjectMapper.ts:18-87`]

**Required outcome taxonomy decision:** the live contracts currently quote only `"whatsapp_orders", "bookings", "launch", "offer", "demonstration", "trust"`; the locked Phase 3 outcomes add education, announcement, and brand story. Extend the common enum and the creative-engine goal validation in the same change, then update every exhaustive map (labels, template media tones, catalog recipe typing, and filtering). [VERIFIED: `packages/contracts/src/creator.ts:21-29`; `packages/creative-engine/src/types.ts:63-106`; `apps/web/src/features/create/templateMedia.ts:90-109`]

### Pattern 3: Pure, deterministic recommendation view model

**What:** Implement one pure function that receives normalized facts/source assets, chosen outcome, campaign language/format, presenter need, and published template facts; returns at most three selectable recommendations plus a concise explanation for each. It must be stable for identical input.

**When to use:** Source-first after fact confirmation; template-first uses the selected template as immutable, skips replacement, and reports required missing inputs from the same view model.

**Rules:**

- Rank only selectable combinations. If no combination is selectable, show the complete reason and a single recovery path (change outcome, add required asset, or choose another template); never silently pick a different template. [VERIFIED: `packages/contracts/src/creator.ts:62-113`; `apps/web/src/features/create/TemplateGrid.tsx:72-102`]
- Build the “Why this fits” sentence from explicit score reasons, never from model/provider language. [ASSUMED]
- Treat template metadata as server/catalog facts. The current public schema has required inputs, duration, supported languages/ratios, preview/poster flags, quality status, and capability policy, but it lacks presenter compatibility and an explicit availability/selectability field; add those facts rather than infer them from UI labels. [VERIFIED: `packages/contracts/src/creator.ts:62-113`; `apps/web/src/features/create/types.ts:50-73`]

### Pattern 4: Truthful template media and cost state

**What:** Preserve the existing media split: a motion-preview button exists only when `previewVideo` is present; a static direction links to its details. The Phase 3 display model additionally needs expected result, required inputs, supported formats, presenter availability, current quote state, and disabled reason.

**Why:** The existing media module states that its posters are visual directions rather than customer outputs, and only explicitly inspected clips are mapped as verified videos. [VERIFIED: `apps/web/src/features/create/templateMedia.ts:13-88`; `apps/web/src/features/create/TemplateGrid.tsx:258-305`; `apps/web/src/features/create/TemplatePreviewDialog.tsx:23-60`]

### Pattern 5: State machine per step, controlled fields throughout

**What:** Model source import, fact confirmation, recommendation, presenter eligibility, settings validation, quote recovery, auth handoff, and review editing as explicit discriminated states. Keep field values controlled and preserve draft content on every non-destructive error.

**Why:** React controlled fields require a current `value`/`checked` plus synchronous `onChange`, and should not switch controlledness. [CITED: https://react.dev/reference/react-dom/components/input] The current creator already preserves its project state while its quote, claim, and recovery conditions change. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:347-455`; `apps/web/src/features/create/CreateStudio.tsx:777-824`]

### Anti-Patterns to Avoid

- **A second “review payload”:** Do not assemble a summary object separately from the persisted draft; it will inevitably omit provenance, a CTA destination, or presenter rights. Derive review rows from the normalized contract. [VERIFIED: `apps/web/src/features/create/contracts.ts:99-138`; `apps/web/src/features/create/projectStore.ts:178-203`]
- **Browser-side link scraping:** Never bypass the scanner or re-fetch candidate URLs from the client. [VERIFIED: `apps/api/src/source-scanner.ts:236-281`]
- **Sample content in the customer source path:** Remove the current visible “try a sample product” action from production Template Mode; keep any fixture strictly development/QA-only. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:1537-1541`]
- **Fake playable template media:** Preserve static direction links and do not add a play icon, duration progress, or “generated example” wording to them. [VERIFIED: `apps/web/src/features/create/TemplateGrid.tsx:286-305`]
- **A blanket presenter selector:** Do not expose `digital_twin` merely because it is still in the current enum. Verbatim current enum: `"none", "ai_ugc", "uploaded_spokesperson", "digital_twin"`. The Template Mode selector must be capability-driven and hide the last value. [VERIFIED: `packages/contracts/src/creator.ts:31-37`]
- **Hard-coded single details page requirements:** Do not require every service fact for a product, or make optional fields invisible; use outcome/source requirements and show absent optional facts as “Not added.” [ASSUMED]

## Don’t Hand-Roll

| Problem | Don’t Build | Use Instead | Why |
|---|---|---|---|
| Remote-page fetching / SSRF defense | A new `fetch(url)` importer | `createSourceScanner` and the existing remote-request policy | It already guards protocol, public DNS/IP resolution, redirects, content type, byte limits, and failure classification. [VERIFIED: `apps/api/src/source-scanner.ts:236-281`] |
| Private asset upload and claim | A phase-specific upload/claim flow | Existing guest draft, manifest, `claimGuestAssets`, and claim checkpoints | It preserves exact local assets until server persistence is verified. [VERIFIED: `apps/web/src/features/create/guestDraftStore.ts:272-329`; `apps/web/src/features/create/CreateStudio.tsx:986-1031`] |
| Quote, price retry, and Generate-time auth | A second checkout/generate action | Existing portable quote, auth gate, and submission path | It already keeps the draft, detects quote change/unavailability, and binds the existing intent. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:376-455`; `apps/web/src/features/create/CreateStudio.tsx:1055-1191`] |
| Preview dialog / focus behavior | A bespoke modal/video player | Existing dialog and template preview components | They already identify verified motion as preview rather than customer output. [VERIFIED: `apps/web/src/features/create/TemplatePreviewDialog.tsx:23-62`] |

**Key insight:** the high-risk complexity is provenance and cross-boundary preservation, not rendering five more screens. Reusing the proven transport/ownership paths leaves Phase 3 free to make the user-facing state complete and truthful.

## Common Pitfalls

### Pitfall 1: Extending only the client type

**What goes wrong:** The fact looks correct until authentication, project hydration, quote refresh, or generation, where it disappears because one serializer or the creative brief did not carry it.  
**Why it happens:** Existing persistence has several independently named representations: `CreatorProject`, guest `CreationDraft`, stable project configuration, product recipe, campaign recipe, and creative brief. [VERIFIED: `apps/web/src/features/create/contracts.ts:56-138`; `apps/web/src/features/create/projectStore.ts:91-203`]  
**How to avoid:** First task changes all representations and adds one round-trip test for product and service fixtures before any step UI work.  
**Warning signs:** A review row is missing after reload/auth, a `configuration` equality check ignores a fact, or a quote input cannot explain a setting. [VERIFIED: `apps/web/src/features/create/portableProjectMapper.ts:18-87`; `apps/web/src/features/create/projectStore.ts:270-303`]

### Pitfall 2: Treating imported text as confirmed business truth

**What goes wrong:** Metadata fetched from a page becomes a campaign claim without an explicit user decision.  
**Why it happens:** The scanner intentionally extracts title/description/price but only gives the browser a warning to review. [VERIFIED: `apps/api/src/source-scanner.ts:262-281`]  
**How to avoid:** Require fact review before recommendation or quote, make provenance visible on every used fact, and change edited values to manual.  
**Warning signs:** Imported facts route directly from `scanSource()` to details/recommendation, or a generated configuration has no provenance array. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:687-724`; `apps/web/src/features/create/projectStore.ts:178-203`]

### Pitfall 3: Letting template choice mutate confirmed source intent

**What goes wrong:** A template selection changes business/product classification, vertical, goal, CTA, or facts unexpectedly.  
**Why it happens:** The current selection handler derives several campaign fields from the template and only preserves some values when it sees a name or image. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:621-644`]  
**How to avoid:** Source-first treats outcome/confirmed facts as authoritative; template-first treats the immutable template as authoritative; both produce the same normalized draft without hidden reassignment.  
**Warning signs:** Switching template changes a confirmed CTA or clears a service field.

### Pitfall 4: Claiming availability from a catalog card

**What goes wrong:** A user can select a development/review template, unsupported presenter, static preview, or stale price.  
**Why it happens:** Current template mapping includes `qualityStatus`, but UI cards do not yet display the required inputs/cost/selectability matrix. [VERIFIED: `apps/web/src/features/create/types.ts:50-73`; `apps/web/src/features/create/templateCatalogMapper.ts:6-31`; `apps/web/src/features/create/TemplateGrid.tsx:258-305`]  
**How to avoid:** A template recommendation must return an explicit disabled/selectable state and exact reason. Fetch/refresh authoritative quote state at final review, not from static card data.  
**Warning signs:** “Play preview” appears on a static direction, or Generate enables with no current quote. [VERIFIED: `apps/web/src/features/create/TemplateGrid.tsx:286-305`; `apps/web/src/features/create/CreateStudio.tsx:1584-1599`]

### Pitfall 5: Visual polish without field-level recovery

**What goes wrong:** A user cannot tell which input is required, loses a correction after a scan/upload error, or gets trapped in a modal/state.  
**Why it happens:** Multi-step states multiply loading, optional, invalid, offline, and capability-unavailable paths.  
**How to avoid:** Each field keeps a visible label, current value, nearby error/instruction linkage, and a focused recovery action. W3C guidance supports labels/instructions associated with fields and errors associated with invalid controls. [CITED: https://www.w3.org/WAI/tutorials/forms/instructions/; https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21.html]  
**Warning signs:** A global alert is the only validation feedback, placeholder text carries the only label, or retry clears any draft field. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:1537-1552`; `apps/web/src/features/create/CreateStudio.tsx:1567-1587`]

## Code Examples

### Controlled fact editor pattern

React recommends controlled inputs for UI that must keep a current state representation; `value`/`checked` require an updating `onChange`. [CITED: https://react.dev/reference/react-dom/components/input]

```tsx
function FactField({ fact, onChange }: {
  fact: NormalizedCampaignFact;
  onChange: (change: FactChange) => void;
}) {
  return (
    <label>
      <span>{labelFor(fact.field)}</span>
      <input
        value={fact.value}
        onChange={(event) => onChange({ field: fact.field, value: event.target.value })}
        aria-describedby={helpIdFor(fact.field)}
      />
      <small id={helpIdFor(fact.field)}>{provenanceLabel(fact.provenance)}</small>
    </label>
  );
}
```

### Determinate named progress pattern

The existing creator progress component exposes `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-valuetext`; preserve that pattern for the expanded wizard. [VERIFIED: `apps/web/src/features/create/CreatorProgress.tsx:18-43`] WAI-ARIA specifies that a determinate progress bar should expose its numeric value and use `aria-valuetext` where the named stage is more meaningful. [CITED: https://www.w3.org/TR/wai-aria-1.3/]

## State of the Art

| Old approach | Current approach for this phase | Impact |
|---|---|---|
| One `source → template → details` creator state | Contract-first source/facts/outcome/recommendation/setup/review flow | Preserves provenance and exact values through auth/claim/quote rather than relying on a broad form. [VERIFIED: `apps/web/src/features/create/types.ts:127-154`; `apps/web/src/features/create/CreateStudio.tsx:1504-1606`] |
| Catalog browsing first with broad filters | Source-first outcome selection returns a small, explainable ranked set; template-first preserves the explicit selection | Matches the locked beginner journey while keeping browsing secondary. [ASSUMED] |
| Static poster mapping plus optional local video | Explicit preview truth and selection availability metadata | Prevents cards from implying generated customer output or usable combinations. [VERIFIED: `apps/web/src/features/create/templateMedia.ts:13-121`; `apps/web/src/features/create/TemplateGrid.tsx:258-305`] |

**Deprecated/outdated for Phase 3:**

- The visible production sample-product action is incompatible with the locked source boundary and should move behind development/QA only. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:1537-1541`]
- The current six-value goal taxonomy cannot directly represent all locked Phase 3 outcomes; extend it coherently rather than relabeling unrelated values. [VERIFIED: `packages/contracts/src/creator.ts:21-29`; `packages/creative-engine/src/types.ts:73-106`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Recommendation explanations can be generated solely from deterministic scoring reasons and should not use model/provider terminology. | Architecture Pattern 3 | UX copy might need an additional product-approved rule set. |
| A2 | Outcome-aware required/optional fact metadata can be maintained client-side from the shared normalized contract without a new external rules service. | Anti-Patterns / Validation | The API may need a stricter reusable validation endpoint if more consumers are added. |
| A3 | A source-first ranked set can be limited to three results while Browse all remains sufficient for discovery. | State of the Art | Product testing could show that users need a wider first view. |

## Open Questions

1. **Which real, rights-cleared physical product and service business are the Phase 3 browser fixtures?**
   - What we know: The phase requires one real product and one real service golden path, and production UI cannot present sample content as a user import.
   - What's unclear: No named approved product/service URLs, media, facts, or spokesperson-rights evidence is in phase context.
   - Recommendation: Add a plan checkpoint before browser UAT to record the two approved fixture packs (source URL or manual facts, assets, expected provenance, intended outcome, and required CTA), and use anonymized test fixtures only in automated tests.

2. **What is the authoritative source of approved AI UGC cast and language availability?**
   - What we know: Existing template metadata has capability policy but no explicit presenter compatibility or cast inventory. [VERIFIED: `packages/creative-engine/src/types.ts:63-94`]
   - What's unclear: The API/worker data source that can prove a cast is approved for a specific template and campaign language.
   - Recommendation: Keep No presenter selectable by default; hide AI UGC until a server/catalog-backed availability fact exists. Do not fake availability in Phase 3.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Bun | install/test/build commands | ✓ | 1.3.12 | — [VERIFIED: shell `bun --version`] |
| Node.js | repository runtime/typecheck | ⚠ | 25.2.0 installed; repository requires `24.x` | Use the project-supported Node 24 before final integration validation. [VERIFIED: shell `node --version`; `package.json:7-10`] |
| Vitest/jsdom | fast web and API regression tests | ✓ | web config detected | — [VERIFIED: `apps/web/vitest.config.ts:5-20`; `apps/web/package.json:12-14`] |
| Docker Compose/PostgreSQL/MinIO | authenticated claim and full portable-stack browser evidence | ✗ | Docker command unavailable in this environment | Run focused unit tests now; use a provisioned development stack for claim/auth UAT. [VERIFIED: `package.json:21-22`; shell `command -v docker`] |

**Missing dependencies with no fallback:** Docker-compatible services for full authenticated source-claim/browser UAT.  
**Missing dependencies with fallback:** The focused Vitest suites can validate contract, scanner, and component behavior before that stack is available.

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10, Testing Library, jsdom. [VERIFIED: `apps/web/package.json:81-95`; `apps/web/vitest.config.ts:11-17`] |
| Config file | `apps/web/vitest.config.ts` (jsdom and `src/**/*.{test,spec}.{ts,tsx}`). [VERIFIED: `apps/web/vitest.config.ts:5-20`] |
| Quick run command | `bun run --cwd apps/web test -- src/features/create/<target>.test.tsx` [VERIFIED: `apps/web/package.json:12-14`] |
| Full suite command | `bun run test:all` [VERIFIED: `package.json:30-36`] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| SOURCE-01 | Product link, service link, photos, real footage, and manual entry each normalize without data loss. | unit/component | `bun run --cwd apps/web test -- src/features/create/GoldenPathFlow.test.tsx` | ❌ Wave 0 |
| SOURCE-02 | Product/service fact edit preserves values and source-specific fields. | component | `bun run --cwd apps/web test -- src/features/create/FactReviewStep.test.tsx` | ❌ Wave 0 |
| SOURCE-03 | Imported edit becomes manual; bulk confirmation changes untouched campaign facts only. | unit | `bun run --cwd apps/web test -- src/features/create/campaignFacts.test.ts` | ❌ Wave 0 |
| CREATE-01 | Template Mode contains no model/provider/prompt/timeline terminology. | component | `bun run --cwd apps/web test -- src/features/create/GoldenPathFlow.test.tsx -t "beginner"` | ❌ Wave 0 |
| CREATE-02 | Source-first and template-first converge to byte-equivalent normalized configuration. | unit | `bun run --cwd apps/web test -- src/features/create/campaignDraft.test.ts` | ❌ Wave 0 |
| CREATE-03 | Every locked outcome is accepted by contracts, labels, filtering, and draft persistence. | contracts/engine | `bun run --cwd packages/contracts test -- creator` and `bun run --cwd packages/creative-engine test -- catalog` | ❌ Wave 0 |
| CREATE-04 | Same recommendation input yields the same ranked three/explanations; unsupported input has an honest fallback. | unit/component | `bun run --cwd apps/web test -- src/features/create/recommendationEngine.test.ts` | ❌ Wave 0 |
| CREATE-05 | Selectable card displays expected result, required inputs, formats, presenter state, preview truth, and quote state. | component | `bun run --cwd apps/web test -- src/features/create/TemplateRecommendation.test.tsx` | ❌ Wave 0 |
| CREATE-06 | Only verified motion receives a Play control; static direction stays non-playable. | component | `bun run --cwd apps/web test -- src/features/create/TemplateGrid.test.tsx` | ✅ existing baseline |
| CREATE-07 | No presenter default; AI UGC is capability-gated; uploaded spokesperson requires footage and rights; Digital Twins absent. | component/unit | `bun run --cwd apps/web test -- src/features/create/PresenterStep.test.tsx` | ❌ Wave 0 |
| CREATE-08 | Outcome-aware settings keep Kuwait/KWD, CTA destination, language, ratio, resolution, subtitles, and audio intact. | component/round-trip | `bun run --cwd apps/web test -- src/features/create/CampaignSetupStep.test.tsx` | ❌ Wave 0 |
| CREATE-09 | Review displays every used fact/provenance and returns each Edit action to the correct step; exact draft survives auth serializer. | component/contract | `bun run --cwd apps/web test -- src/features/create/CampaignReviewStep.test.tsx src/features/create/__tests__/creatorContracts.test.ts` | ❌ / ✅ baseline |
| CREATE-10 | Loading, empty, invalid, offline, quote, capability, and recovery states retain draft and expose one primary action. | component | `bun run --cwd apps/web test -- src/features/create/GoldenPathStates.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** targeted Vitest file(s), web typecheck, and relevant contracts/creative-engine tests.
- **Per wave merge:** `bun run test:all`, `bun run typecheck`, `bun run build`, and `bun run check:web-bundle`.
- **Phase gate:** both real fixture paths in rendered browser at 375, 768, 1024, and 1440 pixels; English/Arabic UI, light/dark, keyboard traversal, dialog focus return, reduced motion, and screen-reader status checks.

### Wave 0 Gaps

- [ ] `apps/web/src/features/create/campaignFacts.test.ts` — provenance transition and normalized fact validation.
- [ ] `apps/web/src/features/create/campaignDraft.test.ts` — source-first/template-first convergence plus guest/auth/project-version round trip.
- [ ] `apps/web/src/features/create/GoldenPathFlow.test.tsx` and `GoldenPathStates.test.tsx` — primary paths and recovery matrix.
- [ ] Component tests for fact review, recommendations, presenter, settings, and final review — behavior-specific coverage listed above.
- [ ] Fixture manifest for one approved product and one approved service browser run — provenance/rights/CTA expected values.

The existing targeted baseline passed during this research: `apps/api/src/source-scanner.test.ts` (5 tests) and the web TemplateGrid/creator-contract/guest-draft suites (11 tests). [VERIFIED: research execution on 2026-08-20]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | Yes | Preserve Generate-time auth/claim rather than creating a new sign-in path. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:1034-1191`] |
| V3 Session Management | Yes | Existing opaque guest intent/claim recovery remains the session boundary. [VERIFIED: `apps/web/src/features/create/guestDraftStore.ts:272-329`] |
| V4 Access Control | Yes | Authenticated projects/assets continue through existing owner-scoped API and private storage. [VERIFIED: `apps/web/src/features/create/portableProjectMapper.ts:76-87`; `apps/api/src/creator-routes.ts:452-470`] |
| V5 Input Validation | Yes | Zod contract validation for fact/source payloads; field-level client validation is a usability complement, not authorization. [VERIFIED: `packages/contracts/src/creator.ts:295-328`] |
| V6 Cryptography | No new cryptographic primitive | Reuse existing SHA-256 snapshot/asset checksum flow; do not implement a custom hash or signing design. [VERIFIED: `apps/web/src/features/create/guestClaimSnapshot.ts:20-40`] |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| SSRF or redirect/DNS rebinding through imported links | Tampering / Information disclosure | Preserve public-address filtering, pinned fetch policy, redirect revalidation, byte/content limits, and API rate limiting. [VERIFIED: `apps/api/src/source-scanner.ts:229-283`; `apps/api/src/creator-routes.ts:503-549`] |
| Imported content becomes an unreviewed campaign claim | Tampering | Store/propagate provenance, require confirmation before campaign use, and render text as text—not raw HTML. [VERIFIED: `packages/contracts/src/creator.ts:299-325`; `apps/api/src/source-scanner.ts:262-281`] |
| Wrong-account or duplicate claim after Generate | Elevation of privilege / Repudiation | Retain existing idempotent guest claim and verified cleanup path. [VERIFIED: `apps/web/src/features/create/guestDraftStore.ts:272-329`; `apps/web/src/features/create/CreateStudio.tsx:986-1031`] |
| Unconsented human media used as a presenter | Spoofing / Privacy | Require explicit uploaded-spokesperson rights confirmation and keep footage as a source asset until that decision. [ASSUMED] |
| Signed preview URL persisted with campaign facts | Information disclosure | Keep stable object metadata only; refresh signed URLs on read. [VERIFIED: `apps/web/src/features/create/projectStore.ts:28-61`; `apps/web/src/features/create/portableProjectMapper.ts:76-87`] |

## Sources

### Primary (HIGH confidence)

- `packages/contracts/src/creator.ts` — source kinds, current goals/presenters, template contract, and fact provenance. [VERIFIED: `packages/contracts/src/creator.ts:9-41`; `packages/contracts/src/creator.ts:62-328`]
- `apps/web/src/features/create/CreateStudio.tsx` — current creator orchestration, source UI, persistence/claim/quote, and final details summary. [VERIFIED: `apps/web/src/features/create/CreateStudio.tsx:458-1191`; `apps/web/src/features/create/CreateStudio.tsx:1504-1609`]
- `apps/web/src/features/create/projectStore.ts` and `portableProjectMapper.ts` — authoritative serialization and hydration seams. [VERIFIED: `apps/web/src/features/create/projectStore.ts:91-203`; `apps/web/src/features/create/portableProjectMapper.ts:18-87`]
- `apps/api/src/source-scanner.ts` and `creator-routes.ts` — source import safety and API rate-limit boundary. [VERIFIED: `apps/api/src/source-scanner.ts:229-283`; `apps/api/src/creator-routes.ts:503-549`]
- Existing test evidence — scanner, preview truth, guest draft and contract suites. [VERIFIED: `apps/api/src/source-scanner.test.ts:5-111`; `apps/web/src/features/create/TemplateGrid.test.tsx:18-101`; `apps/web/src/features/create/guestDraftStore.test.ts:70-112`]

### Secondary (MEDIUM confidence)

- [React input reference](https://react.dev/reference/react-dom/components/input) — controlled form semantics.
- [W3C WAI form instructions](https://www.w3.org/WAI/tutorials/forms/instructions/) and [ARIA-invalid technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21.html) — labels, instructions, and field-associated errors.
- [WAI-ARIA progressbar](https://www.w3.org/TR/wai-aria-1.3/) — named determinate progress semantics.

### Tertiary (LOW confidence)

- None; unverified design choices are explicitly recorded in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all recommended systems are already installed and exercised in the repository.
- Architecture: HIGH — the critical client/API/claim/version seams were opened and targeted baseline tests passed.
- Pitfalls: HIGH — they follow concrete gaps in the current orchestration and shared schemas; UX technique details are MEDIUM where based on official React/W3C documentation.

**Research date:** 2026-08-20  
**Valid until:** 2026-09-19 for repository-specific findings; re-check runtime/provider/cast availability before execution.
