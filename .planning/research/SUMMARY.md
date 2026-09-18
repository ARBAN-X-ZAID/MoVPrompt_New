# Project Research Summary

**Project:** MovPrompt
**Domain:** Kuwait-first template-led AI social-content platform
**Researched:** 2026-08-17
**Confidence:** HIGH

## Executive Summary

MovPrompt should not become a broader model marketplace or professional timeline editor. Higgsfield already competes on cinematic breadth and presets, HeyGen on presenters/languages, and Canva on broad design/editing. The defensible product is simpler and more specific: a Kuwait business owner provides a product, service, or business link, chooses an outcome, and receives an accurate Arabic/English/bilingual social campaign pack without learning video production.

The existing React/Hono/PostgreSQL/Better Auth/pg-boss/S3 foundation is the correct architecture and should be completed, not replaced. Development must first close the real product loop—authoritative project state, price, durable provider operation, owned output, quality acceptance, honest progress, editor/export parity—before expanding templates or Advanced Mode.

The largest risks are integration truth failures: provider success without a usable MovPrompt output, sample media displayed as customer output, draft fields lost across auth, and charges detached from accepted results. The roadmap therefore begins with runtime/data correctness, proves one product and one service golden path, then adds deterministic editing/social packs, launch templates/localization, Advanced parity, and commercial production controls.

## Key Findings

### Recommended Stack

Preserve the current monorepo. PostgreSQL transactions and pg-boss provide the required durability and exactly-once economics; S3-compatible private storage provides stable ownership; FFmpeg/FFprobe and a shared Remotion composition make actual downloads match the editor. Better Auth is appropriate for PostgreSQL-backed identities and callbacks.

**Core technologies:**
- React/Vite: guided responsive customer experience — already established.
- Hono + Zod: typed portable API — small, explicit boundary.
- PostgreSQL/Drizzle/pg-boss: source of truth and durable orchestration — essential for versions, ledger, and recovery.
- S3-compatible storage: durable media ownership — prevents provider URL expiry.
- Remotion/FFmpeg: deterministic social-pack delivery — ensures preview/output parity.

### Expected Features

**Must have (table stakes):**
- Accurate URL/photo/footage/manual import.
- Outcome-led templates with real previews and transparent costs.
- Exact auth/draft recovery and background generation.
- Projects, immutable versions, guided edits, and four-format downloads.
- Arabic/English/bilingual, KWD, Kuwait phone, WhatsApp, and safe-zone support.

**Should have (competitive):**
- Kuwait Campaign Autopilot and business/service recipes.
- Business Truth Lock and accepted-output guarantee.
- Complete social pack with copy, captions, subtitles, poster, QR, and CTA.
- Clinic compliance and transparent provenance.
- Template-to-Advanced immutable fork.

**Defer (v2+):**
- Full timeline, broad model marketplace, automatic publishing, scene-lock regeneration, Digital Twins, and other GCC markets.

### Architecture Approach

Use one authoritative path: guest IndexedDB → authenticated PostgreSQL project/version → configuration-bound quote → transactional run/outbox → durable provider operation → private output copy → technical/visual QA → accepted version → deterministic export artifacts. Browser state displays this process but never controls it.

**Major components:**
1. Guided web creator — simple tasks, drafts, project/editor views.
2. Portable API/data plane — ownership, templates, versions, quotes, runs, credits.
3. Durable worker — provider, persistence, quality, refund, exports.
4. Private media layer — inputs, accepted outputs, posters, downloadable artifacts.

### Critical Pitfalls

1. **Provider complete but app stuck** — persist/reconcile the same operation and expose real stages.
2. **Demo media shown as output** — separate source, direction, preview, and generated artifact types.
3. **Draft settings lost** — one normalized campaign contract and exact auth recovery tests.
4. **User charged for failures** — configuration-bound quote, transactional reservation, and exactly-once settlement.
5. **Arabic/clinic content only looks complete** — rendered human QA and compliance blocking, not direction toggle alone.

## Implications for Roadmap

### Phase 1: Production Truth Foundation
**Rationale:** Nothing else is dependable until project, quote, worker, output, and settlement truth agree.
**Delivers:** Clean baseline, migrations, API/worker fingerprint, heartbeat, authoritative pricing, output reconciliation, observability.
**Addresses:** Generation availability and ownership.
**Avoids:** Provider-complete/app-stuck and double-charge failures.

