# MongoDB local migration

## Goal

Run the MovPrompt development stack entirely on MongoDB, including authentication, application data, transactional generation state, rate limits, heartbeats, outbox delivery, and durable worker jobs.

## Execution

1. Add a MongoDB client, typed collection access, indexes, and transaction helper in `@movprompt/db`.
2. Move Better Auth from the Drizzle PostgreSQL adapter to its MongoDB adapter.
3. Replace API repositories and PostgreSQL rate-limit function with MongoDB operations.
4. Replace pg-boss and the PostgreSQL outbox lease with MongoDB job and outbox leases.
5. Replace the local PostgreSQL Compose service with a single-node MongoDB replica set and initialize it before API/worker startup.
6. Change environment templates and local setup scripts to `MONGODB_URI` and `MONGODB_DATABASE`.
7. Build, test, start the local stack, and verify auth/API/worker data in MongoDB.

## Safety and invariants

- Preserve UUID string IDs and public API payloads.
- Keep owner filters on every authenticated query.
- Use MongoDB transactions for billing, idempotency, and outbox writes.
- Use unique indexes for operation keys and idempotency keys.
- Do not send generation requests or spend provider balance during migration verification.
- Do not commit or push any changes.
