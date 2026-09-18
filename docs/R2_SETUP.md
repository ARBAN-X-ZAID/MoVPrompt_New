# Cloudflare R2 setup

MovPrompt uses Cloudflare R2 only for persistent media, MongoDB for records and jobs, Render for hosting, Vercel AI Gateway for generation, and SMTP for email. The AWS SDK is an R2 protocol client, not an AWS storage provider.

## Create Cloudflare resources

1. Use one R2 bucket: `movprompt`.
2. Keep all public access disabled, including the r2.dev URL and custom public domains. Images, outputs, and demos are separated by object keys, not public bucket access.
3. Create an R2 API token with Object Read & Write permissions scoped to this bucket. Copy its access key ID and secret; the account ID is in your Cloudflare account dashboard.
4. Fill these existing blank root `.env` settings:

```dotenv
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ASSETS_BUCKET=movprompt
R2_OUTPUTS_BUCKET=movprompt
R2_TEMPLATE_PREVIEWS_BUCKET=movprompt
R2_TEMPLATE_PREVIEWS_BASE_URL=
```

The three settings describe roles in the same private bucket. Leave R2_TEMPLATE_PREVIEWS_BASE_URL empty. The endpoint is derived from the account ID. Do not put any credentials in a VITE variable.

User images use `users/<owner>/projects/<project>/assets/...`; output videos use `users/<owner>/projects/<project>/versions/<version>/outputs/...`; approved demo videos/posters use `templates/v1/<template>.mp4` and `.jpg`. MongoDB ownership governs customer access. The public API route `/api/v1/template-previews/v1/<template>.mp4` (or `.jpg`) signs only the five allowlisted demo names, never arbitrary object keys. Redirects are not cached, so later playback requests obtain fresh signed URLs.

Configure bucket CORS with your precise website origins (http://localhost:8080 locally and the public HTTPS origin), GET/HEAD/PUT, Content-Type and x-amz-* request headers, and expose ETag and Content-Length. Customer media is private; signed URLs expire in 15 minutes. Their signatures are never saved in MongoDB.

Clean campaign exports use the authenticated API route `/api/v1/projects/<projectId>/render-runs/<runId>/output/file`. The API rechecks account ownership and streams the private R2 object with attachment headers and `private, no-store` caching. The website fetches that API response with account credentials and downloads a local blob, so exports do not depend on bucket CORS or direct browser navigation to the R2 domain. Keep bucket CORS for direct signed upload/read flows. No customer bucket needs public access for downloads.

## Verify and publish

```sh
bun run storage:check
bun run storage:publish-templates
bun run dev
```

The check creates a temporary object, verifies upload/download hashes and metadata, then deletes it. It never creates buckets. Publishing writes only versioned template demo objects, never customer media, and verifies them through private signed reads. Review the template manifest and media before publishing. Missing approved demo files cause an explicit error.

Restart local processes after changing settings. Configure R2 settings on the Render API/worker only. The web uses VITE_API_ORIGIN (or its own origin when unset) for demo requests, matching the portable API/auth setup; rebuild after changing that origin. No public R2 domain is needed.

## Guest generation

Guest sessions last seven days. Their private clean master is never exposed to anonymous clients; a separately encoded watermarked preview is served. Sign in at Download to claim the existing projects. Cookies are HttpOnly, SameSite=Lax, Secure in production; serve the web/API on same-site custom domains (e.g. app.example.com and api.example.com).

Production also requires GUEST_TRUST_PROXY=true behind the trusted Render reverse proxy, GUEST_DAILY_BUDGET_USD and GUEST_MAX_RENDER_COST_USD. The latter must be an audited worst-case USD ceiling covering the selected model, duration, resolution, quality evaluation and all configured retries. Requests fail closed without positive values. Each submission reserves this worst-case cost for 24 hours even if the provider fails; terminal failures release the per-guest allowance but do not erase potential provider spend. Set a matching hard budget on the Gateway key as the independent provider-side cap. Never trust forwarded IP headers on a directly exposed API.

Local APP_ENV=local bypasses guest quotas, not provider billing. Add credits to the Gateway account before generating. Configure authenticated SMTP for production password resets/verification. There is no separate Azure Speech runtime.

Guest claiming waits for active renders to finish. Expired guests cannot start jobs or retrieve previews. Cleanup skips in-flight jobs, then retries private media deletion safely. Claimed objects retain their original storage namespace, with database ownership and provenance checked before access.

## Existing data

No existing local storage volumes or files are removed by this change. Old objects are not silently copied into R2. Existing project rows pointing to former storage require an explicit migration before those historical files can be retrieved. New projects use R2 exclusively.

## Verification limits

Local unit tests use mocked R2 responses; only `storage:check` with real credentials proves Cloudflare access. A funded, authorized generation is required to verify the entire provider/worker/storage/download journey. Never interpret a valid Gateway key as evidence of available credits or an accepted video.

App/Service and Salon currently use explicitly labeled illustrative motion-design guides, built reproducibly with `bun scripts/infra/create-template-demo-guides.ts`. They are not examples of a paid model result. Replace them with inspected provider-generated demos after funded generation is authorized.

Luxury uses the existing funded two-second perfume testing video in `artifacts/gateway-smoke/` and its extracted poster. Keep that local source file available when running publication; it is intentionally ignored by Git. No additional paid generation is performed by publication.

Trashed account projects keep the existing recovery window for seven days. After that the worker marks deletion atomically, rejects restoration, and removes all media in both the current and original guest namespaces.
