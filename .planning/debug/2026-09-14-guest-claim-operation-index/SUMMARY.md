# Guest claim operation index summary

## Cause

The selected image and local object storage were healthy. The initial MongoDB project version stored `operationKey: null`, and the unique sparse `{ userId, operationKey }` index treated null as an indexed value. A second campaign for the same user therefore failed with `E11000`, and the web recovery flow mislabeled every project-claim failure as an image failure.

## Fix

- Initial claimed versions now omit `operationKey`.
- The operation-key index is migrated to a unique partial index that only includes string keys.
- One existing explicit null operation key was removed from the local device MongoDB.
- Project-save failures and image-upload failures now have distinct English and Arabic recovery messages and actions.
- The Mongo cursor proxy lint error found by the required repository check was corrected without changing cursor behavior.

## Validation

- Local MongoDB accepted two temporary initial versions for the same user with no operation key; the fixtures were deleted afterward.
- The live index is unique with `partialFilterExpression: { operationKey: { $type: "string" } }`.
- Database: 4 files, 8 tests passed.
- API: 17 files, 127 tests passed.
- Web: 59 files, 217 tests passed.
- TypeScript checks passed for database, API, and web.
- Production web build passed.
- ESLint passed with 20 existing Fast Refresh warnings and no errors.
- The reported draft loaded without the stale error, reached final review, and displayed an enabled Generate campaign button with no browser errors.

## Delivery state

The reported draft remains open locally on the final review screen. No paid generation was submitted. Changes are local, uncommitted, and unpushed.
