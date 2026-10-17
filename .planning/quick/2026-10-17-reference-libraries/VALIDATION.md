# Local validation — 17 October 2026

- All workspace type checks passed.
- All workspace production builds passed. Existing web chunk-size advisory remains.
- Storage 18, contracts 16, providers 43, creative engine 193, database 17, auth 12, API 248 and worker 206 tests passed. Web: 452 passed, 11 skipped using `--maxWorkers=1`.
- An existing AuthFlow shared-localStorage assertion was intermittent in parallel full-suite runs. It passed individually, with the new library tests, and in the complete serial web run. No auth implementation was changed for this assertion.
- Focused library integration: 8/8 passed with a real local MongoDB replica set, existing image decoder and actual private R2. Includes anonymous storage-read denial, independent copies for two campaigns, checksum/invalid-file/owner rejection, duplicate/concurrent saves, interrupted-copy retry, strict guest claim receipt preservation, atomic render freshness gate before charge/enqueue, immutable accepted/active versions, replacement, withdrawal and deletion.
- Web library tests: 22/22 passed, including every launch photo policy, property/artwork exclusion, guest handoff, native speech restriction, draft reconciliation, exact speech/facts/message preservation and local/owned campaign distinction.
- Browser: synthetic local account uploaded and approved a bundled perfume photo, selected it in Adstudio, replaced its library photo, reopened its device draft and confirmed the review notice. Product brand, `20% off until Friday — خصم ٢٠٪` and `رسالتك فقط!` remained exact. Review confirmation removed the notice. Generation was not started.
- Browser library layout: English/Arabic × light/dark × 375/768/1024/1440 px, with no horizontal overflow. Inspected adult permission modal at 375 px and keyboard tab switching. Screenshots in `evidence/`.
- New/changed library modules pass focused ESLint. `git diff --check` passed.
- No paid video generation or provider calls were performed. Historical local accepted test output remains intact.

Final consistency hardening: canonical library provenance is retained on independent asset records. Added assertions reject stripped provenance and mismatched generation references before enqueue. Focused Mongo/R2 integration remains 8/8.

Production preview: public availability uses a credential-free request and bounded retries during backend rollout. Library buttons appear in the production-built preview. Library web checks: 24/24 passed, including public availability semantics.
