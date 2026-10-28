# Execution record

2026-10-27: Created a clean managed worktree from main b8e545a on codex/owner-admin. Existing native-ugc-speech checkout was retained because it contains earlier evidence. No production data or services changed.

Repository inventory confirms legacy Supabase admin screens, no portable owner authorization, no refund adapter, and static recipe resolution that must be replaced consistently before publishing is enabled.

## Local foundation checkpoint

Implemented the owner-only backend/UI foundation and connected local workflows described in IMPLEMENTATION.md. This is a partial implementation of the approved complete plan. New recipe publishing, dynamic pricing, full moderation/communications and release acceptance remain open.

Verified with real isolated MongoDB transactions and actual Better Auth MFA, plus synthetic files in private R2. R2 test objects were deleted after verification. No paid generation or live financial call was made. Browser evidence includes a synthetic 100-to-110-credit owner review and a separate Adstudio draft revision, with original published versions retained.

Dashboard checks at 375/768/1024/1440 in English/Arabic and light/dark recorded no horizontal overflow. Screenshots and dimensions are in evidence/. This does not certify all journeys against WCAG.

A regression run exposed the existing Node 24 shared Web Storage test file racing between Vitest workers. Test setup now creates isolated storage per jsdom realm. The complete web suite then passed 506 tests. Initial full-workspace failures and their corrections were investigated rather than reported as a clean first run.

The supplied production-owner identity has not been written into source or used to grant production access. Read-only lookup in the configured remote database found no account for it. Production ownership remains pending verified account provisioning, MFA and the rollout gates.


## Owner provisioning and versioned runtime checkpoint

The designated account was created through the protected `admin:provision` command in the configured remote `movprompt` database. The password was supplied on stdin with terminal echo disabled and stored only as a Better Auth hash. Verification confirmed no retained provisioning session, email unverified, and owner membership inactive/pending verification. No verification flag or MFA setup was fabricated. No production admin feature flag or deployment was enabled. The account identity and plaintext credential are deliberately omitted from repository artifacts.

Implemented shared stored-definition resolution through the public immutable template endpoint, browser pin hydration, API preflight/compiler and Mongo worker snapshots. A compatibility adapter preserves Adstudio v2's existing character-photo behavior without rewriting historical rows. Managed-form contracts and a concrete renderer bind supported field labels/help/order/conditions to existing campaign controls. Required family inputs, permissions, photo roles, blank optional display messages and exact copy remain protected. Cached definitions are reverified when a draft is reopened. Unsupported selected lengths remain selected until the customer changes them.

The guided owner editor now includes forms, per-duration scene directions, supported video/photo settings and a form-only preview. Added unpublished family duplication, comparison, immutable publishing and rollback. Publication defaults off. Metadata/form changes may inherit matching verified baseline footage. Video-affecting changes require matching business-funded output evidence; that preview-budget workflow is still incomplete, so no new video-quality claim was made.

Added versioned pricing drafts, immutable policies, impact review, package/custom-top-up limits, product/length/resolution prices and entitlement controls. New quotes store a pricing version and authoritative snapshot; previously quoted amounts are honored. Pending top-up retries retain their original money and credits after price changes. Customer pricing/wallet surfaces read current server pricing. Price publication defaults off and no production prices changed.

Added source/period-stamped report aggregates for acquisition, first-generation activity, template/run outcomes, cash orders/refunds, credit movements/reservations, reported provider costs with explicit missing coverage, recorded private-storage metadata and support workload. Added moderation decisions using the existing asset-reconciliation and generation domain, owner suspension protection, requested-cancellation status and customer follow-up replies with owner isolation/private-note protection.

