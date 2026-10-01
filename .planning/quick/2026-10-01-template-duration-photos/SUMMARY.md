# Duration-specific templates and photo rules

Implemented locally on 2026-10-01. The unavailable `/gsd-quick` entry point was bypassed only after explicit user approval. Existing uncommitted project work was preserved; no commit, deployment, production database migration, external publication or paid generation was performed.

## Delivered

- Twelve launch templates now have immutable version-2 recipes for 8, 15 and 20 seconds (36 variants). The other 50 internal recipes are unchanged by this work. Eight-second concepts retain their original sequence with corrected reference and identity instructions; longer variants have distinct authored action and closing compositions.
- Shared photo policies enforce the approved single-photo limits, 1–3 phone views, 1–5 ordered property views, and UGC 1–3 product plus 0–3 character photos. JPG, PNG and WebP only. UGC character references have a separate typed photo-presenter contract and per-asset adult/rights attestation; existing unsupported footage/avatar paths remain gated.
- Upload batches reject invalid types and excess counts without partially adding files. Replacement unselects the old photo instead of deleting it. Imported photos require explicit selection. Template changes preserve saved assets and require resolving invalid selections. Property order has accessible Earlier/Later controls, and each selected view receives a shot before the opening-view close.
- Roles, order, checksums, consent, selected duration and recipe identity survive draft persistence, claim merging, immutable project configurations and reopening. Ordered selections and variant identity participate in quote hashing.
- Browser, API and worker share duration resolution and policy validation. Complete prompts are bounded before quote/charging, reserving space for quality retries rather than truncating confirmed facts. All variants prohibit invented labels, features, people or rooms and keep uploaded identities authoritative.
- Server-only Seedance 2.5 selection fails closed. Unavailability does not snap duration or choose another model. Browser capability responses contain semantic readiness, not provider/model IDs.
- Multi-photo requests, UGC and billboard use pure ordered reference mode with exact `[Image N]` mapping and no first-frame input. Ordinary single-photo animation retains prepared first-frame behavior. Stable server-derived seeds are persisted before submission and retained on retries.
- Audio is disabled in provider requests and prompts. Final MP4 normalization also removes audio and skips narration when muted, protecting delivery even if the provider returns an audio track.
- Catalog writes use insert-only immutable version records with idempotent replay. Historical versions and accepted project pointers remain intact. Existing preview keys stay explicitly associated with version-1 eight-second examples; no longer-preview paths were invented.
- The UI/UX skill informed per-photo grouping, explicit selection, 44px actions, RTL-safe layout and keyboard-accessible ordering, while preserving the existing visual system.

## Verification

- Full workspace builds and TypeScript checks passed.
- Full workspace tests: 721 passed, 49 optional/environment-gated tests skipped. Focused checks cover all 36 variants, exact timing totals, reference mapping and boundaries, optional characters and rights, muted prompts, oversized facts, quote invalidation, guest restoration, provider reference/frame exclusivity, model rejection, seed retry stability and existing billing/retry regressions.
- ESLint: zero errors; 20 existing Fast Refresh export warnings. Web bundle budget passed. `git diff --check` passed.
- Isolated local MongoDB replica-set tests: all 16 database tests passed, including immutable catalog publication/replay and preservation of historical versions/accepted project pointers. API guest-claim recovery: 3 passed, 1 live-R2-dependent case skipped. Test databases were disposable and cleaned by their fixtures; production was not touched.
- Real local FFmpeg/FFprobe output tests: all 13 output-persister tests passed. Synthetic videos with audio were normalized at 8, 15 and 20 seconds: each retained its duration and had only a video stream. Existing audio-enabled delivery behavior also passed.
- Rendered local creator checks covered all 16 combinations of 375/768/1024/1440 pixels, English/Arabic and light/dark, with no horizontal page overflow. Representative screenshots were visually inspected. Property keyboard reordering, rejected over-limit batches, and retained 15/20-second selection during unavailability were exercised. This is targeted responsive/accessibility evidence, not a complete WCAG audit.
- Browser screenshots: `/tmp/movprompt-template-visual-shGCIQ/` (including `property-final.png`). Check logs: `/tmp/movprompt-duration-final-{build,types,tests,lint,bundle}.log`, `/tmp/movprompt-duration-mongo-final.log` and `/tmp/movprompt-mongo-claims.log`.

## Remaining acceptance gates

- Local browser checks used the QA creator route; generation was correctly unavailable without a ready matching API/worker capability. No real provider output was generated or reviewed.
- Real generated-media identity, motion, room fidelity and consistency require explicit spending authorization and human review. Stable seeds and detailed prompts improve repeatability but do not guarantee pixel-identical generations.
- Production rollout, real R2 preview availability and end-to-end authenticated production acceptance remain unverified. Existing eight-second preview associations were verified in code/database tests, not republished.
- Phase 4 qualified-human Kuwait calibration remains open. This quick implementation does not complete that gate or authorize launch.
