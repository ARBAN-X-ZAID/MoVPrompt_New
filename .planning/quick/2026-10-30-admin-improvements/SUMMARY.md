# Admin simplification — local implementation and release preparation

Completed locally on 2026-10-30. Production has not been changed by this work.

## Implemented
- Overview: six metrics, readable processing/failure summaries, one updated timestamp, layout-specific skeletons.
- Customers: basic profile, Active/Inactive controls, inline keyboard-accessible tabs, shared wallet labels, full history pagination, source-linked refunds, projects/video previews, generations, product/presenter assets and support.
- Templates: approved thumbnails/previews, table/mobile rows and detail view. Whole-template and existing-duration availability use confirmation dialogs, optimistic revision checks and idempotency. Customer forms and quote/submission reject disabled lengths without rewriting drafts or recipes.
- Payments: customer search, status/pagination and Kuwait today/week/month/custom boundaries, with confirmed collection/refund totals across all matching records.
- Support: issue/replies/private notes, linked customer/source, independent simple status updates. Settings: account/preferences and sign out.
- Authentication: protected designated-owner password-only migration and rollback, five-minute session-bound password confirmation, daily-renewed 60-day sessions, durable per-identifier ten-failure/five-minute lockout. Expired password-check leases fail closed. Existing owner membership, read-only protection and unrelated customer MFA are retained.
- Shared typed summary, customer-tab and payment responses exclude unrestricted record objects from the new customer views.

## Validation
- Web: **535 tests passed** across 94 files. Includes customer pagination, duration controls, failed-save retry keys, password-only confirmation and gated/idempotent refund UI.
- API full suite with one worker: **327 passed, 34 environment-gated tests skipped** across 39 files. Real local MongoDB and private R2 enabled. Includes financial concurrency/idempotency, private media access, storage copying, support attachments, template snapshots and existing inactivation protection.
- Additional final edge suite: **8 passed** with real MongoDB and Better Auth. Includes actual known/unknown-email attempts 1–10, cooldown, concurrent checks, lost-lease rejection, migration/rollback, renewal beyond 59 days, sign-out invalidation, expired confirmation, complete wallet pagination, payment totals and immutable duration policy.
- All workspace/web type checks passed. All packages, API, worker and web production builds passed. Lint: zero errors, 20 pre-existing Fast Refresh warnings. `git diff --check` clean.
- Browser: password-only local login and password confirmation, whole-template disable/restore without codes, duration disable/restore and customer-catalog projection, real playable 8-second preview, populated two-page wallet, customer-tab keyboard arrows/Home, support detail/status save, payment search/inclusive custom dates and settings.
- **96 responsive layout checks**: six pages × four widths (375, 768, 1024, 1440) × English/Arabic × light/dark. No horizontal overflow or rendered error alerts. Screenshots visually inspected for desktop tables/customer overview and Arabic mobile dark layout.
- Lighthouse on six authenticated production-build pages: **100 accessibility / 100 best practices / 79 performance**, with zero layout shift and zero blocking time. This is a local, uncompressed static-server simulation, not production performance. Shared fonts/bundles keep simulated LCP above the 2.5-second target. No claim of a full manual screen-reader certification or live performance validation.

The first unrestricted parallel API run hit I/O/hook timeouts. It passed after limiting the run to one worker and using 30-second database/storage timeouts. Initial UI-test failures were outdated text/selector expectations and were corrected before the final all-green run.

## Local review
- Web: http://127.0.0.1:18080/admin
- API: http://127.0.0.1:18787
- Synthetic demo customer: `Demo perfume shop` / `shop.demo@example.test` — 31 local ledger entries, one explicitly labeled demo purchase and a resolved demonstration support case. These are local fixtures, not gateway transactions.
- Private owner credentials remain in the existing local fixture file and were not added to repository files.
- Temporary authenticated Lighthouse proxy was stopped after auditing. Normal local admin requires sign-in.

## Release
Follow `docs/runbooks/OWNER_ADMIN_RELEASE.md` for compatible API/web rollout, protected owner migration, fresh login and rollback. Rebuild web with production configuration; the audit build used a loopback API origin.

Production owner migration, writable activation, independent backup/retention approval, live refund acceptance and paid generation remain outside this local release. Existing production/read-only and cash-refund gates remain intact. No live refunds, paid renders, customer emails, production data changes or deployment were performed.
