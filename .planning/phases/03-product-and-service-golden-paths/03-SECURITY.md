---
phase: 03
slug: product-and-service-golden-paths
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-21
---

# Phase 03 — Security

> Verified security contract for the Product and Service Golden Paths phase.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Guest browser → portable API | Unauthenticated source import, draft claim, template estimate, and eventual auth handoff | Product/service facts, campaign settings, private asset metadata, rights state |
| Authenticated API → PostgreSQL | Owner-scoped immutable project/version, quote, claim, and render mutations | User-owned configuration, object keys, quote and idempotency records |
| API/worker → private storage | Verified image/footage reads and signed delivery | Private media bytes, checksums, MIME metadata, stable object keys |
| API/worker → generation provider | Server-approved semantic capability only after quote/start validation | Sanitized prompt/configuration and verified references; no browser model IDs |
| Planning/UAT evidence → repository | Release proof without operational secrets or false pass claims | Redacted request/evidence metadata and explicit verification status |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering / information disclosure | Source import | high | mitigate | Strict source/fact schemas plus pinned public-network, redirect, timeout, and size policy | closed |
| T-03-02 | Tampering / repudiation | Fact provenance | high | mitigate | Imported, confirmed, and manual provenance transitions are explicit and bounded | closed |
| T-03-03 | Tampering / information disclosure | Draft claim and recovery | high | mitigate | Stable object keys, signed-URL stripping, exact receipt/checksum recovery | closed |
| T-03-04 | Tampering | Template selection | high | mitigate | Server reloads the immutable published template and rechecks eligibility | closed |
| T-03-05 | Tampering / repudiation | Quote and start | high | mitigate | Configuration-bound quote hash, expiry, invalidation, and start-time parity | closed |
| T-03-06 | Spoofing / elevation | Presenter authorization | high | mitigate | Unsupported presenter modes fail before claim, quote, charge, or provider work | closed |
| T-03-07 | Tampering | Campaign settings | high | mitigate | Strict Kuwait Template payload and immutable template ID enforced at route, service, repository, PostgreSQL, quote, and start boundaries | closed |
| T-03-08 | DoS / repudiation | Guest claim replay | high | mitigate | User-scoped advisory locks, canonical digest, replay conflict checks, and idempotency | closed |
| T-03-09 | Information disclosure | UAT evidence | high | mitigate | Blocking evidence redaction for secrets, signed URLs, object keys, identifiers, and remote URLs | closed |
| T-03-10 | Information disclosure | Public generation errors | medium | mitigate | Stable sanitized API envelopes; provider payloads remain server-only | closed |
| T-03-11 | Tampering | Presenter policy | high | mitigate | Strict presenter schema, compatibility projection, and server fail-closed enforcement | closed |
| T-03-12 | Information disclosure | Presenter assets | high | mitigate | Owner/project-scoped lookups and uniform denial behavior | closed |
| T-03-13 | Spoofing | Template previews | medium | mitigate | Playback is limited to verified preview media; static directions are labelled | closed |
| T-03-14 | Denial of service | Recommendation quotes | medium | mitigate | Recommendation cap and stale-request cancellation | closed |
| T-03-15 | Spoofing | Capability messaging | medium | mitigate | Unsupported presenter capabilities are absent from Template Mode | closed |
| T-03-16 | Denial of service / cost | Provisioned UAT | high | mitigate | UAT harness does not submit provider work and fails closed | closed |
| T-03-17 | Spoofing | Verification claims | high | mitigate | Missing browser/provisioned proof is recorded as NOT VERIFIED, never inferred as passed | closed |

*Status: open · closed · open — below high threshold (non-blocking).*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-21 | 17 | 16 | 1 | GSD security auditor — initial audit |
| 2026-08-21 | 17 | 17 | 0 | GSD security auditor — final verification after T-03-07 remediation |

---

## Sign-Off

- [x] All threats have a disposition
- [x] No accepted risks require documentation
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-21
