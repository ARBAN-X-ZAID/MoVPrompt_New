# Delete unfinished projects

Local implementation under the previously approved GSD bypass. No push, deployment, paid generation, or deletion of existing user data.

1. Write UI and isolated MongoDB regressions first.
2. Show a clear Delete draft action only for unfinished projects without any generated output or active render. Confirm before deleting, prevent duplicate clicks, and preserve the dialog on failure.
3. Soft-delete through the existing owner-scoped API transaction. Protect historical outputs and accepted versions, including concurrent generation/deletion. Do not remove R2 media immediately.
4. Verify tests, type checks, lint, and the live Projects screen at desktop/mobile widths. Use only disposable records for destructive tests.

## Follow-up: every non-generated project

User clarified that every project without a generated video should show Delete, with “Are you sure you want to delete this project?” confirmation. Expand eligibility beyond draft/ready/failed; keep completed or historically generated videos protected. For active jobs, request cancellation using the existing API, wait boundedly for terminal state, and then use transactional trash. Timeout preserves the project and offers retry. No paid generation or deletion of existing user projects in verification.

## Visible footer regression

User screenshots show all project footers clipped, not just the Delete action. Browser measurement before the fix confirms all five footers extend outside their overflow-hidden cards; the preview link computes as inline.

Fix the card as a vertical flex layout and make the preview a block with a bounded aspect ratio. Verify actual vertical containment of footers/actions and use the visible Delete button to open/cancel confirmation. Cover empty/image previews at 375, 768, 1024 and 1440 pixels; keep generated videos protected. No existing project deletion is needed.
