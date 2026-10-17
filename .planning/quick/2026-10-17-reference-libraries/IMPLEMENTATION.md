# Private reference libraries

## Flags and routes

- `FEATURE_REFERENCE_LIBRARY=true` on API and worker.
- `VITE_FEATURE_REFERENCE_LIBRARY=true` at web build time. Both web visibility and server availability must agree.
- `/assets` is account protected. `/library` retains its existing legacy redirect.
- API `/api/v1/reference-library`: status, owner listing/search, one entry, verified uploads, immutable revision save, delete, private photo read and independent campaign copies.

## Invariants

- Entries contain one to three photos. Product and presenter namespaces stay separate. Names never become product facts, dialogue or display copy.
- Every saved revision carries the customer approval policy version, revision, rights/same-subject attestations, and the adult attestation for presenters. A replacement in the editor clears approval until the customer approves again.
- Mongo stores stable private object keys. Library objects are independent of campaign objects. Immutable revision history and previous campaign copies are retained to protect historical accepted outputs.
- Upload bytes pass the existing image signature, dimensions, checksum and FFmpeg decoder. Metadata is unavailable for selection until verification and revision commit succeed.
- Save/delete operations are idempotent and revision checked. Campaign copies use deterministic identities and checksums. Interrupted copies remain pending and retry without duplicating assets.
- Library mutations atomically enqueue reconciliation jobs. The API also attempts immediate reconciliation. Jobs use the Mongo lease queue. Generation completion retries reconciliation for drafts previously protected by an active render.
- Reconciliation creates child working versions and changes only photo references, photo recipes and review state. It skips accepted working versions and active generation snapshots. Concurrent edits cause retry instead of overwriting the new working pointer.
- Device drafts reconcile on reopen, online and focus. Replacement/deletion/withdrawal requires explicit review. Existing campaign library additions use server copies rather than a second claim/project.
- Quote preflight resolves current owner approval and exact checksums. Render enqueue repeats verification under the Mongo transaction and writes a fence on each entry, serializing rendering against approval/photo changes.
- No automatic regeneration, voice storage, voice cloning, staff moderation or video extraction. Speaking-mode presenter image restrictions remain.

## Verification boundaries

Tests use isolated local replica-set databases and actual private R2 storage for upload/copy checks. Storage test objects are removed afterward. Browser QA uses a synthetic account in the existing local test database and bundled product photography. No paid generation is invoked.
