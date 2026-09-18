# Canonical MongoDB ObjectId schema

## Goal

Use MongoDB's native `_id: ObjectId(...)` as the single primary identifier for authentication and active domain collections. Remove separately persisted top-level UUID `id` fields, store entity references as ObjectIds, and continue exposing 24-character hexadecimal identifiers at API boundaries.

## Work

1. Add failing persistence and contract tests for ObjectId identifiers and absence of duplicate top-level `id` fields.
2. Convert Better Auth from BSON UUID identifiers to native ObjectIds.
3. Convert active MongoDB repositories, template seeding, generation records, queue records, and reference filters to native ObjectIds.
4. Update public contracts and browser-generated identifiers to use 24-character ObjectId strings where they represent persisted entities.
5. Clear the explicitly authorized local database, rebuild indexes, and reseed the template catalog.
6. Run the complete tests, type checks, builds, API health, signup, and persisted document-shape checks.

## Boundaries

- Local development database data may be deleted as explicitly requested.
- Keep changes local and uncommitted.
- Do not push, deploy, publish, or trigger paid generation.
