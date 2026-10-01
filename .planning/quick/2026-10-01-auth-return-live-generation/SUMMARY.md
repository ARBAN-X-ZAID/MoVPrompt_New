# Auth return and live generation failure — 2026-10-01

## Diagnosis

- The gallery header linked sign-in to `/auth?next=/create`, and the no-intent auth fallback was `/create`. That route creates a draft with the default first template. Explicit draft/project return paths remain valid and must continue to resume their campaigns.
- The live project's latest run failed before provider acceptance with `provider_operation_failed`. The saved provider response says Vercel AI Gateway requires a minimum $10 balance and the current balance is insufficient. The run has `chargedCredits: 0`, no provider operation ID and no accepted output. This is an external funding gate, not a prompt or image-validation failure. No paid retry or top-up was performed.
- The API converted that specific failure to generic public copy, so the creator could not see an actionable reason.

## Changes

- Ordinary sign-in and sign-up without an explicit return destination go to `/templates`. The gallery's sign-in link also returns there. Explicit `/create?...` continuation links remain intact.
- Classify the narrowly matched Gateway balance response as `provider_balance_required` at the provider/worker boundary. Translate older saved `provider_operation_failed` runs at API read time without changing historical records. Show safe English/Arabic service-balance guidance under Generate, without exposing raw provider details or the top-up URL.
- Added focused provider, worker, API, auth and creator UI regression tests.

## Verification and release gate

- Focused tests, `bun run test:all`, `bun run typecheck:workspaces`, `bun run build:all`, `bun run lint`, and `git diff --check` passed locally. Lint has 20 pre-existing Fast Refresh warnings and zero errors; Vite retains its large-chunk warning.
- Commit/push and Render deployment are pending at the time of this summary. A successful real video remains unverified until the Gateway account is funded and a separately authorized paid canary completes.
