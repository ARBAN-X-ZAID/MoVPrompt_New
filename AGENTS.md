<!-- GSD:project-start source:PROJECT.md -->

## Project

**MovPrompt**

MovPrompt is a Kuwait-first social content creation platform for business owners who have no video-making or editing knowledge. A salon, clinic, local shop, or ecommerce business can paste a link or upload its own content, choose a purpose-built template, generate a high-quality Arabic, English, or bilingual video, make simple guided edits, and download a complete social-media pack.

Template Mode is the default experience. Advanced Mode remains a separate secondary workspace for experienced users who need prompts, references, camera, lighting, motion, and visual-direction controls.

**Core Value:** A Kuwait business owner with no video skills can create a professional, accurate, ready-to-publish social-media campaign in minutes without learning prompts, timelines, models, or editing software.

### Constraints

- **Primary user**: Must require no knowledge of prompts, models, timelines, codecs, or video editing.
- **Market**: Kuwait only for initial production; Arabic, English, and bilingual are first-class.
- **Truth**: Imported or user-confirmed facts must never be invented or changed silently.
- **Authentication**: Guests configure and generate first; sign-in appears at clean download and idempotently claims their saved projects.
- **Architecture**: Continue the existing React/Hono/MongoDB/Better Auth/R2 system; use the MongoDB transaction and lease-queue implementation.
- **Generation**: Provider/model IDs remain server-only; capabilities fail closed until pricing, worker, storage, output, and quality evidence agree.
- **Economics**: A user pays for an accepted output, not failed provider attempts; charges/refunds and retries are idempotent.
- **Editing**: Deterministic factual edits are free; visual changes are separately quoted immutable versions.
- **Compliance**: Clinic content requires legal review and stronger claim, identity, consent, and privacy rules than retail content.
- **Quality**: Every production claim requires database, API, worker, media, and rendered-browser evidence—not code presence alone.
- **Accessibility**: Core journeys must meet WCAG 2.2 AA and work at 375, 768, 1024, and 1440 pixels in light/dark and English/Arabic.

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.9.3 - All active web, API, worker, shared-package, migration-tooling, and test code under `apps/`, `packages/`, and `scripts/`.
- MongoDB query documents and indexes - Portable persistence, transactions, TTL indexes, and owner-scoped repositories under `packages/db/src/mongo-*.ts`.
- CSS/PostCSS/Tailwind CSS - Application and marketing styling in `apps/web/src/` and `apps/web/postcss.config.js`.
- Bash - Infrastructure validation, backup, and parity scripts under `scripts/infra/`.
- Deno TypeScript - Frozen legacy Supabase Edge Functions under `supabase/functions/`.

## Runtime

- Node.js 24.x - Required by the root `package.json` and server workspaces.
- Browser - React single-page application built by Vite.
- MongoDB 8 replica set - Canonical portable database target in `compose.yaml`; replica-set mode supports transactions locally.
- Bun 1.3.12 - Workspace install and script runner.
- Lockfile: `bun.lock` is present and CI requires `bun install --frozen-lockfile`.

## Frameworks

- React 18.3.1 and React DOM 18.3.1 - Web UI in `apps/web/src/`.
- React Router 7.18.0 - Route composition and compatibility redirects in `apps/web/src/App.tsx`.
- Vite 8.2.1 with SWC - Web development and production builds in `apps/web/vite.config.ts`.
- Hono 4.12.32 - Portable HTTP API in `apps/api/src/app.ts`.
- Better Auth 1.4.18 - Portable email and optional Google/Apple authentication in `packages/auth/src/auth.ts`.
- MongoDB Node.js Driver 6 - Database access, sessions, transactions, indexes, and atomic lease operations in `packages/db/`, `apps/api/`, and `apps/worker/`.
- MongoDB worker queue - Durable lease-based worker jobs in `apps/worker/src/mongo-worker.ts`.
- Vitest 4.1.10 - Unit and integration tests across every active workspace.
- Testing Library 16 and jsdom 30 - React component and interaction tests in `apps/web/src/**/*.test.tsx`.
- TypeScript project builds - Workspace-specific `tsconfig.json` and `tsconfig.build.json` files.
- Docker Compose - Local MongoDB replica set, Mailpit, API, and worker topology in `compose.yaml`.
- ESLint 9 with typescript-eslint and React Hooks rules - Repository-wide linting through `eslint.config.js`.

## Key Dependencies

