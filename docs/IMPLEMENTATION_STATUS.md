# Current R2 and guest-generation work

See [R2 setup](R2_SETUP.md) and `.planning/quick/r2-guest-generation/SUMMARY.md` for the current stack and verified limits. The phase notes below are historical and do not describe the current storage or database configuration.

# Production rebuild implementation status

Updated: 2026-08-12

This file records demonstrated evidence, not intended behavior. A phase is not
complete merely because a schema, interface, or placeholder exists.

| Phase | Implemented and verified locally | Still required for the exit gate |
|---|---|---|
| 0 — protect and freeze | Protected rebuild branch; recovery commit; `.env` removed from HEAD; Bun lock selected; route and Supabase parity inventories | Authenticate GitHub and push; rotate live credentials; perform and restore a real Supabase database/auth/storage export |
| 1 — portable platform | Bun workspaces; Hono API; pg-boss worker; Drizzle packages; MinIO/R2 storage adapter; Compose and CI definitions; fresh PostgreSQL migrations; durable worker job; signed object round trip; lint/typecheck/test/build/security and initial-bundle gates | Demonstrate the full Compose stack on a clean Docker host; create real preview/staging environments and immutable release artifacts |
| 2 — data, auth and storage | Canonical PostgreSQL schema and invariants; Better Auth mounted at `/api/auth/*`; portable email/password client and callback; stable private object keys and owner-scoped asset API; fresh-database two-user RLS tests | Deliver email through a real SMTP environment; verify Google/Apple callbacks; test object isolation against MinIO/R2; preserve live legacy user ownership |
| 3 — Supabase migration | Complete legacy inventory plus repeatable plan/export/import/reconcile tooling with immutable checkpoints and local self-checks | Run the tooling against real Supabase snapshots; reconcile every row, balance, relationship and object checksum; resolve the generated exception report; rehearse rollback |
| 4 — generation economics | Fail-closed approved aliases; configuration-bound authoritative quote API; atomic quote/credit/entitlement/run/outbox transactions; durable worker submission/reconciliation; exactly-once charge/refund tests; owner-scoped status and cancellation endpoints | Run provider bake-off; configure approved credentials and reviewed prices; add concrete provider/output-copy adapters, provider cancellation and media validation against real outputs |
| 5 — guest auth handoff | Seven-day IndexedDB creator draft; contextual auth gate; safe return-path validation; Better Auth callback/session recovery client | Implement authenticated draft claim and checksum confirmation; move creator assets/projects from Supabase to portable APIs; harden both public scanning and authenticated mirroring; prove exact draft recovery for email/Google/Apple in a rendered browser |
| 6 — shell and Template Mode | Marketing design, creator shell, product-first and template-first UI prototypes, GCC campaign controls and development catalog remain preserved | Connect the canonical API/database catalog; remove fake/local cloud truth; complete all loading/error/offline states; generate three real recoverable projects |
| 7 — projects, editor and exports | Project/editor UI prototype and schema are preserved | Build real immutable project/version APIs, Remotion/FFmpeg composition and worker pipeline, four independent artifacts, comparison/rollback and 30-day trash recovery |
| 8 — Advanced Mode | Approved-alias Advanced UI prototype and template-to-Advanced draft handoff are preserved | Connect every visible control to real assets, quotes, versions and runs; migrate `/ads` parity and history before redirects |
| 9 — GCC launch | Six-market data definitions, RTL direction support and twelve template concepts exist | Complete all Arabic strings and mixed-direction QA; render/approve twelve templates in three campaign-language modes and four ratios |
| 10 — billing and operations | Payment schema and disabled feature flag exist | Integrate UPayments hosted checkout/webhooks/reconciliation/refunds; real account, notification and admin operations |
| 11 — production release | CI/security/runbook scaffolding exists | Security remediation, WCAG 2.2 AA evidence, bundle/performance targets, observability, backups/restore, 72-hour staging soak and final cutover drill |

## Demonstrated local checks

- The current web application builds and its 51 tests pass.
- All portable packages typecheck, build, and pass their focused tests.
- The repository lint gate has zero errors; legacy warnings remain tracked.
- Migrations apply idempotently to a fresh PostgreSQL 17 database.
- A real pg-boss health job completes against PostgreSQL without browser control.
- The Hono health, auth, asset, generation and feature-flag contracts have focused
  tests; unconfigured capabilities and pricing keep generation disabled.
- Generation start is idempotent and atomically reserves either the verified
  starter entitlement or real credits before writing the durable outbox job.
- The initial web route bundle remains below the 300 KB gzip budget.
- A real private S3-compatible signed upload/download/delete round trip passes.
- Secret scanning passes after removing the tracked environment file.

## Truthful current milestone

This is a locally verified platform foundation, not an internal alpha. Template
and Advanced generation still use legacy/prototype paths until their portable
API, provider, credit, storage, and migration gates are complete.