### Phase 2: Product and Service Golden Paths
**Rationale:** Validate the core promise with one physical product and one service business before catalog expansion.
**Delivers:** Import/upload, facts, outcome/template, campaign, auth recovery, generation, project reload.
**Uses:** Existing portable data plane and creative engine.
**Implements:** One normalized campaign contract.

### Phase 3: Honest Editor and Social Pack
**Rationale:** A provider clip is not the promised product.
**Delivers:** Shared Remotion composition, guided edits, versions, four ratios, captions, subtitles, poster, WhatsApp assets, Download All.

### Phase 4: Launch Template System
**Rationale:** Templates need real recipes and previews after the pipeline is trustworthy.
**Delivers:** Curated high-quality launch set across salons, clinics, shops, ecommerce and content outcomes.

### Phase 5: Kuwait Localization and Compliance
**Rationale:** Deep local quality is the main differentiation and clinic content carries special risk.
**Delivers:** Full Arabic/RTL/KWD/phone/Gulf copy QA and clinic safeguards.

### Phase 6: Advanced Mode Parity
**Rationale:** Professional controls should reuse the proven project/run/version system.
**Delivers:** Real directions, references, camera/lighting/motion, quotes, renders, comparison, retries.

### Phase 7: Commercial and Production Launch
**Rationale:** Billing and broad rollout require verified product reliability.
**Delivers:** UPayments, credits, account/admin/notifications, security, accessibility, monitoring, backups, staged rollout.

### Phase Ordering Rationale

- Data/runtime truth precedes UX expansion because every customer surface depends on it.
- One product and one service journey precede 50-template polish because they expose different import and campaign needs.
- Deterministic editing/export precedes catalog scale because the social pack is the actual customer deliverable.
- Advanced Mode follows beginner reliability so it cannot fragment history, pricing, or generation again.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Live Gateway async/output contract, cost sampling, and production observability.
- **Phase 3:** Remotion/FFmpeg composition and multi-ratio safe-zone implementation.
- **Phase 5:** Kuwait clinic advertising/privacy/consent legal review and Arabic human QA.
- **Phase 7:** UPayments webhook/refund behavior and production infrastructure limits.

Phases with standard patterns:
- **Phase 2:** Existing contracts and code already define most golden-path components.
- **Phase 6:** Existing Advanced UI and immutable project model provide the base.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing implementation plus official platform documentation |
| Features | HIGH | User decisions and current competitor product documentation align |
| Architecture | HIGH | Existing code implements the required pattern; gaps are integration/completion |
| Pitfalls | HIGH | Directly observed repository/browser/provider failure modes plus official constraints |

**Overall confidence:** HIGH

### Gaps to Address

- **Provider economics:** Collect accepted 480p/720p canary samples before final public credit prices.
- **Clinic law/policy:** Obtain Kuwait legal review before enabling commercial clinic exports.
- **Template acceptance:** Test the launch set with actual Kuwait business owners and real assets.
- **Performance claims:** Do not publish “better than competitors” until a blinded campaign-readiness benchmark supports it.

## Sources

### Primary (HIGH confidence)
- https://vercel.com/docs/ai-gateway/getting-started/video — AI Gateway video generation.
- https://better-auth.com/docs/adapters/postgresql — Better Auth and PostgreSQL.
- https://developers.cloudflare.com/r2/api/s3/api/ — S3-compatible output storage.
- https://www.facebook.com/business/ads/facebook-instagram-reels-ads — Reels creative guidance.
- https://www.facebook.com/business/ads/click-to-message-ads — WhatsApp/message conversion.
- https://www.facebook.com/help/1038071743007909 — Instagram Reels format requirements.
- https://higgsfield.ai/blog/The-Fastest-Way-to-Create-Cinematic-Product-Commercials — competitor template workflow.
- https://higgsfield.ai/blog/cinema-studio-guide — competitor advanced workflow.
- https://www.heygen.com/tool/ai-product-placement — competitor product/presenter workflow.
- https://www.canva.com/en_in/pro/brand-kit/ — competitor brand/template/resize workflow.

### Secondary (MEDIUM confidence)
- `.planning/codebase/` — repository-grounded map created 2026-08-16.
- Existing MovPrompt test and operational evidence documented in `docs/` and source tests.

### Tertiary (LOW confidence)
- None used for locked decisions.

---
*Research completed: 2026-08-17*
*Ready for roadmap: yes*
