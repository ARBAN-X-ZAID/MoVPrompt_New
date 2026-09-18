# Phase 02 — UI Re-Audit

**Audited:** 2026-08-20  
**Baseline:** [02-UI-SPEC.md](02-UI-SPEC.md), Kuwait-first novice workflow, WCAG 2.2 AA, responsive LTR/RTL, and light/dark requirements.  
**Scope:** Phase 2 guest configuration, authentication handoff, private asset claim, recovery, and source/review presentation.  
**Evidence:** Automated component tests plus the rendered browser matrix in [Quick Task Browser Evidence](../../quick/260820-1nr-fix-phase-2-ui-blockers-truthful-private/260820-1nr-BROWSER-EVIDENCE.md).

## Evidence labels

- **Verified** — exercised in the rendered browser or a focused behavioral test.
- **Code-confirmed** — implemented and connected, but the complete live browser transition was not exercised.
- **Not verified** — external/authenticated runtime evidence remains open and is not counted as passing.

## Pillar scores

| Pillar | Score | Current finding |
|---|---:|---|
| Copywriting | 2/4 | Auth preservation and claim stages are clear, but some generation errors remain English-only or implementation-flavoured. |
| Visuals | 3/4 | Source-first mobile hierarchy and readable current-step identity are fixed; a live claim matrix is still open. |
| Color | 3/4 | Semantic creator tokens and Retry-price focus are verified in both themes; a few hard-coded legacy colors remain. |
| Typography | 2/4 | Creator hierarchy is clear, but Auth still exceeds the compact Phase 2 type-role contract. |
| Spacing | 4/4 | Source-first order, 44px controls, and tested viewports show no clipping or horizontal overflow. |
| Experience Design | 3/4 | Real claim stages, abort, retained draft, and recovery are wired and tested; the complete authenticated browser transition is not yet observed. |

**Overall: 17/24**

## Re-audit outcome

The three original priority defects are corrected:

1. **Resolved in code and focused tests — private-claim status and cancellation.** `CreateStudio` now owns one abort controller, passes it through `claimGuestAssets`, renders factual creating/per-image/verifying stages, and returns focus to Generate after cancellation. The live authenticated browser transition remains **not verified**.
2. **Verified in browser — Retry price focus.** Real keyboard focus produced a 3px amber outline with a 3px offset in light and dark modes.
3. **Verified in browser — mobile source-first hierarchy.** At 375px, Campaign source precedes the empty preview and the current step is readable in English and Arabic. The tested 375, 768, 1024, and 1440 layouts had no horizontal overflow.

No model/provider name, fake claim percentage, or fabricated completion estimate is shown during the private-claim stage.

## Remaining priority work

1. **HUMAN EVIDENCE — exercise a real authenticated private claim.** Observe creating → image N of N → checking saved details, then cancel once and fail one asset once. Confirm the draft and local images remain unchanged, retry targets the exact image, and Generate receives focus.
2. **WARNING — complete Arabic business-language error copy.** Several late generation errors in `CreateStudio.tsx` still bypass the translation helper or refer to internal concepts such as a saved project version.
3. **WARNING — simplify Auth typography.** The auth surface still uses more roles and weights than the Phase 2 contract, reducing the calm single-purpose recovery feel.

## Detailed findings

### 1. Copywriting — 2/4

- **Verified:** Generate-time auth promises that the exact campaign returns after sign-in. Cancel copy explicitly says nothing changed.
- **Verified:** Claim copy is factual: creating the private campaign, securing a numbered image, and checking saved details. It does not imply provider generation has started.
- **Warning:** Some late validation, quote, and render-start errors remain hard-coded English.
- **Warning:** Phrases such as “saved project version” and “secure recovery” are accurate but too technical for the primary business-owner audience.

### 2. Visuals — 3/4

