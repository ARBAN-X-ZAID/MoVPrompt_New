---
status: resolved
trigger: "Full web suite leaves AuthGateDialog in English during the Arabic localization test; isolated test passes."
created: 2026-08-20
updated: 2026-08-20
---

# Auth Dialog Locale Leak

## Symptoms

- **Expected behavior:** `AuthGateDialog.test.tsx` renders Arabic copy when invoked with locale `ar`, both in isolation and in the full workspace suite.
- **Actual behavior:** The full suite renders English copy in the Arabic test; the isolated test passes.
- **Error:** Testing Library cannot find heading `حملتك جاهزة للإنشاء`; accessible heading is `Your campaign is ready to create`.
- **Timeline:** Confirmed after Phase 03 wave 7 during `bun run test:all`; an older Phase 02 Windows entry also recorded an order-dependent locale failure.
- **Reproduction:** Run `bun run test:all` from the repository root. The failure occurs in `apps/web/src/features/create/AuthGateDialog.test.tsx` while the same file passes alone.

## Current Focus

- hypothesis: A shared locale/store or DOM lifecycle leaks English state between tests because cleanup/reset is incomplete.
- test: Pass the intended locale through the provider boundary instead of relying on shared persisted storage, then test with a conflicting stored English preference.
- expecting: Arabic locale becomes deterministic regardless of test order without weakening the localization assertion.
- next_action: resolved
- reasoning_checkpoint: The application keeps its persisted-preference behavior; only an explicit initial language can override it for an embedded deterministic surface.
- tdd_checkpoint: Regression is covered by rendering Arabic while the persisted preference deliberately remains English.

## Evidence

- timestamp: 2026-08-20T23:51:40+03:00
  observation: `bun run test:all` failed 1 of 176 web tests; all API, worker and package tests passed.
- timestamp: 2026-08-20T23:55:29+03:00
  observation: The focused dialog suite passed alone (4/4) and the normal full web suite passed (51 files, 176 tests), confirming the failure is execution-order dependent rather than missing Arabic copy.
- timestamp: 2026-08-20T23:57:50+03:00
  observation: A shuffled, parallel full web suite with seed 143 passed (51 files, 176 tests) after explicit-locale coverage was added.
- timestamp: 2026-08-20T23:58:16+03:00
  observation: `bun run typecheck:web` and `bun run test:all` passed. The workspace suite covered web (176), API (89 passed/13 skipped), worker (67 passed/9 skipped), and all shared packages.

## Eliminated

## Resolution

- root_cause: `AuthGateDialog.test.tsx` used the globally persisted `movprompt-lang` browser value as the only source for its requested locale. In a full suite, another test could leave the shared preference as English between the helper write and provider initialization, producing an order-dependent English dialog.
- fix: Added an optional `initialLocale` to `LanguageProvider`. Production callers continue restoring the persisted preference; the auth-dialog harness now passes its intended locale explicitly, resets document direction/language after each test, and proves Arabic remains correct when persisted storage says English.
- verification: Focused auth dialog suite (4/4); shuffled parallel web suite seed 143 (51 files, 176 tests); `bun run typecheck:web`; `bun run test:all` (all active workspaces passed, skipped database/provisioned cases unchanged).
- files_changed: apps/web/src/i18n/LanguageContext.tsx; apps/web/src/features/create/AuthGateDialog.test.tsx
