# Automatic assets: local completion

Implemented the approved automatic photo-saving and shared upload-picker plan in the isolated checkout. The user approved the manual GSD workflow.

- Product/presenter photos save without generating or manually saving a library entry.
- Upload opens My assets / Upload new. First reuse requires approval.
- Guest device storage survives draft cleanup, migrates after owner verification, and supports interrupted-save recovery.
- Existing campaign copy, presenter speech restrictions, immutable accepted outputs and running snapshots remain protected.
- Web full suite: 469 passed / 11 skipped; final focused suite: 52 passed. API: 251 passed, including local Mongo/private R2 checks. Worker units: 188 passed / 18 optional skips. Types, builds and scoped lint passed.
- Browser: account and guest upload/reuse, first approval, sign-in recovery and 16 locale/theme/viewport layouts checked.

See IMPLEMENTATION.md, VALIDATION.md and evidence/ for details. No deployment or paid generation was performed.
