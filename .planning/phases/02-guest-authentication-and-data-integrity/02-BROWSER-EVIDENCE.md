# Phase 2 Rendered Browser Evidence

**Captured:** 2026-08-19

## Environment and boundaries

- Local Vite web interface observed at `127.0.0.1:8080`; the dedicated local API, PostgreSQL, private storage, and worker endpoints were not available at that origin during this run.
- No password, reset, OAuth, provider, claim, upload, or paid-generation submission was made. Provider and claim outcomes below therefore use the deterministic unit/integration seams from Plans 02-01 through 02-07.
- This document intentionally contains no account data, request identifiers, draft identifiers, credentials, callback values, private storage paths, remote URLs, or signed links.

## Rendered matrix

| Viewport | Language / direction | Theme | Evidence | Result |
|---:|---|---|---|---|
| 375 × 812 | English / LTR | Light | `/auth` renders one labelled email/password form, Sign in action, and no horizontal overflow. | PASS |
| 375 × 812 | Arabic / RTL | Light | Language control switches `lang=ar` and `dir=rtl`; labelled Arabic form and actions remain visible with no overflow. | PASS |
| 375 × 812 | Arabic / RTL | Dark | `/create` shell switches to semantic dark surface and retains RTL order with no overflow. | PASS |
| 768 × 900 | Arabic / RTL | Light | `/auth` heading, form, and controls render without horizontal overflow; all visible interactive controls measured at least 44px. | PASS |
| 1024 × 900 | Arabic / RTL | Light | `/auth` retains the approved single form hierarchy and no horizontal overflow. | PASS |
| 1440 × 900 | Arabic / RTL | Light | `/auth` retains the approved single form hierarchy and no horizontal overflow. | PASS |

## Accessibility and interaction observations

- The auth page exposes one h1, native labelled email/password inputs, a tablist, and semantic buttons in the accessibility tree.
- Keyboard navigation moved focus to the Sign in button at 375px; visible control measurements were at least 44px in the inspected states.
- The creator shell exposes the skip link, language/theme buttons, named source tabs, and a status region.
- No browser console errors were recorded in the inspected auth and creator routes.
- Existing reduced-motion CSS was present and the scoped unit tests verify the auth-gate focus target, no empty provider divider, exact configured zero/one/two provider controls, cancellation focus restoration, and bilingual copy.

## Deterministic recovery proof

| Requirement | Evidence | Result |
|---|---|---|
| Zero, one, two provider controls | `AuthGateDialog.test.tsx` injects the server capability seam and asserts only configured controls render and the first enabled method receives focus. | PASS |
| Email, cancel, safe return, reset neutral copy | `AuthCopy.test.ts`, `AuthGateDialog.test.tsx`, and `returnPath` tests assert the complete bilingual contract and same-origin return rules. | PASS |
| Replay, offline, source failure, mismatch, retry, expiry | `guestClaimRecovery.test.ts`, `GuestAuthRecovery.test.tsx`, and Plans 02-01..02-07 database/API tests retain the exact local draft until the canonical receipt verifies. | PASS (deterministic seam) |
| Social callback fixture | Plan 02-03 API test-only provider adapters exercise Google and Apple callback/replay paths without contacting a live provider. | PASS (deterministic seam) |
| Owner media refresh and wrong-account denial | Plan 02-04 and 02-07 isolated API/storage/PostgreSQL tests exercise owner refresh and cross-user denial. | PASS (deterministic seam) |

## Open rendered checks

- Live email reset delivery, Google/Apple redirects, callback replay across tabs, private-asset claim/retry, expired owner URL refresh, and two-account browser denial could not be exercised because the local API/worker/storage stack was not available at the observed web origin. These remain explicitly unverified in a rendered browser, not inferred from code.
- A full Axe scan was not run because Phase 2 forbids adding browser-test dependencies and no existing Axe command was available. Semantic tree, labels, keyboard flow, focus, target size, overflow, RTL, theme, and console checks above are the observed substitute evidence.

## Redaction verification

`node scripts/infra/check-phase2-evidence-redaction.mjs` passes on this file.
