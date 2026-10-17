# Projects cleanup and go-live review — 2026-10-01

## Delivered

- Failed “Needs attention” project cards offer an owner-checked Delete action and confirmation when there is no accepted output. Accepted video history remains protected. The card disappears after successful trashing; a server rejection leaves it visible with an error.
- Projects cards use the template page's 1/2/3/4-column breakpoints and closely matched dimensions. At 1280 px, measured template and project cards were both 283.25 px wide and approximately 440 px tall. The rendered card and confirmation flow were inspected in the signed-in browser; no project was deleted during this inspection.
- Added focused tests for failed-project deletion, accepted-output protection, unhydrated history, and deletion rejection.

## Verification

- `bun run test:all`, `bun run typecheck:workspaces`, `bun run build:all`, `bun run lint`, and `git diff --check` passed. Lint reported 20 existing Fast Refresh warnings and no errors. The Vite build reported its existing large-chunk warning.
- Live API generation availability was initially `worker_unavailable`, later `ready`, and remained `ready` in four checks ten seconds apart at 09:30 UTC. This is readiness evidence, not proof of a completed video.
- No paid generation, push, or deployment was performed for this review.

## Go-live gates

- Render web and API auto-deploy from `main`; the worker auto-deploys from `codex/ugc-worker-compatibility`. A push to `main` alone does not update all three services. While this review finished, `main` advanced to `b63b8a4` outside this task. Render subsequently showed both API and website live on that commit.
- The last authorized UGC generation reached the provider and failed because the Vercel AI Gateway balance did not meet its $10 minimum. It charged zero credits and produced no output. Funding and a new end-to-end canary are still required before claiming reliable video completion.
- A local development worker currently shares the configured Atlas database with the production worker. Avoid concurrent production canaries while it is running against that database.
- Do not infer deployment readiness solely from passing source checks.