- `@movprompt/contracts` - Zod-validated public types shared by web, API, worker, and providers.
- `@movprompt/creative-engine` - Kuwait campaign templates, prompt compilation, preflight, and quality policy.
- `@movprompt/db` - Canonical schema, owner-scoped transactions, generation economics, and migrations.
- `@movprompt/providers` - Semantic capability registry and Seedance provider adapters.
- `@movprompt/storage` - Private R2 object keys, signing, validation, and reads.
- `@tanstack/react-query` - Browser query lifecycle configured at `apps/web/src/App.tsx`.
- `zod` 4.4.3 - Boundary validation throughout contracts, API, providers, and worker.
- AWS SDK S3 client/presigner - R2 protocol communication only; no alternate storage provider.
- AI SDK 7 - Vercel AI Gateway quality analysis and video smoke tooling in `apps/worker/`.
- Nodemailer 9 - SMTP boundary for Better Auth emails in `apps/api/src/email.ts`.
- FFmpeg and FFprobe executables - Reference-frame preparation, output validation, and normalization in `apps/worker/`.

## Configuration

- Root environment files exist but their contents are intentionally not mapped. Public configuration names are documented in `.env.example` and `infra/environments/*.example`.
- API and worker validate database, storage, auth, pricing, capability, media-tool, and heartbeat configuration before advertising generation.
- Web feature flags are centralized in `apps/web/src/config/features.ts` and use `VITE_FEATURE_*` variables.
- Root orchestration: `package.json`.
- Web: `apps/web/vite.config.ts`, `apps/web/tsconfig.app.json`, and `apps/web/vitest.config.ts`.
- Server packages: workspace `tsconfig.json` files.
- Database generation: `packages/db/drizzle.config.ts`.

## Platform Requirements

- Node 24, Bun 1.3.12, MongoDB 8 replica set, Cloudflare R2 storage, and FFmpeg/FFprobe.
- Docker Compose is the documented full-stack path; web-only development can run from `bun run dev:web`.
- Docker-compatible API and worker images are defined in `Dockerfile.api` and `Dockerfile.worker`.
- MongoDB replica-set transactions and private Cloudflare R2 object storage are architectural requirements; no production deployment is proven by repository state alone.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- Use PascalCase for React components/pages: `AuthGateDialog.tsx`, `CreatorProjects.tsx`.
- Use descriptive kebab-case for server/domain modules: `generation-service.ts`, `output-persister.ts`.
- Existing web feature helpers also use lower camel filenames: `guestDraftStore.ts`, `portableProjectMapper.ts`; match the surrounding directory.
- Use lower camel case with action-oriented names: `createGenerationService`, `registerGenerationRoutes`, `loadApiConfig`.
- Factory functions begin with `create`; validation functions use `assert`, `parse`, `validate`, or schema names.
- Use lower camel case.
- Use `SCREAMING_SNAKE_CASE` for module-level constants such as entitlement types and limits.
- Use PascalCase for interfaces, type aliases, schemas, and error classes.
- Suffix Zod schemas with `Schema`, repositories with `Repository`, services with `Service`, and input shapes with `Input`.

## Code Style

- TypeScript modules use semicolons, double-quoted imports/strings, trailing commas, and two-space indentation.
- No standalone Prettier configuration is detected; preserve local formatting and rely on TypeScript/ESLint checks.
- ESLint 9 flat config in `eslint.config.js`.
- React Hooks recommended rules are errors.
- Fast Refresh export warnings remain warnings.
- Web legacy boundaries temporarily permit explicit `any`, empty object types, `require`, and TypeScript suppression while portable migration progresses.

## Import Organization

- Web uses `@/` for `apps/web/src/` through `apps/web/vite.config.ts` and TypeScript config.
- Server workspaces use package imports such as `@movprompt/db` and relative `.js` extensions for ESM output.

## Error Handling

- Parse all untrusted payloads with Zod before use.
- Throw domain-specific errors with stable codes and retryability rather than leaking raw provider responses.
- API maps internal errors to a shared envelope containing code, message, retryability, and request ID.
- Worker classifies pre-acceptance versus post-acceptance failures so reservations/refunds remain correct.
- Catch blocks must not silently convert failures into success states.

## Logging

- Include request ID, job ID, run ID, and worker ID where available.
- Do not log secrets, signed URLs, raw OAuth tokens, or full provider payloads.
- Sanitize provider usage metadata before persistence.

## Comments

- Explain invariants, provider quirks, security boundaries, and exactly-once behavior.
- Avoid narrating obvious JSX or CRUD operations.
- Used selectively for public services and security-critical helpers, for example `packages/db/src/user-transaction.ts` and `packages/providers/src/vercel-gateway-seedance.ts`.

## Function Design

- Prefer small validators/factories around a composed service, but several legacy web files exceed 1,000 lines; do not copy that pattern into new modules.
- Service methods accept a single typed input object.
- Runtime factories accept explicit dependency objects to support isolated tests.
- API/domain functions return typed records or discriminated status objects.
- Optional values are omitted rather than assigned `undefined` where `exactOptionalPropertyTypes` applies.

## Module Design

- Shared packages export public surfaces from `src/index.ts`.
- Internal helpers remain file-local unless tests or adjacent modules require them.
- Use package-level barrels, not deep web-component barrels.
- Preserve `.js` extension imports in TypeScript server packages so built ESM works in Node.

