# Canonical MongoDB ObjectId schema summary

## Outcome

- Cleared the authorized local `movprompt` development database, rebuilt indexes, and reseeded 50 templates with 50 published template versions.
- MongoDB documents now use native `_id: ObjectId(...)` as their only persisted top-level primary identifier. No active collection stores a duplicate top-level `id` field.
- Direct entity references such as `userId`, `projectId`, `templateId`, and `templateVersionId` are stored as native ObjectIds.
- Application and API code continues to work with 24-character hexadecimal strings at its boundaries, while the MongoDB adapter translates those values to and from BSON ObjectIds.
- Better Auth, creator repositories, generation records, worker queue records, and deterministic template seeds all use the same ObjectId persistence rule.
- Kept browser draft UUIDs compatible because they are idempotency keys rather than persisted entity primary keys.

## Verification

- Full automated suite: 491 passed, 2 intentionally skipped.
- TypeScript checks: every workspace passed.
- Production builds: every workspace and the web application passed. Vite retains its existing large-chunk advisory warning.
- Live API flow: disposable email signup returned 200, a template-backed draft claim returned 201, and both returned 24-character ObjectId strings.
- Raw database inspection after the live flow confirmed native ObjectIds and no top-level `id` fields in auth, project, version, entitlement, account, session, credit, and template collections.
- Removed all 3 disposable QA users and 17 related records after verification.
- Final database audit: 0 invalid collections, 0 disposable QA users; remaining nonempty collections are 50 templates, 50 template versions, and service heartbeats, all with native ObjectId `_id` values.
- API health: `/healthz` and `/api/v1/health` returned `status: ok`; MongoDB reported `status: ok`.
- Browser: `/templates` loaded after a fresh reload with template cards present and no console warnings or errors.
- Graphify code-only map refreshed: 5,131 nodes, 12,624 edges, and 319 communities.

## Boundaries

- No Git commit or push was created.
- No deployment, publication, or paid generation was triggered.
