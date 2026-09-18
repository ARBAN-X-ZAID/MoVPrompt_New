# R2 and guest-generation implementation — 2026-09-15

Update 2026-09-15: the user replaced the original three-bucket design with one private bucket named `movprompt`. The one-bucket change, live storage check, and publication of five existing demo videos/posters passed; see `../simple-template-flow/PLAN.md` and `docs/R2_SETUP.md`. Earlier three-bucket/public-domain requirements below are superseded. A separate previously authorized funded Gateway test also passed; no new paid generation was performed in this one-bucket update.

## Delivery status

Local code implementation is ready for credential activation. End-to-end acceptance is NOT yet passed: all seven R2 fields are intentionally blank and the read-only Gateway key check returned a valid key with $0 balance. No Git push, commit, deployment, purchase, or deletion of previous storage data was performed. GSD command bypass was explicitly approved by the user; this directory records the work directly.

## Implemented

- R2-only runtime configuration, derived account endpoint/auto region, distinct private assets/outputs and public template-preview buckets. Removed alternate storage configuration and Compose storage services; retained AWS SDK only as R2 protocol transport. Existing local media and volumes remain untouched.
- `.env` and `.env.example` contain exactly one blank entry for each required R2 setting. Existing MongoDB, Better Auth and Gateway credentials are preserved. Added public proxy/budget fields; local guest quota restrictions are bypassed.
- MongoDB-native guest sessions, opaque hashed-cookie lookup, HMAC IP identifiers, owner-scoped upload/project/render access, origin checks and clean-download denial at middleware and route boundaries.
- Atomic guest quota/spend reservation in the existing MongoDB enqueue transaction; duplicate retries reuse the run, active jobs and successful jobs within the rolling window consume quota. Failed runs release the guest allowance while retaining conservative provider cost reservations. Public generation fails closed without finite positive operator-audited budget ceilings.
- Separate private clean master and FFmpeg-encoded watermarked preview. Guest preview routes never return the master; authenticated downloads refresh signed access. Browser access renewal and requests have bounded handling.
- Idempotent account claiming, including concurrent callbacks; original object namespaces are retained as storage provenance. My Projects reloads claimed projects. Expired guest cookies do not block the signed-in account's own library.
- Seven-day unclaimed expiry, ownership locking before cleanup, active-job exclusion, retryable media deletion and private-prefix orphan cleanup. Claimed projects expire only after user trash plus the seven-day recovery window.
- Worker registers Vercel Gateway only. Removed inactive Azure speech implementation/configuration and changed prompt instructions to native Gateway audio. Existing Seedance model preserved. New prompt engine version recorded for newly created projects; prior brief versions remain readable.
- Five R2 template mappings, no runtime bundled-preview fallback, public upload/verification command, three existing video snippets and two clearly illustrative motion guides. Existing theme preserved; guest generation now precedes sign-in, which appears at clean download.
- Updated platform, environment, backup, creative-engine, setup and project instruction documentation.

## Evidence

- `bun run test:all`: 507 passing standard tests. Eight Mongo integration cases are opt-in in this command and were executed separately; two pre-existing worker integration cases remain skipped.
- `MOVPROMPT_TEST_MONGO=true bun --env-file=../../.env run --cwd apps/api test --run src/guest-access.integration.test.ts`: 4 passed against an isolated disposable local MongoDB database. Covers opaque sessions/origin checks, clean denial, preview isolation, expired sessions and concurrent idempotent claim/provenance.
- `MOVPROMPT_TEST_MONGO=true bun --env-file=../../.env run --cwd packages/db test --run test/guest-quota.integration.test.ts`: 4 passed. Covers simultaneous same-IP requests, terminal failure allowance release, absent budget and duplicate submission.
- Workspace typechecks and builds passed. Lint: zero errors, 20 existing Fast Refresh warnings. Existing build warning: chunks over 500 kB. Web bundle boundary check passed.
- Actual FFmpeg output inspected: H.264, 480x854, 12 seconds with visible center watermark. PNG overlay works on this device, whose FFmpeg lacks drawtext/subtitles filters.
- Existing Luxury, WhatsApp and Food demo snippets are decodable H.264 480x864, approximately two seconds each. App/Service and Salon guides are H.264 480x854, 12 seconds. These guides are not paid provider output and need content approval before publication.
- Browser: five-template catalog, guest image selection, fact review, campaign setup/review and sign-in/signup layouts inspected. English/Arabic and light/dark creator layout checked at 375, 768, 1024 and 1440 widths without horizontal overflow. Missing setup now presents an unavailable message and retry action instead of telling users to keep waiting. Signup was not submitted through the browser; no terms were accepted on the user's behalf.
- `bun run storage:check` failed as expected with `R2_ACCOUNT_ID is required`, without contacting R2 or generating a video.

## Pending external acceptance

1. Create/scopingly configure the three R2 buckets and credentials, their CORS and preview domain; fill the seven blank fields. Run `bun run storage:check` to prove both private bucket round trips, checksum/private endpoint access and deletion.
2. Review/approve all demo sources (replace illustrative guides if real-model demos are required), then run `bun run storage:publish-templates`. Nothing has been uploaded to Cloudflare yet.
3. Fund the existing Gateway account and explicitly authorize bounded paid video tests. No new model or provider key was substituted.
4. Prove the full browser → API → MongoDB → worker → Gateway → R2 → authenticated download journey, including real signup/SMTP, refresh/subsequent login, saved/downloaded media inspection, live signed URL expiry/renewal, worker restart while a real job is pending, and remote cleanup failure/retry. Production quality/calibration gates remain required; local development intentionally bypasses commercial charging and AI quality approval.
5. Verify Render deployment settings, same-site web/API domains, trusted proxy behavior and SMTP delivery in the actual hosted environment. No hosted deployment was attempted.

See `docs/R2_SETUP.md` for activation instructions and retention/budget caveats. Do not interpret mocked storage tests, a valid Gateway key, or the illustrative guides as evidence of successful paid generation.

The owned local test stack was stopped after verification; ports 8080 and 8787 were confirmed free so the user can start it with `bun run dev`. MongoDB itself was left running. Final targeted template tests (7) and real MongoDB claim tests (4) passed after the last UI/cookie refinements.
