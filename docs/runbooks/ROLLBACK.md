# Rollback runbook

## Principle

Application rollback and database rollback are different operations. Prefer a
known-good application artifact plus backward-compatible schema. Do not reverse
a data migration or run destructive SQL during an incident without database
owner review and a verified backup.

## Before every release

Record:

- previous and candidate web/API/worker artifact digests;
- current and candidate migration versions;
- feature-flag values;
- queue consumers and scheduled jobs affected;
- backup identifiers and restore-test date;
- provider/payment webhook versions;
- exact rollback owner and decision deadline.

## Application rollback

1. Stop rollout and disable the affected feature flag.
2. Prevent new incompatible jobs while allowing safe in-flight work to settle.
3. Redeploy the previous immutable API and worker digests.
4. Redeploy the previous web artifact.
5. Verify health, authentication, authorization and a bounded core journey.
6. Reconcile jobs, credits, payments and outputs created during the window.
7. Keep evidence and open an incident record.

## Database response

Use one of these in order of preference:

1. Forward-fix with an additive migration.
2. Keep the expanded schema and roll back only application artifacts.
3. Disable reads/writes to the affected capability and repair data offline.
4. Restore to a new database and perform controlled cutover only when data loss,
   RPO/RTO impact and reconciliation are explicitly accepted.

Never edit a migration that has already run in a shared environment. Never
assume `DROP`, down migrations or point-in-time restore is safe for concurrent
generation, credits or payments.

## Verification

- Two accounts remain isolated.
- Last accepted project versions remain accessible.
- No user is charged twice or refunded twice.
- Queued/processing jobs have one authoritative owner and state.
- Provider outputs are available from MovPrompt-owned storage.
- Payment and credit ledgers reconcile.
- Error rate and latency return to the known-good baseline.

Document the failed release, selected recovery path, affected records, customer
impact and follow-up owner before closing rollback.
