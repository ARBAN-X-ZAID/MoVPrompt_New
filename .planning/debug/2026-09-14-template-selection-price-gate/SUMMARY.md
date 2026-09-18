# Template selection price-gate summary

## Cause

The recommendation card disabled `Use this template` whenever its generation quote was unavailable. Local generation is intentionally disabled, so the unavailable quote incorrectly blocked the free template-selection step.

## Fix

- Template selection now remains available while pricing loads, expires, changes, or is unavailable.
- A ready quote is carried forward when present; selecting without one leaves quote credits unset.
- The final Generate action still requires a fresh confirmed quote, source media, and rights confirmation.

## Validation

- Focused creator suite: 19 tests passed.
- Web TypeScript build passed.
- Web production build passed with only the existing Vite large-chunk warning.
- The reported draft showed three enabled `Use this template` buttons.
- Clicking the repaired button advanced the creator and produced no browser warnings or errors.
- The reported draft URL was left open on the recommendation screen with all three actions enabled.
- Local Graphify output was refreshed.

## Delivery state

Changes remain local, uncommitted, and unpushed. No deployment or paid generation was performed. The existing local development stack remains running for user testing.
