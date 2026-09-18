# Publish launch templates on API Mongo readiness

The previously approved GSD bypass applies. Keep secrets out of the repo.

Live `GET /api/v1/templates` returns `[]`. Campaign setup then calls `GET /api/v1/templates/:slug`, gets 404, and fail-closes with “Could not load this template’s supported settings.”

1. Run the same launch-catalog upsert as `db:migrate` when the API first connects to Mongo (once per process, not on every health poll).
2. Keep fail-closed UI. Do not fall back to bundled settings when the published catalog is missing.
3. Cover with a unit assertion that readiness uses the catalog helper, or reuse the existing catalog document tests if a helper is extracted.
