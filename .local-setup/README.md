# MovPrompt local setup

Nothing was committed or pushed. The environment files and this directory are locally ignored by Git.

## Add your key

Edit the root `.env` and fill **AI_GATEWAY_API_KEY**. No Supabase, BytePlus, Azure, or separate Google key is needed for the local provider test.

- `.env`: Gateway key, cheap local model, and portable web selection.
- `.env.infrastructure`: ready local MongoDB replica set, MinIO, Mailpit, and generated Better Auth secret.
- `.env.production-template`: inactive production reference with empty service credentials and Seedance 2.5. It is not automatically loaded.

## Test the key without generating anything

From the repository root:

```sh
node .local-setup/run.mjs auth
node .local-setup/run.mjs readiness
```

These check the account and model catalog. A valid key/account is required. They do not generate content.

## Optional real video test

```sh
node .local-setup/run.mjs test-video --confirm-paid
```

This explicitly requests one paid **Seedance 1.0 Pro Fast**, **2-second**, **480p**, **9:16** text-to-video test, with audio off and no retries or model fallback. It needs only the Gateway key; it uses a generic unbranded cup scene, not your campaign or uploaded assets. No paid test was run during setup.

The MP4 and result record go to `artifacts/gateway-smoke/`. The helper checks dimensions, duration and complete FFmpeg decoding. It does not certify campaign quality. If a download fails, retain the private recovery file and recover the existing result before starting another billable request. That file may contain an expiring signed URL; do not share it.

## Run the application

```sh
colima start
node .local-setup/run.mjs up
bun run dev:web
```

`up` starts a single-node MongoDB replica set, MinIO, Mailpit, API and worker. The separate web command stays running in your terminal. MongoDB replica-set mode is required for local transactions.

- Web: http://localhost:8080
- API: http://localhost:8787
- Captured local email: http://localhost:8025
- MinIO console: http://localhost:9001

```sh
node .local-setup/run.mjs status
node .local-setup/run.mjs down
```

`down` retains the local database and object-storage volumes. After editing the Gateway key, re-run `up` to refresh the API/worker environment. Restart Vite after changing public `VITE_*` settings.

## What is still blocked

The full campaign Generate action remains disabled: the repository still needs qualified-human calibration, accepted-output evidence, matching worker readiness and approved pricing. Adding a key alone cannot finish that production gate. The isolated provider test above is available independently.

The requested production models are Seedance 2.5 and `google/gemini-omni-flash-preview`. Both appeared in the live Gateway catalog on 2026-09-12; Omni was classified as a language model. This repository has no durable Omni video adapter. No invented Omni env switch or alternate generation provider was added. The existing independent quality-review step also needs its own calibrated model selection through Gateway.

The audio did not specify production hosting, database, storage or email providers. Their credentials remain empty in `.env.production-template`; they are not needed for the local stack. Local startup omits `AUTH_REQUIRE_EMAIL_VERIFICATION` because the current auth parser rejects it, despite the older example files including it.

## Verified on 2026-09-12

- Frozen Bun dependency installation, all workspace builds/typechecks, and final web rebuild passed.
- 34 relevant tests passed across auth config, portable auth, legacy import initialization, Seedance configuration and capability policy.
- API health and feature flags return HTTP 200; generation is explicitly disabled.
- MongoDB is the only application database in the local stack; replica-set primary and transaction checks pass.
- A synthetic local account completed signup and session recovery; its verification email arrived in Mailpit.
- All three private buckets are reachable. A synthetic object passed authenticated write/read and anonymous-access denial, then was deleted.
- The worker completed its health job and has a fresh ready database heartbeat.
- Home, creator and sign-in routes rendered in a real browser. The creator rendered in English and Arabic; 375px Arabic RTL had no horizontal overflow. This is a startup check, not full WCAG or production acceptance.
- The isolated video helper passed a fully offline provider mock with an actual two-second MP4 decode. No real generation or paid account validation was run; the Gateway key is still required.

Git LFS was installed, and the existing Colima VM was configured to share this exact project path read-only with containers. Its default home mount was retained. The local MongoDB volume contains the application collections and indexes and is retained by `down`. No pre-existing user database was removed.

The source fix defers the legacy Supabase client until actual legacy use, preventing portable routes from crashing during import when Supabase credentials are absent. Docker build context now excludes graph, local helper, planning and design artifacts.

## Local graph

Open `graphify-out/graph.html` or read `graphify-out/GRAPH_REPORT.md`. Use `graphify query "How does generation readiness depend on quality calibration and worker heartbeat?"` from the repository root. The graph is a navigation aid; its integrity and coverage caveats are recorded in the report.
