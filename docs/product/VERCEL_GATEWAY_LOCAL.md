# Vercel AI Gateway local testing

MovPrompt stores the development Gateway key only in the ignored root
`.env.local`. Never add it to a browser `VITE_*` variable, commit it, or place
it in screenshots and logs.

## Low-cost local project testing

The tracked [local application profile](../../infra/environments/local.example)
selects `bytedance/seedance-v1.0-pro-fast` for both server-only video
capabilities only when `APP_ENV=local`. It keeps the first test at 480p, two
seconds and provider-native audio off. Both 480p and 720p local quotes use the
tracked 3-credit-per-second test rate; those values are not production pricing.

Layer that tracked profile with your ignored `.env.local` (which contains the
Gateway key) when starting the full local application. For Docker Compose:

```bash
docker compose --env-file infra/environments/local.example --env-file .env.local --profile application up
```

Do not set `MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO=YES`: that switch is only for
the separate guarded CLI smoke command, not normal project generation. A real
**Generate** click in the application still creates a paid Gateway request and
can also incur quality-review cost. The browser remains provider-agnostic and
does not show model or provider names.

There is no silent fallback. A missing, unknown or failed fast-model selection
fails closed; it never retries through Seedance 2.5 or another family. Human
calibration, private storage, technical validation, exact settlement and
quality approval remain required before an accepted output completes. Staging
and production stay hard-locked to `bytedance/seedance-2.5`.

## Commands

Verify the key with a read-only credit-account request:

```bash
bun run --cwd apps/worker gateway:auth
```

This reads the authenticated Gateway credit balance without generating content or consuming credits.

## Check exact launch-model readiness

```bash
bun run --cwd apps/worker gateway:readiness
```

This verifies the current catalog entries for Seedance 2.5 and Gemini Omni Flash Preview. It does not run either paid model. Seedance uses the Gateway video-model contract; Omni is currently exposed as a multimodal language model with video output and requires its own adapter path.

Inspect the current live video-model catalog:

```bash
bun run --cwd apps/worker gateway:models
```

Generate one guarded, paid, four-second Seedance smoke video:

```bash
MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO=YES \
  bun run --cwd apps/worker gateway:video
```

For a development-only plumbing check, the guarded CLI also permits the exact
`bytedance/seedance-v1.0-pro-fast` model. This does not change either production
capability alias and must never be used as a silent customer fallback. A
two-second 480p test is explicitly selected with server-side environment
variables:

```bash
MOVPROMPT_GATEWAY_VIDEO_MODEL_ID=bytedance/seedance-v1.0-pro-fast \
MOVPROMPT_GATEWAY_VIDEO_DURATION_SECONDS=2 \
MOVPROMPT_GATEWAY_VIDEO_RESOLUTION_TIER=480p \
MOVPROMPT_GATEWAY_VIDEO_RESOLUTION=480x864 \
MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO=YES \
  bun run --cwd apps/worker gateway:video
```

The CLI keeps the expected 9:16 output canvas as `480x864` for artifact
validation, but sends the legacy Seedance endpoint its required `480p` catalog
tier. This differs from the Seedance 2.5 first-frame wire contract and is kept
inside the development-only smoke path.

On success, the MP4 is written under the ignored
`artifacts/gateway-smoke/` directory. The CLI writes a submitting record before
the billable call and a permission-`0600` recovery record containing the signed
provider URL before download begins. If the download fails, use that exact URL
to recover the already-billed output instead of submitting again. After a
successful durable MP4 write, the CLI scrubs the signed URL from the recovery
record.
The code default is the live `bytedance/seedance-2.5` model, 4 seconds, 9:16
and 720p-class output. Override prompt, duration, ratio or resolution only
through the server-side `MOVPROMPT_GATEWAY_*` environment variables.

## Durable worker activation

The production queue adapter uses the Gateway v4 asynchronous operation
contract. It submits once with the render idempotency key, persists the opaque
Gateway operation, polls from PostgreSQL-backed jobs, copies the result into
MovPrompt private storage, normalizes it, runs technical and independent visual
quality review, and only then completes the render.

Both video capability aliases are locked to these exact server-only values:

```dotenv
MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_ADAPTER_ID=vercel-ai-gateway
MOVPROMPT_CAPABILITY_VIDEO_CINEMATIC_MODEL_ID=bytedance/seedance-2.5
MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_ADAPTER_ID=vercel-ai-gateway
MOVPROMPT_CAPABILITY_VIDEO_PRODUCT_FIDELITY_MODEL_ID=bytedance/seedance-2.5
```

Leave both capability `*_ENABLED` flags and
`MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY` false until every prerequisite below
is present and verified:

- `AI_GATEWAY_API_KEY` is a server-only key with a capped budget.
- the seven `R2_*` fields documented in `docs/R2_SETUP.md`
  point to private storage.
- `PROVIDER_OUTPUT_ALLOWED_HOSTS` contains the exact observed provider-output
  host or an explicitly reviewed leading-dot DNS suffix. Do not copy or guess
  a hostname from unrelated provider documentation. Downloads are HTTPS-only;
  every hop is re-allowlisted, resolved only to public IP addresses and pinned
  to the checked address, with bounded bytes, MIME and MP4 magic validation.
- `FFMPEG_PATH` and `FFPROBE_PATH` execute successfully in the worker image.
- `MOVPROMPT_QUALITY_MODEL_ID` is an explicit `google/gemini-*` language-model
  slug available through AI Gateway. The reviewer reuses the server-only
  `AI_GATEWAY_API_KEY`; no separate Google key or fallback model is accepted.
- Quality-review input is fail-closed and bounded to one MP4 up to 18 MiB plus
  the first five JPEG/PNG/WebP references sharing an 8 MiB budget. Oversized,
  unsupported or schema-invalid inputs never approve an output.
- Resolution-specific 480p/720p credit rates and a pricing version/TTL are
  approved. A missing requested tier fails closed.

The user-selected 480p/720p tier, duration, ratio and audio toggle are bound
into the immutable quote configuration and passed to the provider operation.
Seedance has no native 4:5 canvas, so MovPrompt generates 3:4 and performs the
final center crop inside the worker's deterministic delivery normalization
before the render can be marked complete.

When generation is enabled, the API also requires a fresh ready worker
heartbeat, private-bucket probes, exact resolution pricing and an identical
secret-free API/worker runtime fingerprint. A stopped or differently configured
worker therefore pauses new quotes without hiding saved projects or existing
render status.

Product-fidelity generation never exposes R2 or private object URLs to AI
Gateway. The worker verifies the exact owner/project asset row and canonical
object key, compares database MIME/size/SHA-256 with R2 metadata, magic bytes
and the downloaded body, contain-pads the image to the requested canvas, and
sends a bounded inline JPEG first frame without a separate ratio field. The
live Seedance contract inherits the prepared canvas and rejects a duplicate
ratio field on first-frame requests.

The current Gateway async contract exposes start and status, but no documented
request-cancel endpoint. MovPrompt therefore never fabricates a successful
cancellation: a cancelling run remains pending until Gateway reports a
terminal state. This must be disclosed in the UI or cancellation kept disabled
for this adapter until Gateway publishes a confirmed cancellation contract.

## Safety boundary

The guarded command is a local provider smoke test, not the authoritative
production render path. It does not bypass the durable activation gate above,
exactly-once charging/refunds or the complete benchmark.

Vercel requires a valid payment card on the team before it services AI Gateway
requests, including free-credit models. The CLI reports
`vercel_customer_verification_required` without attempting a paid video when
that account prerequisite is missing.
