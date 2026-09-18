---
phase: 02-guest-authentication-and-data-integrity
plan: "05"
subsystem: api-database-security
tags: [postgresql, rate-limiting, ssrf, dns-pinning, source-import]
requires: [02-04]
provides: [postgresql-authoritative-request-limits, shared-public-network-policy]
affects: [source-scanning, remote-image-mirroring, api-runtime]
tech-stack:
  added: []
  patterns: [atomic-postgresql-fixed-window, trusted-proxy-hop-resolution, pinned-dns-transport]
key-files:
  created:
    - apps/api/src/request-rate-limiter.ts
    - apps/api/src/network-media-policy.ts
    - packages/db/migrations/0016_request_rate_limits.sql
  modified:
    - apps/api/src/creator-routes.ts
    - apps/api/src/asset-routes.ts
    - apps/api/src/runtime-services.ts
    - packages/db/src/schema.ts
decisions:
  - PostgreSQL fixed-window consume function is the only quota authority; no in-memory fallback exists.
  - Forwarded identities are ignored by default and selected only from explicitly configured trusted proxy hops.
  - Source scans and image mirrors share public-address filtering, DNS resolution, address pinning, redirect limits, and timeout defaults.
metrics:
  duration: 25min
  completed: 2026-08-19
status: complete
actuals:
  tokens: 12887
  tasks: 3
  commits: 7
requirements: [SOURCE-04, SOURCE-05]
coverage:
  - id: D1
    description: Public scans are atomically limited before scanner network work.
    requirement: SOURCE-04
    verification:
      - kind: integration
        ref: apps/api/src/request-rate-limiter.postgres.test.ts#atomically admits exactly twenty concurrent public scans across API instances
        status: pass
      - kind: unit
        ref: apps/api/src/creator-routes.test.ts#rejects a public scan before the scanner can resolve or fetch
        status: pass
    human_judgment: false
  - id: D2
    description: Scan and mirror use an equivalent hostile-network and media safety boundary.
    requirement: SOURCE-04
    verification:
      - kind: unit
        ref: apps/api/src/network-media-policy.test.ts#pins the validated addresses and revalidates every redirect hop
        status: pass
      - kind: unit
        ref: apps/api/src/source-scanner.test.ts
        status: pass
      - kind: unit
        ref: apps/api/src/remote-image-fetcher.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Authenticated image mirror quotas and runtime configuration fail closed.
    requirement: SOURCE-05
    verification:
      - kind: unit
        ref: apps/api/src/assets.test.ts#rejects a rate-limited mirror before it fetches or stores remote media
        status: pass
      - kind: unit
        ref: apps/api/src/config.test.ts
        status: pass
    human_judgment: false
---

# Phase 02 Plan 05: PostgreSQL Source Security Boundary Summary

**PostgreSQL-authoritative 20/10m guest scan and 50/10m authenticated mirror quotas, with shared DNS-pinned SSRF and media protections.**

## Performance

- **Duration:** 25 min
- **Completed:** 2026-08-19T20:05:30Z
- **Tasks:** 3/3
- **Files modified:** 20

## Accomplishments

- Added an atomic PostgreSQL fixed-window limiter keyed by a salted SHA-256 subject hash, action, and window start; concurrent API instances admit exactly 20 public scan requests.
- Enforced source scan quota before scanner DNS or transport work, returning a safe 429 envelope, request ID, and `Retry-After`.
- Added 50/10m authenticated mirror admission before remote fetch or private storage writes.
- Centralized public URL validation, mixed DNS rejection, address pinning, redirect handling, and timeout defaults; preserved MIME, magic-byte, byte-cap, and empty-media checks.
- Added strict startup configuration for both limits, shared window, and explicit trusted proxy hops; runtime always composes a PostgreSQL limiter.
- Extended the guarded disposable PostgreSQL 17 migration validator for the new table and function.

## Verification

- `bun run --cwd apps/api test -- request-rate-limiter source-scanner remote-image-fetcher creator-routes assets config` — 42 passed, 2 opt-in PostgreSQL tests skipped without a disposable URL.
- `bun run --cwd apps/api typecheck` — passed.
- Guarded disposable PostgreSQL 17 empty→latest→rerun migration validation — passed.
- Disposable PostgreSQL 17 two-instance concurrency test — passed: exactly 20 allowed and 10 denied.

## Decisions Made

- PostgreSQL is the quota authority, because process-local counts cannot remain correct across API instances.
- Proxy identity starts fail-closed at zero trusted hops; forwarded headers never change a direct connection’s quota subject.
- Rate limits are charged once per submitted scan/mirror operation, before outbound work; a transient scanner retry remains inside that already-admitted operation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Wired mirror quotas through the actual asset route**
- **Found during:** Task 02-05-02
- **Issue:** The authenticated mirror endpoint is implemented in `asset-routes.ts`, not `creator-routes.ts` as the plan’s file list implied. Without this route-level wiring, the 50/10m requirement could be bypassed before remote fetch/storage.
- **Fix:** Added limiter admission and safe 429 behavior to the owner-checked mirror route, with a test proving zero fetch/storage calls after denial.
- **Files modified:** `apps/api/src/asset-routes.ts`, `apps/api/src/assets.test.ts`, `apps/api/src/app.ts`
- **Commit:** `ac9cf35`

**2. [Rule 3 - Blocking] Registered migration 0016 in Drizzle’s journal**
- **Found during:** Task 02-05-01 verification
- **Issue:** The new SQL migration was not discovered by the migration runner, so the guarded PostgreSQL proof correctly found no limiter table.
- **Fix:** Added the `0016_request_rate_limits` journal entry and reran the disposable PostgreSQL 17 proof.
- **Files modified:** `packages/db/migrations/meta/_journal.json`
- **Commit:** `984445e`

**3. [Rule 1 - Bug] Safeguarded non-Node test request contexts**
- **Found during:** Task 02-05-01 verification
- **Issue:** Browser-style Hono test requests do not include the Node incoming-message binding, causing a 500 before scan quota evaluation.
- **Fix:** Made direct socket extraction optional while production Node requests still use `incoming.socket.remoteAddress`.
- **Files modified:** `apps/api/src/creator-routes.ts`, `apps/api/src/request-context.ts`
- **Commit:** `984445e`

## Known Stubs

None.

## Next Phase Readiness

Source scanning and authenticated image mirroring now have an authoritative pre-network abuse boundary and a shared public-network policy. Future API instances must continue passing the runtime-composed limiter rather than adding local counters.

## Self-Check: PASSED

- Required migration, limiter, policy, and configuration files exist.
- Task commits `8424361`, `984445e`, `1ed1971`, `ac9cf35`, `b6b71b2`, `8b550fd`, and `79ed295` exist.
