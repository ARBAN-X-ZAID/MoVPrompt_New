# Roadmap: MovPrompt

## Overview

MovPrompt moves from a feature-rich prototype to a production Kuwait Campaign Autopilot through ten vertical phases. The sequence first makes runtime, pricing, generation, and ownership truthful; then proves complete product and service journeys; then turns accepted outputs into editable social packs; and only afterward scales templates, localization, Advanced Mode, billing, and production rollout. Existing application work is preserved and connected rather than redesigned.

## Phases

- [x] **Phase 1: Production Truth Foundation** - Make availability, pricing, worker state, progress, and initial settlement authoritative. (completed 2026-08-19)
- [x] **Phase 2: Guest, Authentication, and Data Integrity** - Preserve exact guest campaigns through authentication and private cloud claiming. (completed 2026-08-20)
- [x] **Phase 3: Product and Service Golden Paths** - Deliver one simple end-to-end campaign flow for products and service businesses. (completed 2026-08-21)
- [ ] **Phase 4: Durable Generation and Accepted Quality** - Produce owned, validated, quality-approved output without browser dependence.
- [ ] **Phase 5: Projects and Immutable Version Recovery** - Make every campaign, run, output, and accepted version durable and recoverable.
- [ ] **Phase 6: Guided Editor and Social Campaign Pack** - Turn one accepted master into editable, matching, multi-format business deliverables.
- [ ] **Phase 7: Production Template Catalog** - Publish an honest, database-backed set of 18 launch-ready template recipes and previews.
- [ ] **Phase 8: Kuwait Localization and Clinic Safety** - Complete Arabic/RTL/KWD/WhatsApp quality and enforce clinic safeguards.
- [ ] **Phase 9: Advanced Mode Parity** - Connect professional controls to the same real project, quote, version, and render system.
- [ ] **Phase 10: Commercial Operations and Production Launch** - Activate billing, accounts, observability, accessibility, security, migration, and controlled rollout.

## Phase Details

### Phase 1: Production Truth Foundation

**Goal:** Establish one truthful runtime contract for generation availability, quotes, submissions, worker health, progress, and starter value.
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** TRUTH-01, TRUTH-02, TRUTH-03, TRUTH-04, TRUTH-05, TRUTH-06, TRUTH-07, GEN-01, GEN-02, GEN-03, GEN-04
**Success Criteria** (what must be TRUE):

1. A healthy local/staging stack returns an authoritative quote and enables Generate; an unhealthy dependency produces the correct saved-project recovery state.
2. Repeated Generate clicks create one idempotent project run and reserve one starter entitlement or charge.
3. Browser progress is reconstructed from persisted server stages and never remains at a simulated percentage after provider completion or failure.
4. API and worker fail closed when capability, pricing, storage, quality, or runtime fingerprints differ.
5. Sample, source, direction, template-preview, and generated media are visibly and technically distinct throughout canonical routes.

**Plans:** 3/3 plans complete

Plans:

- [x] 01-01-PLAN.md
- [x] 01-02-PLAN.md
- [x] 01-03-PLAN.md
- [x] 01-01: Reconcile current runtime, migrations, service heartbeat, capability fingerprint, and generation availability contract.
- [x] 01-02: Complete authoritative pricing, quote invalidation, starter entitlement, and idempotent submit integration.
- [x] 01-03: Replace simulated progress/media fallbacks with persisted stages, supportable failure states, and end-to-end runtime proof.

### Phase 2: Guest, Authentication, and Data Integrity

**Goal:** Let a guest configure freely, authenticate at Generate, and recover the exact campaign and owned assets safely.
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, SOURCE-04, SOURCE-05, SOURCE-06, SOURCE-07, PROJ-06
**Success Criteria** (what must be TRUE):

1. Email, configured social sign-in, cancelled auth, duplicate callback, and password reset journeys preserve or recover the correct campaign without duplication.
2. Guest media remains local until claim; authenticated media is private, owner-scoped, checksum-verified, and reusable after URL expiry.
3. Another user cannot read, claim, reference, download, or mutate the campaign, asset, run, or output through HTTP or PostgreSQL.
4. Source/import/upload failure keeps the exact local draft and gives a clear safe recovery action.

**Plans:** 8/8 plans executed

Plans:

