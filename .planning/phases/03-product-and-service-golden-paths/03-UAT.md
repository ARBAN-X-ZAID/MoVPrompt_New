---
phase: 03-product-and-service-golden-paths
tested: 2026-08-21
status: passed
tests_passed: 5
tests_failed: 0
provider_calls: 0
---

# Phase 3 User Acceptance Test

## Result

Phase 03 passes its non-paid acceptance gate. One physical-product campaign and one service campaign each reached a real authenticated, private, checksum-verified, immutable, authoritatively quoted, idempotent queued render on a provisioned disposable stack.

| Test | Result | Evidence |
|---|---|---|
| Product upload golden path | PASS | Real product media, strict facts, private claim, immutable version, 80-credit quote, one run, replay-safe cancellation. |
| Service/manual golden path | PASS | Service media and facts, bilingual configuration, private claim, immutable version, 120-credit quote, one run, replay-safe cancellation. |
| Exact configuration preservation | PASS | Campaign contract remained equal across browser draft, claim snapshot, project version, quote binding, and run. |
| Auth only at Generate | PASS | Browser remained guest through final review and opened the account gate only after Generate; cancelling retained the campaign. |
| Isolation and economics | PASS | Restricted roles, forced RLS, private storage, zero provider attempts, zero ledger entries, and restored starter entitlement were observed. |

No paid generation was performed. Phase 04 must separately prove provider completion and accepted output quality.
