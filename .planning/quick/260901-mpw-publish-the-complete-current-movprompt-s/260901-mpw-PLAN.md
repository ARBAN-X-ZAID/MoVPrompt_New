---
quick_id: 260901-mpw
phase: quick-260901-mpw
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: []
files_modified:
  - .gitignore
  - .planning/STATE.md
  - .planning/quick/260821-t0i-consolidate-durable-project-continuity-b/260821-t0i-VERIFICATION.md
  - .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-PLAN.md
  - .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-SUMMARY.md
  - .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-VERIFICATION.md
must_haves:
  truths:
    - "The latest complete MovPrompt snapshot is published to https://github.com/virtuprose/Zaid-MOVPROMPT.git on main."
    - "The destination repository has main as its default branch and no other remote branches."
    - "The local checkout uses only the new destination as origin and retains only main as a local branch."
    - "All prior local branch commits are reachable from the published main commit before obsolete branches are removed."
    - "Secrets, ignored environment files, local agent runtimes, linked worktrees, and files above GitHub's size limit are not accidentally published."
    - "A fresh single-branch clone resolves to the exact published main commit and contains a clean, usable repository snapshot."
  artifacts:
    - path: .gitignore
      provides: "Explicit exclusions for local agent and workflow runtime directories."
    - path: .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-VERIFICATION.md
      provides: "Recorded GitHub, branch, secret, size, LFS, and fresh-clone publication evidence."
    - path: .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-SUMMARY.md
      provides: "Client-readable publication outcome, final commit, and repository URL."
  key_links:
    - from: local main
      to: origin/main
      via: "Git push and exact SHA equality"
      pattern: "refs/heads/main"
    - from: origin
      to: https://github.com/virtuprose/Zaid-MOVPROMPT.git
      via: "git remote get-url origin"
      pattern: "virtuprose/Zaid-MOVPROMPT.git"
    - from: fresh clone main
      to: local main
      via: "git rev-parse HEAD equality"
      pattern: "Published SHA"
---

<objective>
Publish the complete latest MovPrompt project to the new VirtuProse GitHub repository and consolidate repository history onto one authoritative `main` branch.

