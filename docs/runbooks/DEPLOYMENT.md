# Deployment runbook

## Current deployment target

The repository includes a safe-first-release Render Blueprint for a static web
site and Docker API backed by MongoDB Atlas and Cloudflare R2. See
[`RENDER.md`](./RENDER.md). The Blueprint is deployment configuration, not
proof of a live deployment. Video generation remains disabled until the worker
and production activation evidence are complete.

## Required release inputs

- reviewed commit SHA from the protected release branch;
- green CI, dependency audit and secret scan;
- immutable web, API and worker artifacts with checksums;
- migration plan reviewed by application and database owners;
- database and object-storage backup evidence;
- tested rollback/forward-fix path;
- change owner, incident lead and observation window;
- provider capability, quota and cost controls confirmed;
- feature flags defaulted safely;
- release notes and user-impact statement.

## Staging sequence

1. Validate environment separation with `verify-environment.sh staging` and,
   when generation is enabled, follow `GENERATION_ACTIVATION.md`.
2. Restore the latest approved production-shaped sanitized fixture.
3. Run structural migration checks and verify Auth/assets feature dependencies.
4. Execute migrations through a one-shot migration task using
   `MONGODB_URI`, run `bun run db:migrate` to create indexes, and retain
   complete logs.
5. Deploy the API artifact by digest and verify Better Auth, SMTP and private
   object-storage configuration before starting the worker.
6. Deploy one durable worker artifact by digest; verify MongoDB worker jobs, outbox
   lease/retry behavior and reconciliation scheduling before scaling it.
7. Deploy the web artifact and verify `/healthz`, `/api/v1/health`, server
   feature flags, safe generation availability and dependency connectivity.
8. Run email/password and Google/Apple OAuth draft recovery plus two-user
   authorization tests.
9. Run generation success, failure, missing-output, duplicate, cancel and
   refund tests against approved provider capabilities.
10. Verify private upload/download expiry, MIME/checksum validation, cross-user
    denial and browser reachability of signed URLs.
11. Stop/restart the worker during queued and processing operations; prove
    outbox lease recovery and no duplicate charge or provider submission.
12. Run payment test-mode purchase, webhook replay and cancellation recovery.
13. Run English/Arabic, both themes and four-viewport acceptance checks.
14. Confirm logs, metrics, traces and alerts identify the release SHA.

Staging evidence is attached to the release record. A local screenshot or build
alone does not satisfy these checks.

## Production sequence

1. Obtain the required production-environment approval.
2. Confirm backup completion and restore-test recency.
3. Record current application, API, worker and schema versions.
4. Revalidate production environment variables without printing values.
5. Apply backward-compatible expand migrations first.
6. Deploy API/worker canary with generation disabled or tightly capped.
7. Verify health, error rate, latency, queue depth, DB saturation and cost.
8. Deploy the web artifact and enable flags gradually.
9. Run bounded smoke tests using a designated test account and project.
10. Observe for the agreed window before continuing contract migrations or
    retiring old paths.
11. Record final artifact digests, migration versions and dashboard links.

## Stop conditions

Pause or roll back when any of these occur:

- authentication, authorization or account-isolation regression;
- incorrect charge, refund or starter-entitlement behavior;
- generation failure/error rate beyond the approved threshold;
- orphaned or duplicate jobs;
- database/storage integrity or signed-URL failure;
- payment webhook replay or reconciliation mismatch;
- material accessibility/localization regression;
- missing telemetry, rollback evidence or incident owner.

Threshold numbers and dashboard links must be filled in before the first
production deployment.

## Post-deployment

- Reconcile renders, credit ledger, payments and object outputs.
- Confirm no migration, job or webhook is stuck.
- Review errors and provider costs by release SHA.
- Notify stakeholders of success or rollback.
- Keep the old artifacts and compatible schema for the rollback window.
- Open tracked follow-ups for every accepted deviation.
