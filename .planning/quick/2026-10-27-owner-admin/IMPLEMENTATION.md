# Owner admin implementation status

Status: **in progress, not the complete approved admin plan**. This checkout is a local implementation milestone, not a production release. Feature flags default off. The designated account is created with inactive owner membership pending verified email and MFA. The supplied credential was passed through protected stdin and is not stored in repository artifacts. No production admin access or deployment is enabled, and no live refund or paid generation was performed.

Worktree: `/Users/arbaanq/.codex/worktrees/owner-admin/MoVPrompt_New`
Branch: `codex/owner-admin`
Baseline: `b8e545a`

## Implemented locally

- Portable owner membership, protected bootstrap command, verified-email checks, actual Better Auth TOTP/recovery-code enrollment and login, session-specific admin assurance and five-minute step-up for sensitive actions. Legacy `role=admin` does not confer owner access. Owner MFA removal and owner suspension/session removal/deletion through customer controls are blocked.
- Default-off owner routing, responsive English/Arabic shell, theme controls, URL-based list filters, server pagination and detail pages. The legacy Supabase admin page and login are no longer routed from `/admin`.
- Canonical customer/project/run/order/ledger/library/worker/audit lists. Customer profile changes, session revocation and suspension/restoration. Suspended/deletion-pending users cannot create new sessions or start new runs.
- Customer-linked case creation, private owner notes, customer-visible in-app follow-up replies and a customer report/read flow in Notifications. Versioned bilingual in-app communications have audience counts, previews, scheduling, archival and actual customer readers. A durable scheduled job checks the approved revision before publishing. Email drafts require their separate review/delivery workflow; no SMTP acceptance is labeled customer delivery.
- Recorded financial request and owner review for ledger-only adjustments. Wallet impact is recalculated inside a transaction, with stale-impact rejection and idempotent concurrent replay. Generation reservation now shares the wallet write fence and subtracts refund holds.
- Purchase provenance distinguishes purchased credits from non-purchase/opening balances. New-policy generation reservations and debits retain their purchase allocations, cash-refund holds exclude those lots, and failed-video restorations return the original lots. Derived per-purchase records and an owner-requested reconciliation job are available. Live refunds and customer allocation rollout stay gated; historical migration/reconciliation remains incomplete.
- UPayments refund creation/status adapter, verified refund-source identifiers on newly confirmed payments, durable refund operations, uncertain-outcome handling and exactly-once hold retirement. An uncertain submission is never automatically submitted again.
- Queued generation cancellation, existing-output recovery and normal-lifecycle reconciliation. No force-completion or quality bypass. Business-funded renders use a separate reviewed USD budget and protected zero-customer-credit execution path; production execution remains disabled pending cost acceptance.
- Private library/campaign/output inspection, logged before bytes leave the server, with no stored signed URLs. Authorized access is distinguished from delivery. Playback streams with bounded ranges and cancellation/backpressure rather than buffering whole videos. Restricted trash/quarantine review requires recent owner authentication.
- Asset permission withdrawal, quarantine/release, 30-day trash and unapproved restore revisions. Library reconciliation removes or flags editable references while retaining accepted versions and active snapshots. Reference usage identifies working/accepted versions and active runs. Quarantine checks include independent customer copies with the same verified checksum. A separate MovPrompt media area copies approved owner-owned library photos or completed owner footage independently, verifies source/destination checksums and requires review. Replacements keep revisions; approval/trash mutations have a separate state revision fence. Sources are limited to 12 MiB photos / 64 MiB preview footage.
- Separate template drafts with immutable draft revision history, schema/safety/timing validation and guided identity/scene controls. Existing publication can be unpublished, archived or restored. Startup imports preserve owner-managed heads and retain normal synchronization for pre-migration code-managed heads.
- Operational generation pause is enforced in readiness and the submission transaction. Existing run idempotency, payment routes, admin routes and recovery paths remain available.
- Leased background exports with bounded rows/ranges/bytes, spreadsheet-formula protection that preserves numeric negative credits, private object keys, verified persistence, expiry and audited downloads. Account exports include immutable campaign configurations, exact copy/speech, library revisions, customer-visible support and a private media inventory. Media bytes are not embedded. Deletion requests prepare a reviewable inventory with financial/active-run/retention blockers and can be cancelled without clearing an unrelated suspension. An additional admin operation worker can run beside the video worker through `scripts/start-workers.mjs`, with its own heartbeat and graceful shutdown. Heartbeat failure and polling failure are logged with safe codes.

## Current implementation and release boundary — 2026-10-28

The earlier gap list is superseded by this checkpoint. Local workflows now include funded-render accounting/queue execution, version-pinned company-media bindings, historical private revision review, verified support attachments, transactional/promotional email delivery, reviewed erasure/reference-aware cleanup, scheduled operational monitoring, bounded historical wallet reconciliation and an isolated encrypted database/media restore drill.

