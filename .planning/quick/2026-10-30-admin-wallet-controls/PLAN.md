# Scoped customer wallet management

User requested enabling refund and credit-adjustment controls. Continue the previously authorized manual GSD workflow.

- Add a separately controlled wallet capability to the existing owner permission boundary. Allow only validated credit adjustments, generation restorations and cash-refund review workflows; inspect persisted request kind on shared approval routes.
- Keep recent password confirmation, transaction/idempotency protections, audit history and gateway acceptance gates. No live cash refund or paid render tests.
- Add customer-prefilled credit adjustment review, reuse purchase/refund controls, preserve English/Arabic and current component styling.
- Restrict the admin worker to wallet jobs while production remains read-only. Keep unrelated actions and maintenance disabled.
- Validate against isolated MongoDB, component tests, type checks, lint/build and rendered browser; deploy compatible services and activate the scoped flag.
