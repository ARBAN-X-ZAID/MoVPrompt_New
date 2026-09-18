# Dev database status summary

## Outcome

- `bun run dev` now pings the MongoDB URI loaded from the root `.env` before starting Vite.
- A successful ping prints `[MovPrompt] Database connected: MongoDB is ready`.
- Missing, invalid, or unreachable configuration prints `[MovPrompt] Database not connected: ...` without blocking frontend startup.
- Database credentials are not printed.

## Validation

- Confirmed the local MongoDB success message.
- Confirmed the unreachable MongoDB failure message.
- Confirmed `bun run dev` prints database status and then starts Vite successfully.
- ESLint and repository diff checks passed.
