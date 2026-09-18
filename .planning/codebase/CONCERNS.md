# Codebase Concerns

**Analysis Date:** 2026-08-16

## Tech Debt

**Portable/legacy hybrid:**
- Issue: Canonical-looking web routes still contain Supabase branches while Better Auth/MongoDB is the portable target.
- Files: `apps/web/src/pages/AdvancedStudio.tsx`, `apps/web/src/lib/director/api.ts`, `apps/web/src/integrations/supabase/client.ts`, `supabase/functions/`.
- Impact: A portable-auth session can reach code that expects Supabase authentication or legacy tables/functions.
- Fix approach: Complete portable API parity per route, switch each canonical surface atomically, then redirect and retire the legacy path.

**Oversized UI modules:**
- Issue: Several files exceed 1,000 lines and combine orchestration, data access, state, and presentation.
- Files: `apps/web/src/features/create/CreateStudio.tsx`, `apps/web/src/pages/MarketingStudio.tsx`, `apps/web/src/pages/Library.tsx`, `apps/web/src/pages/Landing.tsx`.
- Impact: High regression risk and difficult isolated testing.
- Fix approach: Extract state machines/controllers and focused panels only after current vertical journeys have regression coverage.

**Dirty integration baseline:**
- Issue: The current worktree contains a large volume of modified and untracked implementation files.
- Files: repository-wide; inspect with `git status --short` before any cleanup or branch operation.
- Impact: It is difficult to distinguish committed baseline from in-progress work, and broad git operations could lose user changes.
- Fix approach: Verify, stage, and commit logical slices without resetting unrelated work.

## Known Bugs

**Provider completion can outpace local completion:**
- Symptoms: Vercel can report a completed Seedance operation while the application remains in a preparing/rendering progress state.
- Files: `packages/providers/src/vercel-gateway-seedance.ts`, `apps/worker/src/output-persister.ts`, `apps/worker/src/render-lifecycle.ts`, `apps/api/src/generation-routes.ts`.
- Trigger: Provider completes but output URL retrieval, hostname validation, download, persistence, quality review, or worker reconciliation does not finish.
- Workaround: None should be presented as success; reconcile the same operation and preserve the run/charge state.

**Generation availability is intentionally fail-closed:**
- Symptoms: Quote UI reports generation/pricing unavailable.
- Files: `apps/api/src/generation-availability.ts`, `apps/api/src/generation-pricing.ts`, `packages/providers/src/capability-registry.ts`.
- Trigger: Missing/expired worker heartbeat, pricing tier, exact adapter/model, private storage, output-host allowlist, FFmpeg/FFprobe, or quality reviewer.
- Workaround: Configure and prove every readiness dependency; do not bypass the gate in UI.

## Security Considerations

**Hybrid authorization boundaries:**
- Risk: Direct Supabase calls and portable cookie auth can diverge.
- Files: Supabase-importing files under `apps/web/src/` and portable routes in `apps/api/src/`.
- Current mitigation: Feature flags and explicit portable branches.
- Recommendations: Remove Supabase imports from canonical routes before production cutover.

**Remote source ingestion:**
- Risk: SSRF, DNS rebinding, large files, MIME spoofing, and redirect abuse.
- Files: `apps/api/src/source-scanner.ts`, `apps/api/src/remote-image-fetcher.ts`, `apps/api/src/asset-routes.ts`.
- Current mitigation: public-IP validation, per-hop redirect validation, pinned transport, time/byte limits, MIME and magic-byte checks.
- Recommendations: Add rate limiting/bot protection and keep the security tests mandatory.

**Generated output ingestion:**
- Risk: Untrusted provider URLs or oversized/invalid media entering private storage.
- Files: `apps/worker/src/output-persister.ts`.
- Current mitigation: HTTPS, DNS validation, exact host allowlist, byte/MIME/MP4 checks, and FFmpeg/FFprobe validation.
- Recommendations: Alert on every unknown output host and reconcile the same operation instead of resubmitting.

## Performance Bottlenecks

**Web bundle and media catalog:**
- Problem: The product has many heavy pages, components, and local preview assets.
- Files: `apps/web/src/App.tsx`, `apps/web/src/features/create/TemplateGrid.tsx`, `apps/web/public/template-previews/`.
- Cause: Large legacy screens and media-rich template cards.
- Improvement path: Preserve route-level lazy loading, visibility-gate video, optimize posters, and enforce `scripts/infra/check-web-bundle.ts`.

**Generation latency:**
- Problem: Provider generation plus output download, transcoding, and quality review can take minutes.
- Files: `apps/worker/src/render-lifecycle.ts`, `apps/worker/src/media-quality-analyzers.ts`.
- Cause: Durable external operation plus safety/quality stages.
- Improvement path: Display truthful server stages and timestamps; never synthesize a fake percentage that stalls at an arbitrary value.

## Fragile Areas

