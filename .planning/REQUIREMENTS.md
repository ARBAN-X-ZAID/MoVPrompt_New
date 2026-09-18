# Requirements: MovPrompt

**Defined:** 2026-08-17
**Core Value:** A Kuwait business owner with no video skills can create a professional, accurate, ready-to-publish social-media campaign in minutes without learning prompts, timelines, models, or editing software.

## v1 Requirements

Requirements for the first production release. A requirement is complete only after implementation, automated verification, and rendered-browser evidence.

### Runtime and Product Truth

- [x] **TRUTH-01**: User sees generation as available only when the API, worker, approved capability, authoritative pricing, private storage, media tools, and quality reviewer are simultaneously healthy.
- [x] **TRUTH-02**: User sees a specific recoverable availability message when generation is paused, without losing the draft or project.
- [x] **TRUTH-03**: User never sees sample, template-preview, direction, or source media presented as their generated output.
- [x] **TRUTH-04**: User sees real generation stages derived from persisted server state rather than a simulated progress percentage.
- [x] **TRUTH-05**: Operator can stop new quotes and submissions with one server-side kill switch without interrupting already accepted runs.
- [x] **TRUTH-06**: API and worker refuse generation when their capability, pricing, storage, or runtime fingerprints disagree.
- [x] **TRUTH-07**: User can refresh or close the browser during generation and return to the correct project, stage, and result.

### Accounts and Guest Drafts

- [x] **AUTH-01**: Guest can configure a complete campaign before creating an account.
- [x] **AUTH-02**: User can create an account or sign in with email and password only when Generate is selected.
- [x] **AUTH-03**: Google and Apple sign-in appear only when correctly configured and recover the same pending campaign.
- [x] **AUTH-04**: Private-beta user can complete the first campaign without an email-verification interruption and sees a dashboard reminder to verify later.
- [x] **AUTH-05**: User can reset a forgotten password and return safely to the intended MovPrompt route.
- [x] **AUTH-06**: Cancelled authentication returns the user to the unchanged campaign.
- [x] **AUTH-07**: Successful authentication restores the exact template, sources, facts, language, campaign settings, rights decision, and pending generation intent.
- [x] **AUTH-08**: Repeated authentication callbacks create at most one project, one run, and one charge.
- [x] **AUTH-09**: Guest drafts and local media expire after seven days and cannot be claimed or viewed by a different account.
- [x] **AUTH-10**: Authenticated projects use PostgreSQL and private object storage as their source of truth; browser storage is only a recoverable cache.

### Business and Product Sources

- [x] **SOURCE-01**: User can begin with a product URL, business/service URL, product photos, real footage, or manual entry.
- [x] **SOURCE-02**: User can review and correct imported name, description, price, offer, location, booking link, WhatsApp number, logo, colors, images, and service facts.
- [x] **SOURCE-03**: Each business fact is marked as imported, user-confirmed, or manually entered.
- [x] **SOURCE-04**: Product/business scanning blocks private networks, unsafe redirects, oversized responses, invalid media, and abusive request rates.
- [x] **SOURCE-05**: Authenticated remote images are mirrored into owner-scoped private storage with verified type, size, checksum, and project ownership.
- [x] **SOURCE-06**: Failed import or media upload leaves the local draft unchanged and provides a clear Retry or Upload instead action.
- [x] **SOURCE-07**: Changing the source invalidates incompatible prior outputs instead of showing an old product or demo video.

### Template Mode and Campaign Setup

- [x] **CREATE-01**: Beginner can complete Template Mode without seeing model names, provider names, prompt engineering, codecs, or a timeline.
- [ ] **CREATE-02**: Product-first and template-first entry paths converge on the same campaign draft without losing information.
- [ ] **CREATE-03**: User can choose an outcome: WhatsApp orders, bookings, offer, launch, demonstration, education, announcement, trust/testimonial, or brand story.
- [ ] **CREATE-04**: User receives template recommendations based on vertical, outcome, available sources, presenter need, language, duration, and format.
- [ ] **CREATE-05**: Every selectable launch template shows an honest expected result, required inputs, duration, formats, and current estimated cost.
- [ ] **CREATE-06**: Every playable preview is rights-cleared and belongs to the selected template; static direction art has no fake play controls.
- [ ] **CREATE-07**: User can choose no presenter, approved AI UGC presenter, or uploaded real spokesperson; Digital Twins are not exposed in v1.
- [ ] **CREATE-08**: User can select Kuwait, Arabic/English/bilingual campaign language, KWD price, offer, CTA destination, WhatsApp/booking details, tone, subtitles, audio, resolution, and output ratio.
- [ ] **CREATE-09**: Review screen displays the actual selected template, outcome, source, language, CTA, price, offer, format, resolution, audio, subtitles, rights state, and authoritative price.
- [x] **CREATE-10**: Every Template Mode screen has one clear primary task, one clear next action, and complete loading, empty, validation, offline, error, and success states.

