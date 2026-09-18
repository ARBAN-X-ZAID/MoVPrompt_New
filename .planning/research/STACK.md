# Stack Research

**Domain:** Kuwait-first AI social-content generation for non-technical businesses
**Researched:** 2026-08-17
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React + Vite | React 18.3 / Vite 8.2 | Responsive guided creator and project workspace | Already implemented and well suited to route-level lazy loading, interactive previews, RTL, and browser draft recovery |
| Hono on Node.js | Hono 4.12 / Node 24 | Typed portable API | Lightweight, container-friendly, and already integrated with shared contracts and request IDs |
| PostgreSQL + Drizzle | PostgreSQL 17 / Drizzle 0.45 | Auth, projects, versions, credits, jobs, payments, audit | Transactions, advisory locks, RLS, immutable history, and ledger correctness are essential for paid AI generation |
| Better Auth | 1.4 | Email and social authentication | Official PostgreSQL/Drizzle support and database-backed sessions fit the existing portable ownership model |
| pg-boss | 12.x | Durable generation and export queue | Keeps job state in PostgreSQL and avoids adding Redis before scale requires it |
| S3-compatible private storage | AWS SDK 3.x | Inputs, provider outputs, exports, thumbnails | Stable object keys and signed access work with MinIO locally and R2/S3 in production |
| FFmpeg + FFprobe | deployment-pinned binaries | Media validation, normalization, deterministic exports | Provider completion is not delivery; files must be decoded, checked, normalized, and rendered into social formats |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 4.4 | Shared boundary validation | Every browser/API/provider/worker configuration boundary |
| AI SDK | 7.x currently installed | Gateway calls and structured multimodal quality review | Server/worker only; never expose keys or provider models to the browser |
| React Query | 5.101 | Server-state caching | Templates, projects, run status, credits, and output refresh |
| Testing Library + Vitest | 16 / 4.1 | UI, service, provider, and integration regression tests | Every workflow state and bug fix |
| Radix UI | current workspace versions | Accessible dialogs, fields, tabs, menus | Reusable interaction primitives; keep MovPrompt visual tokens on top |
| Remotion | add during export phase | Shared browser/server deterministic composition | Factual overlays, subtitles, logo, CTA, and preview-equals-download exports |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Bun 1.3.12 | Workspace package manager and scripts | Keep frozen-lockfile CI |
| Docker Compose | Local PostgreSQL, MinIO, Mailpit, API, worker | Required for reproducible full-stack testing |
| GitHub Actions | Quality, migration, security, and release gates | Keep provider-paid tests separately guarded |
| Playwright | Browser E2E | Add for guest-auth-generation-reload-download journeys |
| Sentry/OpenTelemetry-compatible tracing | Runtime errors and job tracing | Add before external beta, not as a substitute for structured domain events |

## Installation

The core stack already exists. Do not replace it. Add only missing delivery tools in their implementation phases:

```bash
# Deterministic composition, when the export phase begins
bun add --cwd packages/render remotion @remotion/player @remotion/renderer

# Browser E2E, when the golden path becomes stable
bun add -D --cwd apps/web @playwright/test
```

FFmpeg/FFprobe should be installed in API/worker images with pinned image/package versions, not downloaded dynamically at runtime.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| PostgreSQL + pg-boss | Redis/BullMQ | Only after measured queue contention or independent queue scaling is required |
| Hono container API | Serverless functions | Suitable for small stateless endpoints, but durable media orchestration and matching worker configuration favor containers |
| S3-compatible abstraction | Provider-hosted output URLs | Never as durable storage; provider URLs may expire or disappear |
| Guided editor + Remotion | CapCut-style timeline | Only if validated customers later demand professional layer editing |
| Hidden capability registry | Public model picker | Only in a separate expert product; it conflicts with beginner simplicity |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Another platform rewrite | The portable foundation is substantial and rewriting delays reliable customer value | Finish and verify the existing monorepo |
| Browser-controlled generation completion | Closing/reloading the page loses truth and can duplicate work | Durable run records, outbox, worker, and polling for display only |
| Signed URLs in database JSON | They expire and leak infrastructure details | Bucket/object keys plus signed URLs on demand |
| Client-calculated credits | Prices drift and can be manipulated | Server-issued configuration-bound quotes |
| Generic model fallback | Can silently change quality, capability, cost, or rights | Explicit capability contract and fail-closed availability |
| Full timeline editor at launch | Adds complexity for the wrong user | Scene cards and deterministic business edits |

## Stack Patterns by Variant

**If the user is a guest:**
- Use IndexedDB for seven-day draft JSON and blobs.
- Do not create cloud projects or upload assets until authentication.

**If the user is authenticated:**
- Use PostgreSQL as the only source of truth.
- Keep browser storage as recoverable cache only, never authoritative project state.

**If a change affects business facts only:**
- Use deterministic composition and create an immutable edit version.
- Do not spend generative credits.

**If a change affects generated visuals:**
- Create a new bound quote and immutable render version.
- Preserve the last accepted output if generation fails.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Node 24 | Bun 1.3.12 and server workspaces | Repository engines and CI are pinned |
| Better Auth 1.4 | PostgreSQL and Drizzle adapter | Official docs support PostgreSQL and ORM adapters |
| AWS SDK S3 | Cloudflare R2/MinIO | R2 exposes an S3-compatible API; verify unsupported operations before relying on them |
| Vercel AI Gateway video | AI SDK video contract | Model catalog presence is not enough; validate real start/status/output behavior with controlled canaries |

## Sources

- https://vercel.com/docs/ai-gateway/getting-started/video — official Gateway video-generation contract.
- https://better-auth.com/docs/adapters/postgresql — official PostgreSQL integration.
- https://better-auth.com/docs/installation — official Drizzle adapter guidance.
- https://developers.cloudflare.com/r2/api/ — official R2 API surfaces.
- https://developers.cloudflare.com/r2/api/s3/api/ — official S3 compatibility details.
- `.planning/codebase/STACK.md` and `.planning/codebase/ARCHITECTURE.md` — verified current repository foundation.

---
*Stack research for: Kuwait-first AI social-content generation*
*Researched: 2026-08-17*
