# Visible generation progress and errors

Implement locally under the previously approved GSD bypass. Preserve keys, provider/model configuration, saved projects and media. No push, deployment, purchases, or new paid video generation.

1. Write progress/time/error regressions first.
2. Pass canonical run timestamps through the existing generation status mapper. Show an accessible linear estimated progress bar, current server stage, elapsed duration, estimated remaining range, last successful status check, and a clear slow-generation notice. Never infer successful completion from a timer.
3. Serialize polling, stop after terminal status, ignore stale responses after navigation, and show temporary connectivity errors with safe retry. Preserve explicit provider errors and saved project state.
4. Check local readiness read-only, automated tests/typecheck/build/lint, and browser rendering at supported widths/themes/languages with a development-only status preview. Do not submit a paid generation for verification.
