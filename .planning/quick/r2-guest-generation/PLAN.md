# R2-only storage and guest generation

Approved by user; explicit GSD bypass approved on 2026-09-15. Local edits only, no commit, deployment, purchases, or deletion of existing media/volumes.

1. Tests first: R2 configuration validation, private signed media, guest authorization/claiming/quota, watermark isolation, retention and frontend recovery.
2. Replace generic storage configuration with R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ASSETS_BUCKET, R2_OUTPUTS_BUCKET, R2_TEMPLATE_PREVIEWS_BUCKET, R2_TEMPLATE_PREVIEWS_BASE_URL. Leave values empty. Derive endpoint and region; remove MinIO runtime and alternate providers. Preserve other credentials.
3. Guest sessions and owner-scoped uploads/jobs; one successful guest generation per rolling day (session and HMAC IP), bounded retries and global cost ceiling; local development quota bypass. Generate private master plus watermarked preview. Require real account for clean download; idempotently claim guest projects at sign-in. Seven-day expiry and race-safe media cleanup.
4. Five launch template demos in R2, no bundled runtime fallback. Complete App/Service and Salon demos. SMTP email; remove Azure narration settings and unavailable UI.
5. Typecheck, workspace tests, browser English/Arabic light/dark at 375/768/1024/1440. Live R2 tests await credentials, paid generation tests await credits and explicit authorization.

Acceptance: browser -> API -> MongoDB -> worker -> Gateway -> R2 -> clean authenticated download. Report incomplete or credential-dependent checks honestly.

## Progress

Local implementation and verification recorded in [SUMMARY.md](SUMMARY.md). R2/Gateway/SMTP deployment acceptance remains pending external configuration and explicitly authorized funded tests. No production-ready claim is made.
