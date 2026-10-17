# Local validation

## Automated checks

- Full web suite: 80 files passed, 469 tests passed, 11 skipped. Run with the existing development-free-generation flag required by the account-menu fixture.
- Final focused rerun: 52/52 passed across six files, including the additional device-transfer race regression, approval migration boundaries and stale receipt protection.
- API: all 27 files / 251 tests passed with real local MongoDB enabled. Private R2 reference integration was enabled.
- Focused reference integration rerun: 9/9 passed, including verified independent R2 copies, owner isolation, invalid checksums/files, idempotency, simultaneous first saves, deletion/re-upload, preserved accepted/running snapshots and zero billing/outbox side effects for invalid references.
- Worker unit suite: 188 passed, 18 skipped (optional integration gates were off for this invocation).
- Web/API/worker type checks and builds passed. Scoped ESLint and diff whitespace checks passed. Web build retains the existing analytics chunk size warning.
- The initial ungated API run exposed an existing skipped-suite constructor requiring an unset Mongo URI; the fixture now uses a local default and the gated real integration run passed. Upload-control tests were updated for the intentionally replaced interface.

## Rendered local browser checks

- Uploaded a product in a regular template, left without generating, and saw its automatically saved, unapproved entry in My assets.
- Reused that photo in Adstudio, confirmed first-use approval, and verified the exact entered English/Arabic offer and closing text remained unchanged.
- Uploaded a presenter, left without generating, and reused it in another Adstudio campaign with speech disabled. Both photos and permissions survived reload.
- Signed out and verified account-library photos were absent from the guest library.
- Uploaded as a guest, removed the photo from its original campaign, and reused the device photo in a different template without another upload.
- Signed in through the restored draft URL and verified the photo changed from browser-only storage to Saved to My assets while the campaign returned correctly.
- Inspected the picker at 375, 768, 1024 and 1440 widths in English/Arabic and light/dark: 16 layouts, no horizontal overflow. Captured representative screenshots and layout measurements.
- Verified keyboard arrow navigation between My assets and Upload new. Arabic dialogs use a localized close label and place the close control away from the title.

## Limits

- No paid provider generation, production customer writes, deployment or live acceptance was performed.
- Browser-only photos remain subject to browser storage clearing and quota. Account copies remain private.
- The rollout uses the existing reference-library feature flag; flags default off in deployment examples.