| Area | Verified local scope | Still required for production acceptance |
|---|---|---|
| Templates | Executable forms/scenes/options, tags/order, pinned resolution limits, sample/preview bindings, publication/rollback and customer/browser/API/worker resolver checks | Matching paid output evidence for new video-affecting recipes; staging owner review |
| Pricing/finance | Versioned pricing, exact quote snapshots, ledger adjustments, purchase provenance, reviewed 50-wallet reconciliation batches, durable cash-refund adapter and funded-recovery budgets | Actual historical data inventory/mappings and reconciliation; merchant permissions/precision and separately approved real gateway acceptance |
| Customers/privacy | Bounded account-record/media-inventory exports, reviewed manifest/policy-hash erasure, zero-wallet/legal/active-run checks and expired-export revocation | Approved production retention policy and grace; larger/segmented exports when an account exceeds the documented limits |
| Media | Independent owner copies, historical access logging, public bindings, trash/recovery and checksum/reference-aware cleanup, including expired support staging and private exports | Actual production storage/retention policy and inventory; no private customer media becomes public automatically |
| Support/moderation | Customer cases, private notes, verified image attachments, in-app replies and optional durable email; consent/clinic gates stay enforced | Actual external clinic/legal review; production email delivery configuration |
| Communications | Bilingual in-app readers, authentication-email runtime templates, opt-in/suppression/unsubscribe, owner tests, reviewed audience snapshots, scheduling and truthful SMTP outcomes | Production mail configuration and staged owner acceptance; no real customer broadcast was sent |
| Reports/system | Canonical aggregates, reported-cost coverage, stale-aware monitoring/alerts, scheduled maintenance, local encrypted restore drill, legacy endpoint retirement guards | Approved backup RPO/RTO/retention, independent production backups and measured restore evidence, actual legacy cutover and full staged accessibility/failure acceptance |
| Release | Local browser and transactional/private-storage checks; all risky rollout flags default off | Verified production owner email/MFA, backup and historical cutover gates, staged owner review and deployment |

No production deployment, live refund, paid provider render, real customer email, real-account erasure or production admin activation was performed. See `docs/runbooks/OWNER_ADMIN_RELEASE.md` for the release sequence and remaining external evidence.

## Local operation

Build packages first using `bun run build:workspaces`.

For a protected deployment, set `FEATURE_OWNER_ADMIN=true` only after the designated verified account is known, then run `bun --env-file=<protected-environment> run admin:bootstrap --email=<verified-email> --confirm-owner-bootstrap`. Bootstrap cannot replace an existing owner. The owner enrolls MFA and saves recovery codes through `/admin`.

Web flag: `VITE_FEATURE_OWNER_ADMIN=true`. API flag: `FEATURE_OWNER_ADMIN=true`. Both default false. `admin:worker` drains durable admin operations. The Docker worker supervisor starts it alongside the existing video worker when the admin flag is enabled. Keep reconciliation workers running while financial operations are unsettled, even if the web flag is rolled back.

Do not enable `ADMIN_REFUNDS_ENABLED` or `ADMIN_REFUND_ACCEPTANCE_VERIFIED` from mock-test evidence. The exact KWD precision, response shapes, merchant permissions and separately approved real payment/refund acceptance must be verified first. UPayments references: https://developers.upayments.com/reference/refund and https://developers.upayments.com/reference/checkrefund .

Local preview uses a dedicated replica set on 127.0.0.1:27029 and database `movprompt_admin_ui_test`, API 18787 and web 18080. Only synthetic local accounts were granted owner membership. Test account MFA secrets are outside the repository in a restricted `/tmp` fixture, not production credentials.

## Known technical limits

- Streaming media supports objects larger than the bounded buffered-read limit. Preview imports have their own explicit 64 MiB limit. Historical playback and policy-gated permanent cleanup are implemented locally; production execution is disabled without an approved policy.
- Published definitions are consumed through immutable pins by browser, API/compiler and worker. Saving a draft alone is not publication. Paid visual-preview evidence and the production rollout gates remain incomplete.
- Refunds whose gateway acceptance timed out before returning an identifier need protected merchant reconciliation. There is deliberately no button to manually claim success.
- Account exports are bounded to 10,000 rows per section and 30 MiB total. They include a media inventory, not a binary media archive. Larger accounts require a reviewed segmented export.
- Layout checks are not full WCAG certification or a substitute for screen-reader/manual acceptance of every journey.


## Additional local modules

- Managed template runtime: `VITE_FEATURE_MANAGED_TEMPLATES=false`, `ADMIN_TEMPLATE_PUBLISHING_ENABLED=false` by default. Existing static forms stay in use until the web runtime flag is enabled with compatible API/worker versions.
- Pricing: `ADMIN_PRICING_ENABLED=false` by default. Saved pricing drafts do not affect customer prices. Existing quotes and pending orders retain original pricing snapshots after publication.
- Reports use canonical database amounts; costs without provider reports remain unavailable and no profit/currency-conversion estimate is presented as confirmed.
- Customer support replies are private to the case owner and support. Moderation cannot bypass consent or clinic review, suspend the designated owner, or mark a provider operation cancelled merely because cancellation was requested.


## Latest local safeguards

- Owner MFA uses real Better Auth verification and unused recovery codes. Login and step-up share an atomic per-code replay fence with keyed fingerprints; no code or token is stored in audit records.
- Recent-auth confirmation opens over the active editor, preserving unfinished work. Repeat submissions reuse operation keys.
- A label-only template was duplicated, saved and published in the isolated local database. The actual customer form consumed its pinned revision and edited Arabic/English labels. Message-only drafts now save before a photo is uploaded and persist clearing both display fields.
- `FEATURE_PURCHASE_ALLOCATIONS=false` is the default for the customer rollout. Enable it on API and worker together after historical reconciliation. Existing pinned reservations/refund holds still use the new accounting during a flag rollback. New cash approval also requires this flag; submitted gateway operations can be rechecked without authorizing another submission.
- `VITE_FEATURE_COMMUNICATIONS=false` gates the customer notice reader. Local notices and template publication used synthetic data only.
