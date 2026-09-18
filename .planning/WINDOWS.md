---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 3
total_count: 10
last_updated: 2026-08-21T16:58:50.558Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | unrun-verify | apps/api/src/auth-provider-stubs.test.ts |  | PostgreSQL callback replay cases skipped because MOVPROMPT_TEST_DATABASE_URL and Docker are unavailable in this execution environment. | fixed |  | 2026-08-19T19:33:12.375Z | 2026-08-19T20:42:45.933Z |
| 2 | 02 | unrun-verify | apps/api/src/guest-claim-service.postgres.test.ts |  | Disposable PostgreSQL guest-claim replay and owner-isolation suite skipped because MOVPROMPT_TEST_DATABASE_URL is unset. | fixed |  | 2026-08-19T19:49:20.865Z | 2026-08-19T20:42:46.023Z |
| 3 | 02 | unrun-verify | apps/api/src/creator-routes.postgres.test.ts |  | Source-change PostgreSQL replay/concurrency test skipped because MOVPROMPT_TEST_DATABASE_URL is not configured. | fixed |  | 2026-08-19T20:23:02.743Z | 2026-08-19T20:42:46.105Z |
| 4 | 02 | deviation | apps/web/src/features/create/AuthGateDialog.test.tsx |  | Full web suite has a pre-existing order-dependent locale test failure; isolated test passes. | open |  | 2026-08-19T20:23:02.830Z |  |
| 5 | 02 | unrun-verify | .planning/phases/02-guest-authentication-and-data-integrity/02-BROWSER-EVIDENCE.md |  | Live API, provider, private-claim, and two-account browser matrix was unavailable at the observed local web origin. | open |  | 2026-08-19T20:58:50.652Z |  |
| 6 | 03 | stub | apps/web/src/features/create/creatorAssets.ts | 37 | MP4/MOV source media is preserved in the guest draft but authenticated asset claiming currently accepts only JPEG, PNG, and WebP. | open |  | 2026-08-20T14:01:54.255Z |  |
| 7 | 03 | unrun-verify | apps/web/src/features/create/CampaignSetupStep.tsx |  | Full-page campaign setup browser verification requires a live authoritative quote service; local QA correctly kept template selection disabled. | open |  | 2026-08-20T20:34:54.602Z |  |
| 8 | 03 | unrun-verify | .planning/phases/03-product-and-service-golden-paths/03-UAT-EVIDENCE.md |  | Provisioned email/claim/checksum/replay/authoritative quote/durable-run UAT remains NOT VERIFIED because generation is disabled and Mailpit/worker queue evidence is unavailable. | open |  | 2026-08-20T21:11:47.357Z |  |
| 9 | 03 | unrun-verify | .planning/phases/03-product-and-service-golden-paths/03-BROWSER-EVIDENCE.md |  | Rendered browser matrix remains NOT VERIFIED because browser automation and a reachable provisioned Generate path are unavailable. | open |  | 2026-08-20T21:11:47.437Z |  |
| 10 | 04 | unrun-verify | apps/web/src/features/create/CreateStudio.tsx |  | Rendered browser verification of a real persisted cancelling run awaits a configured local API and worker fixture. | open |  | 2026-08-21T16:58:50.558Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/src/auth-provider-stubs.test.ts",
    "line": null,
    "description": "PostgreSQL callback replay cases skipped because MOVPROMPT_TEST_DATABASE_URL and Docker are unavailable in this execution environment.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-19T19:33:12.375Z",
    "resolved_at": "2026-08-19T20:42:45.933Z"
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/src/guest-claim-service.postgres.test.ts",
    "line": null,
    "description": "Disposable PostgreSQL guest-claim replay and owner-isolation suite skipped because MOVPROMPT_TEST_DATABASE_URL is unset.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-19T19:49:20.865Z",
    "resolved_at": "2026-08-19T20:42:46.023Z"
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "apps/api/src/creator-routes.postgres.test.ts",
    "line": null,
    "description": "Source-change PostgreSQL replay/concurrency test skipped because MOVPROMPT_TEST_DATABASE_URL is not configured.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-19T20:23:02.743Z",
    "resolved_at": "2026-08-19T20:42:46.105Z"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "02",
    "file": "apps/web/src/features/create/AuthGateDialog.test.tsx",
    "line": null,
    "description": "Full web suite has a pre-existing order-dependent locale test failure; isolated test passes.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-19T20:23:02.830Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "02",
    "file": ".planning/phases/02-guest-authentication-and-data-integrity/02-BROWSER-EVIDENCE.md",
    "line": null,
    "description": "Live API, provider, private-claim, and two-account browser matrix was unavailable at the observed local web origin.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-19T20:58:50.652Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "stub",
    "phase": "03",
    "file": "apps/web/src/features/create/creatorAssets.ts",
    "line": 37,
    "description": "MP4/MOV source media is preserved in the guest draft but authenticated asset claiming currently accepts only JPEG, PNG, and WebP.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-20T14:01:54.255Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "apps/web/src/features/create/CampaignSetupStep.tsx",
    "line": null,
    "description": "Full-page campaign setup browser verification requires a live authoritative quote service; local QA correctly kept template selection disabled.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-20T20:34:54.602Z",
    "resolved_at": null
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-product-and-service-golden-paths/03-UAT-EVIDENCE.md",
    "line": null,
    "description": "Provisioned email/claim/checksum/replay/authoritative quote/durable-run UAT remains NOT VERIFIED because generation is disabled and Mailpit/worker queue evidence is unavailable.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-20T21:11:47.357Z",
    "resolved_at": null
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-product-and-service-golden-paths/03-BROWSER-EVIDENCE.md",
    "line": null,
    "description": "Rendered browser matrix remains NOT VERIFIED because browser automation and a reachable provisioned Generate path are unavailable.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-20T21:11:47.437Z",
    "resolved_at": null
  },
  {
    "id": 10,
    "kind": "unrun-verify",
    "phase": "04",
    "file": "apps/web/src/features/create/CreateStudio.tsx",
    "line": null,
    "description": "Rendered browser verification of a real persisted cancelling run awaits a configured local API and worker fixture.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-21T16:58:50.558Z",
    "resolved_at": null
  }
]
````
