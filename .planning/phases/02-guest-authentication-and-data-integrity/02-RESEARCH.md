# Phase 2: Guest, Authentication, and Data Integrity - Research

**Researched:** 2026-08-19  
**Domain:** Guest-to-authenticated campaign recovery, private media ownership, and cross-user isolation  
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Template Mode remains the default; Advanced uses the same draft/auth/claim foundation without adding a second ownership model.
- Guests can configure the complete campaign before authentication. Account creation appears only after Generate.
- Guest draft JSON and blobs stay in IndexedDB for seven days and recover only in the same browser.
- Guests do not receive cloud projects, anonymous Supabase accounts, or cloud uploads from page visits.
- Email/password is the private-beta primary path. Email verification does not interrupt the first campaign; the authenticated workspace shows a reminder to verify later.
- Google and Apple appear only when configured and must return through the same safe callback/claim contract.
- Authentication cancellation returns to the unchanged draft. Password reset returns only to a validated same-origin MovPrompt route.
- Resume priority is: stable pending generation intent, explicit safe same-origin next route, then `/create`.
- A stable `pendingGenerationId` and idempotency key bind claim, project/version creation, quote refresh, and eventual start. Callback replay must return the same records.
- Authentication never silently changes template, source, facts, language, market, CTA, WhatsApp/booking destination, price, offer, presenter, ratio, resolution, audio, subtitles, rights decision, or Advanced references.
- Local blobs are deleted only after project rows, private objects, checksums, and recovered server configuration are verified. Any failure keeps the complete local draft.
- Authenticated PostgreSQL and private S3-compatible storage are authoritative. Browser state becomes a recoverable cache, never the cloud source of truth.
- Signed URLs are response-only and refreshable. Database rows contain bucket/object keys, MIME, size, checksum, and ownership metadata.
- A draft claimed by one account cannot be viewed or claimed by another account on the same browser.
- Source scanning and authenticated mirroring share the same SSRF, redirect, DNS/IP, MIME, size, timeout, checksum, and abuse protections.

### the agent's Discretion

None stated.

### Deferred Ideas (OUT OF SCOPE)

- Cross-device guest drafts.
- Mandatory verification before the first private-beta campaign.
- Team/shared project claims.
- Production billing/top-up and subscription gates.
- Digital Twin enrollment and third-party consent.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | Guest configures a complete campaign before account creation. | IndexedDB cache, Generate-time transition, browser recovery tests. |
| AUTH-02 | Email/password auth appears only at Generate. | Contextual auth gate and safe return contract. |
| AUTH-03 | Configured Google/Apple return the same campaign. | Server-issued public provider configuration and one callback/claim path. |
| AUTH-04 | First private-beta campaign is not blocked by email verification. | Auth configuration parity plus non-blocking workspace reminder. |
| AUTH-05 | Password reset returns safely. | Validated same-origin return intent carried through reset flow. |
| AUTH-06 | Cancelled auth returns unchanged campaign. | No mutation before an authenticated claim starts. |
| AUTH-07 | Auth restores exact configuration and pending intent. | Immutable local snapshot digest and canonical server round-trip comparison. |
| AUTH-08 | Replayed callbacks create one project, run, and charge. | Persisted claim operation plus intent-scoped idempotency and concurrency tests. |
| AUTH-09 | Seven-day same-browser expiry and no cross-account claim/read. | Expiry checks, single-owner claim record, generic mismatch response. |
| AUTH-10 | PostgreSQL/private object storage are authoritative. | Claim finalization after object verification; browser becomes recoverable cache. |
| SOURCE-04 | Scanner/mirroring reject unsafe and abusive input. | Reuse scanner protections and add rate-limit proof. |
| SOURCE-05 | Remote images are private, owner-scoped, verified objects. | Existing asset routes, namespace assertions, finalization gate. |
| SOURCE-06 | Failed import/upload preserves draft and offers recovery. | Persisted claim checkpoint plus Retry/Replace state. |
| SOURCE-07 | Changing source invalidates incompatible output. | Server-side immutable version/output invalidation integration proof. |
| PROJ-06 | Users cannot access each other's project data. | Owner predicates, PostgreSQL RLS, private-object authorization, adversarial tests. |
</phase_requirements>

## Summary

