# Product With Model Ad - isolated new-template implementation

User approved the custom-form/brand-kit implementation; use the previously approved GSD scoped-plan/summary fallback because GSD commands are unavailable. Preserve unrelated changes. No deployment or live database migration authorized in this turn.

## Invariants
- Existing templates, recipe versions, forms, preview keys and provider selection stay unchanged.
- New opt-in versioned custom form and MongoDB/R2 brand kit; no Supabase or additional AI provider.
- Product/model asset roles, consent, immutable snapshot, quote identity and worker revalidation remain authoritative.
- 8/15/20 seconds, portrait and silent. Human-reference restrictions fail closed.
- Feature remains gated until media and integration evidence pass.

## Work
1. Add contracts and isolated recipe/form definitions; baseline existing-template regression fixtures.
2. Wire new form and draft/config persistence, separate brand-kit API and snapshot.
3. Compile new prompt and exact branding output with server ownership checks.
4. Test affected units, typecheck/build, local browser flow with synthetic data (no shared production worker).
5. User selected unpaid tests only. Do not submit a paid 8-second preview or live Seedance generation. Run mocked 1.0 compatibility checks and document its lack of multiple references and 15/20-second support.
6. Save report of verified work, limitations and remaining release gates.
