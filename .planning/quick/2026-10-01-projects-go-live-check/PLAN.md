# Projects cleanup and go-live review

Continue the user-authorized GSD fallback because `/gsd-quick` is unavailable. Preserve the dirty working tree and the published worker compatibility branch.

1. Show Delete project for failed generation cards only when the project has no accepted output. Reuse the existing confirmation and owner-scoped trash endpoint; verify the card does not return after refresh.
2. Match the project history card grid, width breakpoints and media proportions to the current template page while preserving playable video and readable actions.
3. Run focused UI and generation-path checks, builds, typecheck and lint. Inspect Render branch/deployment wiring and live dependency state without making a paid generation request.
4. Report deployment readiness and remaining external gates precisely. Do not push or deploy as part of this review.
