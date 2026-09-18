# Template selection price-gate debug

## Symptom

On a restored creator draft, recommended templates show `Price unavailable` and disable `Use this template`.

## Root-cause hypothesis

The recommendation card uses quote readiness as the enablement condition for template selection, even though selecting a template does not charge the user and pricing is only required at the final generation boundary.

## Work

1. Reproduce the issue on the reported draft.
2. Separate template selection availability from quote availability.
3. Preserve the fail-closed generation check when a valid quote is unavailable.
4. Add a regression test, run focused and relevant workspace checks, and verify the restored draft in the browser.
5. Leave the local development stack running for user testing.

## Boundaries

- Keep changes local and uncommitted.
- Do not push, deploy, publish, or trigger paid generation.