- [x] 02-01-PLAN.md
- [x] 02-02-PLAN.md
- [x] 02-03-PLAN.md
- [x] 02-04-PLAN.md
- [x] 02-05-PLAN.md
- [x] 02-06-PLAN.md
- [x] 02-07-PLAN.md
- [x] 02-08-PLAN.md

**Wave 1**

- [x] 02-01: Create the durable authenticated guest-claim boundary with replay-safe ownership and verified asset checkpoints.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02: Preserve the exact seven-day browser draft, stable Generate intent, auth cancellation, and verified local cleanup.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03: Make authentication capability, verification policy, and OAuth/password returns server-controlled and safe.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-04: Secure guest media into the authenticated user's private namespace with resumable integrity checks.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-05: Add PostgreSQL-authoritative rate limits and hardened source scanning and image mirroring.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 02-06: Make source changes versioned and every source or claim failure safely recoverable.

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 02-07: Prove abandoned-claim cleanup, guarded migrations, RLS isolation, and adversarial ownership safety.

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 02-08: Complete and verify the guest/auth recovery UI across languages, themes, viewports, and accessibility states.

### Phase 3: Product and Service Golden Paths

**Goal:** Make the beginner journey complete for one physical product and one service business with all campaign facts preserved.
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** SOURCE-01, SOURCE-02, SOURCE-03, CREATE-01, CREATE-02, CREATE-03, CREATE-04, CREATE-05, CREATE-06, CREATE-07, CREATE-08, CREATE-09, CREATE-10
**Success Criteria** (what must be TRUE):

1. A user can import a real product link/photo and complete source review, outcome, template, campaign settings, review, auth, and submission without prompts or model choices.
2. A salon/clinic/service user can import a business link or enter details manually and complete the same guided journey with booking or WhatsApp outcomes.
3. The final review and submitted configuration exactly preserve confirmed facts, media, language, CTA, price, offer, presenter, audio, subtitles, resolution, and ratio.
4. Template-first and source-first entry converge on the same draft and every launch option truthfully states inputs, preview type, duration, format, and quote.
5. Every screen has one clear task/action and usable loading, empty, validation, offline, error, and success states at mobile and desktop sizes.

**Plans:** 8/8 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Normalize source facts, provenance, persistence, and source-first/template-first convergence.

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — Complete product, service, upload, footage, and manual source review with bilingual recovery states.

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Bind catalog eligibility to exact configuration-bound server quotes and quote lifecycle states.

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 03-04-PLAN.md — Enforce presenter media, rights, template, language, capability, claim, quote, and submission rules server-side.

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 03-05-PLAN.md — Deliver quote-aware outcomes, recommendations, eligibility disclosures, and truthful previews.

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 03-06-PLAN.md — Deliver capability-derived presenter choice and Kuwait campaign setup without expert terminology.

**Wave 7** *(blocked on Wave 6 completion)*

- [x] 03-07-PLAN.md — Deliver exact product/service review, authoritative quote gates, and Generate-time auth recovery.

**Wave 8** *(blocked on Wave 7 completion)*

- [x] 03-08-PLAN.md — Automated smoke, rendered accessibility evidence, and provisioned auth/private-claim/quote/worker UAT pass.

### Phase 4: Durable Generation and Accepted Quality

**Goal:** Convert an accepted request into a MovPrompt-owned, technically valid, quality-approved result with exact settlement.
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** GEN-05, GEN-06, GEN-07, GEN-08, GEN-09, GEN-10, GEN-11, GEN-12, GEN-13, GEN-14
**Success Criteria** (what must be TRUE):

1. A real render continues after browser closure, reconciles the original provider operation, and stores the output privately before completion.
2. Completed output passes full media decode, format/dimension/duration/audio checks, business-truth checks, Arabic/text legibility, safe zones, and policy review.
3. Provider errors, unknown output origin, timeout, invalid media, quality rejection, and cancellation settle entitlement/credits exactly once.
4. A failed new version leaves the previous accepted version intact and gives an honest retry route.
5. Expired output links refresh securely while provider IDs, secrets, raw errors, and signed URLs remain internal.

**Plans:** 3 plans

Plans:
**Wave 1**

- [ ] 04-01: Prove production provider submit/poll/reconcile/cancel and safe output acquisition contracts.

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-02: Complete media normalization, technical validation, visual/business quality gates, and bounded retries.

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-03: Prove exact settlement, previous-success preservation, output refresh, and failure/cancellation matrices.

