# MovPrompt Progress

Updated: 2026-09-18

## 2026-09-18: Template Mode launch cleanup

- Temporarily hid the **Switch to Advanced** handoff and the remaining public **Advanced** navigation links. The `/advanced` route and workspace remain in the codebase for later activation.
- Documented the Render deployment source requirement and the hosted customer-upload path through the Render API, private R2 storage and MongoDB ownership records in `docs/runbooks/RENDER.md`.

This is the compact, chat-independent resume file. Product rules remain in `AGENTS.md` and `.planning/PROJECT.md`; scope and exit criteria remain in `.planning/ROADMAP.md`; detailed evidence remains in the Phase 04 plans, summaries, and validation files.

## Ten-template catalog implementation

- The public launch catalog now contains exactly ten version-one Seedance recipes in five supplied categories: mobile/electronics, food/restaurants, clothing/fashion, beauty/cosmetics, and real-estate/business services.
- The full internal creative catalog contains 60 recipes. The previous five launch templates remain resolvable for historical projects but are no longer public choices.
- MongoDB migration evidence on 2026-09-17: 10 published templates, 5 archived legacy templates, 5 retained legacy current versions, and 15 retained version documents total.
- Ten purpose-specific 1080x1350 JPEG posters are published under R2 `templates/v1/`. Premium Phone Reveal, Restaurant Food Hero Shot, and Fashion Product Showcase also have verified 8-second 720x1280 Seedance 2.5 MP4 previews, real video-frame posters, signed R2 reads, and matching SHA-256 checksums.
- The approved Perfume Advertisement and Real Estate Property preview requests were rejected before generation with Gateway `402 insufficient_funds` after the balance fell to USD 8.49; Vercel requires a minimum USD 10 balance before accepting another video request. No retries were made, and both cards remain honestly poster-only.
- Browser evidence covers all ten cards and R2 posters at 375, 768, 1024, and 1440 pixels with zero horizontal overflow; English/Arabic, light/dark, template selection, local upload, campaign settings, and review were checked. Generation was not submitted.
- Validation: 627 workspace tests passed, workspace type checks passed, production builds passed, and ESLint completed with zero errors and 20 existing Fast Refresh warnings.
- The user explicitly authorized one paid preview per category. Three paid previews completed; two uncharged submissions were rejected for insufficient balance. No Git commit, GitHub push, or deployment was made.
- Public template selection now shows only the three recipes with verified playable R2 previews. The seven poster-only recipes remain versioned internally for historical compatibility and can be exposed after matching previews are approved.

## Durable snapshot

- Branch: `codex/production-rebuild`
- Upstream: `origin/codex/production-rebuild`
- Preserved code snapshot: `d2ce4116ad5d2ac2ae9fbac3deabf6018dbfee01`
- At that snapshot, local hero tests, web typecheck, targeted lint, and the production web build passed.
- `.claude/`, `.codex/`, and `.gsd/` are pre-existing local tool directories. They are not project continuity artifacts and must remain unstaged.

## Exact current position

| Work | Status | Durable evidence |
|---|---|---|
| Phase 04-01: durable lifecycle, private output, truthful state | Complete | [`04-01-SUMMARY.md`](./phases/04-durable-generation-and-accepted-quality/04-01-SUMMARY.md) |
| Task 04-02-01: calibration import, schema, metrics, validator | Implemented | Commits `a8c859e`, `0d38c3c` |
| Task 04-02-02: calibrated acceptance and bounded retries | Implemented; automatic acceptance remains fail-closed without approved calibration | Commits `dab7fd2`, `fa84038`, `90f6f36` |
| Task 04-02-03: qualified-human Kuwait calibration | **Blocking and incomplete** | [`04-02-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-02-PLAN.md) |
| Phase 04-03: settlement proof and production canary | Not started | [`04-03-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-03-PLAN.md) |

Phase 04-02 and Phase 04 are not complete.

## Latest non-billable proof

