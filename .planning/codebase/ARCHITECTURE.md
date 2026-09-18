<!-- refreshed: 2026-08-16 -->
# Architecture

**Analysis Date:** 2026-08-16

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ React web application                                      │
│ `apps/web/src/App.tsx`                                     │
├──────────────────┬──────────────────┬───────────────────────┤
│ Template Create  │ Advanced Studio  │ Projects/Auth/Account │
│ `features/create`│ `pages/Advanced` │ `pages/`              │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ portable HTTP    │ guest IndexedDB    │ legacy branch
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Hono API `apps/api/src/`                                   │
│ Auth, templates, projects, assets, quotes, render control   │
└────────┬────────────────────────────────────────────────────┘
         │ MongoDB transaction + outbox
         ▼
┌──────────────────────────┬──────────────────────────────────┐
│ MongoDB `packages/db`    │ Mongo lease worker `apps/worker` │
│ versions/ledger/RLS      │ provider/output/quality lifecycle│
└──────────────┬───────────┴──────────────┬───────────────────┘
               ▼                          ▼
     private S3-compatible storage   approved AI capabilities
     `packages/storage`              `packages/providers`
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Web router | Public, guest, authenticated, legacy, and development-only routes | `apps/web/src/App.tsx` |
| Template creator | Product-first/template-first guest draft, campaign settings, auth handoff, generation progress, editor | `apps/web/src/features/create/CreateStudio.tsx` |
| Advanced workspace | Direction controls, references, quote, and portable/legacy submission | `apps/web/src/pages/AdvancedStudio.tsx` |
| Portable API | HTTP composition, CORS, auth, health, flags, and route registration | `apps/api/src/app.ts` |
| Creator repository | Templates, projects, immutable versions, credits, output URLs | `apps/api/src/creator-repository.ts` |
| Generation service | Quote validation, ownership preflight, run submission/status/cancel | `apps/api/src/generation-service.ts` |
| Generation domain | Quote hash, reservations, ledger, entitlement, outbox atomicity | `packages/db/src/generation-service.ts` |
| Worker lifecycle | Provider submit/reconcile, quality retry, completion, refund | `apps/worker/src/render-lifecycle.ts` |
| Provider registry | Public capability aliases to server-only adapters/models | `packages/providers/src/capability-registry.ts` |
| Creative engine | Kuwait templates, localized prompts, preflight, quality gates | `packages/creative-engine/src/` |

## Pattern Overview

**Overall:** Modular monorepo with a React client, transaction-oriented Hono API, MongoDB outbox, and durable asynchronous worker.

**Key Characteristics:**
- Public contracts are Zod schemas in `packages/contracts/src/`; server-only model IDs never belong in browser contracts.
- Authenticated writes use explicit owner filters, MongoDB unique indexes, and replica-set transactions.
- Project versions, quotes, ledger entries, and render attempts are immutable or append-oriented.
- Generation is fail-closed until capability, pricing, storage, quality tooling, and worker heartbeat all agree.
- Legacy Supabase paths coexist while portable route parity is completed.

## Layers

**Presentation:**
- Purpose: Marketing, guided creation, Advanced controls, project library, account/auth.
- Location: `apps/web/src/`.
- Depends on: `@movprompt/contracts`, `@movprompt/creative-engine`, portable API, and selected legacy Supabase branches.

**HTTP application:**
- Purpose: Validate requests, authenticate ownership, expose safe responses, coordinate repositories.
- Location: `apps/api/src/`.
- Depends on: auth, DB, storage, providers, and contracts workspaces.

**Domain/data:**
- Purpose: Define schema, migrations, pricing-bound render invariants, credits, entitlements, and RLS.
- Location: `packages/db/src/` and `packages/db/migrations/`.
- Used by: API, auth, worker, migration tools.

**Asynchronous execution:**
- Purpose: Drain the transactional outbox, enqueue MongoDB-leased jobs, submit/reconcile provider operations, persist/validate outputs, update final state.
- Location: `apps/worker/src/`.
- Depends on: DB, provider, storage, creative-engine, FFmpeg/FFprobe.

## Data Flow

### Template Generation

1. Guest configures a `CreationDraft` and blobs in `apps/web/src/features/create/guestDraftStore.ts`.
2. Authentication is requested only at Generate through `apps/web/src/features/create/AuthGateDialog.tsx`.
3. Draft claiming creates a MongoDB project/version through `/api/v1/drafts/claim` in `apps/api/src/creator-routes.ts`.
4. Assets are uploaded or securely mirrored through `apps/api/src/asset-routes.ts` and private `packages/storage/src/service.ts`.
5. The API validates ownership/references and issues a configuration-bound quote in `apps/api/src/generation-service.ts`.
6. `packages/db/src/generation-service.ts` atomically reserves entitlement/credits, creates the run, and inserts an outbox job.
7. `apps/worker/src/outbox-dispatcher.ts` and `apps/worker/src/mongo-worker.ts` hand work to `apps/worker/src/render-lifecycle.ts`.
8. The provider adapter runs, output is copied and reviewed, and the accepted project version advances only on completion.
9. Browser polling/subscription displays server state; it does not control completion.

