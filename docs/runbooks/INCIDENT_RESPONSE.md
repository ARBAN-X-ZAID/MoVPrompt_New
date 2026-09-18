# Incident response runbook

## Severity guide

| Severity | Examples | Initial response target |
|---|---|---|
| SEV-1 | Cross-account access, secret exposure, widespread double charging, destructive data loss | Immediate page |
| SEV-2 | Generation outage, OAuth outage, payment failure, queue/reconciler stuck, major export failure | Urgent response |
| SEV-3 | Partial degradation, one template/market unavailable, elevated latency | Business-hours response |
| SEV-4 | Cosmetic or low-impact defect with workaround | Planned triage |

Exact response-time commitments and on-call contacts are not yet approved and
must be filled in before production.

## First 15 minutes

1. Assign incident commander, operations lead and communications owner.
2. Record start time, detection source, release SHA and affected environment.
3. Preserve logs and audit events; do not paste secrets into chat or tickets.
4. Bound impact by account, project, capability, provider, region and time.
5. Stop the harm using the smallest safe control: feature flag, provider
   capability disable, payment pause, worker pause or release rollback.
6. Protect credit/payment integrity before trying repeated provider requests.
7. Start an event timeline and state the next update time.

## Scenario controls

### Generation/provider failure

- Disable only the affected approved capability; never route silently to an
  unapproved model family.
- Pause new submissions if quote/charge correctness is uncertain.
- Keep reconciler visibility for accepted provider requests.
- Reconcile every run with its charge, refund and output before re-enabling.

### Credit or payment mismatch

- Stop new paid operations and webhook consumption if replay is suspected.
- Preserve provider event IDs, idempotency keys and ledger rows.
- Do not manually edit balances without an auditable corrective transaction.
- Produce affected-account and financial reconciliation reports.

### Suspected data exposure

- Revoke affected credentials/sessions and preserve access logs.
- Restrict access without destroying evidence.
- Engage legal/privacy owners and follow applicable notification timelines.
- Rotate credentials from a trusted environment and verify old credentials fail.

### Database/storage incident

- Stop destructive writers and snapshot current state where safe.
- Verify backup identity and checksum before restore decisions.
- Restore to an isolated destination first; do not overwrite the source during
  diagnosis.

## Recovery and closure

- Run bounded user journeys and financial/data reconciliation.
- Confirm alerts and dashboards have returned to baseline.
- Communicate resolution, residual risk and any required user action.
- Complete a blameless review with root cause, detection gap, timeline,
  corrective actions, owners and dates.
- Test the prevention/rollback action rather than closing on documentation alone.
