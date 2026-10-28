# Existing Render service rollout

This is the existing production deployment, inspected on 2026-10-28. Do not apply the historical `render.yaml` as a new Blueprint: its `*-zaid` service names and Frankfurt region do not describe these Ohio services.

| Component | Existing service ID | Runtime / public origin |
| --- | --- | --- |
| Web | `srv-damkknad0e5s73fqd4og` | Static site, `https://website-xrha.onrender.com` |
| API | `srv-damjap142hec739bbqt0` | Native Node, `https://movprompt-new.onrender.com` |
| Video/admin worker | `srv-dap961dg1s2s739skva0` | Docker, `Dockerfile.worker` |

All services must use the same reviewed Git commit. Existing customer flags, pricing and credentials must be preserved. Never copy local `.env` wholesale into Render or enable free generation as a deployment workaround.

## Code deployment before activation

1. Run local checks and the branch CI, including the isolated MongoDB admin job. Private R2 and paid provider tests are not run by public CI.
2. Record a private database backup and the currently deployed revisions. Do not put backups, account data or credentials in this public repository or public CI artifacts. This checkpoint does not establish the approved independent production backup/retention policy.
3. Deploy API and worker from the reviewed commit, then the static web build. The API keeps its existing native build/start commands. The worker Docker CMD now runs `node scripts/start-workers.mjs`; leave its Render Docker Command override empty.
4. Start with `FEATURE_OWNER_ADMIN=false` on API/worker and `VITE_FEATURE_OWNER_ADMIN=false` in the web build. For the approved inspection-only release, enable the API/web flags with `ADMIN_READ_ONLY=true` and leave the admin worker flag false. Full write activation still requires the gates in `OWNER_ADMIN_RELEASE.md`. Leave customer managed-template, communications and versioned-pricing rollout flags unchanged/off until their coordinated rollout.
5. Verify actual Render deploy success for all three services, dependency readiness in `/api/v1/health`, and `/api/v1/version`. The API uses Render's `RENDER_GIT_COMMIT` when no explicit `COMMIT_SHA` is supplied. Verify public forms still load and unauthenticated admin requests disclose no data.

## Activation environment parity

Before activating the admin process, configure these through the existing private deployment environment:

| Setting | Required behavior |
| --- | --- |
| `FEATURE_OWNER_ADMIN` | Enable together on API and worker only after the release gates pass |
| `VITE_FEATURE_OWNER_ADMIN` | Rebuild web with true for the approved activation |
| `FEATURE_AUTHENTICATION` | True on API and admin worker |
| `FEATURE_ASSETS` | True on API and admin worker for private support/media operations |
| `MONGODB_URI`, `MONGODB_DATABASE` | Same production database on API and worker |
| `BETTER_AUTH_SECRET` | Same existing private secret on API and admin worker; never rotate incidentally |
| `BETTER_AUTH_URL` | `https://movprompt-new.onrender.com` on API and admin worker |
| `BETTER_AUTH_TRUSTED_ORIGINS`, `WEB_ORIGIN`, `PUBLIC_APP_URL` | Include/use `https://website-xrha.onrender.com` as applicable |
| `R2_*` | Same existing private storage configuration and bucket roles |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Real transactional sender; production localhost/Mailpit is not a delivery service |
| `ADMIN_BACKUP_*` and retention-policy values | Owner-approved values and reference, with actual independent backup/restore evidence |

The worker reuses the authenticated API runtime to execute durable operations. Enabling it with only the video-worker environment is insufficient. Do not export or expose private API values in terminal output, screenshots or repository files.

Keep `ADMIN_REFUNDS_ENABLED`, `ADMIN_REFUND_ACCEPTANCE_VERIFIED`, `ADMIN_BUSINESS_RENDERS_ENABLED`, `ADMIN_BUSINESS_COST_ACCEPTANCE_VERIFIED` and `ADMIN_RETENTION_EXECUTION_ENABLED` false. Do not enable purchase-allocation reconciliation, publishing, pricing or promotional delivery incidentally.

The designated owner account is provisioned independently of the web build. Default provisioning requires a genuine verification link. The owner explicitly requested no SMTP on 2026-10-28: protected provisioning may use `--allow-unverified-email-login` for only that nominated account, while retaining `emailVerified=false` and mandatory authenticator/recovery enrollment. No deployment script may fabricate verification/MFA flags. Eight Supabase retirement guards and legacy database write restrictions require separate verified cutover; a Render deployment cannot establish that outcome.
