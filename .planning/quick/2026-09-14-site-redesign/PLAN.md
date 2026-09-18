# Site redesign refinement

## Goal

Refine MovPrompt's public homepage, authentication experience, and handoff into the creator workspace while preserving the current warm neutral and amber palette, routes, navigation labels, bilingual behavior, form order, and accessibility semantics.

## Design direction

- Redesign mode: preserve and evolve.
- Design variance: 6.
- Motion intensity: 5.
- Visual density: 5.
- Use real existing campaign imagery and Framer Motion for hierarchy, feedback, and state transitions.
- Keep one radius system, one accent family, both light and dark modes, and reduced-motion fallbacks.

## Work

1. Tighten the marketing navigation and hero so the value proposition and action fit the initial viewport.
2. Add restrained Framer Motion reveals to key marketing sections without scroll hijacking.
3. Redesign authentication as a product-connected split composition with real imagery and clearer form grouping.
4. Preserve exact authentication behavior, field order, return paths, and draft-restoration promises.
5. Verify build, typecheck, lint, focused tests, light and dark modes, English and Arabic, and 375/768/1024/1440 browser layouts.

## Boundaries

- Do not change routes, API contracts, data behavior, or brand colors.
- Do not enable paid generation or expose provider identifiers in the browser.
- Do not commit, push, publish, or deploy.
