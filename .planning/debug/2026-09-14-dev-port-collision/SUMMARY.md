# Duplicate local dev startup fix

## Root cause

An existing MovPrompt development stack still owned ports 8080 and 8787. A second `bun run dev` allowed Vite to fall back to 8081, while the API crashed because port 8787 was already occupied. This produced a partial, mismatched stack.

## Changes

- Added an early required-port check to `scripts/dev.ts` for web port 8080 and the configured `API_PORT`.
- Duplicate starts now exit before the MongoDB check or child-process launch with a concise message explaining that another local stack may already be running.
- Enabled Vite `strictPort` so the web server cannot silently move away from 8080.
- Replaced `@vitejs/plugin-react-swc` with `@vitejs/plugin-react` in Vite and Vitest because the project uses no SWC plugins. This removes the Vite performance recommendation and the unused SWC compiler dependency.

## Verification

- `bun build scripts/dev.ts --target bun` passed.
- Web TypeScript check passed.
- Focused `CreatorProgress` tests passed: 2 tests.
- Production web build passed.
- A clean `bun run dev` started MongoDB, web on 8080, API on 8787, and reported authentication ready without the React SWC warning.
- A second `bun run dev` exited immediately with the new port-in-use message and did not start port 8081.
- Browser verification loaded `/create` with content, matching viewport/body width, no error overlay, and no page errors.
- API health reported MongoDB OK.

## Runtime state

One healthy local development stack remains running on ports 8080 and 8787. Changes remain local and uncommitted; nothing was pushed or deployed.
