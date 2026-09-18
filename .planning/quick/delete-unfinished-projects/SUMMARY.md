# Delete unfinished projects — completed locally

My Projects now shows a named Delete draft button only for unfinished work. Confirmation supports English/Arabic and light/dark, keeps the draft on failure, and prevents duplicate clicks while deletion is pending. Projects with generated media (including older accepted versions) and active renders are protected in the API, not just hidden in the UI. Local/QA drafts use the same eligibility rule.

Deletion uses the existing owner-scoped soft trash operation in a MongoDB transaction. Generation checks the live project within its enqueue transaction, so concurrent deletion cannot orphan a newly submitted job. Render history and accepted/exported output are checked across versions. Failed/cancelled renders without media remain deletable even if the project status is stale. No R2 media is deleted immediately.

## Evidence

- Tests written first: six new UI cases failed, and ten MongoDB cases failed against the previous implementation.
- Web: 233 tests pass; type check and production build pass (existing large chunk warning).
- API: 146 tests pass; 20 optional MongoDB checks skipped in the default suite. The targeted isolated MongoDB deletion suite separately passes all 15 cases, including ownership, historical outputs, active jobs, idempotency and concurrent enqueue/delete.
- Database: 8 default tests pass; all four optional guest-quota cases also pass against an isolated local MongoDB database after updating their fixture to include the required live project.
- API/database type checks, targeted ESLint, and git diff whitespace checks pass.
- Live browser: unfinished campaigns have Delete draft; the generated project has no delete action. Confirmation/cancel checked in English/light and Arabic/dark at 375 pixels. Actions stay within the page without horizontal overflow at 375, 768, 1024, and 1440 pixels.
- A newly created disposable draft was soft-deleted through browser → authenticated API → MongoDB. MongoDB confirms its trash state; the existing generated project remains live and its completed video reference is retained. No pre-existing user project was deleted.
- Language/theme/viewport restored. Changes remain local; no GitHub push, deployment, purchases, paid video generation, or persistent media deletion.

## Follow-up clarification implemented

Every project without a completed or historically generated video now offers **Delete project**, including review, export, failure, and active generation states. Confirmation explicitly asks **“Are you sure you want to delete this project?”**, names the campaign, and offers **Cancel** / **Delete project**. Status alone no longer classifies review/exporting work as generated.

Active jobs are cancelled through the existing owner-scoped cancellation API before transactional trash is retried. Waiting is bounded to 30 attempts with one-second intervals; network failures, provider acceptance/cancellation conflicts, or a video completing during cancellation preserve the project and show a retry/protection message. Cancelling an existing operation never submits a new generation. Actual saved output remains protected by the backend even when UI state is stale.

Verification: 17 targeted UI/cancellation tests pass, all 17 isolated MongoDB deletion tests pass, and web/API type checks and targeted lint pass. The full web suite and production build also pass. Live browser confirms the exact requested question and both buttons, cancellation leaves the existing project visible, and the generated project still has no deletion action. Verification used a separate temporary tab to preserve the user's active campaign form; no existing project or active provider operation was deleted/cancelled in this follow-up. No GitHub push or paid generation.

## Screenshot-reported footer clipping fixed

The previous DOM/button tests missed vertical clipping. Actual browser geometry showed all five project footers outside their overflow-hidden cards because the preview link was inline and its contents consumed the card height. Fixed the card as a vertical flex container, the preview as a block with its own aspect ratio, and the footer as a separate flex region. Product previews and empty placeholders now reserve the same bounded space, with titles/actions visibly below.

Browser verification measures every footer and action within its card at 375, 768, 1024 and 1440 pixels, with no horizontal overflow. A screenshot visually confirms all draft Delete project buttons alongside Open/duplicate, while the generated card has no delete button. Click → exact Are you sure confirmation → Cancel passes without deleting any project. All 17 targeted deletion/UI tests and the web build pass (existing chunk-size warning only). Temporary viewport override reset. Changes remain local.
