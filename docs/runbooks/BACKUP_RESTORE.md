# Backup and restore runbook

## Scope

A recoverable MovPrompt backup set includes:

- MongoDB collections, indexes and migration history;
- private creator, output and legacy asset objects plus metadata/checksums;
- deployment manifests, artifact digests and environment variable names;
- OAuth/provider/payment configuration references;
- encryption/signing key version metadata, not plaintext secrets in backups;
- queue/job state needed to reconcile generation, credits and payments.

RPO, RTO, retention, backup region and restore-test frequency are not yet
approved. Production cannot launch until owners and measurable values are
recorded.

## MongoDB and media backups

Use MongoDB replica-set backups or a managed point-in-time recovery service. Back up database records, queue state and all three R2 buckets to an independently controlled destination; MongoDB backups do not include media. Preserve stable object keys, metadata, sizes and SHA-256 checksums. Never make assets or output buckets public to simplify backups. Do not delete existing local volumes as part of this migration.

## Production backup requirements

- Automated database backups plus point-in-time recovery where supported.
- Object versioning or immutable backup copies with lifecycle protection.
- Encryption in transit and at rest with controlled key access.
- Backup success/failure alerts routed to an accountable owner.
- Separate failure domain/account from the primary service.
- Documented retention and privacy deletion interaction.
- Quarterly restore drill at minimum until operational data supports a different
  cadence.

Provider-managed backup status is not proof of recoverability; restore must be
demonstrated.

## Restore drill

1. Open a change/incident record and identify the exact backup/checksum.
2. Provision an isolated empty database and private object namespace.
3. Restore database data without changing production DNS or credentials.
4. Restore object data and validate database paths against object manifests.
5. Run migrations only when their compatibility with the restored version is
   documented.
6. Validate row counts, constraints and representative checksums.
7. Run two-user isolation, auth, project, generation recovery, credit/refund and
   signed-download tests.
8. Reconcile job, credit and payment records at the recovery boundary.
9. Measure achieved RPO/RTO and record failures.
10. Destroy the isolated drill environment according to retention policy.

## Production recovery

Restore into a new destination first. Cutover requires incident commander,
database owner and product/financial owner approval. Record the recovery point,
known lost window, affected in-flight operations and reconciliation plan before
changing traffic.
