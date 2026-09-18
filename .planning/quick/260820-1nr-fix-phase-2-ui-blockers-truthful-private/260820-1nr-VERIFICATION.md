---
quick_id: 260820-1nr
phase: quick-260820-1nr
verified: 2026-08-20T01:35:00+03:00
status: human_needed
score: 2/6 must-haves verified
behavior_unverified: 3
overrides_applied: 0
behavior_unverified_items:
  - truth: "Authenticated Generate presents factual creating, per-image, and verification stages before render submission."
    test: "Sign in locally, add two images, click Generate, and observe each claim stage before any render is submitted."
    expected: "A single polite claim surface moves from creating to each image number and then checking saved details; no provider/render status is shown."
    why_human: "Unit tests prove callback ordering and component markup, but no authenticated browser interaction exercised the React state transition."
  - truth: "Cancel and keep editing preserves the campaign and returns focus to Generate video."
    test: "Start an authenticated private claim, cancel while an image stage is visible, then inspect the review form and press Tab."
    expected: "The review remains unchanged, its local image remains, the unchanged-draft notice appears once, and Generate video receives focus."
    why_human: "The abort and focus code is wired and the abortable claim unit test passes, but the complete browser cancellation and focus sequence was not exercised."
  - truth: "A failed image claim exposes exact retry/replacement recovery without treating cancellation as failure."
    test: "Induce a single local asset claim failure, then separately cancel an in-flight claim."
    expected: "Failure exposes Retry securing image and Replace image for the affected image; cancellation returns to review without an error state."
    why_human: "The exact localAssetId is unit-tested and wired into recovery selection, but no authenticated browser failure path was recorded."
human_verification:
  - test: "Run the authenticated two-image private-claim scenario and cancel it before finalization."
    expected: "All claim stages are factual, cancellation retains the full draft, and focus returns to Generate video."
    why_human: "The available browser session had no signed-in local test account; the evidence correctly leaves this as NOT VERIFIED."
  - test: "Review the responsive matrix at 375, 768, 1024, and 1440 in English/Arabic and light/dark while a real claim is visible."
    expected: "No overflow, clipping, or RTL alignment break; source comes first at 375px; the current step remains readable."
    why_human: "The recorded matrix covers source/review layout but not a real authenticated claim surface across all states."
---

# Quick Task 260820-1nr: Truthful Private Claim UI Verification

**Goal:** Fix Phase 2 UI blockers: truthful private-claim progress and cancel recovery, Retry price focus, mobile source-first ordering and current-step label.

**Verified:** 2026-08-20

**Status:** human_needed

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Authenticated Generate shows dedicated factual claim stages before render submission. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `CreateStudio` sets `claimProgress` before calling `claimGuestProject`; `claimGuestAssets` emits creating, per-asset, and verifying events; component test verifies one polite status region. No authenticated browser path was run. |
| 2 | Cancel retains the campaign and restores useful focus. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `cancelGuestClaim` aborts only the active controller, clears transient state, retains draft state, sets the existing cancellation copy, and schedules focus to `generateButtonRef`. The claim unit test proves abort-before-finalize and retained blobs, but not the React/browser sequence. |
| 3 | A claim failure provides exact image recovery and does not turn an abort into an error. | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `GuestClaimAssetFailure.localAssetId` is preserved by `claimGuestAssets` and passed into `selectGuestClaimRecovery`; `AbortError` returns before recovery selection. Unit coverage proves asset identity and abort semantics, not the rendered recovery controls. |
| 4 | Retry price has the required visible keyboard focus treatment in both themes. | ✓ VERIFIED | Real keyboard focus produced `focusVisible: true`, a 3px amber outline, and 3px offset in both light and dark rendered themes. |
| 5 | At 375px, source precedes preview and the current step is readable in English and Arabic. | ✓ VERIFIED | Browser evidence records English/light and Arabic/dark 375px observations, visible `Step 1 of 5: Source` / `الخطوة 1 من 5: المصدر`, and no horizontal overflow. JSX renders source before preview and mobile CSS no longer reorders the preview. |
| 6 | The whole corrected flow is rendered without overflow across sizes, languages, themes, keyboard, and a cancellable real claim. | ? HUMAN VERIFICATION REQUIRED | This is a declared `backstop` truth. The evidence covers source/review layout and Retry price focus, but not a cancellable authenticated claim across the full matrix. |

