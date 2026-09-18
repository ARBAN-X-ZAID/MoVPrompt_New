---
phase: 04
slug: durable-generation-and-accepted-quality
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-21
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 plus disposable PostgreSQL 17 and real FFmpeg/FFprobe fixtures |
| **Config file** | `apps/worker/vitest.config.ts`, `apps/api/vitest.config.ts`, and workspace equivalents |
| **Quick run command** | `bun run --cwd apps/worker test --run src/render-lifecycle.test.ts src/output-persister.test.ts src/output-quality-reviewer.test.ts src/media-quality-analyzers.test.ts` |
| **Full suite command** | `bun run test:all && bun run typecheck && bun run build:all` plus the Phase 04 disposable-PostgreSQL suite |
| **Estimated runtime** | ~60 seconds without external provider calls |

---

## Sampling Rate

- **After every task commit:** Run the affected focused Vitest files; never call a paid provider from an automated test.
- **Commit discipline:** Stage and commit only the current task's files; never combine frontend/API and worker/database changes in one task commit.
- **After every plan wave:** Run the worker/provider/API focused suite and relevant disposable-PostgreSQL integration tests.
- **Before `$gsd-verify-work`:** Full suite, full typecheck/build, media fixtures, PostgreSQL concurrency proof, browser evidence, and one separately authorized real canary must be green.
- **Max feedback latency:** 120 seconds for automated non-provider gates.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | GEN-05 | T-04-01 | Same persisted provider operation resumes; uncertainty never resubmits | provider/worker unit | `bun run --cwd packages/providers test --run src/vercel-gateway-seedance.test.ts && bun run --cwd apps/worker test --run src/render-lifecycle.test.ts` | ✅ existing tests; task extends | ⬜ pending |
| 04-01-02 | 01 | 1 | GEN-06, GEN-07 | T-04-02, T-04-06 | Exact-host, DNS-pinned, bounded acquisition writes a private object, then the final normalized owned object passes immutable quote checks, FFprobe and full decode before visual review | worker acquisition/media fixture | `MOVPROMPT_TEST_FFMPEG=true bun run --cwd apps/worker test --run src/output-persister.test.ts src/media-quality-analyzers.test.ts && bun run --cwd apps/worker test --run src/render-lifecycle.test.ts` | ❌ W0 final-object fixtures; ✅ acquisition tests exist | ⬜ pending |
| 04-01-03 | 01 | 1 | Supporting control; final GEN-12/GEN-14 proof is in 04-03-01/02 | T-04-03, T-04-04 | Persisted public progress/cancellation contract and fixture/log allowlist are established; creates `scripts/verify-phase4-redaction.ts` and browser state evidence | API/web/redaction/browser | `bun run --cwd apps/api test --run src/generation-service.test.ts && bun run --cwd apps/web test --run src/features/create/GoldenPathStates.test.tsx && bun scripts/verify-phase4-redaction.ts` | ❌ W0 redaction verifier; ✅ UI test exists | ⬜ pending |
| 04-02-01 | 02 | 2 | GEN-08 supporting calibration | T-04-07, T-04-08, T-04-10 | Automation builds the checksum-bound candidate manifest and validates imported human labels, reviewer independence/roles, adjudication, approval, metrics, thresholds and exact versions without fabricating reviewer evidence | worker calibration schema/metrics | `bun run --cwd apps/worker test --run src/benchmark-manifest.test.ts` | ❌ W0 candidate manifest/import validator | ⬜ pending |
| 04-02-02 | 02 | 2 | GEN-08, GEN-09 | T-04-07, T-04-09 | Runtime acceptance is fail-closed unless a validated human-attested approved artifact matches exact checksums/versions; one quote permits at most two same-config retries and one customer result | worker reviewer/lifecycle | `bun run --cwd apps/worker test --run src/output-quality-reviewer.test.ts src/render-lifecycle.test.ts && bun run eval:phase04` | ✅ existing tests; task extends attestation/approval cases | ⬜ pending |
| 04-02-03 | 02 | 2 | GEN-08 human calibration gate | T-04-07, T-04-10 | Two independent qualified-human labels per candidate, role attestations, adjudication, candidate checksums, versions and approval record produce kappa/Spearman thresholds with zero critical false accepts | blocking human checkpoint | Human reviewers complete/lock labels and adjudication; importer then runs `bun run --cwd apps/worker test --run src/benchmark-manifest.test.ts && bun run eval:phase04` | ❌ human labels/attestations/adjudication/approval record | ⬜ pending |
| 04-03-01 | 03 | 3 | GEN-10, GEN-11, GEN-12 | T-04-11, T-04-12, T-04-16 | Disposable-PostgreSQL races settle exactly once, preserve previous success and prove pre/post-acceptance cancellation truth; runbook contains exact isolated PostgreSQL 17 provision/migrate/test/teardown and CI service contract | PostgreSQL/worker/runbook | `test -n "$MOVPROMPT_TEST_DATABASE_URL" && DATABASE_URL_DIRECT="$MOVPROMPT_TEST_DATABASE_URL" bun run db:migrate && DATABASE_URL="$MOVPROMPT_TEST_DATABASE_URL" DATABASE_URL_DIRECT="$MOVPROMPT_TEST_DATABASE_URL" bun run db:check && MOVPROMPT_TEST_DATABASE_URL="$MOVPROMPT_TEST_DATABASE_URL" bun run --cwd packages/db test --run test/generation-service.postgres.test.ts && bun run --cwd apps/worker test --run src/render-lifecycle.test.ts && test -s docs/runbooks/PHASE4_PAID_CANARY.md && rg -q "movprompt-phase4-pg17" docs/runbooks/PHASE4_PAID_CANARY.md && rg -q "postgres:17-alpine" docs/runbooks/PHASE4_PAID_CANARY.md && rg -q "docker stop" docs/runbooks/PHASE4_PAID_CANARY.md` | ❌ W0 race fixtures/runbook | ⬜ pending |
| 04-03-02 | 03 | 3 | GEN-13, GEN-14 | T-04-13, T-04-14 | Owner-only output refresh, expired access, redacted API/cache/log data and complete CreateStudio browser matrix; expands redaction verifier then runs final non-billable eval after all tests exist | API/storage/web/redaction/browser | `bun run --cwd apps/api test --run src/generation.test.ts && bun run --cwd apps/web test --run src/features/create/GoldenPathStates.test.tsx && bun scripts/verify-phase4-redaction.ts && bun run eval:phase04` | ❌ W0 output-refresh/redaction cases; ✅ UI test exists | ⬜ pending |
| 04-03-03 | 03 | 3 | Full GEN-05–GEN-14 canary gate | T-04-14, T-04-15 | Separately approved Task 04-02-03 human calibration is required before submission and acceptance; one separately authorized canary proves the complete same-operation/private-media/quality/settlement path and cannot substitute for calibration | documented blocking paid checkpoint | Dependency: approved 04-02-03 + completed 04-03-01 runbook + explicit current budget authorization; after evidence run `bun run eval:phase04 && bun run test:all && bun run typecheck && bun run build:all && bun scripts/verify-phase4-redaction.ts` | ❌ W0 runbook/human calibration/canary evidence | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **04-01-03:** create `scripts/verify-phase4-redaction.ts`; verify allowlisted API, browser-cache, log, runbook and evidence fixtures with `bun scripts/verify-phase4-redaction.ts`.
- [ ] **04-01-02:** add deterministic final normalized private-object fixtures for FFprobe and full decode, including real 4:5, corrupt/truncated, codec/canvas/duration/audio failures; verify with the `MOVPROMPT_TEST_FFMPEG=true` command above.
- [ ] **04-02-01:** create the checksum-bound candidate-only `kw-video-48-v1.json` plus strict human-evidence importer/schema/metrics/threshold/approval validator; automation must not create reviewer labels, adjudication, role attestations, approval records, or a production calibration artifact.
- [ ] **04-02-02:** add reviewer/readiness tests proving missing, unattested, unapproved, stale, failed, checksum/version-mismatched, or threshold-missing calibration cannot return accepted; include them in `eval:phase04`.
- [ ] **04-02-03:** two independent qualified humans label every candidate, attest reviewer roles, lock submissions, obtain role-qualified adjudication, and import the approval record; the validator must prove kappa >= 0.70, every applicable per-dimension Spearman >= 0.70, and zero critical false accepts before this blocking checkpoint can close.
- [ ] **04-03-01:** add disposable-PostgreSQL barriers that race reconciliation, retry and cancellation with one operation/settlement and create `docs/runbooks/PHASE4_PAID_CANARY.md`; document exact PostgreSQL 17 local provision/readiness/migrate/test/teardown/absence commands plus the equivalent ephemeral CI service contract.
- [ ] **04-03-02:** add owner/cross-owner accepted-output refresh-after-expiry API fixtures, CreateStudio persisted pending-cancel/previous-success/output-refresh browser fixtures, and the complete rendered browser evidence matrix.
- [ ] **04-03-03:** create sanitized `04-CANARY-EVIDENCE.md` only after valid calibration and current explicit budget authorization; the checkpoint reruns final `eval:phase04` after every later test/artifact addition.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Qualified-human calibration approves automatic review | GEN-08 | Reviewer independence, role qualifications, adjudication and approval cannot be manufactured or truthfully inferred by automation | Two qualified humans independently label every checksum-bound candidate, a qualified adjudicator resolves differences, role attestations and approval record are imported, and the deterministic validator proves kappa/Spearman thresholds plus zero critical false accepts |
| Real Seedance 2.5 operation survives browser closure and worker restart, then stores and accepts the same operation | GEN-05–GEN-09 | Requires an external billable provider operation and observed output host | Only after the separate human calibration checkpoint is approved, obtain explicit current budget approval, follow `docs/runbooks/PHASE4_PAID_CANARY.md`, record sanitized evidence, and never count the canary as calibration or resubmit during recovery |
| User sees persisted progress, pending cancellation, accepted playback/download, and refreshed expired URL | GEN-11–GEN-14 | Requires rendered browser and provisioned stack evidence | Exercise at 375/768/1024/1440 in English/Arabic and light/dark; verify clean console, focus, announcements, truthful copy, and owner-only download |

---

## Validation Sign-Off

- [x] All tasks have an automated command or an explicit documented checkpoint dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 maps every missing fixture, verifier, runbook, browser proof and evidence artifact to its creating task and command/checkpoint
- [x] No watch-mode flags
- [x] Automated feedback latency target is under 120 seconds
- [x] `nyquist_compliant: true` set in frontmatter; `wave_0_complete` remains false until the listed implementation artifacts exist
- [x] Qualified-human calibration and the paid provider canary are separate blocking checkpoints; neither can substitute for the other

**Approval:** pending
