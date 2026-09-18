# Technology Stack

**Analysis Date:** 2026-08-16

## Languages

**Primary:**
- TypeScript 5.9.3 - All active web, API, worker, shared-package, migration-tooling, and test code under `apps/`, `packages/`, and `scripts/`.
- MongoDB documents and indexes - Active persistence under `packages/db/src/mongo-*.ts`; the former SQL migration files are retained only as migration history.

**Secondary:**
- CSS/PostCSS/Tailwind CSS - Application and marketing styling in `apps/web/src/` and `apps/web/postcss.config.js`.
- Bash - Infrastructure validation, backup, and parity scripts under `scripts/infra/`.
- Deno TypeScript - Frozen legacy Supabase Edge Functions under `supabase/functions/`.

## Runtime

**Environment:**
- Node.js 24.x - Required by the root `package.json` and server workspaces.
- Browser - React single-page application built by Vite.
- MongoDB 8 replica set - Canonical database target in `compose.yaml`; replica-set mode enables multi-document transactions.

**Package Manager:**
- Bun 1.3.12 - Workspace install and script runner.
- Lockfile: `bun.lock` is present and CI requires `bun install --frozen-lockfile`.

## Frameworks

**Core:**
- React 18.3.1 and React DOM 18.3.1 - Web UI in `apps/web/src/`.
- React Router 7.18.0 - Route composition and compatibility redirects in `apps/web/src/App.tsx`.
- Vite 8.2.1 with SWC - Web development and production builds in `apps/web/vite.config.ts`.
- Hono 4.12.32 - Portable HTTP API in `apps/api/src/app.ts`.
- Better Auth 1.4.18 - Portable email and optional Google/Apple authentication in `packages/auth/src/auth.ts`.
- MongoDB Node.js Driver 6 - Database access, transactions, indexes, leases, and queue persistence in `packages/db/`, `apps/api/`, and `apps/worker/`.

**Testing:**
- Vitest 4.1.10 - Unit and integration tests across every active workspace.
- Testing Library 16 and jsdom 30 - React component and interaction tests in `apps/web/src/**/*.test.tsx`.

**Build/Dev:**
- TypeScript project builds - Workspace-specific `tsconfig.json` and `tsconfig.build.json` files.
- Docker Compose - Local MongoDB replica set, MinIO, Mailpit, API, and worker topology in `compose.yaml`.
- ESLint 9 with typescript-eslint and React Hooks rules - Repository-wide linting through `eslint.config.js`.

## Key Dependencies

**Critical:**
- `@movprompt/contracts` - Zod-validated public types shared by web, API, worker, and providers.
- `@movprompt/creative-engine` - Kuwait campaign templates, prompt compilation, preflight, and quality policy.
- `@movprompt/db` - Canonical schema, owner-scoped transactions, generation economics, and migrations.
- `@movprompt/providers` - Semantic capability registry and Seedance provider adapters.
- `@movprompt/storage` - Private S3-compatible object keys, signing, validation, and reads.
- `@tanstack/react-query` - Browser query lifecycle configured at `apps/web/src/App.tsx`.
- `zod` 4.4.3 - Boundary validation throughout contracts, API, providers, and worker.

**Infrastructure:**
- AWS SDK S3 client/presigner - MinIO locally and S3-compatible production storage.
- AI SDK 7 - Vercel AI Gateway quality analysis and video smoke tooling in `apps/worker/`.
- Nodemailer 9 - SMTP boundary for Better Auth emails in `apps/api/src/email.ts`.
- FFmpeg and FFprobe executables - Reference-frame preparation, output validation, and normalization in `apps/worker/`.

## Configuration

**Environment:**
- Root environment files exist but their contents are intentionally not mapped. Public configuration names are documented in `.env.example` and `infra/environments/*.example`.
- API and worker validate database, storage, auth, pricing, capability, media-tool, and heartbeat configuration before advertising generation.
- Web feature flags are centralized in `apps/web/src/config/features.ts` and use `VITE_FEATURE_*` variables.

**Build:**
- Root orchestration: `package.json`.
- Web: `apps/web/vite.config.ts`, `apps/web/tsconfig.app.json`, and `apps/web/vitest.config.ts`.
- Server packages: workspace `tsconfig.json` files.
- Database generation: `packages/db/drizzle.config.ts`.

## Platform Requirements

**Development:**
- Node 24, Bun 1.3.12, MongoDB 8 replica set, S3-compatible storage, and FFmpeg/FFprobe.
- Docker Compose is the documented full-stack path; web-only development can run from `bun run dev:web`.

**Production:**
- Docker-compatible API and worker images are defined in `Dockerfile.api` and `Dockerfile.worker`.
- MongoDB replica-set transactions and private S3-compatible object storage are architectural requirements; no production deployment is proven by repository state alone.

---

*Stack analysis: 2026-08-16*
