# Codebase Structure

**Analysis Date:** 2026-08-16

## Directory Layout

```text
moveprompts/
├── apps/
│   ├── web/              # Vite/React product and marketing UI
│   ├── api/              # Hono portable HTTP API
│   └── worker/           # MongoDB lease queue generation/export worker
├── packages/
│   ├── auth/             # Better Auth configuration and provisioning
│   ├── contracts/        # Shared Zod API/domain contracts
│   ├── creative-engine/  # Kuwait templates, prompts, quality policy
│   ├── db/               # MongoDB collections, indexes, repositories and services
│   ├── providers/        # Capability registry and provider adapters
│   └── storage/          # Private S3-compatible storage
├── supabase/             # Frozen legacy migrations and Edge Functions
├── scripts/              # Infrastructure and migration tooling
├── infra/                # Local/hosted environment contracts and DB bootstrap
├── docs/                 # Product architecture and operational runbooks
├── .github/workflows/    # CI, security, and release-candidate workflows
├── compose.yaml          # Local portable stack
└── package.json          # Bun workspace orchestration
```

## Directory Purposes

**`apps/web/`:**
- Purpose: All browser-rendered surfaces.
- Contains: routes, pages, components, hooks, i18n, static assets, creator feature modules.
- Key files: `apps/web/src/App.tsx`, `apps/web/src/features/create/CreateStudio.tsx`, `apps/web/src/pages/AdvancedStudio.tsx`.

**`apps/api/`:**
- Purpose: Portable authenticated/public API.
- Contains: Hono app, runtime composition, creator/assets/generation routes, repositories, security scanners.
- Key files: `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/runtime-services.ts`.

**`apps/worker/`:**
- Purpose: Durable background execution.
- Contains: outbox dispatcher, MongoDB lease queue adapter, render lifecycle, reference preparation, output persistence, quality analysis, benchmark CLIs.
- Key files: `apps/worker/src/main.ts`, `apps/worker/src/render-lifecycle.ts`, `apps/worker/src/output-persister.ts`.

**`packages/`:**
- Purpose: Framework-independent domain and infrastructure units.
- Contains: package-local source, tests, build config, and exports.
- Key files: `packages/contracts/src/index.ts`, `packages/db/src/schema.ts`, `packages/providers/src/capability-registry.ts`.

**`supabase/`:**
- Purpose: Legacy implementation retained during portable migration.
- Contains: 40+ Deno Edge Functions and historical SQL migrations.
- Key files: `supabase/functions/generate-video/index.ts`, `supabase/functions/_shared/capabilityRegistry.ts`.

## Key File Locations

**Entry Points:**
- `apps/web/src/main.tsx`: React mount.
- `apps/web/src/App.tsx`: browser routes and providers.
- `apps/api/src/server.ts`: API server process.
- `apps/worker/src/main.ts`: worker process.

**Configuration:**
- `package.json`: workspace scripts/runtime pins.
- `eslint.config.js`: linting.
- `compose.yaml`: local services.
- `infra/environments/*.example`: non-secret environment contracts.
- `packages/db/drizzle.config.ts`: schema/migration tooling.

**Core Logic:**
- `apps/web/src/features/create/`: beginner creation journey and local/cloud draft bridges.
- `apps/api/src/creator-repository.ts`: project/template/version access.
- `packages/db/src/generation-service.ts`: quote/credit/entitlement/run invariants.
- `apps/worker/src/render-lifecycle.ts`: provider-to-accepted-output state machine.
- `packages/creative-engine/src/catalog.ts`: 50 campaign template recipes.

**Testing:**
- Co-located `*.test.ts` and `*.test.tsx` files across `apps/` and `packages/`.
- Live MongoDB integration uses `.local-setup/verify-runtime.mjs`.
- Browser test setup is `apps/web/src/test/setup.ts`.

## Naming Conventions

**Files:**
- React components/pages: PascalCase, for example `CreateStudio.tsx`.
- Domain modules/utilities: kebab-case or lower camel descriptive names, for example `generation-service.ts` and `guestDraftStore.ts`.
- Tests: implementation basename plus `.test.ts(x)`; database tests add `.postgres.test.ts`.

**Directories:**
- Deployable units use `apps/<name>`.
- Shared boundaries use `packages/<name>`.
- Web features are grouped under `apps/web/src/features/<feature>`.

## Where to Add New Code

**New browser workflow:**
- Primary code: `apps/web/src/features/<feature>/` or `apps/web/src/pages/`.
- Shared UI primitives: `apps/web/src/components/ui/`.
- Tests: co-located beside implementation.

**New portable endpoint:**
- Contract: `packages/contracts/src/`.
- Route/repository: `apps/api/src/`.
- Database schema/service: `packages/db/src/` plus an ordered migration.
- Tests: API unit tests plus the local MongoDB runtime verifier where ownership/state matters.

**New worker capability:**
- Provider contract/adapter: `packages/providers/src/`.
- Lifecycle/handler: `apps/worker/src/`.
- Public alias/schema: `packages/contracts/src/capabilities.ts`.

**New template:**
- Recipe and localization: `packages/creative-engine/src/catalog.ts`.
- Database publication migration/tool: `packages/creative-engine/scripts/` and `packages/db/migrations/`.
- Web media truth: `apps/web/src/features/create/templateMedia.ts` and rights-cleared assets under `apps/web/public/template-previews/`.

**Utilities:**
- Cross-workspace domain utilities belong in the relevant package, not an app-specific `utils` catch-all.
- Browser-only helpers belong under `apps/web/src/lib/`.

## Special Directories

**`apps/*/dist` and `packages/*/dist`:**
- Purpose: Generated build artifacts.
- Generated: Yes.
- Committed: No.

**`.planning/codebase/`:**
- Purpose: GSD architecture reference used by future planning/execution.
- Generated: Yes, then maintained as project documentation.
- Committed: Yes.

**`apps/web/public/`:**
- Purpose: Static marketing, template, and sample media.
- Generated: Mixed; some preview frames are derived assets.
- Committed: Yes.

---

*Structure analysis: 2026-08-16*