## Security and Data Rules

- Never persist signed URLs; persist bucket/object keys.
- Every authenticated mutation must run through owner predicates and `withUserTransaction` where applicable.
- Every mutation endpoint must accept/validate an idempotency key when repetition can charge or duplicate state.
- Provider model IDs remain in server configuration, not public request bodies.
- Guest blobs stay in IndexedDB until server upload and checksum verification succeed.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- Public contracts are Zod schemas in `packages/contracts/src/`; server-only model IDs never belong in browser contracts.
- Authenticated reads and writes include explicit owner predicates in the MongoDB repositories and group related billing/outbox changes in transactions.
- Project versions, quotes, ledger entries, and render attempts are immutable or append-oriented.
- Generation is fail-closed until capability, pricing, storage, quality tooling, and worker heartbeat all agree.
- Legacy Supabase paths coexist while portable route parity is completed.

## Layers

- Purpose: Marketing, guided creation, Advanced controls, project library, account/auth.
- Location: `apps/web/src/`.
- Depends on: `@movprompt/contracts`, `@movprompt/creative-engine`, portable API, and selected legacy Supabase branches.
- Purpose: Validate requests, authenticate ownership, expose safe responses, coordinate repositories.
- Location: `apps/api/src/`.
- Depends on: auth, DB, storage, providers, and contracts workspaces.
- Purpose: Define schema, migrations, pricing-bound render invariants, credits, entitlements, and RLS.
- Location: `packages/db/src/` and `packages/db/migrations/`.
- Used by: API, auth, worker, migration tools.
- Purpose: Drain the transactional outbox, enqueue MongoDB lease jobs, submit/reconcile provider operations, persist/validate outputs, and update final state.
- Location: `apps/worker/src/`.
- Depends on: DB, provider, storage, creative-engine, FFmpeg/FFprobe.

## Data Flow

### Template Generation

### Source Import

- Guest-only state: IndexedDB with seven-day TTL.
- Authenticated source of truth: MongoDB.
- Cached UI state: React state, React Query, and transitional local project cache in `apps/web/src/features/create/projectStore.ts`.

## Key Abstractions

- Purpose: Hide provider/model complexity from public clients.
- Examples: `packages/contracts/src/capabilities.ts`, `packages/providers/src/capability-registry.ts`.
- Pattern: Server-controlled registry with fail-closed resolution.
- Purpose: Preserve changes and last accepted output independently from the current working version.
- Examples: `packages/db/src/schema.ts`, `apps/api/src/creator-repository.ts`.
- Pattern: Working pointer plus accepted pointer; failures do not overwrite the last successful version.
- Purpose: Bind quote, configuration, charge, provider attempt, output, and refund.
- Examples: `packages/db/src/generation-service.ts`, `apps/worker/src/render-lifecycle.ts`.
- Pattern: Idempotency key + advisory locks + outbox + exactly-once ledger transitions.

## Entry Points

- Location: `apps/web/src/main.tsx` and `apps/web/src/App.tsx`.
- Triggers: Browser navigation.
- Responsibilities: Providers, routes, lazy loading, offline fallback, feature-gated surfaces.
- Location: `apps/api/src/server.ts`.
- Triggers: Node process/Docker container.
- Responsibilities: Load runtime services and serve the Hono app.
- Location: `apps/worker/src/main.ts`.
- Triggers: Node process/Docker container.
- Responsibilities: Validate runtime, register adapters, heartbeat, outbox dispatch, and MongoDB lease-queue handlers.

## Architectural Constraints

- **Concurrency:** Node event loops plus MongoDB transactions, conditional updates, leases, unique operation keys, and singleton queue keys.
- **Global state:** API and worker compose singleton database/storage/provider services at process startup.
- **Storage:** Database rows must contain stable bucket/object keys, never expiring signed URLs.
- **Provider policy:** Browser inputs are semantic capabilities only; provider IDs and detailed errors remain server-side.
- **Hybrid migration:** Portable and Supabase code paths coexist, so flags and route parity must be treated as architecture boundaries.

## Anti-Patterns

### Authenticated Local Cache as Authority

### Direct Supabase Calls in Canonical UI

## Error Handling

- `ApiHttpError` and request IDs in `apps/api/src/errors.ts` and `apps/api/src/request-context.ts`.
- Zod parsing in `packages/contracts/src/` and service schemas.
- Retryable/permanent worker error classification in `apps/worker/src/render-lifecycle.ts`.
- Exactly-once release/refund transitions in `packages/db/src/generation-service.ts`.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

- `.cursor/skills/graphify/SKILL.md` and `.agents/skills/graphify/SKILL.md` — query-first Graphify. Prefer `graphify query "<question>" --budget 1500`. Refresh only with `graphify update . --no-viz --no-label`. Never `--mode deep` unless asked.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
