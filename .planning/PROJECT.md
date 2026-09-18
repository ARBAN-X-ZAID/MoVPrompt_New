# MovPrompt

## What This Is

MovPrompt is a Kuwait-first social content creation platform for business owners who have no video-making or editing knowledge. A salon, clinic, local shop, or ecommerce business can paste a link or upload its own content, choose a purpose-built template, generate a high-quality Arabic, English, or bilingual video, make simple guided edits, and download a complete social-media pack.

Template Mode is the default experience. Advanced Mode remains a separate secondary workspace for experienced users who need prompts, references, camera, lighting, motion, and visual-direction controls.

## Core Value

A Kuwait business owner with no video skills can create a professional, accurate, ready-to-publish social-media campaign in minutes without learning prompts, timelines, models, or editing software.

## Business Context

- **Customer**: Kuwait salons, clinics, local shops, and ecommerce businesses; the primary user is the owner or staff member creating content without an agency.
- **Revenue model**: One verified-account starter render followed by prepaid KWD credit bundles; subscriptions and enterprise plans are deferred.
- **Success metric**: At least 85% of first-time users complete and download a usable social-media pack without support.
- **Strategy notes**: Compete on Kuwait campaign readiness, truthful business content, simplicity, and complete deliverables—not on the number of exposed AI models.

## Requirements

### Validated

- ✓ The product has a public marketing site, Template Mode, Advanced Mode, template catalog, Projects, authentication, and account routes — existing code.
- ✓ The web supports guest drafts, product/business link import, photo uploads, campaign settings, template selection, and Generate-time authentication — existing code.
- ✓ MongoDB models users, immutable template/project versions, assets, quotes, render runs, credits, entitlements, exports, payments, notifications, outbox jobs, and worker heartbeats — migrated for development on 2026-09-12.
- ✓ The API exposes portable template, project, version, asset, quote, render, credit, and output endpoints with owner-scoped transactions — existing code.
- ✓ The worker implements a MongoDB-leased durable queue and outbox, provider reconciliation, private output persistence, media validation, quality review, controlled retries, and idempotent refund logic.
- ✓ The creative engine contains 50 Kuwait-oriented template concepts with Arabic and English campaign copy — existing code.

### Active

- [ ] Make one complete product and one complete service journey production-reliable: import/upload → template → campaign → authentication → generation → project → edit → download.
- [ ] Make Template Mode usable by a person with no video knowledge, with one clear task and one clear primary action per screen.
- [ ] Support full social-content outcomes: offers, product/service demonstrations, educational tips, announcements, testimonials, brand stories, bookings, trust, launches, and WhatsApp orders.
- [ ] Preserve every confirmed business fact, image, language, price, offer, CTA, logo, brand setting, subtitle, audio, ratio, and rights decision through authentication and generation.
- [ ] Produce technically valid, quality-reviewed, MovPrompt-owned video outputs that recover correctly after browser closure or reload.
- [ ] Provide guided factual editing for text, price, offer, CTA, logo, colors, subtitles, voice/music, scene order, timing, crop, and output format without generative charges.
- [ ] Quote visual changes clearly and create a new immutable generated version without replacing the last accepted output after failure.
- [ ] Deliver a complete social-media pack: 9:16, 1:1, 4:5, and 16:9 videos; subtitles; thumbnail; Arabic/English captions; WhatsApp CTA/link/QR; and Download All.
- [ ] Make the campaign experience Kuwait-native: Arabic, English, bilingual, RTL, KWD with three decimals, Kuwait phone normalization, Gulf-Arabic option, and WhatsApp/booking outcomes.
- [ ] Publish rights-cleared, unique, playable previews and production recipes for the launch template catalog; static direction art must never pretend to be a finished preview.
- [ ] Keep Advanced Mode separate and secondary while connecting every visible control to a real version, quote, render, or reference.
- [ ] Add clinic-specific claim, identity, privacy, consent, and before/after safeguards before clinic templates can be used commercially.
- [ ] Complete prepaid KWD billing, notifications, account operations, admin oversight, monitoring, rate limits, backup/restore, accessibility, and production rollout gates.
- [ ] Remove all canonical runtime dependency on Supabase after data migration and rollback validation.

### Out of Scope

- General-purpose multitrack timeline — conflicts with the beginner-first product promise.
- Node-based workflow canvas or public marketplace of every AI model — exposes complexity without improving the Kuwait business outcome.
- Long-form filmmaking and general cinema production — Higgsfield/Runway territory, not the launch category.
- Automatic ad buying or social scheduling — the initial product creates validated publish-ready assets; publishing comes later.
- True locked single-scene regeneration — requires scene-level generation/stitching infrastructure and is deferred until the full-video version system is stable.
- Native mobile applications — responsive web ships first.
- Saudi Arabia, UAE, and other GCC localization — Kuwait launches first; the architecture remains extensible.
- Enterprise SSO, complex approvals, and public APIs — deferred until repeatable product-market fit.

