# Owner admin implementation

Manual GSD workflow: the user explicitly approved the manual planning fallback when GSD commands were unavailable. This implementation follows the complete admin plan approved in the conversation on 2026-10-27.

## Invariants

- Current React/Hono/Better Auth/MongoDB/R2/lease queue architecture.
- Owner membership, verified email, MFA and recent authentication for sensitive actions. Legacy role flags do not grant owner access.
- Canonical, paginated server data, no fabricated metrics or successful operation states.
- Idempotency, optimistic revisions, ledger-only credit changes and append-only audit.
- Preserve facts, exact display copy, speech, existing prices, accepted versions and in-flight snapshots.
- Financial requests and explicit owner review. Live refunds and paid generation remain disabled pending external acceptance/budget gates.
- Customer media remains private. Logged owner access, 30-day recoverable trash and reference-aware cleanup.
- English/Arabic, RTL, themes and accessible responsive UI.

## Execution stages

2026-10-27 continuation: the user requested completion of remaining modules and full local validation before deployment. Continue the previously authorized manual GSD workflow. Implement remaining workflows with external acceptance gates preserved; verify each completed module against transactional MongoDB/private storage and rendered customer/admin UI before release. Production backup/retention policy clarification is pending; independent implementation continues.

- [x] 1. Secure owner bootstrap, MFA, membership middleware, audit, feature flag, admin shell.
- [x] 2. Overview and customer investigation/account operations.
- [x] 3. Campaigns, generations, media access and safe operations.
- [x] 4. Financial requests, credit ledger, allocations and durable refund reconciliation.
- [x] 5. Pinned database-backed executable template definitions (browser/API/compiler/worker and real MongoDB checks).
- [x] 6. Guided template editor, validation, preview, publication, rollback.
- [x] 7. Customer assets, permissions, trash and cleanup.
- [x] 8. Support cases, customer help integration and moderation.
- [x] 9. Versioned communications, scheduling and actual customer readers.
- [x] 10. Pricing, reports, bounded private exports and operational controls.
- [ ] 11. MongoDB/storage/integration/security/accessibility validation and migration rehearsal.
- [ ] 12. Staging/production rollout only after acceptance gates, documented remaining external gates.

## Evidence

2026-10-28 continuation: finish operational monitoring and reviewed retention scheduling, add bounded historical reconciliation and legacy cutover controls, rehearse isolated database/private-media recovery, then run current full local regression and rendered admin/customer checks. Production policy values, verified owner MFA and paid/gateway acceptance remain external release gates; do not infer them from “continue”.

Record commands, failures, local fixture scope and verified outcomes in PROGRESS.md. A screen or source file alone is not a completed workflow.

Stages 1–10 are implemented and validated locally. Stage 11 remains open for actual legacy-data/staging acceptance and formal screen-reader/accessibility review; stage 12 remains open for verified production backup/retention policy, owner email/MFA, cutover and deployment. Local tests include all 1,386 distinct workspace cases in the combined opt-in matrix. No production completion is claimed. See PROGRESS.md and evidence/validation-summary-2026-10-28.json.

## Deployment continuation — 2026-10-28

The user explicitly requested completion of deployment setup and deployment. Continue the authorized manual workflow: prepare and secret-scan the release candidate, add deployed revision reporting and CI coverage for transactional MongoDB, document environment parity for the existing Render services, push the reviewed branch and run remote checks. Deploy compatible code behind closed activation flags while documented owner, backup and legacy-cutover gates are outstanding. Actual service mutation requires an authenticated Render session; a sign-in handoff is pending. Never infer production deployment from Git push or local builds.
