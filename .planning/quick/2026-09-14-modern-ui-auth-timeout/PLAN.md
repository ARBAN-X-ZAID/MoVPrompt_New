# Modern UI and bounded account creation

## Goal
Modernize the existing MovPrompt homepage and authentication experience while preserving the current brand palette, routes, navigation, localized labels, and sign-up field order. Add a strict 30-second account-creation boundary with visible, accessible loading, success, and error states.

## Work
- Recompose the homepage hero into a clearer campaign-storyboard presentation using existing production assets and restrained Framer Motion.
- Rebuild authentication as an image-led split layout with a focused form surface that works in light/dark and English/Arabic.
- Add a reusable timeout helper and a 30-second sign-up countdown for both portable and legacy auth paths.
- Guarantee cleanup through catch/finally and show an announced success or recoverable error result.
- Add focused timeout tests, then run typecheck, build, relevant UI tests, and browser checks at 375, 768, 1024, and 1440 widths.

## Boundaries
- Keep changes local and uncommitted; do not push or deploy.
- Preserve route structure, form field names/order, feature flags, and existing colors.
- Use existing real campaign imagery and the installed Framer Motion dependency.
