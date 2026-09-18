# Phase 3 Rendered Browser Evidence

**Observed:** 2026-08-21

## Status

**VERIFIED FOR THE WEB UI SURFACE.**

The Phase 03 source and fact-review experience was rendered in the local Vite application across the required language, theme, and viewport matrix. This evidence covers responsive layout, RTL direction, interaction sizing, keyboard/error behavior, reduced motion, console cleanliness, and automated accessibility checks. It does not claim that the separately provisioned auth, quote, private-claim, worker, or durable-generation journey passed; those operational gates remain recorded in [`03-UAT-EVIDENCE.md`](03-UAT-EVIDENCE.md).

No provider submission, provider request, provider attempt, or paid cost was made.

## Rendered matrix

| Viewport | English light/dark | Arabic light/dark | Keyboard/focus | Overflow/console | Status |
|---:|---|---|---|---|---|
| 375 | Observed | Observed, RTL | Observed | No horizontal overflow; clean console | PASS |
| 768 | Observed | Observed, RTL | Observed | No horizontal overflow; clean console | PASS |
| 1024 | Observed | Observed, RTL | Observed | No horizontal overflow; clean console | PASS |
| 1440 | Observed | Observed, RTL | Observed | No horizontal overflow; clean console | PASS |

## Interaction and accessibility evidence

- All 16 EN/AR × light/dark × 375/768/1024/1440 combinations rendered with the expected document language and direction.
- Visible primary controls met the 44px target check. The visually hidden native file input is intentionally 1×1 and is operated through its labelled 48px button.
- Source URL validation exposed `aria-invalid` and associated help/error IDs through `aria-describedby`.
- Radio-keyboard navigation retained focus, reduced-motion emulation reduced transition duration to `0.00001s`, and browser console warnings/errors remained empty.
- Axe-core 4.11.4 WCAG 2 A/AA reported zero violations. Its contrast rule was incomplete only where an intentional gradient prevented automatic background calculation; those surfaces received rendered visual inspection.
- Computed styles confirmed 12px/600 labels, 16px/400 inputs, 48px minimum input height, 16px inline padding, and tokenized action spacing.

## Independent current-runtime spot check

The root verification pass opened `http://127.0.0.1:8080/create` in the Codex in-app browser after the UI-fix commit:

- At 375px, Arabic/dark rendered with `lang=ar`, `dir=rtl`, `scrollWidth=375`, no page overflow, the expected Arabic heading, and no console warnings/errors.
- At 1440px, English/light rendered with `lang=en`, `dir=ltr`, `scrollWidth=1440`, no page overflow, the expected English heading, and no console warnings/errors.

This spot check confirms the current served application matches the recorded matrix at the two boundary anchors. It is not a substitute for the missing provisioned-stack UAT.

## Automated support

- `bun run test:creator-smoke` covers deterministic product/service facts, source/template convergence, auth-cancellation/replay intent, final review, current quote state, and no provider work.
- Full web suite: 52 files and 201 tests passed.
- Workspace typecheck, web production build, scoped lint, and web bundle gate passed; the initial JavaScript gzip total remained within the configured 300 KiB limit.
- Evidence redaction check passed for Phase 3 evidence artifacts.

## Remaining operational follow-up

1. Provision PostgreSQL, private storage, Mailpit, API, and a fresh worker heartbeat together.
2. Complete both golden paths through real Generate-time authentication, private checksum-verified claim, an authoritative quote, idempotent submission, and close/reload recovery while provider dispatch remains paused.
3. Update `03-UAT-EVIDENCE.md` only after that real-stack evidence passes.
