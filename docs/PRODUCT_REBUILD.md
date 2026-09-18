# MovPrompt product rebuild baseline

This document is the implementation source of truth for the phased rebuild approved on 2026-08-11. Existing screens remain available until their replacement passes its exit gate.

## Product thesis

The primary launch user is a GCC small-business owner or marketer who needs a credible product video without knowing video editing. Their core tasks are: add a product, choose a campaign outcome, review the facts and price, generate, make precise brand/copy changes, and download platform-ready formats. Template Mode is the default. Advanced Mode is a separate workspace that never leaks model complexity into the beginner journey.

The visual direction is a calm enterprise workspace: warm neutral surfaces, dark media canvases, one amber action accent, restrained motion, clear task hierarchy, bilingual typography, and honest status language.

## Phase 0 route baseline

| Route | Baseline status | Target |
|---|---|---|
| `/` | Production-used marketing homepage | Keep design; public creator links |
| `/create` | Partially implemented, previously auth-guarded | Public product-first creator |
| `/templates` | Partially implemented, previously auth-guarded | Public canonical catalog |
| `/projects` | Partially implemented/localStorage prototype | Authenticated cloud projects |
| `/ads` | Production-used advanced prototype | Compatibility redirect after parity |
| `/movprompt` | Production-used advanced template workshop | `/advanced/templates` |
| `/library` | Production-used split history | Projects or Advanced History |
| `/onboarding` | Legacy mandatory detour | Optional setup, never blocks generation resume |
| `/qa/create`, `/qa/mobile`, `/hero-preview` | Development-only | Development-only |

Route definitions originate in `apps/web/src/App.tsx`. No baseline route is removed during consolidation.

## Shared terminology

- **Creation draft:** guest or signed-in configuration before submission.
- **Project:** owned container for accepted versions, assets, runs and exports.
- **Project version:** immutable configuration snapshot.
- **Render run:** durable, idempotent generation operation and its exact charge/refund state.
- **Export:** an independent deterministic or generative output artifact.
- **Capability alias:** server-owned approved model family identifier.

## Feature flags

The new guest creator, workspace shell, projects, Advanced Mode and export pipeline are controlled in `apps/web/src/config/features.ts`. Environment overrides use `VITE_FEATURE_*` values. New routes may ship behind flags while legacy routes remain reachable. Backend-dependent behavior is additionally controlled by server feature flags.

## Baseline risks

- Creator tables in the prior migration are not a reliable deployed source of truth.
- Local projects were shared across users in one browser storage key.
- Generation completion depended on an open client poller.
- Existing balance/cost text was hardcoded and economically inconsistent.
- Existing guest entry points authenticated before configuration and did not preserve the attempted route.

Phase exit evidence must include code checks, database/API checks where deployable, and rendered-browser checks. Code alone does not close a phase.

## Portable deployment operations

- Keep Supabase unchanged and read-only during development and the cutover window.
- Apply repository-owned PostgreSQL migrations through `packages/db` before enabling portable API flags.
- Run API and worker as separate always-on services. Browser polling displays state but never owns completion.
- Store stable private object keys in PostgreSQL and generate short-lived signed URLs on demand.
- Enable generation only after quotes, ledger reservations, render runs and the transactional outbox are atomically connected.
- Activate compatibility redirects only after data and behavior parity has been demonstrated.
