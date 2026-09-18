---
quick_id: 260820-1nr
status: human_needed
captured_at: 2026-08-20
route: http://127.0.0.1:8080/create
---

# Quick Task 260820-1nr — Browser Evidence

## Runtime used

- Web: existing Vite server at `http://127.0.0.1:8080`.
- API, worker, PostgreSQL 17, and MinIO were already running locally.
- Browser: Codex In-app Browser, with the temporary viewport reset after the inspection.
- No provider generation, billing request, account creation, or file upload was submitted.

## Commands completed

```text
bun run --cwd apps/web test -- src/features/create/GuestClaimProgress.test.tsx src/features/create/CreatorProgress.test.tsx src/features/create/creatorAssets.test.ts
bun run lint -- apps/web/src/features/create/CreateStudio.tsx apps/web/src/features/create/creatorAssets.ts apps/web/src/features/create/GuestClaimProgress.tsx apps/web/src/features/create/CreatorProgress.tsx
bun run typecheck:web
bun run build:web
git diff --check
```

The focused suite passed: 3 files / 10 tests. Typecheck, production build, and diff check passed. Lint had no errors; it emitted 20 pre-existing React Fast Refresh warnings outside the task files.

## Observed browser matrix

| Viewport | UI / theme | Result | Evidence |
|---|---|---|---|
| 375 × 812 | Arabic / dark | PASS | The visible first workspace task was Campaign source, including the source tabs and product URL action before the empty imported-product preview. The complete summary `الخطوة 1 من 5: المصدر` was visible. No horizontal overflow was observed. |
| 375 × 812 | English / light | PASS | DOM recorded `Step 1 of 5: Source`; `scrollWidth` matched `clientWidth` at 375px. |
| 768 × 1024 | English / light | PASS | `scrollWidth` matched viewport width; the localized progress summary and source-first markup remained present. |
| 1024 × 900 | Arabic / dark | PASS | `dir="rtl"`, dark theme, and matching `scrollWidth` / viewport width were observed. |
| 1440 × 900 | Arabic / dark | PASS | `dir="rtl"`, dark theme, and matching `scrollWidth` / viewport width were observed. Campaign review showed the retryable-price state without clipping. |

Screenshot capture location: in-app browser session captures were visually inspected during this run (mobile Arabic/dark source screen and desktop English/light campaign review). They were intentionally not saved as repository artifacts.

## Pricing-recovery observation

Using the non-paid sample-product flow reached Campaign review and showed the real unavailable-price message with the visible **Retry price** action. The desktop English/light screenshot showed the action in the generation summary. The action was not activated, so no quote request was retried.

## Keyboard / console observation

- `Retry price` exists in the rendered campaign review in both localized UI states.
- VERIFIED: real keyboard focus reached `Retry price` in the rendered review. In light mode, Chromium reported `focusVisible: true`, `outline: rgb(230, 148, 15) solid 3px`, and `outlineOffset: 3px`. In dark mode it reported `focusVisible: true`, `outline: rgb(245, 168, 36) solid 3px`, and `outlineOffset: 3px`.
- Browser console error/warning query returned `[]` for the exercised source and review flow.

## Private-claim evidence

- NOT VERIFIED: authenticated guest claim, factual creating/per-image/verifying stages, Cancel and keep editing, failed-image retry, server checkpoint resume, and Generate focus restoration.
- Reason: the local browser had no signed-in test account. No authentication account or private asset was created merely for this UI audit.
- Automated coverage confirms ordered claim stages, one propagated abort signal, abort-before-finalize behavior, retained caller-owned blobs, and exact failed local-asset identity. It does not replace the missing signed-in browser journey.

## Outcome

The source-first responsive, price-recovery, and real keyboard-focus surfaces have browser evidence. The quick task remains **human_needed** until the authenticated local private-claim journey is observed end to end.
