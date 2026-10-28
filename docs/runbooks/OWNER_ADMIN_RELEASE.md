# Owner admin release and verification

The owner workspace uses the portable API, MongoDB transactions, private R2 and the admin operation worker. Repository files and isolated fixture tests are not proof of a production cutover.

## Current release gates

- Designated owner completes genuine email verification, MFA and recovery-code enrollment. Bootstrap intent alone does not activate access. Never set verification or factor flags manually for a real owner.
- Record approved RPO, RTO, backup retention, financial-record retention and account-erasure grace with an approval reference. `continue` is not approval of numerical values. See [backup and restore](BACKUP_RESTORE.md).
- Configure and demonstrate production database/media backups in an independent failure domain. The isolated local drill is encrypted, disposable and uses the same storage account. It does not satisfy this gate or retain an escrowed recovery key.
- Inventory actual legacy data and identity mappings. Review real wallet reconciliation batches after a verified backup. Local synthetic financial evidence is not a migration of customer records.
- Deploy the retirement guard for all eight legacy admin Edge Functions. Verify direct requests return `legacy_admin_retired`, and independently remove/restrict legacy database admin write policies and role grants. A Render deployment alone does not deploy Supabase functions or retire direct database write access.
- Complete staging owner review and the remaining screen-reader/failure acceptance checks before enabling the owner flag. Keep paid preview/recovery, permanent deletion and live cash refunds disabled until their separate acceptance requirements pass.

## Additive rollout

1. Back up and inventory MongoDB, private media and relevant legacy records. Record object checksums, indexes, deployed revisions and identity mappings without credentials or signed URLs.
2. Deploy compatible contracts, API, video worker and admin worker with the owner/customer rollout flags off. Build from one reviewed revision. `scripts/start-workers.mjs` supervises the worker processes in the worker image.
3. Reconcile canonical cash orders, ledger entries, reservations and refund holds. `/api/v1/admin/migration/scan` inspects at most 50 wallets; the reviewed batch expires after 15 minutes. Reconciliation refuses changed or unproven inputs, leaves balances/ledger/accepted snapshots unchanged and records per-user outcomes. Repeat with `nextCursor`.
4. Retire legacy writes and verify that guests, customers and legacy admins cannot invoke owner operations.
5. Verify the real owner identity and MFA, then enable the owner web/API flags for staging. Review audit logging, private playback, support uploads, notice readers, controlled publication and pricing snapshots.
6. Enable modules gradually. Observe worker heartbeats, system checks and reconciliation queues. Pausing new generation must not interrupt payment webhooks, refunds or existing output recovery.
7. Keep `ADMIN_REFUNDS_ENABLED` / `ADMIN_REFUND_ACCEPTANCE_VERIFIED` off until merchant permissions, KWD fils precision and approved real gateway acceptance are verified. Keep business-render flags off until an explicit USD budget and cost acceptance exist. Paid generation testing remains deferred.

## Local restore drill

Use the installed Node/Bun tooling, a dedicated local replica set and private test storage credentials. The drill refuses a non-local database URI, creates unique source/restore databases, verifies encrypted database/index/media recovery, checks two-user isolation, and replays charge/refund operations without paid provider calls. It deletes only its disposable databases and unique objects. A cleanup failure fails the command.

```bash
ADMIN_TEST_MONGODB_URI='mongodb://127.0.0.1:27029/?replicaSet=admin-rs&directConnection=true' \
ADMIN_REAL_STORAGE_TEST=true \
bun --env-file=/path/to/private-test.env scripts/infra/admin-backup-restore-drill.ts /path/to/local-evidence.json
```

An optional `ADMIN_DRILL_RECEIPT_DATABASE=movprompt_admin_ui_test` records only local drill metadata for the local UI. It cannot write a production-success receipt. Never use the application’s remote database URI as a test target.

## Operational behavior

- The worker schedules one monitor per minute across replicas. Source, period, evaluation time and thresholds accompany results. Missing/stale evidence is unavailable. Alert review records acknowledgement, never resolution; recurrence removes the old acknowledgement.
- Provider cost alerts use reported USD samples and disclose incomplete coverage. They are not a confirmed settlement, KWD conversion or profit figure.
- Approved retention policy schedules an hourly inventory. Cleanup checks references, active copies, current photos, independent consumers, recovery periods, sizes and checksums. Expired support staging and private exports retain a conservative 30-day window. Execution stays off when policy values are missing.
- Account erasure requires recent owner review of the exact manifest and policy hash. Recheck financial/legal/active-work blockers at execution. Keep required financial/audit records; expire old account exports. A changed manifest requires renewed review.
- SMTP-accepted means only that the mail server accepted a message. Interrupted submissions are uncertain and are never blindly resent. Promotional messages require current opt-in and suppression checks. Test-only SMTP must refuse real recipients.
- Template tags and ordering are metadata. Resolution restrictions are pinned executable settings enforced by the customer form, API and worker. New video-affecting settings need matching quality evidence. Existing campaign versions retain their settings.

## Rollback

Disable new publication, pricing, email broadcasts, funded rendering and retention execution first. Keep API/worker versions compatible with pinned definitions and pending operations. Do not delete catalog versions, operations, financial rows or media as a rollback. Preserve payment/refund reconciliation and existing-output recovery. Review any active generation pause before disabling owner access so an intended maintenance pause is not mistaken for a healthy service. Restore traffic only through the documented backup/incident procedure when data recovery is required.
