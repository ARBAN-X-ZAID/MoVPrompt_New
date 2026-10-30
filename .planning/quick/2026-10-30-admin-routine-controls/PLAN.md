# Routine owner controls and readable generation records

User-approved plan. Continue the explicitly authorized manual GSD workflow.

1. Add action-specific capabilities and a default-off routine-management flag while retaining the read-only gate for other mutations.
2. Implement typed generation list/detail summaries, exact-run media and immutable template lookup.
3. Remove internal identifiers from rendered admin records and replace relationship labels.
4. Validate permission boundaries with real MongoDB, component/regression checks and browser review.
5. Deploy compatible web/API/worker release, enable the limited flag locally and in production, verify live without changing customer/template business data.

Invariants: no refunds, credit changes, deletion, support mutations or paid recovery enabled. Preserve immutable snapshots, audit, idempotency and last-owner protection. Template actions need confirmation only; customer actions retain password confirmation. Rollback disables the new flag.