### Pricing, Generation, and Quality

- [x] **GEN-01**: Guest and authenticated user receive an expiring server quote bound to the complete project-version configuration.
- [x] **GEN-02**: Changing any cost- or output-affecting field invalidates the old quote and requires a refreshed confirmation.
- [x] **GEN-03**: User can submit one generation from repeated clicks without duplicate projects, runs, entitlements, reservations, or charges.
- [x] **GEN-04**: One private-beta starter render is granted idempotently and is consumed only after an approved provider accepts the request.
- [ ] **GEN-05**: Durable worker submits, polls, reconciles, and completes generation independently of the browser.
- [ ] **GEN-06**: Successful provider output is copied into MovPrompt-owned private storage before the run can complete.
- [ ] **GEN-07**: Output is validated for container, codec, dimensions, duration, audio policy, full decode, and safe output origin.
- [ ] **GEN-08**: Output passes product identity, factual accuracy, Arabic/text legibility, visual quality, safe-zone, and compliance review before acceptance.
- [ ] **GEN-09**: One quote may include at most two internal quality retries; provider failures and rejected internal attempts do not create extra user charges.
- [ ] **GEN-10**: Failure, timeout, invalid output, quality rejection, or confirmed cancellation releases or refunds value exactly once.
- [ ] **GEN-11**: Failed regeneration preserves the last accepted version and exposes a clear retry path.
- [ ] **GEN-12**: User can cancel before provider acceptance immediately and after acceptance only when provider cancellation is confirmed.
- [ ] **GEN-13**: User can download an accepted output after an old signed URL expires by receiving a newly authorized URL.
- [ ] **GEN-14**: Provider IDs, raw provider errors, secrets, signed URLs, and internal retry details never cross the public product boundary.

### Projects and Immutable Versions

- [ ] **PROJ-01**: User can list, search, filter, and sort owned projects by status, vertical, language, template, mode, and updated date.
- [ ] **PROJ-02**: User can open a project by URL and see its source, configuration, current working version, last accepted version, run status, and outputs.
- [ ] **PROJ-03**: User can duplicate, retry, trash, restore within 30 days, and permanently purge an owned project with confirmation.
- [ ] **PROJ-04**: Every meaningful campaign, visual, or Advanced change creates an immutable version rather than overwriting history.
- [ ] **PROJ-05**: User can compare versions and explicitly choose a completed version as the accepted result.
- [x] **PROJ-06**: Two users cannot read, mutate, download, or reference each other's projects, versions, assets, runs, credits, or outputs.

### Guided Editor

- [ ] **EDIT-01**: User can change headline, price, offer, CTA, logo, brand colors, subtitles, voice/music, scene order, timing metadata, crop, and safe-zone position without generative charges.
- [ ] **EDIT-02**: User edits through guided scene cards and plain business controls without a multitrack timeline.
- [ ] **EDIT-03**: Browser preview and downloaded video use the same deterministic composition and display the same text, branding, subtitles, timing, and crop.
- [ ] **EDIT-04**: User can undo, redo, save, reload, and continue deterministic edits without losing work.
- [ ] **EDIT-05**: Visual scene changes show the cost and full-video-regeneration consequence before creating a new version.
- [ ] **EDIT-06**: Visual regeneration never silently claims that unaffected scenes will remain identical.
- [ ] **EDIT-07**: Editor remains fully usable at 375 pixels in English and Arabic, light and dark themes.

### Social Campaign Pack