## Context

- The repository is a Bun/TypeScript monorepo with a React/Vite web app, Hono API, MongoDB data layer, Better Auth, MongoDB-leased worker, private S3-compatible storage, and provider adapters.
- The codebase map is stored in `.planning/codebase/` and identifies a substantial portable foundation alongside legacy Supabase branches.
- Current production risk is concentrated at integration boundaries: matching API/worker readiness, authoritative pricing, provider output recovery, private storage, quality review, and browser-visible run recovery.
- The template catalog has more concepts than verified playable previews; marketing truth must distinguish finished examples from visual directions.
- Meta recommends native 9:16 video with audio and safe-zone messaging for Reels, while business messaging and click-to-WhatsApp are direct conversion paths. These support MovPrompt's campaign-pack and WhatsApp-first decisions.
- Higgsfield and HeyGen already make product-to-video generation fast. MovPrompt differentiates through broader Kuwait business outcomes, deterministic business-fact editing, Arabic/RTL quality, and a complete ready-to-publish social pack.
- Existing uncommitted work belongs to the user. Development must preserve it and commit only verified logical slices.

## Constraints

- **Primary user**: Must require no knowledge of prompts, models, timelines, codecs, or video editing.
- **Market**: Kuwait only for initial production; Arabic, English, and bilingual are first-class.
- **Truth**: Imported or user-confirmed facts must never be invented or changed silently.
- **Authentication**: Guests configure first; account creation appears only at Generate and must restore the exact draft.
- **Architecture**: Continue the React/Hono/MongoDB/Better Auth/S3 system; database and queue changes must preserve owner isolation, transactions, idempotency, and durable retries.
- **Generation**: Provider/model IDs remain server-only; capabilities fail closed until pricing, worker, storage, output, and quality evidence agree.
- **Economics**: A user pays for an accepted output, not failed provider attempts; charges/refunds and retries are idempotent.
- **Editing**: Deterministic factual edits are free; visual changes are separately quoted immutable versions.
- **Compliance**: Clinic content requires legal review and stronger claim, identity, consent, and privacy rules than retail content.
- **Quality**: Every production claim requires database, API, worker, media, and rendered-browser evidence—not code presence alone.
- **Accessibility**: Core journeys must meet WCAG 2.2 AA and work at 375, 768, 1024, and 1440 pixels in light/dark and English/Arabic.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Serve all business social-content outcomes, not ads only | Businesses need a repeatable content system: education, announcements, trust, offers, products, services, and stories | ✓ Locked 2026-08-17 |
| Launch Kuwait first | Allows high-quality KWD, Arabic/RTL, Gulf tone, phone, WhatsApp, booking, seasonal, and clinic policy support | ✓ Locked 2026-08-17 |
| Focus launch templates on salons, clinics, shops, and ecommerce | These verticals cover the main Kuwait booking, trust, retail, and WhatsApp-commerce jobs | ✓ Locked 2026-08-17 |
| Template Mode is the default | The primary user has no video knowledge and should choose outcomes rather than models or prompts | ✓ Locked 2026-08-17 |
| Advanced Mode is separate and secondary | Preserves professional control without burdening beginners | ✓ Locked 2026-08-17 |
| No traditional timeline at launch | Guided edits are easier and sufficient for business facts and social formats | ✓ Locked 2026-08-17 |
| Account creation occurs only at Generate | Users experience value before authentication and retain the exact draft | ✓ Locked 2026-08-17 |
| Accept product/business URLs, photos, footage, and manual entry | Supports both physical-product and service businesses | ✓ Locked 2026-08-17 |
| Every generation produces a social-media pack | Customers need usable deliverables, not one isolated provider clip | ✓ Locked 2026-08-17 |
| MongoDB is authenticated source of truth; IndexedDB is guest-only | Enables durable projects, ownership, recovery, and cross-device authenticated use | ✓ Changed for development 2026-09-12 |
| Retain the current portable architecture | The foundation is substantial; another rewrite would delay user value and increase risk | ✓ Locked 2026-08-17 |
| Clinic content has stricter guardrails | Medical claims, patient privacy, consent, and before/after content create higher legal and trust risk | ✓ Locked 2026-08-17 |
| Launch with 18 verified templates; keep unreviewed concepts hidden or labeled directions | A smaller trustworthy catalog is stronger than 50 repeated or unplayable demo cards | ✓ Locked 2026-08-17 |
| Allow private-beta first campaign before email verification; remind in dashboard | Removes meeting/private-beta friction while preserving a clear path to production verification controls | ✓ Locked 2026-08-17 |
| Defer Digital Twins to v2 | Consent, identity, revocation, deletion, Arabic voice, and provider proof are too risky to bundle into the beginner launch | ✓ Locked 2026-08-17 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-17 after initialization*
