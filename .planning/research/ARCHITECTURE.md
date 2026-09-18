# Architecture Research

**Domain:** Durable AI video generation and deterministic social campaign delivery
**Researched:** 2026-08-17
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│ Guided React experience                                    │
│ Guest draft │ Templates │ Projects │ Editor │ Advanced      │
├─────────────────────────────────────────────────────────────┤
│ Typed Hono API                                             │
│ Auth │ Sources │ Assets │ Versions │ Quotes │ Runs │ Exports │
├─────────────────────────────────────────────────────────────┤
│ PostgreSQL transaction boundary                            │
│ RLS │ Ledger │ Entitlement │ Outbox │ Heartbeat │ Audit      │
├─────────────────────────────┬───────────────────────────────┤
│ pg-boss generation worker   │ deterministic export worker   │
│ provider → copy → QA        │ Remotion → FFmpeg → validate  │
├─────────────────────────────┴───────────────────────────────┤
│ Private S3-compatible assets and outputs                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Guest draft store | Seven-day same-browser JSON and blobs | IndexedDB with expiry and claim state machine |
| Creator API | Owner-safe projects, versions, assets, quotes, runs | Hono + Zod + user-scoped DB transaction |
| Generation domain | Idempotency, quote binding, credit reservation, refund | PostgreSQL transaction, advisory locks, append-only ledger |
| Render worker | Submit/reconcile provider operation and own final result | pg-boss + provider adapter + webhook/poll fallback |
| Quality engine | Technical and visual acceptance | FFprobe/full decode plus bounded multimodal review |
| Export engine | Deterministic overlays and social artifacts | Shared Remotion composition plus FFmpeg |
| Project UI | Server-driven run/version/output recovery | React Query plus route-addressable project state |

## Recommended Project Structure

```text
apps/
├── web/                     # guided customer experience
├── api/                     # public/private HTTP boundary
└── worker/                  # generation and export execution
packages/
├── contracts/               # schemas and typed API surface
├── creative-engine/         # recipes, prompt compiler, quality policy
├── db/                      # schema, migrations, transactions
├── providers/               # hidden provider capability adapters
├── storage/                 # private object storage
└── render/                  # add shared Remotion/FFmpeg compositions
```

### Structure Rationale

- **Apps:** Independently deployable runtime processes with clear operational health.
- **Packages:** Testable provider-independent invariants and contracts reused by every runtime.
- **Render package:** Ensures browser preview and server output use the same composition rather than duplicated CSS/FFmpeg logic.

## Architectural Patterns

### Pattern 1: Configuration-Bound Quote

**What:** Hash the complete normalized generation configuration into an expiring server quote.
**When to use:** Before any operation that can spend credits or provider money.
**Trade-offs:** Requires re-quote after changes, but prevents stale price and tampering.

```typescript
const quote = await quoteService.create({
  projectVersionId,
  configurationHash: hash(normalizedConfiguration),
  expiresAt,
});
```

### Pattern 2: Transactional Outbox

**What:** Create run, reserve value, and insert an outbox event in one PostgreSQL transaction.
**When to use:** Every durable generation/export submission.
**Trade-offs:** Adds dispatcher/reconciliation logic but prevents charged-without-job and job-without-charge states.

### Pattern 3: Working vs Accepted Version

**What:** Keep the user's newest configuration separate from the last quality-approved output.
**When to use:** Any regeneration or edit.
**Trade-offs:** More explicit UI/state, but failures never destroy the usable result.

### Pattern 4: Provider Capability Adapter

**What:** Public aliases resolve to server-only provider/model contracts.
**When to use:** Every external AI operation.
**Trade-offs:** Requires adapter/canary maintenance, but prevents silent quality/cost downgrade.

## Data Flow

### Request Flow

```text
User configures draft
    ↓
Generate → authenticate → claim assets/project/version
    ↓
Quote → confirm → start idempotent run/outbox
    ↓
Worker submit → provider accepted → reconcile
    ↓
Download/copy → technical QA → visual QA → accepted version
    ↓
Editor → deterministic exports → social pack
```

### State Management

```text
Guest: IndexedDB draft/blob
    ↓ claim + checksum confirmation
Authenticated: PostgreSQL project/version/run
    ↓ signed access on demand
Private S3 objects and export artifacts
```

### Key Data Flows

1. **Product/service import:** Public scan returns candidates; user confirms facts; authenticated mirror copies approved media privately.
2. **Generation:** Browser displays the persisted state machine; worker owns progress and completion.
3. **Editing:** Factual changes create an immutable deterministic version; visual changes create a quoted generative version.
4. **Campaign pack:** Export fan-out produces independent artifacts and a manifest only after every required output validates.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users | One API, one worker pool, PostgreSQL pg-boss, private S3 storage; prioritize correctness and observability |
| 1k-100k users | Separate API/worker pools, connection budgets, queue partitions, provider rate scheduling, CDN posters/previews |
| 100k+ users | Isolate queue workload, shard heavy export workers, multi-region object delivery, dedicated analytics pipeline |

### Scaling Priorities

1. **First bottleneck:** Provider latency/rate/spend; solve with concurrency admission, budgets, retries, and telemetry.
2. **Second bottleneck:** Media download/transcode CPU and storage bandwidth; isolate export workers and tune queues.

## Anti-Patterns

### Browser as Orchestrator

**What people do:** Poll provider directly and mark completion client-side.
**Why it's wrong:** Closing the browser loses work and retries duplicate operations.
**Do this instead:** Persist runs and operations before submission; worker reconciles to terminal state.

### Provider Output Equals Product Output

**What people do:** Store a provider URL and declare success.
**Why it's wrong:** URLs expire, media may be invalid, and business quality may fail.
**Do this instead:** Copy privately, fully validate/decode, quality-review, then accept.

### Generic Prompt Playground as Beginner UX

**What people do:** Put model, prompt, camera, and negative prompt on the first screen.
**Why it's wrong:** Makes the owner behave like a video engineer.
**Do this instead:** Ask business/outcome questions and compile the direction server-side.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vercel AI Gateway | Server-only async adapter and bounded canary | Confirm real output host and contract; catalog availability is insufficient |
| S3-compatible storage | Private buckets, stable keys, signed URL on demand | Validate metadata and body checksums |
| Better Auth | Cookie session with PostgreSQL adapter | Auth callback must recover pending guest generation |
| UPayments | Hosted checkout + verified webhook + reconciliation | Browser redirect must never grant credits |
| Meta/Instagram | Export-spec target only in v1 | Publishing/API integration is deferred |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web ↔ API | Typed JSON/HTTP | No provider IDs or signed URLs in durable client state |
| API ↔ DB | User-scoped transaction | Explicit owner predicate plus RLS defense in depth |
| API ↔ Worker | Transactional outbox + pg-boss | No direct synchronous provider call from request path |
| Worker ↔ Providers | Capability adapter | Persist opaque operation before polling |
| Worker ↔ Storage | Private S3 API | Output validation before completion |

## Sources

- https://vercel.com/docs/ai-gateway/getting-started/video — official asynchronous video generation guidance.
- https://developers.cloudflare.com/r2/api/s3/api/ — S3 compatibility and checksum semantics.
- https://better-auth.com/docs/concepts/database — database-backed auth and migration guidance.
- `.planning/codebase/ARCHITECTURE.md` — current system map.

---
*Architecture research for: durable AI social-content delivery*
*Researched: 2026-08-17*
