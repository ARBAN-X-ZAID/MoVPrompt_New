# Debug duplicate local dev startup

## Symptom

Running `bun run dev` while MovPrompt is already active moves Vite from port 8080 to 8081, then the API crashes with `EADDRINUSE` on port 8787.

## Plan

- Confirm which processes own the required ports and stop the stale local stack.
- Add an early required-port preflight to the root development orchestrator.
- Configure Vite to treat port 8080 as required instead of selecting another port.
- Verify one normal start and one duplicate start, then leave one healthy stack running.

## Boundary

Keep changes local and uncommitted. Do not push or deploy.
