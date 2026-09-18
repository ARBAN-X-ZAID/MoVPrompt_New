# Development free-generation mode

## Goal

Make the local development experience free of payment, price, credit, token, and wallet UI while keeping the real Vercel AI Gateway generation pipeline available for testing. Preserve the deferred production payment design in project documentation.

## Work

1. Add an explicit local-only free-generation mode and hide payment-facing creator/navigation UI.
2. Remove product price entry and quote status from the active creator flow.
3. Allow generation in local development without a customer-visible price or credit restriction while retaining authentication, ownership, source-media, rights, provider, worker, storage, and output checks.
4. Fix campaign form grid alignment and responsive layout.
5. Document the deferred production payment architecture in `PAYMENTS.md`.
6. Add regression tests, run repository checks, configure the local runtime, and verify the reported draft in the browser.

## Boundaries

- Development bypass must fail closed outside `APP_ENV=local` / Vite development.
- Keep secrets server-only and do not print them.
- Keep changes local and uncommitted; do not push or deploy.
- Do not trigger an actual paid provider render during automated verification.
