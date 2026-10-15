# Ad Studio section — local implementation report

Completed: 2026-10-15. Workflow: approved scoped GSD fallback (PLAN/SUMMARY).

## Delivered

- Added `/ad-studio` and `/ad-studio/:slug` with the shared catalog cards, search, categories, preview dialog and existing `/create` selection flow.
- Added Ad Studio beside Templates in both navigation components, including mobile and Arabic `استوديو الإعلانات`.
- Central explicit registry: `apps/web/src/features/create/templatePlacement.ts`. All 15 discoverable entries are assigned: 13 Templates, two Ad Studio (Product With Model Ad and Female Product Review). Unknown future entries are not inferred into a section.
- Published and fallback lists, category availability, counts and homepage Templates gallery respect the registry. Shared project/template lookup still includes all items.
- Old moved-item detail routes redirect to Ad Studio with query/hash intact. `/ads` redirects to `/ad-studio`.
- Section navigation, detail/back links and selection carry draft/project context. Change-template saves the draft before returning to its owning section. Shared creation/reopened projects highlight the owning section.
- Default sign-in remains Templates; an explicit Ad Studio destination is retained.
- No recipe, generation, billing, photo policy or form changes in this task. Existing model-ad music and UGC silence remain unchanged. Corrected the model-ad preview label to 15 seconds without changing its generation defaults.
- Closed a preview selection gap: catalog-offline dialogs cannot bypass disabled cards. Unpublished detail requests cannot activate a local fallback.

## Verification

- Full web suite: **71 files passed; 334 tests passed; 11 existing tests skipped**.
- Final focused placement/routing checks: 8 tests passed, including reference/rights and duration preservation, unknown placement, both legacy links, context-preserving selection and unavailable detail handling.
- Web TypeScript check passed.
- Web ESLint passed with zero errors and 20 existing Fast Refresh warnings.
- Web production build passed; existing large-chunk warning remains.
- `git diff --check` passed.
- Component tests cover published/fallback 13/2 filtering, search, preview selection gating, category availability, mobile navigation, active section, sign-in return destination and unchanged existing forms. Existing draft restoration, model reference permissions, checksums, claim identity and project mapper tests passed in the full suite.
- Local browser: 32 layout combinations (two sections × English/Arabic × light/dark × 375/768/1024/1440). All had expected card counts and no document horizontal overflow. Sampled desktop/mobile layouts visually reviewed; Arabic mobile menu verified.
- Local browser: `/ads` redirect and legacy model-ad URL redirect with draft/project/hash verified. Both existing videos reached readyState 4 with no media error: model ad 15.041667s, UGC 8.041667s. Native playback controls retained.
- Screenshot: `output/ad-studio-section/ad-studio-desktop.png`.

## Boundaries

Browser checks used the existing Vite server plus a read-only media server, without a live published catalog. The visible reconnect banner and disabled selection in the screenshot are intentional fail-closed behavior in that isolated setup. Published selection and form/context behavior were verified with local component tests; authenticated live-DB reopening was not re-run.

No paid generation, database migration/write, API/worker change, Git commit, push or deployment was performed. Prior uncommitted work was preserved. UI/UX guidance was used to reuse the existing cards and controls rather than redesign the forms. Production acceptance remains separate from this local verification.