- [ ] **PACK-01**: Accepted campaign can produce independent 9:16, 1:1, 4:5, and 16:9 MP4/H.264/AAC artifacts without overwriting one another.
- [ ] **PACK-02**: Four delivery formats preserve approved business facts, branding, subtitle legibility, and platform-safe zones.
- [ ] **PACK-03**: Campaign pack includes Arabic and English captions, subtitle files, thumbnail/poster, offer/CTA graphic, and campaign summary.
- [ ] **PACK-04**: WhatsApp campaign pack includes a normalized click-to-chat link and downloadable QR code.
- [ ] **PACK-05**: User sees real processing status for every artifact and can retry an individual failed export.
- [ ] **PACK-06**: User can download each completed artifact or one Download All archive after every selected artifact completes.
- [ ] **PACK-07**: Download All contains only the accepted project version and a machine-readable manifest of included artifacts.

### Kuwait Localization and Compliance

- [ ] **LOCAL-01**: User can independently choose English or Arabic interface and Arabic, English, or bilingual campaign output.
- [ ] **LOCAL-02**: Core marketing, Create, Templates, Projects, Editor, Advanced, Auth, Account, Billing, Notifications, errors, and emails are fully localized.
- [ ] **LOCAL-03**: Arabic interface is true RTL with correct mixed Arabic/English layout, punctuation, numerals, form behavior, and accessible reading order.
- [ ] **LOCAL-04**: KWD is formatted with three decimal places and Kuwait phone/WhatsApp numbers are normalized and validated.
- [ ] **LOCAL-05**: User can choose formal Arabic or conversational Gulf Arabic where a template supports it.
- [ ] **LOCAL-06**: Subtitle, logo, price, offer, and CTA placement pass human-reviewed Arabic/English/bilingual safe-zone tests in all four ratios.
- [ ] **SAFE-01**: Clinic user confirms business identity, contact details, services, prices, qualifications, and campaign claims before generation.
- [ ] **SAFE-02**: Clinic campaign cannot invent medical benefits, guarantee results, or generate deceptive before/after transformations.
- [ ] **SAFE-03**: Patient or spokesperson footage requires explicit recorded rights/consent without identifiable health information.
- [ ] **SAFE-04**: Clinic policy or consent failure blocks generation/export with a specific remediation path.
- [ ] **SAFE-05**: Production clinic launch remains disabled until Kuwait legal review approves claims, consent, privacy, retention, and advertising policy.

### Launch Templates

- [ ] **TMPL-01**: One database-backed published template catalog powers the homepage, Templates, Create, and Advanced template entry points.
- [ ] **TMPL-02**: Launch catalog includes at least 18 quality-reviewed templates across salons, clinics, shops, ecommerce, offers, education, announcements, trust, products, and services.
- [ ] **TMPL-03**: Every launch template has an immutable recipe, input schema, edit schema, capability policy, localization rules, compliance policy, quality gates, and export presets.
- [ ] **TMPL-04**: Every launch template has a unique rights-cleared playable preview produced from its own recipe.
- [ ] **TMPL-05**: Every launch template passes real-product/service Arabic, English, bilingual, and four-ratio visual QA.
- [ ] **TMPL-06**: Unreviewed concepts remain hidden or explicitly labeled as visual directions and cannot be mistaken for production-ready templates.

### Advanced Mode

- [ ] **ADV-01**: User can enter Advanced Mode from Create or a project by forking an immutable version that preserves all existing data.
- [ ] **ADV-02**: User can control creative direction, semantic references, camera, shot, motion, lighting, fidelity, presenter, voice, duration, resolution, audio, and output format.
- [ ] **ADV-03**: Every visible Advanced control changes a persisted configuration used by quote and generation.
- [ ] **ADV-04**: Every visual Direction card maps to a real project version, render run, cost, and output rather than placeholder media.
- [ ] **ADV-05**: Guest Advanced configuration and references survive Generate-time authentication and claiming.
- [ ] **ADV-06**: User can compare, accept, cancel, retry, and recover Advanced versions and runs from the same Projects history.
- [ ] **ADV-07**: User can return to Template Mode only from a compatible version; incompatible Advanced settings are never silently discarded.

### Billing, Account, and Operations

