---
phase: 2
slug: guest-authentication-and-data-integrity
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-20
---

# Phase 2 — Security

> All 40 unique plan-authored threats were verified closed at ASVS Level 1. The blocking threshold is high.

## Trust Boundaries

| Boundary | Description | Data crossing |
|---|---|---|
| Browser → API | Guest draft claim, auth callback, source import and private media requests | Campaign facts, checksums, OAuth state, asset metadata |
| API → PostgreSQL | Owner-scoped claim, project/version, quota and audit transactions | User IDs, immutable configuration, operation state |
| API/worker → private storage | Upload, mirror, verification, cleanup and signed download | Private media bytes, stable object keys, checksums |
| Worker → cleanup queue | Leased abandoned-claim cleanup and retry | Operation IDs, sanitized audit state |
| Public URL → scanner/mirror | Hardened fetch with per-hop network validation | Untrusted URL, bounded media response |

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation evidence | Status |
|---|---|---|---|---|---|---|
| T-02-01 | Spoofing | Draft claim owner | critical | mitigate | Session owner and owner-scoped transaction | closed |
| T-02-02 | Tampering | Snapshot/manifest | high | mitigate | Zod boundary and digest/manifest comparison | closed |
| T-02-03 | Repudiation | Claim/callback replay | high | mitigate | Idempotency, advisory lock and unique constraints | closed |
| T-02-04 | Information disclosure | Claim conflict | high | mitigate | Generic conflict response | closed |
| T-02-05 | Elevation of privilege | Project/version ownership | critical | mitigate | Owner tuples, forced RLS and isolation tests | closed |
| T-02-06 | Tampering | Local snapshot | high | mitigate | Versioned IndexedDB and exact receipt verification | closed |
| T-02-07 | Repudiation | Pending intent reuse | medium | mitigate | Persisted stable pending-generation checkpoint | closed |
| T-02-08 | Information disclosure | Expired/wrong-account draft | high | mitigate | Seven-day expiry and account-bound recovery | closed |
| T-02-09 | Tampering | Partial cleanup | high | mitigate | Cleanup only after exact receipt verification | closed |
| T-02-10 | Spoofing | OAuth callback | critical | mitigate | State/session validation and invalid-state tests | closed |
| T-02-11 | Tampering | Verification policy | high | mitigate | Typed deferred-verification policy | closed |
| T-02-12 | Repudiation | Social callback replay | high | mitigate | Replay-safe callback behavior | closed |
| T-02-13 | Information disclosure | Provider capability | high | mitigate | Semantic public auth capability only | closed |
| T-02-14 | Elevation of privilege | Test auth stubs | critical | mitigate | Production composition rejects stubs | closed |
| T-02-15 | Spoofing | Project/asset identity | high | mitigate | Session and project/asset tuple authorization | closed |
| T-02-16 | Tampering | Media metadata | high | mitigate | Magic bytes, size, SHA and HEAD verification | closed |
| T-02-17 | Information disclosure | Signed URLs/object keys | high | mitigate | Stable keys stored; authorized response-only URLs | closed |
| T-02-18 | Denial of service | Partial uploads | medium | mitigate | Upload checkpoint and cleanup eligibility | closed |
| T-02-19 | Elevation of privilege | URL refresh | critical | mitigate | Owned verified asset lookup before signing | closed |
| T-02-20 | Spoofing | Forwarded IP | high | mitigate | Trusted-hop client identity extraction | closed |
| T-02-21 | Tampering | Rate window | high | mitigate | Validated atomic PostgreSQL quota | closed |
| T-02-22 | SSRF | Scanner/mirror | critical | mitigate | Per-hop DNS/IP, pinned transport and redirect checks | closed |
| T-02-23 | Denial of service | Scan/mirror | high | mitigate | Per-IP/user quotas before outbound fetch | closed |
| T-02-24 | Elevation of privilege | Mirror owner | high | mitigate | Owner check and user-scoped quota | closed |
| T-02-25 | Tampering | Source fingerprint | high | mitigate | Canonical fingerprint and idempotent persistence | closed |
| T-02-26 | Repudiation | Source replay | medium | mitigate | Immutable version and operation key | closed |
| T-02-27 | Information disclosure | Source asset | high | mitigate | Owner/version/asset tuple with generic denial | closed |
| T-02-28 | Tampering | Stale media | high | mitigate | Stale/sample output rejection | closed |
| T-02-29 | Denial of service | Offline retry | medium | mitigate | Preserved draft and explicit retry | closed |
| T-02-30 | Tampering | Cleanup eligibility | critical | mitigate | 24-hour threshold, lease/recheck and finalized immunity | closed |
| T-02-31 | Repudiation | Cleanup attempts | high | mitigate | Durable sanitized audit metadata | closed |
| T-02-32 | Denial of service | Cleanup retry | medium | mitigate | Idempotent not-found and bounded backoff | closed |
| T-02-33 | Elevation of privilege | Migration/RLS role | critical | mitigate | Guarded local harness and restricted role | closed |
| T-02-34 | Information disclosure | Cross-user access | critical | mitigate | Forced RLS and two-user probes | closed |
| T-02-35 | Spoofing | Callback/session UI | high | mitigate | Safe return path and protected auth flow | closed |
| T-02-36 | Tampering | Recovery state | high | mitigate | Typed exact-receipt verification | closed |
| T-02-37 | Repudiation | Replay announcements | medium | mitigate | One receipt-driven outcome | closed |
| T-02-38 | Information disclosure | Browser evidence | high | mitigate | Redaction validator blocks secrets and identifiers | closed |
| T-02-39 | Denial of service | Offline retry UI | medium | mitigate | No reconnect auto-submit | closed |
| T-02-SC | Supply chain | Dependency delta | high | mitigate | No Phase 2 package or lockfile change | closed |

## Accepted Risks Log

No accepted risks.

## Security Audit Trail

| Audit date | Threats total | Closed | Open | Run by |
|---|---:|---:|---:|---|
| 2026-08-20 | 40 | 40 | 0 | gsd-security-auditor |

## Verification Evidence

- Focused API security tests: 32 passed; PostgreSQL-gated cases were separately exercised by the guarded PG17 evidence.
- Focused guest/auth/recovery tests: 37 passed.
- Abandoned-claim cleanup tests: 6 passed.
- Evidence redaction and `git diff --check`: passed.
- Full workspace build, 370 non-skipped tests and all workspace typechecks: passed after the final review fix.

## Sign-Off

- [x] All threats have a disposition.
- [x] No risk was silently accepted.
- [x] `threats_open: 0` confirmed.
- [x] `status: verified` set in frontmatter.

**Approval:** verified 2026-08-20