**Render economics and lifecycle:**
- Files: `packages/db/src/generation-service.ts`, `apps/worker/src/render-lifecycle.ts`.
- Why fragile: Provider acceptance, entitlement reservation, charge, retries, cancellation, completion, and refund must be exactly once under concurrency.
- Safe modification: Add domain tests and MongoDB concurrency tests before changing transitions.
- Test coverage: Strong unit/integration coverage exists; live provider/output recovery remains externally dependent.

**Working versus accepted versions:**
- Files: `packages/db/migrations/0011_separate_working_and_accepted_versions.sql`, `apps/api/src/creator-repository.ts`, `apps/worker/src/render-lifecycle.ts`.
- Why fragile: A failed new version must not replace the last usable output.
- Safe modification: Maintain separate pointers and require a completed render before acceptance.
- Test coverage: worker lifecycle unit tests and the local MongoDB runtime verifier cover queue and heartbeat recovery.

**Guest-to-auth draft claim:**
- Files: `apps/web/src/features/create/guestDraftStore.ts`, `apps/web/src/features/create/creatorAssets.ts`, `apps/api/src/creator-routes.ts`.
- Why fragile: OAuth reload, blob lifetimes, retries, and account switching can lose or leak a draft.
- Safe modification: Keep the stable pending-generation ID and delete local blobs only after server checksum verification.
- Test coverage: Unit/component coverage exists; committed cross-browser E2E is missing.

## Scaling Limits

**Single MongoDB queue:**
- Current capacity: MongoDB lease queue and the application database share MongoDB.
- Limit: High render volume can contend with API/data traffic and outbox polling.
- Scaling path: Tune pools and queue leases first; isolate worker database resources or move queue infrastructure only after measured pressure.

**Generation concurrency:**
- Current capacity: Server rules target one active render per project and limited renders per user.
- Limit: Provider rate limits and Gateway spending.
- Scaling path: Enforce per-user/project limits, provider budgets, alerts, and staged rollout.

## Dependencies at Risk

**Legacy Supabase SDK and functions:**
- Risk: They preserve duplicate auth, generation, credits, and history implementations.
- Impact: Conflicting truth and accidental exposure of unapproved models/old pricing.
- Migration plan: Finish portable API surfaces, migrate data, keep Supabase read-only for rollback, then remove runtime use.

**Provider-specific async contract:**
- Risk: Output shapes/URLs and cancellation support can change independently of public catalog availability.
- Impact: Completed paid operations may not become downloadable project outputs.
- Migration plan: Keep adapters isolated, persist operation payloads, use contract tests/canaries, and fail closed per capability.

## Missing Critical Features

**Production-proven end-to-end generation:**
- Problem: Repository code supports durable generation, but production readiness depends on live matching API/worker configuration, fresh heartbeat, pricing, output host, storage, and quality verification.
- Blocks: Reliable public generation claims.

**Deterministic campaign-pack exports:**
- Problem: Schema/job contracts exist, but a complete Remotion/FFmpeg export package and four independent artifacts are not present.
- Blocks: Preview-equals-download editing and Download All campaign packs.

**Complete template preview catalog:**
- Problem: `packages/creative-engine/src/catalog.ts` contains 50 concepts, while `apps/web/src/features/create/templateMedia.ts` has only a smaller verified playable-video set.
- Blocks: Claiming every template has an original playable finished preview.

**Commercial billing:**
- Problem: Payment tables exist in `packages/db/src/schema.ts`, but portable checkout/webhook/account operations are not implemented end to end.
- Blocks: Paid self-service launch after starter entitlement.

**People Studio/Digital Twins:**
- Problem: Capability aliases and product direction exist, but consent enrollment, provider integration, revocation, and deletion journeys are not complete.
- Blocks: Public launch promise for AI UGC, uploaded people, and speaking Digital Twins.

## Test Coverage Gaps

**Browser E2E:**
- What's not tested: Repeatable full guest import → auth → claim → quote → background render → output/download across reload.
- Files: `apps/web/src/features/create/`, `apps/api/src/`, `apps/worker/src/`.
- Risk: Unit-green components can still fail at session, storage, or runtime boundaries.
- Priority: High.

**Live media canaries:**
- What's not tested: Matrix of production Seedance resolutions, ratios, languages, audio states, output hosts, and quality acceptance.
- Files: `apps/worker/src/benchmark-cli.ts`, `apps/worker/src/gateway-local-cli.ts`.
- Risk: Catalog/model availability can be mistaken for usable output.
- Priority: High; keep cost-bounded and explicitly authorized.

**Export fidelity:**
- What's not tested: Browser preview versus final MP4 overlays, four independent ratios, and Download All contents.
- Files: future render/export package plus `apps/web/src/features/create/CreateStudio.tsx`.
- Risk: User edits may not appear in the delivered file.
- Priority: High before commercial launch.

---

*Concerns audit: 2026-08-16*
