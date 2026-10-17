# GitHub main synchronization

- Merged the five incoming `origin/main` commits with local commit `14fea86` without rewriting either history.
- Reconciled overlapping Ad Studio, UGC, catalog, display-copy, reference-library, API, and worker code. Kept the local Product With Model Ad layout while enabling the incoming library-photo controls and previews.
- Fixed a new MongoDB integration test so it can be collected when its opt-in database environment is absent; it remains skipped unless `MOVPROMPT_TEST_MONGO=true`.
- Verified workspace tests, type checks, lint, and builds. Lint has existing Fast Refresh warnings but no errors; the web build reports a chunk-size advisory.
- Pushed the resulting merge commit to `origin/main` and verified remote/local commit identity.

No manual Render deployment or paid video generation was performed.