**Score:** 2/6 truths behaviorally verified; 3 present but behavior-unverified; 1 backstop requires human review.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `apps/web/src/features/create/GuestClaimProgress.tsx` | Semantic claim status and cancel action | ✓ VERIFIED | Substantive component with one `role=status` live region and an external native cancel button; no percentage, provider, media, or time copy. |
| `apps/web/src/features/create/creatorAssets.ts` | Abortable, factual claim orchestration | ✓ VERIFIED | Exports discriminated progress states; uses the supplied signal for start, reservation, content, completion, refresh, finalization, and owned preview refresh. |
| `apps/web/src/features/create/CreatorProgress.tsx` | Semantic desktop progress and mobile current step | ✓ VERIFIED | Renders `progressbar`, ARIA values, `aria-current`, and localized current-step summary. |
| `apps/web/src/features/create/creator.css` | Claim styling, source-first mobile layout, focus treatment | ✓ VERIFIED | Uses semantic tokens, reduced motion fallback, mobile readable progress label, and the required focus outline. |
| `260820-1nr-BROWSER-EVIDENCE.md` | Honest observed browser evidence | ✓ VERIFIED | It clearly records scope, matrix, commands, and NOT VERIFIED states rather than inferring them. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `CreateStudio.tsx` | `creatorAssets.ts` | `claimGuestAssets` receives controller signal and stage callback | ✓ WIRED | `startGeneration` owns the controller and passes signal/progress through `claimGuestProject` to `claimGuestAssets`. |
| `CreateStudio.tsx` | `GuestClaimProgress.tsx` | Real claim callback state renders the status surface | ✓ WIRED | The early `claimProgress` render passes localized stage copy and `cancelGuestClaim`. |
| `CreatorProgress.tsx` | `creator.css` | Mobile current-step summary and retained desktop hierarchy | ✓ WIRED | Component class names match the mobile CSS selectors; browser evidence confirms readable mobile output. |

### Data-Flow Trace

| Artifact | Data variable | Source | Produces real data | Status |
| --- | --- | --- | --- | --- |
| `creatorAssets.ts` | `GuestClaimProgress` | Durable guest-claim API checkpoints and real local-asset manifest | Yes | ✓ FLOWING |
| `CreateStudio.tsx` | `claimProgress` | Active claim callback and guarded controller identity | Yes | ✓ FLOWING |
| `GuestClaimProgress.tsx` | Stage copy | Current claim state plus i18n copy | Yes | ✓ FLOWING |
| `CreatorProgress.tsx` | Current step summary | Actual creator `step` and localized flow steps | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Ordered progress, signal propagation, abort-before-finalize, retained blobs, failed-asset identity | `bun run --cwd apps/web test -- src/features/create/GuestClaimProgress.test.tsx src/features/create/CreatorProgress.test.tsx src/features/create/creatorAssets.test.ts` | 3 files / 10 tests passed | ✓ PASS |
| Web type safety | `bun run typecheck:web` | Passed | ✓ PASS |
| Scoped lint and worktree whitespace | `bun run lint -- apps/web/src/features/create/CreateStudio.tsx apps/web/src/features/create/creatorAssets.ts apps/web/src/features/create/GuestClaimProgress.tsx apps/web/src/features/create/CreatorProgress.tsx && git diff --check` | No errors; 20 pre-existing Fast Refresh warnings outside task files | ✓ PASS |

### Accessibility and Visual QA

- Native `<button>` is used for cancellation and the Retry control; claim copy is one polite, atomic live region.
- Claim cancellation remains outside the live region, avoiding repeated announcement of its action.
- Mobile current-step text is visually hidden only from the repeated circles; it remains visible as a full summary.
- The recorded layout checks pass for the source/review UI at 375, 768, 1024, and 1440. This does **not** verify the same matrix for an authenticated claim surface.

### Anti-Patterns Found

No task-introduced `TBD`, `FIXME`, `XXX`, fake claim percentage, provider/model copy, or empty handler was found. Existing Advanced placeholder styling is outside this quick task's modified surface.

## Human Verification Required

### 1. Authenticated claim and cancellation

**Test:** Sign in with a local account, configure two images, click Generate, observe the claim stages, and select Cancel and keep editing before finalization.

**Expected:** Stages read creating → image 1 of 2 → image 2 of 2 → checking saved details; no provider/time/percentage appears. The unchanged campaign, all images, and pending intent return, with focus on Generate video.

**Why human:** This exact state transition requires a signed-in browser and private API/storage path.

### 2. Failure recovery and retry

**Test:** Make a single image claim fail, use Retry securing image, then use Replace image in a separate run.

**Expected:** Only the affected image is targeted; an abort never displays a claim error; server checkpoints resume without duplication.

**Why human:** The unit suite proves the data contract, but browser controls were not exercised.

### 3. Real claim visual matrix

**Test:** Inspect a real claim state at 375, 768, 1024, and 1440 in English and Arabic.

**Expected:** No clipping/overflow, correct RTL alignment, and a 44px usable cancel target.

**Why human:** The recorded evidence accurately leaves the authenticated claim matrix unverified. The Retry price keyboard focus ring is verified separately.

## Conclusion

The UI implementation is present, connected to the real browser claim orchestration, and has focused automated coverage. It is **not** ready to be called fully verified: the signed-in private-claim journey, browser cancellation/focus restoration, and failed-image recovery still need the above human/browser checks. Retry-price focus is verified in both themes. No production-generation claim is implied.

_Verifier: Codex quick-task verifier_