Phase 2 should extend—not replace—the current React/Hono/PostgreSQL/Better Auth/S3 architecture. The browser may create and retain a complete seven-day IndexedDB draft before Generate, while the authenticated server must own one resumable claim operation that turns that exact snapshot into one private project/version only after every asset is present and verified. [VERIFIED: apps/web/src/features/create/guestDraftStore.ts:69-78] The current expiry behavior is: `if (new Date(draft.expiresAt).getTime() <= Date.now()) { await deleteGuestDraft(id); return null; }`.

The key gap is not basic authentication or RLS. Current `CreateStudio` first creates/synchronizes a cloud project, uploads/mirrors assets, then synchronizes a second time; `stableProjectConfiguration` resets pending generation fields to `null`. [VERIFIED: apps/web/src/features/create/CreateStudio.tsx:793-828] [VERIFIED: apps/web/src/features/create/portableProjectMapper.ts:18-42] The latter includes the verbatim assignments `pendingGenerationId: null,` and `pendingQuoteCredits: null,`. That can leave a partial cloud project after an asset failure and cannot prove exact callback recovery. Make the server-side claim operation, not a browser chain of unrelated calls, the atomic user-facing unit.

**Primary recommendation:** Add one durable, owner-bound, idempotent guest-claim state machine; it must preserve the whole draft snapshot and pending intent, resumably verify each private object, finalize exactly one immutable version, then delete IndexedDB only after the browser confirms the canonical recovered configuration.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Seven-day guest draft and local blobs | Browser / Client | — | IndexedDB is intentionally same-browser recovery cache before authentication. [VERIFIED: apps/web/src/features/create/guestDraftStore.ts:1-38] |
| Generate-time auth and safe return intent | Frontend Server / API | Browser / Client | API authenticates the session; client only requests a contextual gate and restores local state. [CITED: https://better-auth.com/docs/reference/security] |
| Claim/replay/idempotency | API / Backend | Database / Storage | Durable claim state, ownership, and finalization cannot be trusted to a tab. [VERIFIED: apps/api/src/creator-routes.ts:165-184] |
| Exact campaign/version source of truth | Database / Storage | API / Backend | PostgreSQL version data and private object keys are authoritative after claim. [VERIFIED: packages/db/src/schema.ts:227-255] |
| Private asset ingestion and reads | API / Backend | Database / Storage | The API verifies ownership and object metadata before exposing refreshable URLs. [VERIFIED: apps/api/src/asset-routes.ts:132-171] |
| SSRF-safe remote scanning/mirroring | API / Backend | — | Network boundaries, DNS resolution, redirects, MIME, byte caps, and rate limits belong server-side. [VERIFIED: apps/api/src/source-scanner.ts:100-166] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Recovery, microcopy, focus, RTL/responsive assurance | Browser / Client | API / Backend | The interface displays durable claim state and keeps the local draft on recoverable failure. [VERIFIED: .planning/phases/02-guest-authentication-and-data-integrity/02-CONTEXT.md:61-94] |

## Project Constraints (from AGENTS.md)

- Preserve React/Hono/PostgreSQL/Better Auth/pg-boss/S3; do not redesign the platform. [VERIFIED: AGENTS.md:15-25]
- Parse untrusted payloads with Zod; return stable typed error codes and never silently treat failure as success. [VERIFIED: AGENTS.md:118-128]
- Every authenticated mutation uses owner predicates and `withUserTransaction`; repeated charge/duplicate-risk mutations require an idempotency key. [VERIFIED: AGENTS.md:159-166] The verbatim directive is: `Every mutation endpoint must accept/validate an idempotency key when repetition can charge or duplicate state.`
- Persist stable bucket/object keys, never signed URLs; do not log secrets, signed URLs, raw OAuth tokens, or raw provider payloads. [VERIFIED: AGENTS.md:133-166]
- Guest blobs remain IndexedDB-only until server upload and checksum verification succeeds. [VERIFIED: AGENTS.md:165-166]
- Reuse the existing visual system; one dominant action, visible labels/errors, 44 by 44 targets, focus trapping, reduced motion, and English/Arabic light/dark checks at 375/768/1024/1440. [VERIFIED: .planning/phases/02-guest-authentication-and-data-integrity/02-CONTEXT.md:61-85]

## Standard Stack

### Core

| Library / component | Version | Purpose | Why Standard |
|---|---:|---|---|
| Browser IndexedDB | Browser API | Same-browser guest JSON/blob cache | Existing store already expires drafts and stores blobs locally. [VERIFIED: apps/web/src/features/create/guestDraftStore.ts:1-108] |
| Better Auth | `^1.4.18` | Email/password, optional social, cookies, verification/reset | It is already the project authentication boundary. [VERIFIED: packages/auth/package.json:22-25] |
| Hono + Zod contracts | Existing workspace stack | Authenticated claim, asset, and error boundaries | Existing routes parse the claim request and enforce session/idempotency. [VERIFIED: apps/api/src/creator-routes.ts:165-184] |
| Drizzle/PostgreSQL RLS | Existing workspace stack | Owner-scoped state and cross-user isolation | RLS complements explicit application predicates; PostgreSQL defaults to deny after RLS is enabled without a policy. [CITED: https://www.postgresql.org/docs/current/ddl-rowsecurity.html] |
| S3-compatible private storage | Existing workspace stack | Owner namespace, checksums, signed response URLs | Existing key and object-verification services already define this boundary. [VERIFIED: packages/storage/src/keys.ts:20-74] [VERIFIED: apps/api/src/asset-routes.ts:132-171] |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| `@playwright/test` [WARNING: flagged as suspicious — verify before using.] | `1.62.1` | Browser E2E across auth callback, IndexedDB, and private asset recovery | Add only for the required full-browser proof after human review. [CITED: https://playwright.dev/docs/intro] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Durable authenticated claim | Browser-side multi-request upload/sync sequence | Rejected: a tab cannot make DB and object writes atomically recoverable or guarantee one final version. [ASSUMED] |
| IndexedDB same-browser cache | Anonymous cloud account/cross-device draft sync | Rejected by locked scope. [VERIFIED: .planning/phases/02-guest-authentication-and-data-integrity/02-CONTEXT.md:19-34] |

**Installation (only after human checkpoint):**

```bash
bun add -d @playwright/test
```

This command is a planning recommendation, not an executed install. [ASSUMED]

**Version verification:** `npm view @playwright/test version` returned `1.62.1` during this research; registry metadata showed a `2026-08-19` modification timestamp. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `@playwright/test` | npm | ~5 years | ~46.4M/week | github.com/microsoft/playwright | SUS | Flagged — planner must add `checkpoint:human-verify` before installation. [VERIFIED: npm registry] |

**Packages removed due to [SLOP] verdict:** none.  
**Packages flagged as suspicious [SUS]:** `@playwright/test` — the legitimacy seam marked it `SUS` solely as `too-new`, despite its Microsoft source repo and download signal. [VERIFIED: package-legitimacy seam]

## Existing State: Present vs. Not Yet Proven

| Area | Present foundation | Missing proof / change required |
|---|---|---|
| Local recovery | Guest draft plus blob stores, expiry, and atomic local deletion exist. [VERIFIED: apps/web/src/features/create/guestDraftStore.ts:1-128] | Persist a claim checkpoint/snapshot digest and prove recovery after callback, reload, offline failure, and expiry. [ASSUMED] |
| Auth | Better Auth has secure cookie configuration and email/social configuration boundaries. [VERIFIED: packages/auth/src/auth.ts:39-147] | Align private-beta first-campaign verification policy with API/UI configuration; no social button unless the server confirms it is usable. [ASSUMED] |
| Claim replay | Same-owner `draftId` replay is serialized, and another owner gets a conflict. [VERIFIED: apps/api/src/creator-repository.ts:442-543] | Bind one persisted claim operation to immutable snapshot, asset manifest, quote refresh, and eventual run start. [ASSUMED] |
| Asset safety | Object namespace, SHA-256, MIME/size checks, scan redirect/DNS checks, and authorized URL refresh exist. [VERIFIED: packages/storage/src/keys.ts:20-74] [VERIFIED: apps/api/src/source-scanner.ts:100-333] | Make claim finalization wait for all verified objects and add abuse-rate enforcement proof. [ASSUMED] |
| Isolation | Owner transaction and PostgreSQL RLS isolation script/tests exist. [VERIFIED: packages/db/src/user-transaction.ts:7-21] [VERIFIED: scripts/infra/check-rls-isolation.sql:185-237] | Exercise claims, assets, URLs, versions, runs, and callbacks against two users in a real database/browser suite. [ASSUMED] |

## Architecture Patterns

### System Architecture Diagram

```text
Guest Create page
  -> IndexedDB: exact draft + blobs + expiry + pending intent
  -> Generate validation
  -> Auth dialog -> Better Auth email or configured social
  -> validated same-origin callback
  -> POST/resume GuestClaim (session user + opaque operation + snapshot digest)
       -> PostgreSQL claim record / advisory lock / owner RLS
       -> verified direct upload or SSRF-safe remote mirror -> private S3 namespace
       -> HEAD/checksum/MIME/ownership verification
       -> atomic DB finalization: one project + immutable version + claim receipt
  -> browser compares canonical response to local snapshot
  -> delete local draft/blobs only after match
  -> quote refresh -> one idempotent generation submission -> durable project progress

Failure at any arrow -> persisted claim checkpoint + unchanged IndexedDB draft -> Retry / Replace image
```

### Recommended Project Structure

```text
apps/api/src/
├── guest-claim-service.ts       # persisted claim/retry/finalize orchestration
├── guest-claim-repository.ts    # owner-scoped operation and checkpoint records
├── creator-routes.ts            # authenticated claim/resume endpoints
└── asset-routes.ts              # existing verified upload/mirror/read boundary
apps/web/src/features/create/
├── guestDraftStore.ts           # draft + blob persistence and verified cleanup
├── guestClaimRecovery.ts        # callback/retry bridge and canonical comparison
├── GuestAuthRecovery.test.tsx   # integrated auth/recovery state coverage
└── CreateStudio.tsx             # state presentation only
.planning/phases/02-guest-authentication-and-data-integrity/
└── 02-BROWSER-EVIDENCE.md       # in-app browser/Chrome rendered proof
```

### Pattern 1: Persisted Claim Saga

**What:** On Generate, create or resume a single server operation keyed by authenticated user plus opaque pending intent. Its immutable input is the complete serialized draft and asset manifest; the operation records per-asset progress. It may create deterministic project/asset records to gain an owner namespace, but does not publish a usable claimed project/version or start a render until every required object passes ownership, type, size, and checksum verification. [ASSUMED]

**When to use:** Any authenticated claim, retry, duplicate tab/callback, or network interruption. Use the same service for Template and Advanced rather than duplicate claim paths. [VERIFIED: .planning/phases/02-guest-authentication-and-data-integrity/02-CONTEXT.md:19-32]

**Why:** Database transactions cannot atomically include S3 writes; a persisted compensating/resume workflow makes the partial state explicit and retryable. [ASSUMED]

### Pattern 2: Canonical Round-Trip Before Local Destruction

**What:** Return a safe canonical configuration plus stable object metadata after DB finalization. Client compares template, source/facts, campaign settings, Advanced references, pending intent, object keys/checksums, and version ID against the local snapshot. Delete IndexedDB only after a complete match; otherwise retain it and show a retryable error. [ASSUMED]

**When to use:** Every success, callback replay, reload during claim, and post-mirror retry. [ASSUMED]

### Pattern 3: Validated Return Intent

**What:** Keep only a root-relative, same-origin application path in session state. The existing helper rejects `//`, non-root paths, and auth/reset destinations. [VERIFIED: apps/web/src/features/auth/returnPath.ts:3-49] Its allow condition begins `candidate.startsWith("/") && !candidate.startsWith("//")`.

**When to use:** Email sign-in, OAuth callback, cancellation, and password-reset completion. Better Auth also treats trusted origins as the CSRF/open-redirect boundary. [CITED: https://better-auth.com/docs/reference/security]

### Anti-Patterns to Avoid

- **Browser-orchestrated “claim” as a transaction:** Current ordering can create a cloud project before all assets finish. Move retries/checkpoints to the server. [VERIFIED: apps/web/src/features/create/CreateStudio.tsx:793-828]
- **Dropping pending intent during cloud normalization:** Do not reuse a mapper that clears it before claim/run finalization. [VERIFIED: apps/web/src/features/create/portableProjectMapper.ts:18-42]
- **Trusting client `userId`, object key, URL, MIME, or checksum:** Derive owner from session and re-check storage/database values. [VERIFIED: apps/api/src/asset-routes.ts:132-171]
- **Automatic redirect following for import/mirror:** Validate every hop and its resolved IP after each redirect. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]
- **Deleting local media on optimistic success:** Retain every blob until canonical DB/object verification and exact configuration recovery complete. [VERIFIED: .planning/phases/02-guest-authentication-and-data-integrity/02-CONTEXT.md:27-31]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Email/password, session cookies, OAuth state | Custom credential/session/OAuth layer | Existing Better Auth configuration | Auth protocols and callback state have security edge cases. [CITED: https://better-auth.com/docs/reference/security] |
| Cross-user DB authorization | UI-only user-id checks | `withUserTransaction`, owner predicates, PostgreSQL RLS | Browser checks do not prevent direct HTTP/database access. [VERIFIED: packages/db/src/user-transaction.ts:7-21] [CITED: https://www.postgresql.org/docs/current/ddl-rowsecurity.html] |
| Private object authorization | Signed URL persistence or public bucket paths | Existing object key assertion + owner-authorized signed URL response | Signed URLs expire and must not become database authority. [VERIFIED: packages/storage/src/keys.ts:20-74] |
| SSRF filtering | Regex-only URL validation | Existing DNS-pinned scanner/mirror plus rate limiter | Redirects, DNS rebinding, IPv6, content magic, and byte caps need layered validation. [VERIFIED: apps/api/src/source-scanner.ts:100-333] |
| Rendered browser behavior | jsdom-only imitation | Existing in-app browser or Chrome control plus redacted evidence record | IndexedDB, redirects, cookies, callback navigation, focus and responsive/RTL behavior require a real rendered browser. [ASSUMED] |

**Key insight:** Reuse the mature primitives, but compose them under an explicit, durable claim operation; none of the individual primitives proves the full guest-to-owned transition alone. [ASSUMED]

## Common Pitfalls

### Pitfall 1: Empty or duplicate project after a failed asset claim

**What goes wrong:** A project is synchronized before blobs/remote images are fully secured, then a later asset fails. [VERIFIED: apps/web/src/features/create/CreateStudio.tsx:793-828]

**How to avoid:** Persist server operation/checkpoints; finalization publishes the immutable version only after every object verification. Keep the local draft for retry. [ASSUMED]

### Pitfall 2: Callback success loses the exact intended generation

**What goes wrong:** The current stable configuration mapper clears pending intent. [VERIFIED: apps/web/src/features/create/portableProjectMapper.ts:18-42]

**How to avoid:** Include intent ID, idempotency key, snapshot digest, claim receipt, quote binding, and final run reference in the durable operation; replay returns those records rather than constructing new ones. [ASSUMED]

### Pitfall 3: Social button looks available but server credentials are absent

**What goes wrong:** The browser feature flag and server provider credentials are separate configuration surfaces. [VERIFIED: apps/web/src/config/authProviders.ts:1-14] [VERIFIED: packages/auth/src/config.ts:42-94]

**How to avoid:** API exposes a non-secret `configuredProviders` capability derived from validated server configuration; UI renders only that response. [ASSUMED]

### Pitfall 4: SSRF controls regress when scanner and mirroring diverge

**What goes wrong:** One path validates URLs while the other follows an unpinned redirect or accepts a spoofed image MIME. [ASSUMED]

**How to avoid:** Factor both routes through the same policy configuration and test private IPv4/IPv6, metadata IPs, redirect chains, rebinding, bad magic bytes, cap/timeouts, and abuse limits. [VERIFIED: apps/api/src/source-scanner.test.ts:5-111] [VERIFIED: apps/api/src/remote-image-fetcher.test.ts:22-139]

### Pitfall 5: RLS test exists but end-to-end authorization still leaks

**What goes wrong:** Tests can use stubs or only cover project rows, while URL issuance, asset mirroring, versions, and generation references have different routes. [ASSUMED]

**How to avoid:** Run a two-user adversarial matrix through HTTP, PostgreSQL RLS, object URL issuance, and browser callback/retry flows. [VERIFIED: scripts/infra/check-rls-isolation.sql:185-237]

## Code Examples

### Claim-finalization contract (implementation pseudocode)

```typescript
// [ASSUMED] Service-shape guidance; names and fields must be designed in the plan.
const claim = await claimService.resume({ sessionUser, opaqueIntent, snapshotDigest });
await claimService.securePendingAssets(claim);
const canonical = await claimService.finalizeIfVerified(claim);

if (!sameSnapshot(canonical, localDraft)) {
  throw new RecoverableClaimError();
}
await deleteGuestDraft(localDraft.id);
```

The endpoint must derive `sessionUser` from the session rather than trusting a body user ID; existing claim routes already require authentication and an idempotency header. [VERIFIED: apps/api/src/creator-routes.ts:165-184]

### Safe return path boundary

```typescript
// Existing pattern source: apps/web/src/features/auth/returnPath.ts
candidate.startsWith("/") && !candidate.startsWith("//")
```

The source’s exact condition is quoted above. Use that one validated contract for social callback and reset completion rather than accepting an arbitrary URL. [VERIFIED: apps/web/src/features/auth/returnPath.ts:3-49]

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Client-driven sequences treated as one request | Durable idempotent sagas for transaction-plus-object-store workflows | Explicit retry/recovery points are required when DB and object storage cannot share a transaction. [ASSUMED] |
| URL regex to prevent SSRF | Per-hop URL validation, DNS/IP filtering/pinning, redirect and response controls | Prevents redirect/DNS-rebinding bypasses that a regex misses. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Unit-only UI confidence | Isolated browser-context E2E | Exercises cookies, redirects, IndexedDB, and user-visible recovery states. [CITED: https://playwright.dev/docs/intro] |

**Deprecated/outdated:** Persisting signed URLs as durable asset state is incompatible with the project’s storage rule; retain stable object keys and issue authorized response URLs instead. [VERIFIED: AGENTS.md:159-166]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A persisted server-side claim saga is the smallest viable design for DB plus S3 recovery. | Architecture Patterns | More/less schema work than planned. |
| A2 | A public configured-provider API contract is preferable to independent browser flags. | Common Pitfalls | Requires a small API contract addition. |
| A3 | Claim input should include snapshot digest and asset manifest. | Architecture Patterns | Schema/compatibility design needs confirmation. |
| A4 | Phase 2 browser proof uses the available in-app browser or Chrome control and does not add `@playwright/test`. | Validation Architecture | Rendered proof must be recorded manually/tool-assisted rather than through a new package. |
| A5 | The resolved PostgreSQL quotas and proxy-hop policy are the Phase 2 defaults. | Security Domain | Operations may tune validated server configuration later without changing the contract. |

## Open Questions — Resolved for Planning

1. **What exact retention and cleanup policy applies to partially uploaded objects after a claim permanently fails?**
   - **Resolved decision:** retain incomplete-claim private objects for 24 hours. After the cutoff, an idempotent pg-boss cleanup job leases each candidate, rechecks that the claim/asset is still incomplete, validates the canonical private key, deletes or accepts already-missing objects, and records an auditable outcome. Transient failures retry with backoff. Finalized/verified assets are permanently ineligible, including delayed or replayed cleanup jobs. Local IndexedDB data remains governed by verified canonical claim success and is never deleted by this worker. [ASSUMED — locked for Phase 2 planning]

2. **Which rate limit is appropriate for source scan and mirror requests?**
   - **Resolved decision:** public source scan defaults to 20 requests per 10 minutes per trusted client IP; authenticated mirror defaults to 50 requests per 10 minutes per session user. PostgreSQL is the authoritative atomic limiter across API instances; no process-local production fallback is allowed. Forwarded client headers are trusted only when an explicit trusted proxy-hop count is configured, otherwise the direct peer address is authoritative. Limits remain validated server configuration and deterministic tests must prove 429 plus no outbound fetch/storage after rejection. [ASSUMED — locked for Phase 2 planning]

3. **How is email verification policy made consistent across server, web, and private-beta deployment configuration?**
   - **Resolved decision:** define exactly `firstCampaignVerificationPolicy = "deferred_until_after_first_campaign"` in shared auth configuration/contracts. Better Auth behavior, the public API capability and web UI consume this one value. Email/password users may claim and finish the first private-beta campaign before verification, while the workspace presents the approved non-blocking reminder and verification remains available. No independent UI boolean or deployment-only bypass is permitted. [ASSUMED — locked for Phase 2 planning]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Bun | Workspace install/tests | ✓ | 1.3.12 | — |
| Node.js | Existing server/runtime tests | ✓, newer than documented target | 25.2.0 | Validate on documented Node 24 in CI/container. [VERIFIED: package.json:7-10] |
| PostgreSQL client/service | RLS/claim integration | ✓ socket accepts connections; client is older | psql 15.17 | Use project PostgreSQL 17 Compose path for release evidence. [VERIFIED: compose.yaml:10-26] |
| Docker / Compose | PostgreSQL 17 + MinIO + Mailpit full-stack E2E | ✗ | — | No equivalent local full-stack path was verified. |
| FFmpeg/FFprobe | Existing overall worker stack, not primary Phase 2 path | ✓ | 8.1.2 | — |
| Browser E2E runner | Callback/IndexedDB/cookie evidence | ✗ | — | Use the available in-app browser or Chrome control and record the rendered matrix; no package addition in Phase 2. [ASSUMED] |

**Missing dependencies with no fallback:** Docker/Compose (or a securely configured equivalent PostgreSQL 17, private S3-compatible store, and mail test service) for release-grade asset/auth E2E proof.  
**Missing dependencies with fallback:** Rendered browser evidence uses the available in-app browser or Chrome control. Any later browser-test dependency is a separate plan and requires a blocking human package-provenance checkpoint before package modification. [ASSUMED]

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | Vitest 4.1.10 across active workspaces; jsdom/Testing Library for web. [VERIFIED: apps/web/package.json:12-14] |
| Config file | `apps/web/vitest.config.ts`; API and packages use workspace Vitest scripts. [VERIFIED: apps/web/vitest.config.ts:12-20] |
| Quick run command | `bun run --cwd apps/web test` / `bun run --cwd apps/api test` [VERIFIED: apps/web/package.json:12-14] [VERIFIED: apps/api/package.json:15-15] |
| Full suite command | `bun run test:all && bun run typecheck` [VERIFIED: package.json:16-40] |
| Required browser layer | Existing Testing Library integration plus in-app browser/Chrome rendered evidence; current repository search found no committed browser-test config and Phase 2 adds none. [ASSUMED] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| AUTH-01 | Complete guest JSON/blob campaign survives refresh before Generate. | web unit + E2E | `bun run --cwd apps/web test -- guestDraftStore` | ❌ Wave 0 |
| AUTH-02, AUTH-06 | Generate opens contextual auth; cancel preserves exact draft. | Testing Library + rendered browser | `bun run --cwd apps/web test -- AuthGateDialog GuestAuthRecovery` | ❌ Wave 0 |
| AUTH-03 | Only server-configured social providers appear and replay safely. | API stub + rendered browser | `bun run --cwd apps/api test -- auth-provider-stubs` | ❌ Wave 0 |
| AUTH-04, AUTH-05 | Non-blocking verification and reset preserve validated route. | API/web + rendered browser | `bun run --cwd apps/web test -- AuthCopy GuestAuthRecovery returnPath` | ❌ Wave 0 |
| AUTH-07, AUTH-09 | Callback/reload/expiry preserve-or-reject exact snapshot and same-browser ownership. | web unit + rendered browser | `bun run --cwd apps/web test -- guestDraftStore GuestAuthRecovery` | ❌ Wave 0 |
| AUTH-08 | Concurrent callback/retry yields one project/version/run/charge. | PostgreSQL integration + E2E | `bun run --cwd apps/api test -- creator-routes.postgres` | ✅ partial: existing route test only |
| AUTH-10, SOURCE-05, PROJ-06 | Two-user project/version/asset/object URL isolation. | PostgreSQL + storage integration | `bun run --cwd apps/api test -- creator-routes.postgres` | ✅ partial: extend |
| SOURCE-04 | Private IP, redirect, DNS, MIME/size/timeouts and rate limits are rejected. | API unit/integration | `bun run --cwd apps/api test -- source-scanner remote-image-fetcher` | ✅ partial: rate test missing |
| SOURCE-06 | Failed upload/mirror leaves local draft and offers Retry/Replace. | Testing Library + rendered browser | `bun run --cwd apps/web test -- GuestAuthRecovery guestClaimRecovery` | ❌ Wave 0 |
| SOURCE-07 | Source change creates/invokes compatible output invalidation. | API/domain integration | `bun run --cwd apps/api test -- creator` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** affected Vitest command plus focused typecheck. [ASSUMED]
- **Per wave merge:** `bun run test:all && bun run typecheck`. [VERIFIED: package.json:16-40]
- **Phase gate:** full suite, PostgreSQL RLS isolation, private-object integration, and rendered browser E2E all green before verification. [ASSUMED]

### Wave 0 Gaps

- [ ] `apps/web/src/features/create/guestDraftStore.test.ts` — IndexedDB save/expiry/blob deletion/retry behavior for AUTH-01/AUTH-09.
- [ ] `apps/api/src/guest-claim-service.postgres.test.ts` — concurrent resume, partial asset recovery, one final version, one pending intent for AUTH-07/AUTH-08/AUTH-10.
- [ ] Extend `apps/api/src/creator-routes.postgres.test.ts` — two-user claims/assets/URL/version/run attempts for PROJ-06.
- [ ] `apps/web/src/features/create/GuestAuthRecovery.test.tsx` plus `02-BROWSER-EVIDENCE.md` — jsdom state coverage and in-app browser/Chrome evidence for AUTH-02..09 and SOURCE-06, without adding a browser dependency.
- [ ] Scanner/mirror rate-limit test — deterministic reject/429 evidence for SOURCE-04.
- [ ] Source-change output invalidation integration test for SOURCE-07.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | yes | Existing Better Auth email/session boundary; callback provider configuration is server-derived. [VERIFIED: packages/auth/src/auth.ts:39-147] |
| V3 Session Management | yes | HttpOnly, SameSite, secure-on-HTTPS cookies plus validated return state. [VERIFIED: packages/auth/src/auth.ts:39-147] [CITED: https://better-auth.com/docs/reference/security] |
| V4 Access Control | yes | Session owner, owner predicates, `withUserTransaction`, RLS, private-key authorization. [VERIFIED: packages/db/src/user-transaction.ts:7-21] |
| V5 Input Validation | yes | Zod request boundary; SSRF/remote-media validation by URL, DNS/IP, redirects, MIME, bytes, checksum. [VERIFIED: apps/api/src/source-scanner.ts:100-333] |
| V6 Cryptography | yes | Use platform/Better Auth/S3 mechanisms; do not introduce custom credential or signing crypto. [ASSUMED] |

### Known Threat Patterns for guest claim

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Open redirect or poisoned OAuth/reset `next` | Spoofing | Root-relative same-origin allowlist and trusted origins. [VERIFIED: apps/web/src/features/auth/returnPath.ts:3-49] [CITED: https://better-auth.com/docs/reference/security] |
| Replay from callback or second tab | Repudiation / Tampering | Owner-and-intent scoped idempotency plus persisted operation/advisory lock; test concurrency. [VERIFIED: apps/api/src/creator-repository.ts:442-543] [ASSUMED] |
| IDOR/BOLA over project, asset, version, run, URL | Information disclosure | Session-derived owner, explicit predicates, RLS, namespace assertion, generic mismatch response. [VERIFIED: packages/db/src/user-transaction.ts:7-21] [VERIFIED: packages/storage/src/keys.ts:20-74] |
| SSRF via scan or remote image | Tampering / Information disclosure | Per-hop DNS/IP policy, redirect revalidation, pinned fetch, time/byte/type/magic checks, rate limits. [VERIFIED: apps/api/src/source-scanner.ts:100-333] [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html] |
| Partial object/project state | Denial of service / Integrity | Persisted checkpoint, verify before finalization, terminal cleanup, preserve local draft. [ASSUMED] |
| Signed URL/token/log exposure | Information disclosure | Response-only URLs; sanitize logs/errors and never persist URLs/secrets. [VERIFIED: AGENTS.md:133-166] |

## Sources

### Primary (HIGH confidence)

- Project source files and phase context listed throughout as `[VERIFIED: path:line]`.
- npm registry and package-legitimacy seam for package version/audit. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- [Better Auth security documentation](https://better-auth.com/docs/reference/security) — trusted origins, callback/session security. [CITED: https://better-auth.com/docs/reference/security]
- [PostgreSQL row security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) — RLS behavior. [CITED: https://www.postgresql.org/docs/current/ddl-rowsecurity.html]
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — redirect/DNS/IP controls. [CITED: https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html]

### Tertiary (LOW confidence)

- The explicit schema and operational mechanics of a durable claim saga, cleanup policy, and rate-limit configuration are recommendations marked `[ASSUMED]`.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH for existing stack, MEDIUM for browser E2E addition — direct source plus official documentation; package seam requires human checkpoint.
- Architecture: MEDIUM — current gaps are source-grounded; proposed persisted-saga shape is intentionally marked `[ASSUMED]`.
- Pitfalls: HIGH for current claim/mapper/scanner behavior; MEDIUM for unproven end-to-end failure modes.

**Research date:** 2026-08-19  
**Valid until:** 2026-09-18 for the existing codebase; re-check package and Better Auth documentation before install/upgrade.
