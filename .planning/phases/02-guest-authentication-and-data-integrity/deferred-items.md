# Deferred Items

- **Full web-suite locale isolation:** `bun run --cwd apps/web test` has one pre-existing order-dependent failure in `AuthGateDialog.test.tsx`: the English assertion sees Arabic after another suite leaves `movprompt-lang` state behind. The test passes in isolation and is outside Plan 02-06's files.
- **Disposable PostgreSQL verification:** `MOVPROMPT_TEST_DATABASE_URL` was not configured, so the new source-change PostgreSQL integration test remains skipped. Run it against a disposable PostgreSQL 17 database before relying on the concurrency/history proof.
