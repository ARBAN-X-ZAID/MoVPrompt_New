---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 4
current_phase_name: Durable Generation and Accepted Quality
status: executing
stopped_at: Blocking Task 04-02-03 — qualified-human Kuwait calibration
last_updated: "2026-09-01T13:42:43Z"
last_activity: 2026-09-01
last_activity_desc: Published the complete canonical project to virtuprose/Zaid-MOVPROMPT with one main branch; Phase 04 calibration remains pending
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 22
  completed_plans: 20
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-08-17)

**Core value:** A Kuwait business owner with no video skills can create a professional, accurate, ready-to-publish social-media campaign in minutes without prompts, timelines, models, or editing software.
**Current focus:** Phase 4 — Durable Generation and Accepted Quality

## Current Position

Phase: 4 (Durable Generation and Accepted Quality) — EXECUTING
Plan: 2 of 3
Status: Blocking Task 04-02-03 requires genuine qualified-human calibration
Last activity: 2026-08-21 — Completed quick task 260821-tat: local-only Seedance Fast generation profile

Progress: [██████░░░░] 56%

## Performance Metrics

**Velocity:**

- Total plans completed: 20
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | - | - |

**Recent Trend:** Not available until execution begins.
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 02 P01 | 18min | 3 tasks | 14 files |
| Phase 02 P02 | 11 min | 2 tasks | 5 files |
| Phase 02-guest-authentication-and-data-integrity P03 | 11min | 3 tasks | 15 files |
| Phase 02 P04 | 10min | 3 tasks | 11 files |
| Phase 02 P05 | 25min | 3 tasks | 20 files |
| Phase 02 P06 | 12m | 3 tasks | 18 files |
| Phase 02 P07 | 17m | 3 tasks | 14 files |
| Phase 02-guest-authentication-and-data-integrity P08 | 7m | 3 tasks | 15 files |
| Phase 03 P01 | 11m | 3 tasks | 15 files |
| Phase 03-product-and-service-golden-paths P02 | 26min | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Full decisions are recorded in `.planning/PROJECT.md`.

- Template Mode is the default; Advanced Mode is separate and secondary.
- Kuwait launches first for salons, clinics, shops, and ecommerce.
- Account creation occurs only at Generate and restores the exact draft.
- Every accepted generation becomes a complete four-format social campaign pack.
- Existing React/Hono/PostgreSQL/Better Auth/pg-boss/S3 architecture is completed, not replaced.
- [Phase ?]: Guest claim projects remain non-ready until every required asset checkpoint is verified and an immutable version is persisted.
- [Phase ?]: Guest claim replay is enforced by global draft uniqueness, owner-plus-intent uniqueness, and advisory locks.
- [Phase 02]: Guest draft expiry remains fixed from first save; ordinary edits only update the snapshot.
- [Phase 02]: Local guest data is deleted only after exact canonical configuration and ordered asset-manifest verification.
- [Phase ?]: First-campaign verification is fixed to deferred_until_after_first_campaign; social visibility is server-derived only.
- [Phase ?]: OAuth callback fixtures are test-only injected adapters that reject production loading.
- [Phase ?]: Guest claim lifecycle is explicit: start, resume per server checkpoint, then idempotent finalization.
- [Phase ?]: The immutable local manifest asset ID is also the private object asset ID, avoiding browser-side ID translation.
- [Phase ?]: Signed previews remain response-only; ordered checksum manifests are the browser cleanup authority.
- [Phase ?]: PostgreSQL fixed-window consume function is the only quota authority; no in-memory fallback exists.
- [Phase ?]: Forwarded identities are ignored by default and selected only from explicitly configured trusted proxy hops.
- [Phase ?]: Source scans and image mirrors share public-address filtering, DNS resolution, address pinning, redirect limits, and timeout defaults.
- [Phase ?]: Source replacement uses a server-computed fingerprinted child version; accepted history is retained while incompatible current output is cleared.
- [Phase ?]: A current creator output must match the active source fingerprint; otherwise the UI shows no current video.
- [Phase ?]: Cleanup leases claim assets before deletion so finalization cannot race accepted media.
- [Phase ?]: Phase 2 owner tables force RLS and are proven through a non-superuser no-bypass current_user role.
- [Phase ?]: PostgreSQL integration suites use fresh generated disposable databases when fixtures require empty state.
- [Phase ?]: Social auth controls fail closed until the public server capability enables them.
- [Phase ?]: First-campaign email verification is a non-blocking private-beta reminder.
- [Phase ?]: Rendered browser evidence records unavailable live-stack routes as open, never as passing.
- [Phase 03]: CampaignSource plus its ConfirmedFact collection is the one normalized product/service anchor; legacy product fields derive a compatibility source only.
- [Phase 03]: Campaign fact provenance transitions are explicit and immutable: imported values become confirmed only when selected, while edits remain manual.
- [Phase 03]: Source choices now converge on one normalized CampaignSource with provenance-visible review.
- [Phase 03]: Source retries retain the exact guest draft and never clear reviewed facts.

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 04 Task 04-02-03 is blocking: automation cannot create, duplicate, self-approve, or infer the two independent qualified-human label sets, adjudication, role attestations, and approval record.
- The paid Seedance 2.5 canary remains a separate later gate under Task 04-03-03. It requires approved exact-version calibration first, followed by a new explicit current USD cap and one-operation authorization.
- Phase 1: Live provider completion, private output recovery, worker reconciliation, and browser progress must agree before generation can be called reliable.
- Phase 1: Production prices require accepted-output cost evidence by resolution; client fallback prices are prohibited.
- Phase 8: Commercial clinic launch requires Kuwait legal review.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260821-tat | Switch local development generation to Seedance v1.0 Pro Fast while keeping staging and production on Seedance 2.5 | 2026-08-21 | 8e52765 | [260821-tat-switch-local-development-video-generatio](./quick/260821-tat-switch-local-development-video-generatio/) |
| 260901-mpw | Publish the complete canonical MovPrompt project to the new single-main VirtuProse GitHub repository | 2026-09-01 | 911381e | [260901-mpw-publish-the-complete-current-movprompt-s](./quick/260901-mpw-publish-the-complete-current-movprompt-s/) |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| People | Digital Twins | Deferred to v2 | Initialization |
| Editing | Locked single-scene regeneration | Deferred to v2 | Initialization |
| Distribution | Direct publishing and scheduling | Deferred to v2 | Initialization |
| Markets | Saudi Arabia and UAE | Deferred to v2 | Initialization |

## Session Continuity

Last session: 2026-09-01T13:42:43Z
Stopped at: Blocking Task 04-02-03 — qualified-human Kuwait calibration
Resume file: .planning/PROGRESS.md