### Phase 5: Projects and Immutable Version Recovery

**Goal:** Give users a dependable home for campaigns, versions, runs, outputs, retries, and recovery.
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05
**Success Criteria** (what must be TRUE):

1. User can find and reopen any owned project by URL with accurate source, working version, accepted version, run state, and outputs.
2. Every meaningful campaign or visual change creates immutable history and a failed version never replaces the accepted result.
3. User can compare versions, select a completed accepted version, duplicate/retry projects, and trash/restore them safely.
4. Project list filters, counts, thumbnails, statuses, and actions reflect cloud truth rather than local or demo state.

**Plans:** 2 plans

Plans:

- [ ] 05-01: Complete canonical project list/detail/history, accepted/working version semantics, and output recovery.
- [ ] 05-02: Add compare/accept/duplicate/retry/trash/restore behavior and end-to-end project recovery tests.

### Phase 6: Guided Editor and Social Campaign Pack

**Goal:** Let a non-editor correct business facts and download a complete, preview-matching four-format campaign pack.
**Mode:** mvp
**Depends on:** Phase 5
**Requirements:** EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07, PACK-01, PACK-02, PACK-03, PACK-04, PACK-05, PACK-06, PACK-07
**Success Criteria** (what must be TRUE):

1. User can edit business text, branding, subtitles/audio, scene order/timing, crop, and safe zones through guided controls with no generative charge.
2. Browser preview and final MP4 match for exact copy, price, offer, CTA, logo, colors, subtitle timing, and crop.
3. One accepted master produces independent 9:16, 1:1, 4:5, and 16:9 artifacts plus captions, subtitles, poster, CTA graphic, WhatsApp link/QR, and manifest.
4. User can retry one failed export and Download All only when selected artifacts are ready, without overwriting another ratio.
5. Visual regeneration is separately quoted, versioned, and explicit about full-video changes; all editor actions work at 375 pixels in both languages/themes.

**Plans:** 3 plans

Plans:

- [ ] 06-01: Implement shared Remotion browser/server composition and deterministic guided edit/version workflow.
- [ ] 06-02: Implement durable multi-ratio export jobs, artifact validation, supporting campaign assets, and Download All manifest/archive.
- [ ] 06-03: Prove preview/output parity, visual-regeneration disclosure, failure recovery, mobile, theme, and bilingual accessibility.

### Phase 7: Production Template Catalog

**Goal:** Publish a trustworthy launch catalog of unique, tested Kuwait business recipes rather than demo concepts.
**Mode:** mvp
**Depends on:** Phase 6
**Requirements:** TMPL-01, TMPL-02, TMPL-03, TMPL-04, TMPL-05, TMPL-06
**Success Criteria** (what must be TRUE):

1. Homepage, Templates, Create, and Advanced entries use one published database template/version catalog.
2. At least 18 templates across launch verticals/outcomes have complete immutable recipes, schemas, policies, gates, and export presets.
3. Every selectable launch template has its own rights-cleared playable preview made from that recipe and passes real source QA.
4. Every launch template passes Arabic, English, bilingual, and four-ratio safe-zone/output review; unreviewed concepts remain hidden or clearly non-production.

**Plans:** 3 plans

Plans:

- [ ] 07-01: Finalize publish/version tooling and one canonical template contract/catalog API.
- [ ] 07-02: Produce, review, and publish the 18 launch recipes and unique previews across four verticals.
- [ ] 07-03: Run real product/service language/ratio QA and enforce catalog publishing gates.

### Phase 8: Kuwait Localization and Clinic Safety

**Goal:** Make the whole product locally correct in Arabic/English and safe enough for commercial clinic campaigns.
**Mode:** mvp
**Depends on:** Phase 7
**Requirements:** LOCAL-01, LOCAL-02, LOCAL-03, LOCAL-04, LOCAL-05, LOCAL-06, SAFE-01, SAFE-02, SAFE-03, SAFE-04, SAFE-05
**Success Criteria** (what must be TRUE):

1. Every core route, state, email, and exported asset works in English UI and true Arabic RTL UI with independent campaign language.
2. KWD, Kuwait phone/WhatsApp, mixed-direction text, formal Arabic, Gulf Arabic, subtitles, logos, prices, offers, and CTAs render correctly.
3. Human QA passes Arabic/English/bilingual output and safe zones for all launch templates and ratios.
4. Clinic flows block unsupported claims, deceptive before/after content, missing identity/attestation, privacy risks, and absent consent with clear remediation.
5. Commercial clinic generation/export remains disabled until documented Kuwait legal approval is recorded.