### Source Import

1. The web submits a link through `apps/web/src/lib/api/portableApiClient.ts`.
2. `apps/api/src/source-scanner.ts` parses and fetches the public page with SSRF and size controls.
3. Authenticated image mirroring revalidates each remote image in `apps/api/src/remote-image-fetcher.ts`.
4. Asset metadata and stable object keys are persisted; signed URLs are generated on demand.

**State Management:**
- Guest-only state: IndexedDB with seven-day TTL.
- Authenticated source of truth: MongoDB.
- Cached UI state: React state, React Query, and transitional local project cache in `apps/web/src/features/create/projectStore.ts`.

## Key Abstractions

**Capability Alias:**
- Purpose: Hide provider/model complexity from public clients.
- Examples: `packages/contracts/src/capabilities.ts`, `packages/providers/src/capability-registry.ts`.
- Pattern: Server-controlled registry with fail-closed resolution.

**Immutable Project Version:**
- Purpose: Preserve changes and last accepted output independently from the current working version.
- Examples: `packages/db/src/schema.ts`, `apps/api/src/creator-repository.ts`.
- Pattern: Working pointer plus accepted pointer; failures do not overwrite the last successful version.

**Transactional Render Run:**
- Purpose: Bind quote, configuration, charge, provider attempt, output, and refund.
- Examples: `packages/db/src/generation-service.ts`, `apps/worker/src/render-lifecycle.ts`.
- Pattern: Idempotency key + advisory locks + outbox + exactly-once ledger transitions.

## Entry Points

**Web:**
- Location: `apps/web/src/main.tsx` and `apps/web/src/App.tsx`.
- Triggers: Browser navigation.
- Responsibilities: Providers, routes, lazy loading, offline fallback, feature-gated surfaces.

**API:**
- Location: `apps/api/src/server.ts`.
- Triggers: Node process/Docker container.
- Responsibilities: Load runtime services and serve the Hono app.

**Worker:**
- Location: `apps/worker/src/main.ts`.
- Triggers: Node process/Docker container.
- Responsibilities: Validate runtime, register adapters, heartbeat, outbox dispatch, and MongoDB lease-queue handlers.

## Architectural Constraints

- **Concurrency:** Node event loops plus MongoDB transactions, conditional writes, leases, and unique singleton keys.
- **Global state:** API and worker compose singleton database/storage/provider services at process startup.
- **Storage:** Database rows must contain stable bucket/object keys, never expiring signed URLs.
- **Provider policy:** Browser inputs are semantic capabilities only; provider IDs and detailed errors remain server-side.
- **Hybrid migration:** Portable and Supabase code paths coexist, so flags and route parity must be treated as architecture boundaries.

## Anti-Patterns

### Authenticated Local Cache as Authority

**What happens:** Transitional creator code can read/write local project state in `apps/web/src/features/create/projectStore.ts`.
**Why it's wrong:** It can mask cloud recovery defects or diverge across devices.
**Do this instead:** Treat `/api/v1/projects/*` responses as authoritative and use IndexedDB only for unclaimed guest drafts.

### Direct Supabase Calls in Canonical UI

**What happens:** Several legacy pages and branches import `apps/web/src/integrations/supabase/client.ts` directly.
**Why it's wrong:** Portable Better Auth sessions do not automatically authorize Supabase calls, creating hybrid failure modes.
**Do this instead:** Add portable API contracts/routes first, then switch the canonical screen atomically.

## Error Handling

**Strategy:** Validate at every boundary, normalize public error envelopes, classify retryability, and fail closed for unavailable generation dependencies.

**Patterns:**
- `ApiHttpError` and request IDs in `apps/api/src/errors.ts` and `apps/api/src/request-context.ts`.
- Zod parsing in `packages/contracts/src/` and service schemas.
- Retryable/permanent worker error classification in `apps/worker/src/render-lifecycle.ts`.
- Exactly-once release/refund transitions in `packages/db/src/generation-service.ts`.

## Cross-Cutting Concerns

**Logging:** Structured API/worker events with request/job identifiers.
**Validation:** Zod at public and provider boundaries; FFprobe/full media checks after generation.
**Authentication:** Better Auth cookie sessions plus explicit owner predicates in every MongoDB repository operation.

---

*Architecture analysis: 2026-08-16*
