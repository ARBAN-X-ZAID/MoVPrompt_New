# Authenticated asset claim summary

## Cause

The browser contained the selected upload, but an already-authenticated draft had no pending claim intent. Generation therefore used ordinary project sync, which correctly removed browser-only blobs at the database boundary. MongoDB received project versions with no private asset record and no generation reference, and product-fidelity preflight stopped the render.

## Fix

- Signed-in drafts with browser-only media now receive one stable, resumable claim intent before generation.
- They use the existing checksum, private upload, verification, and claim-finalization path.
- A same-owner MongoDB project shell left by the earlier failed flow is reused safely and receives the next immutable version.
- The claim receipt now exposes only the public project-version fields and preserves the exact claimed configuration for browser verification.
- Asset and generic claim retries both return through the repaired claim path.

## Validation

- Added two authenticated claim preparation tests.
- Live local MongoDB integration proved reuse of an existing project, next version number 2, version count 2, one persisted project asset, and an exact canonical receipt configuration; temporary fixtures were removed.
- Database: 4 files, 8 tests passed.
- API: 17 files, 127 tests passed.
- Web: 60 files, 219 tests passed.
- TypeScript, production web build, and ESLint passed; ESLint retains 20 existing Fast Refresh warnings and no errors.
- The reported draft was reopened with its image and campaign settings restored and no browser errors.

## Delivery state

No provider generation was submitted. The reported draft remains open locally. Changes are local, uncommitted, and unpushed.
