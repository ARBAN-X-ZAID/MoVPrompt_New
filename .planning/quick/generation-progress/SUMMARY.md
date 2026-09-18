# Generation progress delivery

Implemented locally under the previously approved GSD bypass.

- Added an accessible linear estimated percentage, canonical saved-job elapsed time updated each second, estimated remaining range, current processing stage, last successful status-check age, and a slow-generation notice. Only a server-confirmed ready video reaches 100%; timers never manufacture completion.
- Serialized status requests, ignored responses after navigation, stopped polling on terminal outcomes, and retained visible generation and cancellation errors with recovery controls. Temporary connection errors freeze the estimated percentage while keeping elapsed time and retry available. Saved campaigns remain intact.
- Passed run timestamps through the existing API mapper. Added a development-only simulated progress preview without provider submission.

Validation:

- Full web suite: 253 tests passed across 66 files, including elapsed-time restoration, non-overlapping polling, retry, terminal errors, cancellation failure, and Arabic accessibility regressions.
- Web typecheck, build, targeted ESLint, and git diff whitespace check passed. Build retains the existing large-chunk warning.
- Read-only local health checks returned MongoDB, R2 storage and generation runtime ready.
- Browser preview checked connection failure/retry, terminal failure, ready at 100%, elapsed timing, and delay messaging. Progress, timing and error elements remained visible and horizontally contained with no page overflow at 375, 768, 1024 and 1440 pixels in English/Arabic and light/dark modes. Arabic dark mobile layout was visually inspected. Temporary browser overrides were reset and the QA tab closed.

No fresh paid generation was submitted during this task; health readiness and simulated UI checks do not guarantee a new provider attempt succeeds. No credentials, existing projects or stored media were changed. No commit, push or deployment performed.