Validation so far: all workspace builds and typechecks passed before the latest small report/moderation/display-preservation additions. Lint had zero errors and the same 20 existing Fast Refresh warnings. Full workspace run passed before the last additions (web 506, API 256 plus opt-in skips; other packages recorded in `/tmp/movprompt-admin-workspace-current.log`). Focused real MongoDB/Auth/private R2/refund mock/pricing run passed 33 tests; later expanded MongoDB support/moderation/report/pricing suite passed 25 tests. Real worker pinned-version MongoDB test passed; hook hydration tests passed. Synthetic R2 objects were cleaned up. No paid video generation or live cash refund was performed. New changes require a final repeat of appropriate checks before claiming this checkpoint validated.

Browser verification: actual synthetic-owner password login, TOTP challenge and separate admin assurance succeeded. The Arabic pricing draft was edited and saved to the local MongoDB database, and recalculated impact appeared. The draft was not published. Screenshot: `evidence/pricing-draft-ar.png`. Local synthetic QA authentication was rekeyed in a restricted `/tmp` fixture after restart; this was isolated from the real designated account.

## Integrated operations checkpoint — 2026-10-27

The complete approved plan remains in progress. No production deployment, live refund, paid preview or new production-owner access was enabled.

Added independent MovPrompt-owned media import/replacement/review/trash, source-role/ownership checks, verified R2 copies and separate concurrent state revisions. Added private account-record exports with a media inventory, revision-checked deletion manifests and cancellation, customer authentication-event history, live canonical reports, capability pauses and a separate operation-worker heartbeat. In-app communications now include a bilingual editor, audience counts, revision history, durable scheduling and a customer-facing notice reader. Email publication remains disabled.

Purchase accounting now retains original purchase-lot allocations for reservation, charge and failed-video restoration. Cash holds and generation reservations cannot spend the same lots. Non-purchase/opening credit is kept separate. An owner-requested reconciliation operation materializes derived allocations without editing balances. `FEATURE_PURCHASE_ALLOCATIONS` defaults false until historical reconciliation and coordinated API/worker rollout. Submitted refunds can still be rechecked while new submissions are disabled; no uncertain submission is blindly repeated.

MFA login and sensitive-action confirmation share an atomic, keyed per-code replay fence. Login assurance is established from a valid issued session cookie, not an untrusted response token. The recent-auth dialog preserves active editor fields and requires manual retry using the original operation key. Body-size and bounded export checks reject oversized work instead of reporting partial success.

Browser evidence uses synthetic local accounts and data only. A label-only duplicated template was saved and published locally, and its pinned Arabic/English labels appeared in the real customer form. An expired-authentication confirmation preserved all communication fields, after which the owner manually retried publication and the exact notice appeared in the customer templates page. Message-only draft inputs survived reload before a photo was uploaded; clearing both fields also persisted. Adstudio and Product with Presenter retain their existing, separate family defaults. No production template or price was edited.

The reports layout was visually inspected at 1024 pixels in Arabic/light; the complete screenshot is `evidence/reports-tablet-ar.jpg`, with viewport/client/scroll width all 1024. Earlier dashboard geometry covers 375/768/1024/1440 in both languages/themes. A later 1440 report screenshot was cropped by the host pane and is not evidence of a complete visible 1440 report. No full WCAG certification is claimed.

The final reports geometry matrix also passed at 375/768/1024/1440 in English/Arabic and light/dark: 16 states, no horizontal page overflow (`evidence/responsive-reports.json`). Additional complete 375-pixel Arabic and 1024-pixel English screenshots were saved. The viewport override was reset after inspection.

Latest verification, on the current code:

- `bun run build:workspaces`: all nine workspaces passed (`/tmp/movprompt-admin-final-build.log`).
- `bun run typecheck:workspaces`: all nine passed (`/tmp/movprompt-admin-review-typecheck.log`).
- `bun run lint`: zero errors, 20 existing Fast Refresh warnings (`/tmp/movprompt-admin-final-lint.log`).
- `bun run test:workspaces`: 1,263 passed, 97 opt-in skipped. Breakdown: web 512, API 257, worker 188, DB 14, creative engine 201, providers 43, contracts 16, storage 20, auth 12 (`/tmp/movprompt-admin-final-tests.log`).
- Selected real local MongoDB/Auth/private R2/API/refund-adapter/pricing/media suite: 48 passed (`/tmp/movprompt-admin-final-api.log`). Synthetic R2 objects were cleaned after testing.
- Real MongoDB DB-package suite: 22 passed (`/tmp/movprompt-admin-final-db.log`).
- Real MongoDB worker pinned-template snapshot test: one passed (`/tmp/movprompt-admin-final-worker.log`).
- `git diff --check`: passed.