Purpose: Make `virtuprose/Zaid-MOVPROMPT` the sole Git remote and give the team one clean, recoverable latest branch without losing any existing product work.
Output: A secret-scanned, size-checked, LFS-complete `main`, no other local or remote branches, and fresh-clone proof.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Prepare a complete and safe publication snapshot</name>
  <files>.gitignore, .planning/quick/260821-t0i-consolidate-durable-project-continuity-b/260821-t0i-VERIFICATION.md, .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-PLAN.md</files>
  <action>Record the current HEAD and enumerate every local branch and fetched old-origin branch tip, proving each is an ancestor of HEAD before cleanup. Preserve the existing project verification artifact. Add `.claude/`, `.codex/`, and `.gsd/` to `.gitignore` because they contain local worktrees and machine-specific agent runtimes. Confirm `.env` files remain ignored. Run Gitleaks against the complete Git history, verify Git LFS objects, and calculate the largest blob reachable from every Git ref before staging. Abort publication if a secret is found, an LFS object is missing, any reachable blob is at or above GitHub's 100,000,000-byte limit, or another branch contains unmerged work.</action>
  <verify><automated>latest=$(git rev-parse HEAD) &amp;&amp; git for-each-ref --format='%(refname)' refs/heads refs/remotes/origin | while IFS= read -r ref; do case "$ref" in refs/remotes/origin/HEAD) continue;; esac; git merge-base --is-ancestor "$ref" "$latest" || exit 1; done &amp;&amp; git check-ignore -q .env .env.local .claude .codex .gsd &amp;&amp; gitleaks git --redact --no-banner . &amp;&amp; git lfs fsck &amp;&amp; max_blob=$(git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' | awk '$1 == "blob" &amp;&amp; $2 &gt; max {max=$2} END {print max+0}') &amp;&amp; test "$max_blob" -lt 100000000 &amp;&amp; git diff --check</automated></verify>
  <done>The snapshot includes all project work while excluding credentials and local runtime state, with no missing LFS content or oversized Git blob.</done>
</task>

<task type="auto">
  <name>Task 2: Promote the latest snapshot to main and publish only that branch</name>
  <files>.git metadata, GitHub repository refs</files>
  <action>Commit the prepared project snapshot. Remove the clean linked review worktree only after proving its branch is contained in HEAD. Point local `main` at the latest commit, switch to it, delete all other local branches, change `origin` to `https://github.com/virtuprose/Zaid-MOVPROMPT.git`, enumerate configured remotes and remove every exact non-origin remote, then push `main`. Set GitHub's default branch to `main`. Enumerate the destination's heads and delete any non-main remote branch by exact name. Do not push old branches or tags.</action>
  <verify><automated>test "$(git branch --show-current)" = main &amp;&amp; test "$(git remote)" = origin &amp;&amp; test "$(git remote get-url origin)" = https://github.com/virtuprose/Zaid-MOVPROMPT.git &amp;&amp; test "$(git for-each-ref --format='%(refname:short)' refs/heads | wc -l | tr -d ' ')" = 1 &amp;&amp; test "$(git ls-remote --heads origin | wc -l | tr -d ' ')" = 1 &amp;&amp; gh repo view virtuprose/Zaid-MOVPROMPT --json defaultBranchRef --jq '.defaultBranchRef.name' | grep -qx main</automated></verify>
  <done>The new GitHub repository and local checkout both have one authoritative branch named main, and origin points only to the new repository.</done>
</task>

<task type="auto">
  <name>Task 3: Verify recoverability from GitHub and record the final proof</name>
  <files>.planning/STATE.md, .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-SUMMARY.md, .planning/quick/260901-mpw-publish-the-complete-current-movprompt-s/260901-mpw-VERIFICATION.md</files>
  <action>Clone only `main` from the new repository into a fresh temporary directory, verify its HEAD equals local main, verify the clone is clean, confirm representative source, configuration, planning, public-media, and LFS-backed files exist, and run an install/build-oriented repository check appropriate to the available environment. Record exact evidence and update the GSD quick-task table. Commit and push the final publication records. Create a second new isolated single-branch clone after that final push, and repeat SHA equality, branch-count, default-branch, clean-worktree, representative-file, and LFS checks against the final remote commit.</action>
  <verify><automated>test "$(git rev-parse HEAD)" = "$(git ls-remote origin refs/heads/main | awk '{print $1}')" &amp;&amp; test -z "$(git status --porcelain)" &amp;&amp; git rev-list --left-right --count HEAD...origin/main | grep -qx '0[[:space:]]0'</automated></verify>
  <done>A fresh clone reproduces the exact final snapshot and the repository records enough proof for the new GitHub location to be the sole recovery source.</done>
</task>

</tasks>

<verification>
- [ ] Every former branch tip is reachable from the pre-cleanup latest HEAD.
- [ ] Full-history secret scan, LFS integrity, and GitHub blob-size checks pass.
- [ ] Local origin and GitHub default branch resolve to the requested repository and `main`.
- [ ] Exactly one local branch and one destination remote branch remain.
- [ ] The final local, remote, and fresh-clone commit SHAs match.
- [ ] The final local worktree is clean.
</verification>

<success_criteria>
- `https://github.com/virtuprose/Zaid-MOVPROMPT` is the only configured remote and its only branch is the latest `main`.
- No current feature or historical branch-only commit is lost.
- No ignored secret or local agent runtime is included.
- The published project is independently recoverable from a fresh clone.
</success_criteria>

<output>
After execution, create `260901-mpw-SUMMARY.md` and `260901-mpw-VERIFICATION.md` in this quick-task directory.
</output>
