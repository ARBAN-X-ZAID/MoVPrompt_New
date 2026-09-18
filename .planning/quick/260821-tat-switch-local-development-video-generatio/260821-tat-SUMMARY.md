---
phase: quick-260821-tat
plan: 01
subsystem: generation
tags: [vercel-ai-gateway, seedance, pricing, runtime-readiness, local-development]
requires:
  - phase: 04-durable-generation-and-accepted-quality
    provides: durable provider adapter, output quality gates, and worker heartbeat agreement
provides:
  - Explicit local-only Seedance v1 Pro Fast video capability profile
  - Model-bound quote durations and environment/model runtime fingerprinting
  - Reproducible low-cost local profile without production model changes
affects: [local-generation, provider-readiness, staging, production]
actuals:
  tokens: 7751
  tasks: 3
  commits: 3
tech-stack:
  added: []
  patterns:
    - Server-only model policy selects a reviewed output host and duration range by APP_ENV.
    - Local fast-model activation remains explicit and never becomes a provider fallback.
key-files:
  created: []
  modified:
    - packages/providers/src/vercel-gateway-seedance.ts
    - packages/providers/src/capability-registry.ts
    - apps/api/src/generation-pricing.ts
    - packages/providers/src/runtime-fingerprint.ts
    - infra/environments/local.example
    - scripts/infra/verify-environment.sh
key-decisions:
  - "Seedance v1.0 Pro Fast is allowed only for APP_ENV=local; omitted or unknown environments use the production-safe policy."
  - "Local fast generation remains subject to the existing calibration, private-storage, technical validation, quality and settlement gates."
requirements-completed: []
coverage:
  - id: D1
    description: Explicit local fast adapter and capability resolution with staging/production rejection.
    verification:
      - kind: unit
        ref: packages/providers/src/vercel-gateway-seedance.test.ts and capability-registry.test.ts
        status: pass
    human_judgment: false
  - id: D2
    description: Local fast quote duration limits and API-worker readiness fingerprint agreement.
    verification:
      - kind: unit
        ref: apps/api/src/generation-pricing.test.ts, generation-availability.test.ts, and packages/providers/src/runtime-fingerprint.test.ts
        status: pass
    human_judgment: false
  - id: D3
    description: Local profile and shared-environment isolation configuration.
    verification:
      - kind: other
        ref: bash -n scripts/infra/verify-environment.sh plus static staging/production model assertions
        status: pass
    human_judgment: false
duration: 9min
completed: 2026-08-21
status: complete
---

# Quick Task 260821-tat: Local Fast Video Generation Summary

**A server-only local Seedance Fast profile now supplies low-cost project testing while staging and production remain locked to Seedance 2.5.**

## Accomplishments

- Added explicit environment-aware adapter and capability policies: Fast accepts only local configuration, supports 2–12 seconds, and uses its exact reviewed output host.
- Bound authoritative local quotes and API/worker heartbeats to the selected model, environment, resolution rates and pricing version.
- Published a no-secret local application profile using 480p, two seconds, audio off and three local test credits per second; shared environment examples remain Seedance 2.5-only.

## Task Commits

1. **Task 1: Wire explicit local fast-model operation** — `a8b9f9a`
2. **Task 2: Bind quote validation and readiness** — `5d84955`
3. **Task 3: Publish local profile and isolation proof** — `8e52765`

## Verification

- Passed: 20 provider unit tests.
- Passed: 8 API pricing and availability unit tests.
- Passed: all workspace typechecks and builds.
- Passed: shell syntax and static model-isolation assertions for local, staging and production examples.
- No paid request was made; every command explicitly unset `MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO`.

## Environment-only Blocker

`docker compose --env-file infra/environments/local.example --env-file .env.local config --quiet` could not run because `docker` is not installed or available on this machine's PATH. This did not contact a provider or affect source verification.

## Decisions Made

- Fast model selection is explicit local configuration, never a fallback after a failed submission.
- A missing calibration artifact continues to stop accepted-output completion; this change does not claim production readiness.

## Deviations from Plan

None - plan executed as specified. Docker Compose rendering is recorded above as an environment-only unavailable verification command.

## Next Step

Start the local API and worker with `infra/environments/local.example` layered with the ignored `.env.local`, then test a 480p two-second project generation manually. The manual Generate action is paid and still requires the existing quality calibration gate to pass before an output is accepted.

## Self-Check: PASSED