An earlier parallel MongoDB validation exceeded the default five-second test timeout under simultaneous index builds. It also exposed new indexes incorrectly bypassing the repository collection abstraction used by unit fakes. The abstraction was corrected; the relevant MongoDB suites were rerun serially with a 30-second bound and passed. The failed run is not treated as a clean validation.

A read-only recheck of the designated remote owner account confirmed: account exists, email remains unverified, MFA is not enrolled, owner membership is inactive/pending verification. The credential remains outside repository artifacts. No verification or security factor was fabricated. The local API and admin worker were restarted from the latest build; generation/private-storage availability remains disabled in the browser fixture, while separate storage tests use verified private R2.

Remaining implementation and release dependencies are enumerated in IMPLEMENTATION.md. In particular, paid business-preview/recovery execution, template-owned-media publication bindings, support attachments/email, promotional delivery/suppression, permanent retention cleanup, historical migration, backup/restore acceptance, full accessibility/security acceptance and deployment are unfinished.

## Remaining-work continuation — 2026-10-27

The user explicitly requested completion of remaining modules and local acceptance before deployment. Their reply to the production RPO/RTO/backup/financial-retention question was “continue”; no policy values were approved or inferred. Independent local implementation continues, while those production gates stay closed.

Implemented historical library/owned-media revision review behind recent authentication, with the exact selected revision in access logs. Implemented version-pinned company poster/product/presenter/preview bindings, explicit public-rights review, current approval checks at publication/rollback/restoration, and a public media resolver that serves only the current published template and approved independent revision. Customer media never becomes public automatically. Video preview binding additionally requires matching business-funded recipe-quality evidence. The guided editor exposes approved company-media choices. The customer template catalog consumes the approved paths and displays product/presenter examples separately without populating campaign inputs.

Implemented support image attachments with signed private staging uploads, checksum/size/actual-image decode verification, independent verified copies, per-message binding and case/uploader/visibility checks. Customers cannot fetch private owner-note attachments. Verified attachments cannot be reused in another message. Existing in-app reply behavior remains intact. A customer-visible reply may explicitly queue an email notification; private notes cannot be emailed. Added customer/admin reply controls with upload status, removal, retry and retained message inputs.

Implemented safe bilingual verification/reset-email definitions with only {{name}}/{{actionUrl}} bindings, immutable history, controlled activation/scheduling and actual auth-sender consumption. Secure action links are created by Better Auth and are never persisted as email-template content. Implemented opt-in email preferences (default off), signed unsubscribe, owner-only tests, bounded immutable audience review, revision-checked approval, durable individual deliveries, per-send consent/account/publication checks, and recorded queued/suppressed/SMTP-accepted/uncertain outcomes. Interrupted SMTP sends are never blindly retried. Email configuration and customer preference UI flags default off. No real customer email was sent during validation.

New validation: the expanded real MongoDB/private R2 suite passed 5 tests, including independent public sample reads/ranges/trash revocation, historical access, checksum rejection, private attachment isolation and duplicate attachment rejection (`/tmp/movprompt-admin-support-storage-test.log`). Actual local SMTP-sink tests plus email configuration tests passed 6 tests (`/tmp/movprompt-admin-email-unit.log`). Expanded real MongoDB/Auth/email tests passed 37 (`/tmp/movprompt-admin-mail-integrated-test.log`). All workspace typechecks passed (`/tmp/movprompt-admin-mail-integrated-typecheck.log`). New screens still need rendered-browser and accessibility acceptance, and broader regression checks follow the remaining implementation.

