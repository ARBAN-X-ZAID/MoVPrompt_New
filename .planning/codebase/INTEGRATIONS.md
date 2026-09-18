# External Integrations

**Analysis Date:** 2026-08-16

## APIs & External Services

**AI video generation:**
- Vercel AI Gateway / ByteDance Seedance 2.5 - Primary portable video adapter in `packages/providers/src/vercel-gateway-seedance.ts`.
  - SDK/Client: native `fetch` for durable async operations plus AI SDK smoke tooling.
  - Auth: `AI_GATEWAY_API_KEY` is resolved server-side only.
- BytePlus ModelArk Seedance - Alternate explicit adapter in `packages/providers/src/byteplus-seedance.ts`.
  - Availability is fail-closed through `MOVPROMPT_PROVIDER_BYTEPLUS_READY`.
- Semantic capability aliases - Public clients use aliases such as `video.cinematic` and `video.product_fidelity`; provider IDs remain in `packages/providers/src/capability-registry.ts`.

**AI quality review:**
- Google Gemini through Vercel AI Gateway - Multimodal technical/visual review in `apps/worker/src/media-quality-analyzers.ts`.
  - Model is server configuration via `MOVPROMPT_QUALITY_MODEL_ID`.

**Legacy AI services:**
- Supabase Edge Functions - Legacy prompt, story, video, moderation, transcription, email, and admin operations remain under `supabase/functions/`.
- FAL and older model-routing concepts are confined to legacy Supabase/web paths and are not part of the portable capability contract.

**Source import:**
- Public product/business pages - Hardened scanner in `apps/api/src/source-scanner.ts`.
- Authenticated remote images - SSRF-protected mirror path in `apps/api/src/remote-image-fetcher.ts` and `apps/api/src/asset-routes.ts`.

## Data Storage

**Databases:**
- MongoDB 17 is the canonical authenticated source of truth.
  - Connection: pooled and direct URLs are consumed by `packages/db/src/client.ts` and migration tooling.
  - Client: the native MongoDB Node.js driver.
  - Core tables are declared in `packages/db/src/schema.ts`.
- Supabase remains a frozen legacy source. The active API and worker do not connect to it.

**File Storage:**
- Private S3-compatible storage through `packages/storage/src/service.ts`.
- MinIO is the local implementation; Cloudflare R2/S3-compatible storage is supported by the same object-key contract.
- Stable object keys are stored in MongoDB; short-lived signed URLs are generated only at access time.

**Caching:**
- No shared Redis/cache service is detected.
- Guest drafts and blobs use seven-day browser IndexedDB in `apps/web/src/features/create/guestDraftStore.ts`.
- React Query provides client-side request caching from `apps/web/src/App.tsx`.

## Authentication & Identity

**Auth Provider:**
- Better Auth backed by MongoDB in `packages/auth/src/auth.ts`.
  - Email/password is enabled.
  - Google and Apple providers are optional and appear only when configured.
  - Sessions use secure HTTP-only cookies.
  - Provisioning creates credit/starter-entitlement records through `packages/auth/src/provisioning.ts`.
- Supabase Auth remains available to legacy UI branches through `apps/web/src/integrations/supabase/client.ts`.

## Monitoring & Observability

**Error Tracking:**
- No Sentry or other production error-tracking SDK is detected in active package manifests.

**Logs:**
- API correlation/request context is implemented in `apps/api/src/request-context.ts`.
- Worker structured logging is implemented in `apps/worker/src/logger.ts`.
- Audit events are modeled in `packages/db/src/schema.ts`, but full operational dashboards are not present.

## CI/CD & Deployment

**Hosting:**
- Portable Docker images exist for API and worker.
- The web builds to static Vite assets; repository documentation describes hosted targets, but live deployment is not inferable from source.

**CI Pipeline:**
- GitHub Actions in `.github/workflows/ci.yml`, `.github/workflows/security.yml`, and `.github/workflows/release-candidate.yml`.
- CI runs locked install, lint, typecheck, tests, builds, bundle budget, migrations, Compose validation, RLS checks, security scans, and release-candidate packaging.

## Environment Configuration

**Required env groups:**
- MongoDB pooled/direct connectivity.
- Better Auth URL, secret, trusted origins, and optional OAuth credentials.
- S3 endpoint, region, credentials, and private bucket names.
- SMTP delivery configuration.
- Gateway API key, exact capability adapter/model configuration, pricing version/rates, output-host allowlist, FFmpeg/FFprobe, and quality model.
- API/worker runtime fingerprints and heartbeat thresholds.

**Secrets location:**
- Secret values belong in ignored local environment files and deployment secret managers. This map intentionally does not inspect them.

## Webhooks & Callbacks

**Incoming:**
- Better Auth routes are mounted under `/api/auth/*` from `apps/api/src/app.ts`.
- Browser auth recovery uses `/auth/callback` in `apps/web/src/pages/AuthCallback.tsx`.
- BytePlus supports an optional callback URL in `packages/providers/src/byteplus-seedance.ts`.
- Payment webhook tables exist in `packages/db/src/schema.ts`, but no portable payment webhook route is implemented in `apps/api/src/`.

**Outgoing:**
- Vercel AI Gateway async start/status requests originate from `packages/providers/src/vercel-gateway-seedance.ts`.
- Provider outputs are downloaded, validated, normalized, and copied to private storage by `apps/worker/src/output-persister.ts`.
- SMTP mail is sent through `apps/api/src/email.ts`.

---

*Integration audit: 2026-08-16*
