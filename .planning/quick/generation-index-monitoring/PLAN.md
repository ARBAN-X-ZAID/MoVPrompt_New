# Generation index repair and monitoring

The approved GSD bypass continues. All changes stay local.

1. Stop the user's stuck application job. Do not resubmit it. Its prior Gateway response was not saved, so remote cancellation cannot be confirmed without that tracking information.
2. Add regressions before implementation: migrate incorrect runId indexes, enforce uniqueness on renderRunId/attemptNumber, accept multiple runs, retain provider identity across attempt-record failures, surface retries/terminal errors, and emit correlated stage logs without secrets.
3. Repair indexes idempotently at startup, preflight the attempt before provider submission, and persist provider identity independently before dependent transactions. Fix retry/error reporting and bounded terminal recovery.
4. Add safe request/job/run/worker-correlated logs covering configuration, queue, provider submission/status, processing, R2 and quality completion. Document how to monitor bun run dev.
5. Run automated MongoDB and worker regressions and browser checks. Then run exactly one new real App/Service generation using /Users/arbaanq/Downloads/s24U.jpg, inspect the saved video and download. Do not perform extra paid smoke tests or generate new demos.