Corrections: the first expanded media test omitted the baseline catalog argument and failed before publication; the fixture was corrected and the R2 suite rerun successfully. A newly added email index initially used an undefined short collection alias; this was corrected and the real MongoDB suite rerun successfully. These first failed runs are not reported as clean passes.

## Funded-render implementation checkpoint

Added separate requested/preparing/ready/approved/running/terminal business-render records, explicit USD ceilings and daily budget fencing, owner review, zero-customer-credit quotes protected by server-only funding authorization, normal generation preflight and queue execution, and detached replacement versions. Pending candidates are hidden from customer version/output lists. Accepted customer videos and working pointers stay unchanged; passing recovery candidates become available for explicit customer acceptance. Preview requests are restricted to owner-owned company inputs and require public-preview permission. Unpublished preview definitions are resolved only inside the scoped business-generation service. Matching accepted quality decisions are now persisted by the ordinary worker before preview evidence can be created. Public publication requires binding an independently verified approved preview revision.

The new business tests initially exposed a scoped-template resolver incorrectly treating an ordinary recovery source as an unpublished preview; the scope now applies only to preview requests. Test expectations were corrected to the actual Adstudio policy (zero quality retries, one configured provider-cost ceiling). Two workflow tests passed, including detached recovery acceptance and private preview preparation. The third test then failed while inserting multiple synthetic original runs without distinct idempotency keys. The fixture is corrected and its rerun is in progress. No paid provider call or customer credit charge occurred. The latest typecheck checkpoint passed all workspaces before the fixture-only correction.

Status communicated to the user: roughly 70–75 percent of development implemented locally, explicitly an estimate rather than an acceptance score. Permanent retention/privacy execution, operational alerts/backup acceptance, historical migration, full browser/accessibility/regression acceptance and deployment remain open. The user asked for status during active work; implementation continues under the existing authorization.

## Continuation — 2026-10-28

Resumed the authorized manual planning workflow. The old local processes and restricted temporary fixture had disappeared, so a fresh local-only replica set and genuine synthetic auth/MFA fixture were created. No real account verification or security factor was fabricated.

Completed system monitoring with source/range/freshness metadata, unavailable/stale states, reviewed alert receipts and one durable monitor per minute. Added policy-gated hourly media inventory. Completed bounded historical wallet scan/review/reconciliation with snapshot fingerprints, stale-data rejection, per-user idempotent outcomes and unchanged canonical balances/ledger/accepted snapshots. Added default-retired guards to eight legacy admin edge entries; local guards are explicitly not proof of remote cutover.

Completed reviewed account erasure and reference/checksum-aware media cleanup. New real private-storage tests cover independent references, active pending copies, stale erasure approval, auth/profile/configuration anonymization, preserved financial records and expired export revocation. Transient staging/export cleanup keeps a conservative thirty-day recovery window and preserves linked support images. Production deletion policy values remain unapproved and execution remains off.

Implemented and ran the isolated encrypted restore drill: restored 31 collection/index sets and private image bytes, verified two-user project isolation and repeated charge/refund behavior, and cleaned disposable databases/objects. The recorded local restore took approximately 4.9 seconds; this does not establish production RPO/RTO, an independent failure domain or a retained production backup. Evidence is in `evidence/backup-restore-local-2026-10-28.json`.

Browser verification caught a real direct-upload failure: private-storage preflights were denied from the local and live web origins. Rather than changing bucket access, support photos now use an authenticated, origin-checked, 12 MiB-bounded API upload route followed by the same SHA/image validation and independent-copy verification. Real MongoDB/R2 tests cover upload retries, unauthorized/cross-origin rejection and private attachment isolation. The browser successfully retried the retained photo, saved a private note/attachment, and queued a customer-visible reply to a local-only SMTP sink. No real recipient was contacted.

Verified company-media import and separate approval, with unfinished form values retained through actual owner MFA step-up. Verified pinned sample choices and local draft saving in the template editor. Added tags, metadata ordering, rollback category restoration and versioned resolution limits enforced through browser/API/worker validation. Funded recovery checks now include uncertain/active prior funded attempts rather than checking only the original run.

