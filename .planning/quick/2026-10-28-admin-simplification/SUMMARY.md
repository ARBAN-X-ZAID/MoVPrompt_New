# Simplified owner admin

The user confirmed simplification of the entire admin panel. Navigation now has 10 sections instead of 19. Overview shows six essential metrics and two summaries. Settings focuses on owner authentication and sessions. Advanced module URLs redirect to the overview, and template detail/editor URLs redirect to the template list.

Templates have only search, pagination and Enable/Disable controls. The existing audited, revision-checked publication-state API preserves template versions, duration recipes, quotes and customer campaign snapshots. Production inspection mode continues to disable mutations. No production customer records or template availability were changed during validation.

## Local evidence

- Web regression: 90 files, 523 tests passed.
- Real local MongoDB admin integration: 40 tests passed, including duplicate disable requests, stale revision rejection, catalog visibility, startup preservation and restoring the unchanged published version.
- Fresh web typecheck, API typecheck, production web build and bundle budget passed. Initial bundle gzip 259,840 bytes under 307,200.
- Lint: zero errors, 20 existing warnings.
- Browser: synthetic local owner was required to reconfirm MFA, then disabled and re-enabled Premium Phone Reveal successfully. No paid generation.
- English light and Arabic dark layouts visually inspected. Template page has no horizontal overflow at 375, 768, 1024 and 1440 pixels. Overview has six metrics, and Settings displays owner security controls only.

## Release boundary

The earlier admin release is live on Render. This follow-up must pass CI and be verified on the website, API and worker after merge. Production remains read-only pending the previously documented independent backup/retention and activation requirements. SMTP is not required for the designated owner's protected email/password login; authenticator MFA is still required.
