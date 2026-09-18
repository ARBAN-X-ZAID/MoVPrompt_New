# Creator stepper layout fix

## Result

- Corrected the progress-step selector so only the numbered marker receives circle dimensions; labels now retain their natural text size.
- Rebuilt the desktop rail as equal-width grid steps with centered labels and connectors.
- Stacked the creator introduction and progress rail below 1180px, before either region becomes cramped.
- Kept the existing compact mobile summary and evenly distributed the six markers across the available width.
- Preserved the existing color tokens, workflow order, progress semantics, and RTL behavior.

## Verification

- `bun run --cwd apps/web typecheck` passed.
- `bun run --cwd apps/web test --run src/features/create/CreatorProgress.test.tsx` passed: 2 tests.
- Browser checks passed at 1440, 1024, 768, and 375 pixels with no horizontal overflow or Vite error overlay.
- English labels rendered at full size on desktop and compacted accessibly on smaller screens.
- Arabic rendered in RTL at 375px with the step order mirrored and no overflow.
- Browser error log was empty; console contained only Vite connection messages and the React development-tools suggestion.
- Local API health remained OK with MongoDB healthy.
- Graphify was refreshed locally in code-only mode: 5087 nodes, 12531 edges, 297 communities; `graphify-out/graph.html` regenerated.

## Boundary

Changes remain local and uncommitted. Nothing was pushed or deployed.