Browser checks cover five admin surfaces at four widths in both languages/themes: 80 states, no horizontal page overflow and no unnamed visible buttons (`evidence/responsive-admin-continuation-2026-10-28.json`). Additional native keyboard focus and theme text-color inspection were performed. A stale-result UI note initially rendered outside its loop; the browser exposed the error, it was corrected, and a render regression test plus an admin section error boundary were added. This is not a full screen-reader/WCAG certification.

Final current commands, outcomes and release boundaries are recorded below after the last regression pass. Older intermediate results above are historical checkpoints, not the current test total.

## Final local acceptance checkpoint — 2026-10-28

All 1,386 distinct Vitest cases across nine workspaces were executed successfully in the combined local matrix. The default regression passed 1,272, with its 114 opt-in skips subsequently covered by real MongoDB/private R2/FFmpeg runs. Per-workspace complete totals: storage 20, contracts 16, providers 43, creative engine 202, database 22, auth 12, worker 207, API 348 and web 516. These are distinct cases, not a sum of repeated test executions.

The admin/API/private-storage selected run passed 69 tests across nine files. The remaining customer draft/guest claim/reference-library run passed 34, including real private storage reuse and unsigned-read rejection. The complete database run passed 22. The complete worker run, with MongoDB and real FFmpeg enabled, passed 207 with no skipped cases. This verifies native-audio retention/removal and exact optional English/Arabic display-layer behavior on synthetic media, not real provider speech or lip-sync quality.

All nine workspace typechecks and all nine builds passed. ESLint: zero errors, 20 existing Fast Refresh warnings. Initial JavaScript gzip size was 254,002 bytes against the 307,200-byte budget. The build retains a non-blocking >500 kB lazy admin-chunk warning. No conflict markers, unmerged paths or whitespace errors were found. Commands were scoped to disposable local databases; only private R2 fixture tests used the original environment file.

Additional browser customer check: enabled the existing library flag only in the local fixture, reused an approved product photo in Adstudio, verified that the brand/offer/closing fields stayed blank, entered exact mixed Arabic/English offer text, reloaded and verified the wording and linked photo persisted. Cleared the offer again and verified the speech approval flow without generating or approving a paid run. Company media import/approval and support notes/attachments were exercised through the real UI/API/storage path. Local-only SMTP receipts were recorded for a support notification and owner test.

A fresh read-only lookup of the configured designated account found it exists, but email remains unverified, MFA is not enrolled and owner membership is inactive/pending verification. Legacy export credentials are not configured. No production mutation was performed. Production policy values remain unapproved, and production migration/retirement verification, independent backup/restore, staging owner/screen-reader acceptance and deployment remain open. Paid provider previews and real gateway acceptance remain explicitly deferred/disabled.

Evidence and exact source hashes are in `evidence/validation-summary-2026-10-28.json`. The final local admin preview is running on port 18080 with the API on 18787, local replica set on 27029 and a synthetic-only SMTP sink on 11025. Real credentials remain outside the repository; the local preview contains synthetic fixtures only.

## Deployment preparation — 2026-10-28

The user requested deployment and directed Render access through Brave. The signed-in dashboard confirms API and Docker worker currently run baseline `b8e545a5dc2dd192831cad62e73a3554bd933669`; the API is a native Node service, not the stale Blueprint's Docker service. Actual public API is `https://movprompt-new.onrender.com`. Health confirms MongoDB, private storage and generation runtime availability. Production SMTP settings are absent. No secrets were revealed or copied from the dashboard.

Added Render-provided revision reporting with explicit COMMIT_SHA precedence, verified by four configuration tests and API typecheck. Added public CI coverage for isolated transactional MongoDB admin/security/financial/worker snapshot tests without private storage credentials or paid provider calls. Documented existing service IDs, runtime and guarded activation environment parity in `docs/runbooks/OWNER_ADMIN_RENDER.md`.

