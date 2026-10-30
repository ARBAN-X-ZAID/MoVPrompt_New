# Admin simplification and improvements

Approved user plan, executed through the previously authorized manual GSD workflow.

## Delivery
1. Password-only designated owners, password step-up, durable failed-login limits, 60-day sessions.
2. Typed customer/payment views and independent template duration availability.
3. Customer tabs, wallet/refunds, template table/details, payments, support, overview and settings.
4. Local MongoDB tests, regression/type/build checks and rendered English/Arabic responsive review.

## Invariants
- Preserve owner membership, read-only release gate, immutable render snapshots and customer copy.
- Do not enable live cash refunds, paid generation or unrelated production policies.
- No production deployment or owner migration before local evidence and a compatible release are ready.
- Existing orange theme and components, design variance 3, motion 2, density 5.

## Decisions
Whole-template and supported-length switches. Password-only owner login. Five-minute password confirmation for sensitive actions. Sixty-day sessions with daily renewal. Ten consecutive bad passwords cause a five-minute lockout. Customer assets move inside customer pages. Payments use Kuwait calendar dates.
