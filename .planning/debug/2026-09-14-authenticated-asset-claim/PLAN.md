# Authenticated asset claim debug

## Symptom

After selecting an image and a product-fidelity template, Generate campaign reports that at least one saved product or reference image is required.

## Confirmed cause

An already-authenticated browser draft with an unclaimed upload has no pending generation intent. `claimGuestProject` therefore falls back to ordinary project sync, whose persistence boundary deliberately strips browser-only blobs and URLs. MongoDB receives the project versions but no private asset record and no generation reference, so generation preflight fails closed.

## Work

1. Give authenticated drafts with unclaimed media a stable pending claim intent before generation.
2. Route those drafts through the existing private upload, checksum, asset verification, and claim finalization flow.
3. Allow that claim flow to recover a same-owner project shell left by the earlier faulty sync.
4. Keep the canonical claim receipt bound to the original snapshot, then persist the private object keys in the following immutable source version.
5. Add regression tests and verify MongoDB, API, web, and the reported browser draft without invoking a paid provider render.

## Boundaries

- Keep all changes local, uncommitted, and unpushed.
- Do not deploy or submit a paid generation request.
