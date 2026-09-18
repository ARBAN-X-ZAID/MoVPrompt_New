# Generation activation runbook

This runbook activates new Seedance 2.5 submissions without weakening the
fail-closed controls. Existing render status and cancellation endpoints remain
available when the kill switch blocks new quotes.

## Before staging activation

1. Rotate any AI Gateway key that appeared in chat, logs, screenshots or shell
   history. Put the replacement only in the staging secret manager.
2. Confirm Gateway auto-reload is disabled and record the approved canary
   budget and owner.
3. Apply database migrations through `0014_render_processing_stage.sql`.
4. Configure API and worker from the same reviewed environment contract.
5. Run `scripts/infra/verify-environment.sh staging` without printing values.
6. Keep `GENERATION_STARTER_ONLY=true` until five accepted samples exist for
   each enabled resolution tier.

## Required staging configuration

- `FEATURE_GENERATION=true`
- `MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY=true`
- both video capability aliases enabled with adapter `vercel-ai-gateway`
- both video capability model IDs exactly `bytedance/seedance-2.5`
- versioned 480p and 720p rates for both capabilities
- `GENERATION_QUOTE_TTL_SECONDS=900`
- `WORKER_HEARTBEAT_INTERVAL_SECONDS=15`
- `WORKER_HEARTBEAT_MAX_AGE_SECONDS=45`
- private assets and outputs buckets
- working FFmpeg, FFprobe and Gateway quality reviewer
- a reviewed exact provider-output hostname; no broad wildcard

API and worker compute a secret-free configuration fingerprint. A fresh
worker heartbeat must contain the same fingerprint and `generationReady=true`.
The API reports only the safe availability reason, never model IDs, secrets,
signed URLs or internal diagnostics.

## Local readiness proof (no paid generation)

Run the full local stack with secrets supplied through the ignored local
environment file or the shell environment. Do not paste secret values into the
command line, logs, or screenshots.

```bash
bun install --frozen-lockfile
bun run db:migrate
bun run db:check
bun run dev:stack
```

Then verify the public, non-secret health surfaces:

```bash
curl --fail http://127.0.0.1:8787/healthz
curl --fail http://127.0.0.1:8787/api/v1/health
curl --fail http://127.0.0.1:8787/api/v1/feature-flags
```

Expected healthy state:

- PostgreSQL and the generation runtime report healthy.
- A ready worker heartbeat is newer than 45 seconds.
- `generationAvailability.status` is `ready`.
- Enabled video capability aliases report `available=true`.
- A guest quote succeeds without creating a render or charging credits.

If any dependency is removed, the API must return its specific safe
availability reason. Do not make the browser invent a price or enable Generate
without a valid, unexpired server quote.

## Canary sequence

Each paid canary requires a separately recorded budget approval.

1. Confirm `/api/v1/feature-flags` reports `status=ready` and both public video
   capabilities available.
2. Create a quote and retain its configuration hash, pricing version and expiry.
3. Submit once with a stable idempotency key.
4. Close the browser and verify the worker continues the operation.
5. If the output hostname differs from the reviewed allowlist, stop. Record and
   review only the hostname, update the allowlist, then reconcile the same
   provider operation. Do not submit another billable generation.
6. Verify the provider operation is persisted before polling.
7. Verify the candidate is copied into private MovPrompt storage, normalized,
   fully decoded and approved by both technical and visual quality checks.
8. Verify 4:5 delivery is an actual 4:5 H.264 file produced from the provider
   3:4 canvas.
9. Verify provider micro-USD cost, latency and sanitized usage metadata exist on
   the render attempt.
10. Verify the accepted version advances only after quality approval.

## Stop and recovery

Set `FEATURE_GENERATION=false` to stop new quotes and submissions. Do not stop
the worker while it owns accepted provider operations unless incident response
requires it; already accepted work must reconcile to a terminal state.

Stop rollout immediately for an unknown output host, stale heartbeat, storage
failure, invalid media, missing quality review, duplicate provider request,
duplicate charge/refund or loss of an accepted output. Saved projects and
existing run status remain available while new generation is paused.

## Production rollout

Deploy with generation disabled, apply migrations, start the worker, confirm a
fresh heartbeat, and enable only an internal production account. Complete one
real render before 5%, 25% and 100% rollout stages. Each stage requires healthy
quote success, technical success, latency, refund and provider-spend metrics.

Public activation additionally requires the 72-hour staging soak, cost samples,
alerts, backup/restore proof and rollback drill listed in the deployment
runbook. Local readiness is not production evidence.
