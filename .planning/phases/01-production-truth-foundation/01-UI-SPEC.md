# Phase 1 UI Contract

## Screens in Scope

- Create final review and Generate action.
- Authentication handoff overlay.
- Full-page generation progress/recovery state.
- Projects list current run status and output access.

## Hierarchy

1. Campaign identity/media.
2. Current generation state or confirmed quote.
3. One primary action: Generate, Retry price, View project, Retry, or Download.
4. Secondary action: continue editing, cancel, or support details.

## State Copy

| State | Headline | Primary action |
|---|---|---|
| pricing failure | We couldn’t confirm the current price. | Retry price |
| disabled | Video generation is temporarily unavailable. | Continue editing |
| worker unavailable | Generation is temporarily paused. Your project is saved. | Check again |
| price changed | The confirmed price changed. | Confirm new price |
| preparing | Preparing your product | View project |
| rendering | Creating your video | View project |
| securing output | Securing your video | View project |
| quality review | Checking quality | View project |
| failed | We couldn’t finish this version. Your previous result is safe. | Retry |
| ready | Your video is ready | View and download |

## Interaction Rules

- Generate remains disabled without a current server quote.
- A second click while submitting uses the same idempotency key and never starts a second run.
- Support details disclose only request ID and retryability.
- Progress is indeterminate or stage-based; do not present a fabricated percentage.
- Closing the page must not cancel the server operation.
- Generated media appears only when an accepted output object exists.

## Responsive and Accessibility

- At 375px, the primary action remains visible and no horizontal page overflow is allowed.
- Progress uses `role="status"` or an equivalent live-region pattern.
- Dialogs use labelled title/description, focus trapping, Escape, and focus return.
- Logical CSS supports Arabic RTL without a separate layout.
- Motion is reduced or removed when `prefers-reduced-motion` is active.

