# Phase 1 Validation Plan

## Automated Gates

- `bun install --frozen-lockfile`
- Workspace lint, typecheck, tests, and builds.
- Fresh PostgreSQL 17 migrations through `0014`.
- API, worker, database, contracts, provider, storage, and web focused suites.
- Secret scan and dependency audit at current configured thresholds.

## Required Runtime Evidence

- Fresh worker heartbeat and completed health job.
- API feature flags report the exact availability reason when any dependency is removed.
- A healthy configuration returns a quote; changed configuration produces a new hash/quote.
- Duplicate start returns one run and one reservation/entitlement effect.
- Reloading a project uses persisted run stage.

## Required Browser Evidence

- 375, 768, 1024, and 1440 pixels.
- English and Arabic.
- Light and dark themes.
- Keyboard-only completion of quote retry, auth handoff, cancel, project recovery, and output access.
- Axe/WCAG 2.2 AA review with no serious/critical violations in the scoped journey.
- Clean console and no dead controls.

## Phase Exit

Do not mark the phase complete from code presence. Database, API, worker, and rendered-browser evidence must all agree. Real provider output acceptance remains a Phase 4 gate, but Phase 1 must truthfully refuse or proceed based on its dependencies.

