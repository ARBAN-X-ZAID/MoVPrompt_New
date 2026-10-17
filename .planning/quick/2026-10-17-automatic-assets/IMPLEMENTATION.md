# Automatic template photo library

Implemented locally in the isolated release checkout on `codex/automatic-assets`. The user authorized the manual GSD planning workflow because GSD commands are unavailable. No deployment or paid generation was requested for this change.

## Behavior

- Compatible subject/product and presenter uploads automatically create one filename-named library entry per photo. Library copies never populate campaign facts, speech or display text.
- Upload buttons and drop zones use a shared My assets / Upload new picker. Direct drag-and-drop remains available. Logos, artwork, property-only roles, imports and videos retain their existing upload behavior.
- First reuse asks permission; subsequent approved reuse uses the exact current revision. Presenter permission includes same adult and likeness rights. Speaking-mode uploaded-presenter restrictions remain.
- Independent IndexedDB media survives campaign removal, draft cleanup and draft expiry. Guests can reuse within the same browser; the UI explains browser storage limits.
- A root-mounted durable queue transfers guest photos after authenticated owner verification and resumes on reload, reconnect, focus and a bounded polling interval. Account-bound media never transfers to another account. A private receipt is required before discarding the local blob.
- Upload status and retry controls appear beside photos and in My assets for pending account transfers. Library save failure does not prevent the original upload's normal generation path.
- Automatic-save receipts do not link original uploads to the library. Explicitly reused guest references upgrade to approved account references after transfer, preserving newer form edits and selection changes.

## Interfaces and persistence

- Added automatic-save request, private save receipt, save status and device record contracts.
- Added owner-scoped `POST /api/v1/reference-library/auto-save` and `GET /api/v1/reference-library/session`.
- Added an expected-owner header checked at the authenticated boundary, including verified upload content. This prevents a queued upload from using a changed browser session.
- Verified R2 copies commit through MongoDB transactions. Owner/kind transaction fences serialize automatic deduplication with library edits. Active matching checksums are reused; deleted entries are excluded.
- Device queue completion compares operation keys atomically so an older request cannot erase a newer upload of the same photo.
- Existing immutable library revisions, editable-draft reconciliation, accepted outputs and active render snapshots remain intact.

## Review

- Local working example with both reused photos: `/create?draft=a0267ee6-ddd2-406d-a65c-15f5806ee93d`.
- Guest upload/reuse/sign-in recovery example: `/create?draft=5d00798d-bdc7-4985-b089-c6b20d35c7ef`.
- Evidence is under `evidence/`. The existing feature flag controls all new flows.