- [ ] **BILL-01**: User can purchase versioned prepaid KWD credit bundles through UPayments hosted checkout.
- [ ] **BILL-02**: Payment credits are granted only after a verified, idempotently processed webhook or server reconciliation.
- [ ] **BILL-03**: Cancelled or failed payment preserves the exact pending project and generation intent.
- [ ] **BILL-04**: Successful payment resumes the exact pending generation once and exposes receipt and ledger history.
- [ ] **BILL-05**: User can view current credits, reservations, charges, refunds, starter entitlement, and transaction history without legacy daily-credit claims.
- [ ] **OPS-01**: User can manage profile, password, language, theme, notification preferences, data export, and account deletion.
- [ ] **OPS-02**: User receives in-app and email notifications for generation, export, payment, refund, and account events.
- [ ] **OPS-03**: Administrator can audit users, templates, projects, generations, quality decisions, payments, refunds, consent, and operational failures with MFA.
- [ ] **OPS-04**: Production has rate limits, bot protection, CSP/security headers, structured logs, request IDs, error tracing, analytics, and spending alerts.
- [ ] **OPS-05**: Backup restore, database/storage reconciliation, migration rollback, and provider kill-switch drills pass before launch.
- [ ] **OPS-06**: Core journeys meet WCAG 2.2 AA and pass keyboard, screen-reader, focus, contrast, reduced-motion, and 44-pixel target checks.
- [ ] **OPS-07**: Core routes meet agreed mobile performance targets and avoid loading Advanced/video-player code in beginner flows.
- [ ] **OPS-08**: Canonical production runtime no longer reads or writes Supabase after migrated data, ownership, and rollback are verified.
- [ ] **OPS-09**: Production rollout progresses from internal to 5%, 25%, and 100% only while quote, generation, quality, refund, latency, and spending thresholds remain healthy.

## v2 Requirements

Deferred until the beginner Kuwait launch is stable and measured.

### Expansion

- **EXP-01**: User can create and manage consented speaking Digital Twins with provider deletion and revocation proof.
- **EXP-02**: User can regenerate one locked scene without changing approved scenes.
- **EXP-03**: User can create batch A/B campaign variants from one accepted version.
- **EXP-04**: User can share projects with team members and client approval roles.
- **EXP-05**: User can publish or schedule directly to supported social platforms.
- **EXP-06**: User can localize campaigns for Saudi Arabia and UAE.
- **EXP-07**: Enterprise customer can use SSO, governance, audit export, and a public automation API.

## Out of Scope

