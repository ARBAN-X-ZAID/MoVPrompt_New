# MovPrompt platform

The active stack is React/Vite, Hono/Better Auth, MongoDB replica-set transactions and lease jobs, Cloudflare R2, Vercel AI Gateway, and SMTP. Render is the selected hosting platform. Local and production application media both use R2; container filesystems are temporary processing space.

See [R2 setup](R2_SETUP.md) for the exact environment fields, bucket access, publication command, guest ownership and verification limitations.

## Local operation

Use the device MongoDB replica set configured in the untracked root `.env`, or start the isolated Compose database and Mailpit with `bun run dev:services`. Do not start a second database on an occupied port. `bun run dev` starts web (8080), API (8787), and the durable worker; it reports database connectivity and refuses duplicate occupied ports.

Fill R2 settings, run `bun run storage:check`, publish reviewed demos with `bun run storage:publish-templates`, then restart. No local media fallback exists. Without R2 configuration the API keeps authentication available, advertises storage as unavailable, and generation stays disabled. Gateway credentials must also be funded.

## Ownership and media

Guests receive opaque HttpOnly cookies backed by native MongoDB ObjectId records. Uploads and jobs use the same owner-scoped repositories as account projects. Successful generation stores a private clean master and separate watermarked preview. Sign-in idempotently claims completed guest projects; only an authenticated owner can download the master. MongoDB stores stable object keys, never signed URLs.

Unclaimed media expires after seven days. Cleanup locks ownership before deletion and skips active jobs. Claimed media remains until user deletion, followed by the seven-day trash recovery period. Existing former storage files and volumes are not migrated or deleted automatically.

## Validation

Run `bun run test:all`, `bun run typecheck`, `bun run lint`, and `bun run build:workspaces`. Dedicated Mongo integration tests require `MOVPROMPT_TEST_MONGO=true` and use disposable databases. Live R2, SMTP and funded Gateway evidence is still required before claiming production readiness. No deployment is performed by these commands.
