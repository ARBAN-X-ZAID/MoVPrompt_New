# MongoDB local migration summary

## Result

The active local application now uses MongoDB for Better Auth, projects, assets, guest claims, rate limits, generation quotes/runs/attempts, credit reservations and ledger state, transactional outbox delivery, worker heartbeats, and durable worker jobs.

Docker Compose runs MongoDB 8 as a single-node `rs0` replica set. The former PostgreSQL/Drizzle source, SQL migrations, pg-boss worker, PostgreSQL integration tests, bootstrap scripts, and migration utilities have been removed. MinIO remains the private S3-compatible object store and Mailpit remains the local SMTP sink.

## Configuration

- `MONGODB_URI` and `MONGODB_DATABASE` replace `DATABASE_URL` in current environment templates.
- Root `.env` remains the place for private provider keys.
- `.env.infrastructure` contains local MongoDB, MinIO, Mailpit, auth, and feature defaults.
- `bun run db:migrate` and `bun run db:check` now connect to MongoDB and create/check indexes.
- Root API, worker, and database scripts explicitly load the ignored root `.env`, so local commands use the device MongoDB URL even after changing into their workspace directories.
- The native Homebrew MongoDB service now runs at `mongodb://localhost:27017` as the `rs0` replica-set primary, matching MongoDB Compass while retaining transaction support.
- Clean-database initialization now tolerates a missing `worker_jobs` namespace before creating its indexes.
- `node .local-setup/run.mjs up` initializes the replica set before starting API and worker containers.

## Verification

- All workspace builds and TypeScript checks passed.
- MongoDB reported a writable `rs0` primary and passed an actual transaction write/delete round trip.
- API health, feature flags, Better Auth signup/session persistence, owner-scoped project reads, Mailpit delivery, and private S3 write/read/anonymous-denial checks passed.
- The worker remained running, wrote a fresh database heartbeat, and completed a durable MongoDB health job after a restart against existing local data.
- Database, auth, API, worker, contracts, storage, providers, and creative-engine tests passed.
- The repository-wide test command still reports seven failures in two unchanged web UI suites: five IndexedDB guest-recovery tests and two homepage gallery expectations. These are outside the database runtime path; the web production build and typecheck pass.
- No provider generation or paid request was made.
- The local Vercel AI Gateway key passed the read-only credit and model-readiness checks; the account currently has no available Gateway credit, so generation remains fail-closed.
- Nothing was committed or pushed.