Run on 2026-08-21 with the paid-provider confirmation variable removed:

```bash
env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run eval:phase04
```

Result: PASS — 9 provider tests; 39 worker tests passed with 2 intentionally skipped; 35 API tests; 2 database tests. No paid provider call was authorized or made.

## Blocking evidence that is absent

- `apps/worker/src/__fixtures__/kw-video-48-v1.calibration.json`
- `.planning/phases/04-durable-generation-and-accepted-quality/04-02-SUMMARY.md`
- `docs/runbooks/PHASE4_PAID_CANARY.md`
- `.planning/phases/04-durable-generation-and-accepted-quality/04-CANARY-EVIDENCE.md`

Automation cannot fabricate, duplicate, infer, or self-approve reviewer labels. Task 04-02-03 requires two genuinely independent qualified-human reviews per candidate, locked submissions, qualified adjudication, role attestations, exact checksums/versions, an authorized approval record, and validator-passing agreement/false-accept thresholds.

## Next safe action

1. Humans complete and approve the exact Task 04-02-03 calibration process.
2. Import that genuine evidence through the implemented validator and rerun the non-billable `eval:phase04` command above.
3. Only after exact-version calibration is approved may Phase 04-03 proceed.
4. Task 04-03-03 still requires a separate, new authorization in the form `Authorize one Seedance 2.5 canary up to USD <cap>`. Prior discussion, account balance, or calibration approval is not paid-call permission.

## Not proven

- Qualified-human calibration approval
- Phase 04-02 or Phase 04 completion
- A real Seedance 2.5 acceptance canary
- Production deployment or production readiness
- Live end-to-end settlement, restart, browser, and accepted-output evidence

## Safe resume read order

1. `AGENTS.md`
2. `.planning/PROJECT.md`
3. `.planning/STATE.md`
4. This `.planning/PROGRESS.md`
5. Phase 04 in `.planning/ROADMAP.md`
6. [`04-01-SUMMARY.md`](./phases/04-durable-generation-and-accepted-quality/04-01-SUMMARY.md)
7. [`04-02-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-02-PLAN.md)
8. [`04-03-PLAN.md`](./phases/04-durable-generation-and-accepted-quality/04-03-PLAN.md)
9. [`04-VALIDATION.md`](./phases/04-durable-generation-and-accepted-quality/04-VALIDATION.md)

Repository files and Git history are authoritative. Codex chat history is not.

## 2026-09-17: Four-category template discovery

- Added `new-york-billboard-takeover-v1` as master recipe 61 and public launch recipe 11, with four fixed scenes, identity constraints, deterministic overlay space, and English/Arabic catalog copy.
- Added typed discovery categories and replaced overlapping Shops/Ecommerce filtering with All, Electronics, Food, Ecommerce, and Advertising. Business verticals remain unchanged for campaign compatibility.
- Added the advertising poster/reference assets, R2 route and publishing support, MongoDB catalog metadata, and a guarded single-request Seedance generator.
- The one authorized advertising request was rejected before generation with `402 insufficient_funds` at USD 8.49; no retry occurred and no video was uploaded.
- Motion-preview activation remains fail-closed through `verified-preview-manifest.ts`. The Advertising category now exposes the verified poster-only New York Billboard Takeover recipe as a selectable template and labels its video preview as coming later; all other unapproved poster-only recipes remain hidden.
- Full workspace verification passed after the provider rejection: 635 tests passed with 34 intentional skips, all workspace type checks and builds passed, and ESLint reported zero errors with 20 existing Fast Refresh warnings.
- Browser verification passed at 375, 768, 1024, and 1440 pixels with no horizontal overflow; English/Arabic, light/dark, category filtering, and three playable previews were inspected. After enabling the poster-only Advertising recipe, 18 focused web tests, web typecheck, targeted ESLint, and the production web build passed. A live browser check confirmed four cards under All, one card under Advertising, and successful navigation to `/create?template=new-york-billboard-takeover`.