Secret-scanned 256 candidate files using Gitleaks with redacted output. Its twelve detections all correspond to source-file SHA256 values in the local acceptance manifest, verified from their exact lines; no credential finding remained. Generated Graphify cache is excluded. The local acceptance total predates the additional configuration regression test; no deployment is implied by those test results.

Render authentication is available in Brave. A protected encrypted predeployment database checkpoint is being attempted outside the public repository. The first mongodump attempt timed out during Atlas authentication; it is not recorded as a successful backup. Production backup-policy, real owner verification/MFA and actual legacy cutover remain unresolved, so additive deployment must preserve closed activation flags.

Created an AES-256-GCM encrypted production-data checkpoint using the official MongoDB Node driver after two mongodump handshake timeouts. A read-only snapshot captured all 44 collections and 4,350 records with options/indexes. Decrypted and restored to an isolated local database, compared document digests and index counts, then removed the disposable restore. The private archive/key/receipt remain outside this public repository. This is not an approved independently retained production/media backup.

The branch is pushed with PR #1. Initial remote CI exposed pre-existing pipeline drift: tests ran before shared runtime imports were built, and PostgreSQL scripts/directories referenced by CI no longer exist. Corrected CI/release packaging to match the actual MongoDB architecture, retained Docker image/Compose checks and added a real isolated replica-set job. Bounded WiredTiger cache fixed the first container startup failure; that integration job now passes. No failing check was waived.

Remote security audit identified 32 high/critical advisories in the existing lockfile. Updated affected authentication, validation, SMTP and build dependencies plus pinned transitive fixes. New local high-severity audit exits successfully; all nine builds/typechecks passed, ESLint remains zero errors/20 existing warnings, all 1,273 default regression cases passed, and the initial JavaScript budget passes at 259,907 gzip bytes. Real MongoDB/private R2/Better Auth integration is rerunning against these updated dependencies.

The existing secret-scan GitHub Action requires an unconfigured organization license. Replaced only the wrapper with pinned official open-source Gitleaks CLI, verifying its downloaded checksum and retaining a complete-history scan. The full 47-commit local scan passes. Narrow exceptions identify computed SHA256 lines in the local test manifest and one exact historical Render receipt fingerprint; no credential pattern or whole history is excluded.

The user explicitly requested email/password owner login without SMTP. Added a protected per-owner `designated-email-password` provisioning mode without altering the real `emailVerified` value. MFA/recovery enrollment and recent-factor requirements remain mandatory. Default provisioning still requires verification; no customer-facing endpoint can nominate an owner. Real Better Auth integration now exercises both policies, MFA login, recovery/replay and suspension. All 39 owner integration cases pass, including the no-SMTP policy and read-only mutation guard.

Added `ADMIN_READ_ONLY=true` for an initial inspection-only release while full backup-policy and legacy-cutover acceptance remain pending. The server rejects admin mutations before execution, except MFA assurance; identity and the bilingual UI disclose this mode. The admin operation worker remains disabled for this stage. This is a limited owner-access release, not a claim that all writable production gates have passed.

Fresh CI typechecking exposed Better Auth 1.7 client changes hidden by the local incremental web cache. Corrected the SDK session boundary for the legacy non-strict-null web configuration, supplied explicit empty SDK request/query inputs and narrowed TOTP enrollment responses. Forced fresh web/API typechecks now pass. Earlier incremental-only web typecheck is not the release evidence. A full updated API/private R2 suite passed 349 cases, DB 22 and FFmpeg/Mongo worker 207 before the additional owner-policy cases. Current full regression is being rerun after those new cases.

MongoDB CI diagnostics identified the actual intermittent startup failure as the vendor's Linux 6.19+ TCMalloc compatibility guard. Moved this job to the supported Ubuntu 22.04 kernel rather than disabling the guard. Both remote container-image builds, secret scans and high-severity dependency audits pass on the updated lockfile. The repaired application and kernel-specific integration checks are rerunning on the next commit.