- **Verified:** The mobile source task appears before an empty visual preview.
- **Verified:** The mobile progress summary reads `Step 1 of 5: Source` and its Arabic equivalent instead of unexplained numbered circles alone.
- **Code-confirmed:** The claim view is a single focused status surface with one action, not an artificial video-generation screen.
- **Not verified:** The claim surface itself has not been rendered across the complete responsive, language, and theme matrix during a real authenticated upload.

### 3. Color — 3/4

- **Verified:** Retry price uses the semantic creator action token. Keyboard focus in light mode rendered `rgb(230, 148, 15) solid 3px`; dark mode rendered `rgb(245, 168, 36) solid 3px`; both used a 3px offset.
- **Code-confirmed:** Claim and progress components reuse creator surface, ink, muted, action, and danger tokens.
- **Warning:** A small number of legacy creator empty/error styles still use hard-coded color values and should be tokenized in later design-system consolidation.

### 4. Typography — 2/4

- **Verified:** Creator headings, labels, progress summary, and recovery actions remain legible at 375px in English and Arabic.
- **Warning:** `Auth.tsx` still uses a broad marketing-oriented scale and medium/semibold variants beyond the compact Phase 2 role contract.
- **Not verified:** The complete signed-in claim view with maximum-length Arabic copy has not been visually inspected.

### 5. Spacing — 4/4

- **Verified:** Source comes first at 375px; 375, 768, 1024, and 1440 observations showed no horizontal overflow.
- **Verified:** Primary controls and the claim cancel action retain at least 44px usable targets.
- **Code-confirmed:** Reduced-motion handling and responsive spacing use the established creator tokens rather than introducing a parallel system.

### 6. Experience Design — 3/4

- **Verified by tests:** One signal is propagated through claim start, reservation, upload, completion, refresh, and finalize calls. Aborting prevents finalize and retains caller-owned blobs.
- **Verified by tests:** A failed claim preserves the exact local asset ID for Retry/Replace recovery and does not classify cancellation as a failure.
- **Verified in browser:** Retry price has a real visible keyboard focus state; source and review remain usable when pricing is unavailable.
- **Code-confirmed:** Cancel clears transient claim UI, keeps campaign state, shows unchanged-draft reassurance, and schedules focus back to Generate.
- **Not verified:** A real authenticated claim, cancellation, asset failure, and checkpoint resume have not been exercised end to end in the browser.

## Accessibility and interaction evidence

- One polite atomic live region announces claim progress.
- The cancel action is outside the live region, avoiding repetitive announcements.
- Creator progress exposes progressbar semantics and a localized current-step summary.
- Retry price has browser-verified `:focus-visible` treatment in both themes.
- Tested source/review routes showed no browser console errors.
- Full WCAG sign-off remains blocked on the authenticated claim transition, screen-reader announcement order, and real failure/recovery path.

## Registry safety

Phase 2 uses the repository’s local component system. No third-party registry block was introduced or required.

## Sign-off status

**UI status: HUMAN EVIDENCE REQUIRED**

The original implementation blockers are fixed. UI sign-off remains open only because the real signed-in private-claim, cancel, and failed-image recovery transitions have not been observed end to end. This review does not imply provider generation or production launch readiness.

## Files reviewed

- `apps/web/src/features/create/CreateStudio.tsx`
- `apps/web/src/features/create/creatorAssets.ts`
- `apps/web/src/features/create/GuestClaimProgress.tsx`
- `apps/web/src/features/create/CreatorProgress.tsx`
- `apps/web/src/features/create/creator.css`
- `apps/web/src/features/create/AuthGateDialog.tsx`
- `apps/web/src/pages/Auth.tsx`
- `apps/web/src/pages/AuthCallback.tsx`
- `.planning/phases/02-guest-authentication-and-data-integrity/02-UI-SPEC.md`
- `.planning/phases/02-guest-authentication-and-data-integrity/02-BROWSER-EVIDENCE.md`
- `.planning/quick/260820-1nr-fix-phase-2-ui-blockers-truthful-private/260820-1nr-BROWSER-EVIDENCE.md`
