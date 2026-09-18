# Environment separation

## Environment contract

| Property | Local | Staging | Production |
|---|---|---|---|
| Purpose | Developer iteration | Production-shaped verification | Customer traffic |
| Data | Synthetic only | Synthetic or approved sanitized fixtures | Real customer data |
| Database | Local MongoDB replica-set volume | Dedicated replica set/database | Dedicated HA replica set/database |
| Storage | Separate R2 development buckets | Dedicated private buckets | Dedicated private buckets |
| Email | Mailpit only | Restricted test recipients/domain | Verified sender/domain |
| OAuth | Local callback clients | Dedicated staging clients | Dedicated production clients |
| AI providers | Mocks or bounded test keys | Separate capped keys | Production keys and limits |
| Payments | Never | Provider test mode | Provider live mode |
| Telemetry | Local console | Separate staging project | Production project and alerts |
| Secrets | Local untracked file/shell | Staging secret store | Production secret store |

Never point local or staging at production databases, buckets, OAuth clients,
payment accounts, webhook secrets or provider keys.

## Required server variables

The non-secret shape is documented in:

- `infra/environments/staging.example`
- `infra/environments/production.example`

Values must be injected by the deployment platform's secret manager. Do not
copy populated environment files into images or commit them.

The implemented API and worker currently require:

- `APP_ENV`
- `PUBLIC_APP_URL`, `WEB_ORIGIN`, `API_ORIGIN` and
  `CORS_ALLOWED_ORIGINS`
- `FEATURE_AUTHENTICATION` and `FEATURE_ASSETS`; assets cannot be enabled while
  authentication is disabled
- `MONGODB_URI` for API and durable workers; it must target a replica set
- `MONGODB_DATABASE` for the application database name
- TLS must be enabled by the managed MongoDB connection string outside local development
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_ASSETS_BUCKET`, `R2_OUTPUTS_BUCKET`, `R2_TEMPLATE_PREVIEWS_BUCKET`,
  `R2_TEMPLATE_PREVIEWS_BASE_URL`; the endpoint and auto region are derived internally
- Optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_FROM` and provider
  credentials. Without `SMTP_HOST`, sign-up and sign-in remain available but
  verification and password-reset email delivery are unavailable.
- `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_TRUSTED_ORIGINS` and
  Google/Apple client credentials
- `WORKER_ID`, outbox batch/lease/poll controls and render reconciliation delay
- approved AI provider keys
- payment API and webhook secrets
- telemetry endpoint/authentication

Client-side variables must be explicitly allowlisted. A `VITE_` prefix makes a
value public; it must never contain a server, provider, storage root, payment or
database secret.

`VITE_FEATURE_PORTABLE_AUTH=true` selects the Better Auth client in the web
bundle and therefore requires a reachable portable API at `VITE_API_ORIGIN`.
It is `true` in the local full-application example and should be `false` for a
web-only local session. Staging and production may enable it only after their
API, CORS, cookies and callback origins have passed the deployment smoke tests.

`BETTER_AUTH_URL` is the public API origin that serves `/api/auth/*`, not the
web-app origin. It must match `API_ORIGIN`. Better Auth callback URLs derive
from it, for example
`${BETTER_AUTH_URL}/api/auth/callback/google` and
`${BETTER_AUTH_URL}/api/auth/callback/apple`. Register exact staging and
production callbacks in separate OAuth applications.

The server owns the deferred first-campaign verification policy.
`VITE_AUTH_REQUIRE_EMAIL_VERIFICATION=false` mirrors that policy in every web
bundle. The obsolete `AUTH_REQUIRE_EMAIL_VERIFICATION` variable must remain
absent because the API rejects it instead of allowing the browser and server to
drift. A future policy change must update the server contract and rebuild the
web bundle together.

All public UI feature flags are explicit in the staging and production build
contracts. `VITE_FEATURE_ADVANCED_MODE` must match `FEATURE_ADVANCED_MODE`, and
`VITE_FEATURE_EXPORT_PIPELINE` must match `FEATURE_EXPORTS`, so the browser does
not advertise a server-disabled workflow. `VITE_FEATURE_LOCAL_DEMO_GENERATION`
must always be `false` outside local development; it is a non-provider client
simulation and is never a production fallback.

Generation uses the server-only `vercel-ai-gateway` adapter and the existing
configured Seedance model; do not change its model ID without compatibility testing. Capability availability stays
false unless the Gateway key, private R2 storage, provider-output
host allowlist, FFmpeg/FFprobe and explicit `MOVPROMPT_QUALITY_MODEL_ID`
Gateway reviewer are all configured
and `MOVPROMPT_PROVIDER_VERCEL_GATEWAY_READY=true` is deliberately set last.
Both video aliases can use this same adapter; no model ID crosses the public
API. Gemini Omni Flash is not registered in the render worker until a durable,
official async operation contract has been implemented and tested.

Video pricing is resolution-bound. Prefer the four
`GENERATION_VIDEO_*_{480P,720P}_CREDITS_PER_SECOND` variables. The legacy
single-rate variables are accepted only when
`GENERATION_VIDEO_FIXED_RESOLUTION` is explicitly `480p` or `720p`; requesting
the other tier fails closed. Change the pricing version whenever a tier rate
changes so stale quotes cannot be submitted silently.

New generation also requires a fresh worker heartbeat. The worker publishes
every `WORKER_HEARTBEAT_INTERVAL_SECONDS`; the API rejects new quotes when no
ready heartbeat exists within `WORKER_HEARTBEAT_MAX_AGE_SECONDS` or when the
worker's secret-free runtime fingerprint differs from the API. Keep the max age
greater than the interval. `GENERATION_STARTER_ONLY=true` is required during
private-beta cost calibration; paid-credit submissions remain blocked while
verified accounts can consume one eligible starter render.

The derived R2 endpoint must be reachable from API, worker, and browser. Public access belongs only to the template-preview domain; customer objects use signed URLs. See [R2 setup](../R2_SETUP.md).

The worker uses `MONGODB_URI` because queue leasing, outbox delivery and
reconciliation require durable MongoDB transaction semantics. Do not route those
operations through a transaction pooler. Lease duration must exceed ordinary
enqueue latency, and shutdown grace must exceed the worker's graceful-stop
window.

## Validation

Load secrets into the process environment and validate names without printing
values:

```bash
scripts/infra/verify-environment.sh staging
scripts/infra/verify-environment.sh production
```

This structural check does not prove credentials work. Staging smoke tests must
exercise database, storage, SMTP, OAuth, provider and payment-test connections.
It also does not prove callbacks are registered in Google/Apple consoles or
that signed storage URLs are browser-reachable.

## Access controls

- Human production access uses individual SSO identities and MFA.
- API, worker, migration and read-only support roles are separate.
- Break-glass access is time-limited, alerted and reviewed.
- Secret reads and admin actions are audited.
- Credentials are rotated after suspected exposure and on a defined schedule.
- Developers do not receive production service-role credentials by default.
