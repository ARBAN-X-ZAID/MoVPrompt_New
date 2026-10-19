# Credits, top-ups and payment gateways

## How credits are spent

Every generation is paid from the account wallet: a Template video costs `GENERATION_TEMPLATE_CREDITS_PER_GENERATION` (60) and an Ad Studio video `GENERATION_AD_STUDIO_CREDITS_PER_GENERATION` (80). Guests must sign in to generate, and free starter renders are off unless `GENERATION_STARTER_RENDERS=true`.

- `apps/api/src/generation-pricing.ts` creates authoritative, expiring quotes.
- `packages/db/src/mongo-generation-service.ts` holds credits when a render starts, charges them when the provider accepts the job, and releases or refunds them when it fails.
- `apps/worker/src/render-lifecycle.ts` classifies provider attempts so failed attempts never charge the customer.

Local free generation still exists for development only (`APP_ENV=local` and `DEVELOPMENT_FREE_GENERATION=true`); production ignores it.

## How credits are bought (top-ups)

A top-up is an **order** paid through a **provider**. Only one function adds purchased credits: `creditOrder` in `packages/db/src/mongo-payment-service.ts`. It moves an order from `pending` to `credited` exactly once, adds the credits and writes a `purchase` ledger entry, so repeated requests or webhooks never credit twice.

| Piece | File |
|---|---|
| Packages and KWD prices (in fils) | `apps/api/src/payments/credit-packages.ts` |
| Provider contract | `apps/api/src/payments/provider.ts` |
| Provider selection (`PAYMENTS_PROVIDER`) | `apps/api/src/payments/providers.ts` |
| Order flow and webhooks | `apps/api/src/payments/top-up-service.ts` |
| HTTP routes | `apps/api/src/payment-routes.ts` |
| Top-up dialog and return page | `apps/web/src/components/credits/TopUpDialog.tsx`, `apps/web/src/pages/BillingReturn.tsx` |

Routes:

- `GET /api/v1/credits/packages` — packages, and whether top-ups are available and in test mode.
- `POST /api/v1/credits/top-ups` (signed-in, `Idempotency-Key` header) — creates an order and returns either a credited order or a `checkoutUrl`.
- `GET /api/v1/credits/top-ups/:id` — order status for the `/billing/success` page.
- `POST /api/v1/payments/webhooks/:provider` — the gateway's server-to-server notification.

### Test mode today

`PAYMENTS_PROVIDER=manual` approves every top-up instantly with no payment and allows a typed custom amount. It is refused whenever `APP_ENV` is `production` or unset, so it cannot give away credits on the live site.

## Adding a real gateway (UPayments, Tap, MyFatoorah, ...)

1. Create `apps/api/src/payments/<gateway>-provider.ts` implementing `PaymentProvider`:
   - `createCheckout` calls the gateway with the order id, amount (`amountMinor` fils ÷ 1000 = KWD) and the success/cancel URLs, and returns `{ kind: "redirect", providerReference, checkoutUrl }`.
   - `verifyWebhook` checks the gateway signature on the raw body **before** trusting it, and returns `{ eventId, providerReference, status, amountMinor, currency }`.
   - Set `allowsCustomAmount: false` so customers buy fixed packages.
2. Add a `case "<gateway>"` in `providers.ts` that builds it from its env keys.
3. Set `PAYMENTS_PROVIDER=<gateway>` and its keys in `.env`.
4. In the gateway dashboard, point the webhook at `POST /api/v1/payments/webhooks/<gateway>` and the return URLs at `/billing/success` and `/billing/cancel`.
5. Test a paid, a cancelled and a repeated webhook in the gateway sandbox before going live.

The dialog, wallet, ledger and return page need no changes. For Kuwait, choose a gateway that supports KNET.
