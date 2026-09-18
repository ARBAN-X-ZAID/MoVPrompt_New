# Authentication fetch and loading fix

## Root cause
The web app was configured for portable Better Auth, but the root `bun run dev` command started only Vite. The separately running API had been launched without the root `.env`, so `FEATURE_AUTHENTICATION` defaulted to false and `/api/auth/*` returned `503 authentication_service_unavailable`. Thrown fetch errors were not caught by sign-in, which left its busy state active.

## Changes
- Added the missing local Better Auth, authentication feature, and SMTP metadata to the ignored root `.env`, including a generated local secret whose value was never printed.
- Replaced the root dev command with `scripts/dev.ts`, which checks MongoDB, starts API and web with one environment, reports auth readiness, and starts the worker only when generation is enabled.
- Added 30-second timeout, catch, and finally cleanup to sign-in and password reset as well as sign-up.
- Disabled automatic verification email dispatch at sign-up because the configured product policy defers verification until after the first campaign; manual/later verification remains available.
- Rebuilt the auth workspace so the running API consumes the updated behavior.
- Refreshed the local Graphify code index.

## Runtime proof
- `bun run dev` reports MongoDB connected, API started, web started, generation worker skipped because generation is disabled, and authentication plus MongoDB active.
- API readiness reports MongoDB `ok`; feature flags report authentication enabled and email/password available.
- Real browser sign-up redirected to `/create` with no browser error.
- MongoDB contained the new `users` record plus its Better Auth account/session and MovPrompt credit/entitlement records.
- Invalid sign-in returned `Invalid email or password` and re-enabled Sign in.
- Valid sign-in redirected to `/create`.
- A second runtime sign-up after rebuilding auth returned HTTP 200 without the earlier Mailpit background error.
- Temporary verification users and their linked records were removed transactionally.

## Validation
- Web typecheck passed.
- Auth typecheck, build, and all 8 auth tests passed.
- Focused web auth tests: 7 passed.
- `git diff --check` passed.

## Delivery state
All changes remain local and uncommitted. The corrected development stack is running on ports 8080 and 8787.