| Feature | Reason |
|---------|--------|
| General-purpose multitrack timeline | Conflicts with beginner-first simplicity; guided scene cards cover the v1 job |
| Node-based workflow canvas | Adds professional complexity without improving Kuwait campaign readiness |
| Public marketplace of every model | Provider routing must remain server-controlled and quality-audited |
| Long-form filmmaking | Not part of short-form business social content |
| Guaranteed virality or sales | Cannot be truthfully guaranteed from creative output alone |
| AI-generated clinic before/after transformations | Deceptive and unsafe for the launch market |
| Native iOS/Android apps | Responsive web is sufficient for launch validation |
| Automatic ad buying | Requires separate platform policy, account, payment, and measurement work |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRUTH-01 | Phase 1 | Complete |
| TRUTH-02 | Phase 1 | Complete |
| TRUTH-03 | Phase 1 | Complete |
| TRUTH-04 | Phase 1 | Complete |
| TRUTH-05 | Phase 1 | Complete |
| TRUTH-06 | Phase 1 | Complete |
| TRUTH-07 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Complete |
| AUTH-04 | Phase 2 | Complete |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Complete |
| AUTH-07 | Phase 2 | Complete |
| AUTH-08 | Phase 2 | Complete |
| AUTH-09 | Phase 2 | Complete |
| AUTH-10 | Phase 2 | Complete |
| SOURCE-01 | Phase 3 | Complete |
| SOURCE-02 | Phase 3 | Complete |
| SOURCE-03 | Phase 3 | Complete |
| SOURCE-04 | Phase 2 | Complete |
| SOURCE-05 | Phase 2 | Complete |
| SOURCE-06 | Phase 2 | Complete |
| SOURCE-07 | Phase 2 | Complete |
| CREATE-01 | Phase 3 | Complete |
| CREATE-02 | Phase 3 | Pending |
| CREATE-03 | Phase 3 | Pending |
| CREATE-04 | Phase 3 | Pending |
| CREATE-05 | Phase 3 | Pending |
| CREATE-06 | Phase 3 | Pending |
| CREATE-07 | Phase 3 | Pending |
| CREATE-08 | Phase 3 | Pending |
| CREATE-09 | Phase 3 | Pending |
| CREATE-10 | Phase 3 | Complete |
| GEN-01 | Phase 1 | Complete |
| GEN-02 | Phase 1 | Complete |
| GEN-03 | Phase 1 | Complete |
| GEN-04 | Phase 1 | Complete |
| GEN-05 | Phase 4 | Pending |
| GEN-06 | Phase 4 | Pending |
| GEN-07 | Phase 4 | Pending |
| GEN-08 | Phase 4 | Pending |
| GEN-09 | Phase 4 | Pending |
| GEN-10 | Phase 4 | Pending |
| GEN-11 | Phase 4 | Pending |
| GEN-12 | Phase 4 | Pending |
| GEN-13 | Phase 4 | Pending |
| GEN-14 | Phase 4 | Pending |
| PROJ-01 | Phase 5 | Pending |
| PROJ-02 | Phase 5 | Pending |
| PROJ-03 | Phase 5 | Pending |
| PROJ-04 | Phase 5 | Pending |
| PROJ-05 | Phase 5 | Pending |
| PROJ-06 | Phase 2 | Complete |
| EDIT-01 | Phase 6 | Pending |
| EDIT-02 | Phase 6 | Pending |
| EDIT-03 | Phase 6 | Pending |
| EDIT-04 | Phase 6 | Pending |
| EDIT-05 | Phase 6 | Pending |
| EDIT-06 | Phase 6 | Pending |
| EDIT-07 | Phase 6 | Pending |
| PACK-01 | Phase 6 | Pending |
| PACK-02 | Phase 6 | Pending |
| PACK-03 | Phase 6 | Pending |
| PACK-04 | Phase 6 | Pending |
| PACK-05 | Phase 6 | Pending |
| PACK-06 | Phase 6 | Pending |
| PACK-07 | Phase 6 | Pending |
| LOCAL-01 | Phase 8 | Pending |
| LOCAL-02 | Phase 8 | Pending |
| LOCAL-03 | Phase 8 | Pending |
| LOCAL-04 | Phase 8 | Pending |
| LOCAL-05 | Phase 8 | Pending |
| LOCAL-06 | Phase 8 | Pending |
| SAFE-01 | Phase 8 | Pending |
| SAFE-02 | Phase 8 | Pending |
| SAFE-03 | Phase 8 | Pending |
| SAFE-04 | Phase 8 | Pending |
| SAFE-05 | Phase 8 | Pending |
| TMPL-01 | Phase 7 | Pending |
| TMPL-02 | Phase 7 | Pending |
| TMPL-03 | Phase 7 | Pending |
| TMPL-04 | Phase 7 | Pending |
| TMPL-05 | Phase 7 | Pending |
| TMPL-06 | Phase 7 | Pending |
| ADV-01 | Phase 9 | Pending |
| ADV-02 | Phase 9 | Pending |
| ADV-03 | Phase 9 | Pending |
| ADV-04 | Phase 9 | Pending |
| ADV-05 | Phase 9 | Pending |
| ADV-06 | Phase 9 | Pending |
| ADV-07 | Phase 9 | Pending |
| BILL-01 | Phase 10 | Pending |
| BILL-02 | Phase 10 | Pending |
| BILL-03 | Phase 10 | Pending |
| BILL-04 | Phase 10 | Pending |
| BILL-05 | Phase 10 | Pending |
| OPS-01 | Phase 10 | Pending |
| OPS-02 | Phase 10 | Pending |
| OPS-03 | Phase 10 | Pending |
| OPS-04 | Phase 10 | Pending |
| OPS-05 | Phase 10 | Pending |
| OPS-06 | Phase 10 | Pending |
| OPS-07 | Phase 10 | Pending |
| OPS-08 | Phase 10 | Pending |
| OPS-09 | Phase 10 | Pending |

**Coverage:**

- v1 requirements: 106 total
- Mapped to phases: 106
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-17*
*Last updated: 2026-08-17 after roadmap traceability mapping*
