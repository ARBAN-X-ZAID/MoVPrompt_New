# Deferred payment and credit system

MovPrompt runs without payment, credit, wallet, token, or purchase restrictions during local development. The browser hides all commercial controls and the API issues an internal zero-value generation quote so developers can test the real Vercel generation pipeline.

This local mode is enabled only when both conditions are true:

- `APP_ENV=local`
- `DEVELOPMENT_FREE_GENERATION=true`

The browser uses `VITE_FEATURE_DEVELOPMENT_FREE_GENERATION=true` to hide pricing surfaces. Production ignores the server bypass even if the flag is set accidentally.

## Preserved production design

The commercial implementation remains dormant in source code for later integration:

- `apps/api/src/generation-pricing.ts` creates authoritative, expiring quotes.
- `apps/api/src/generation-service.ts` verifies the current quote before starting a render.
- `packages/db/src/mongo-generation-service.ts` performs transactional reservations, ledger writes, acceptance charges, and failure refunds.
- `apps/worker/src/render-lifecycle.ts` classifies provider attempts so failed attempts do not charge the customer.
- `apps/web/src/pages/Pricing.tsx`, `apps/web/src/pages/account/AccountBilling.tsx`, and credit components contain the future commercial screens. Local development redirects these routes to `/create` and does not render their links.

The internal zero-value quote is retained in development because it binds the exact project version and generation configuration, prevents stale submissions, and preserves idempotency. It is an implementation session record, not a user-visible price.

## Returning to paid production

Before enabling payments, set both development-free flags to `false`, configure the authoritative pricing variables, connect the chosen payment provider, and validate reservations, charges, retries, refunds, and rendered UI end to end. Re-enable the pricing and billing surfaces only after those checks pass.