**Plans:** 3 plans

Plans:

- [ ] 08-01: Complete product-wide localization, RTL/mixed-direction behavior, Kuwait formatting, and Gulf copy controls.
- [ ] 08-02: Implement clinic identity, facts, claims, patient/person consent, privacy, and compliance gates.
- [ ] 08-03: Execute human language/safe-zone QA and record legal launch decision evidence.

### Phase 9: Advanced Mode Parity

**Goal:** Turn the existing Advanced interface into a real professional workspace without fragmenting the beginner product.
**Mode:** mvp
**Depends on:** Phase 8
**Requirements:** ADV-01, ADV-02, ADV-03, ADV-04, ADV-05, ADV-06, ADV-07
**Success Criteria** (what must be TRUE):

1. Template-to-Advanced creates an immutable fork that preserves sources, facts, brand, market, language, and output settings.
2. Every visible reference, direction, camera, shot, motion, lighting, fidelity, presenter, voice, duration, resolution, audio, and format control persists into quote/generation.
3. Every Direction card represents a real version, quote, run, and recoverable output; no placeholder media or inert action remains.
4. Guest Advanced setup survives authentication and all Advanced runs live in the same Projects history with compare/accept/cancel/retry.
5. Returning to Template Mode never silently discards incompatible professional settings.

**Plans:** 3 plans

Plans:

- [ ] 09-01: Connect Advanced configuration/references to immutable portable project versions and authoritative quotes.
- [ ] 09-02: Connect real Direction runs, progress, outputs, comparison, cancellation, retry, and guest claim.
- [ ] 09-03: Retire duplicate legacy studios/history only after route, data, and capability parity verification.

### Phase 10: Commercial Operations and Production Launch

**Goal:** Make MovPrompt billable, supportable, secure, accessible, observable, recoverable, and ready for controlled public use.
**Mode:** mvp
**Depends on:** Phase 9
**Requirements:** BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06, OPS-07, OPS-08, OPS-09
**Success Criteria** (what must be TRUE):

1. UPayments success, cancellation, duplicate/out-of-order/missed webhook, receipt, refund, and exact pending-generation resume all reconcile correctly.
2. Users can manage account/data/preferences and receive accurate generation/export/payment/refund notifications; admins have MFA-protected audited oversight.
3. Security, authorization, rate limits, accessibility, responsive performance, monitoring, spending alerts, backup/restore, and rollback gates pass.
4. Migrated ownership, balances, media, and history reconcile; canonical production traffic no longer depends on Supabase while the rollback window is maintained.
5. Internal, 5%, 25%, and 100% rollout stages proceed only while quote success, generation success, quality, refund, latency, and cost thresholds remain healthy.

**Plans:** 3 plans

Plans:

- [ ] 10-01: Complete UPayments credit bundles, ledger/webhook reconciliation, receipts, refunds, and pending-generation resume.
- [ ] 10-02: Complete account, notifications, admin, security, accessibility, performance, observability, and operational drills.
- [ ] 10-03: Rehearse final migration/cutover, run staging soak, and execute metrics-gated production rollout.

## Progress

**Execution Order:** Phases execute in numeric order from 1 through 10. Each phase must pass its success criteria before the next dependent phase becomes authoritative.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Production Truth Foundation | 3/3 | Complete    | 2026-08-19 |
| 2. Guest, Authentication, and Data Integrity | 8/8 | Complete | 2026-08-20 |
| 3. Product and Service Golden Paths | 8/8 | Complete | 2026-08-21 |
| 4. Durable Generation and Accepted Quality | 0/3 | Not started | - |
| 5. Projects and Immutable Version Recovery | 0/2 | Not started | - |
| 6. Guided Editor and Social Campaign Pack | 0/3 | Not started | - |
| 7. Production Template Catalog | 0/3 | Not started | - |
| 8. Kuwait Localization and Clinic Safety | 0/3 | Not started | - |
| 9. Advanced Mode Parity | 0/3 | Not started | - |
| 10. Commercial Operations and Production Launch | 0/3 | Not started | - |
