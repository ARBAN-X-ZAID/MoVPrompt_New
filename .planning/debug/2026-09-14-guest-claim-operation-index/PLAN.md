# Guest claim operation index debug

## Symptom

Generating a restored campaign after selecting an image reports that the image could not be secured, although local object storage is healthy.

## Confirmed cause

The first project version stores `operationKey: null`. The unique sparse MongoDB index on `{ userId, operationKey }` indexes explicit null values, so a user's second claimed campaign collides with the first one. The web flow then presents the database failure as an asset security failure.

## Work

1. Replace the sparse unique index with a partial unique index that only indexes string operation keys.
2. Omit `operationKey` on initial claimed versions and migrate existing null values locally.
3. Correct claim recovery copy so project claim failures are not presented as image failures.
4. Add regression coverage and run the focused database, API, and web checks.
5. Verify the local MongoDB index and restored draft in the browser without submitting a paid generation.

## Boundaries

- Keep changes local and uncommitted.
- Do not push, deploy, or invoke a paid generation provider.
