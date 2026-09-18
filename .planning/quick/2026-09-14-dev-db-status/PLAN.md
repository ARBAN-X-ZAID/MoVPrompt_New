# Dev database status

## Goal

Make `bun run dev` report whether the configured MongoDB database is reachable before starting the existing Vite development server.

## Work

1. Add a bounded MongoDB ping that reads the root `.env` and never prints credentials.
2. Keep frontend startup available when MongoDB is unavailable, while clearly reporting the failed status.
3. Verify connected and unavailable output, then confirm the normal Vite startup still runs.

## Boundaries

- Keep all changes local and unpushed.
- Do not change the existing database configuration or start additional application services.
