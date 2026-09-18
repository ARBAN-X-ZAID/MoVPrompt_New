---
quick_id: 260820-1nr
phase: quick-260820-1nr
status: human_needed
tasks_completed: 2
tasks_total: 3
commits:
  - 552f266
  - a0b1571
  - b41815a
---

# Quick Task 260820-1nr: Truthful Private Claim UI Summary

The Create experience now exposes real private-claim checkpoints, lets a user safely stop the browser attempt without discarding their campaign, and makes the primary source task clear on mobile.

## Completed code work

- Added a factual, cancellable private-claim surface driven by real claim lifecycle callbacks: creating the campaign, securing image N of N, and checking saved details.
- Passed a single `AbortSignal` through every browser claim request, including start, reservation, upload, completion, checkpoint refresh, finalization, and owned-preview refresh.
- Kept local blobs caller-owned on abort; prevented finalize after an abort; retained the exact failed local image ID for the existing retry/replacement recovery path.
- Added a focused `GuestClaimProgress` component with one polite status region and no artificial percentage, media preview, model/provider naming, or time estimate.
- Extracted semantic creator progress into `CreatorProgress`, retaining ARIA progress metadata and exposing clear `Step 1 of 5: Source` / `الخطوة 1 من 5: المصدر` current-step summaries.
- Removed the mobile rule that placed the empty preview ahead of Campaign source.
- Restored the Retry price focus treatment to a 3px `--creator-action` outline with the established offset.

## Verification

- Focused web tests: 3 files / 10 tests passed.
- Web typecheck: passed.
- Web production build: passed.
- Scoped lint: no errors; only unrelated existing Fast Refresh warnings.
- Browser evidence: recorded in [260820-1nr-BROWSER-EVIDENCE.md](260820-1nr-BROWSER-EVIDENCE.md).

## Remaining blocker before completion

The signed-in local private-claim browser journey has not been exercised through the complete asset-claim state transition. The Retry price keyboard focus ring is now browser-verified in both themes. This summary intentionally remains `human_needed`; no production or end-to-end generation readiness is implied.

## Preserved boundaries

- No provider generation, pricing retry, billing, account creation, private upload, package installation, or server-side cancellation was triggered.
- Existing unrelated dirty-tree files remained untouched and unstaged.
