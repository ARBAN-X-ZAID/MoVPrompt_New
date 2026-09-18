---
quick_id: 260821-tat
phase: quick-260821-tat
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: []
files_modified:
  - packages/providers/src/vercel-gateway-seedance.ts
  - packages/providers/src/vercel-gateway-seedance.test.ts
  - packages/providers/src/capability-registry.ts
  - packages/providers/src/capability-registry.test.ts
  - apps/worker/src/main.ts
  - apps/api/src/generation-pricing.ts
  - apps/api/src/generation-pricing.test.ts
  - apps/api/src/generation-availability.test.ts
  - packages/providers/src/runtime-fingerprint.ts
  - packages/providers/src/runtime-fingerprint.test.ts
  - scripts/infra/verify-environment.sh
  - infra/environments/local.example
  - .env.example
  - docs/product/VERCEL_GATEWAY_LOCAL.md
estimate:
  tokens: 28000
  raw_tokens: 28000
  tasks: 3
  confidence: low
must_haves:
  truths:
    - "With APP_ENV=local and an explicit bytedance/seedance-v1.0-pro-fast selection, both semantic video capabilities can pass the same server-only provider, pricing, storage, worker-heartbeat, and quality-readiness checks used by the real local project pipeline."
    - "With APP_ENV=staging or APP_ENV=production, bytedance/seedance-v1.0-pro-fast is rejected before capability advertisement or provider submission; both environments remain locked to bytedance/seedance-2.5 per D-01 and D-02."
    - "The fast model is an explicit local selection, never a fallback: an unknown model, a missing model, or a failed fast-model request fails closed without retrying through Seedance 2.5 or another family per D-02 and D-05."
    - "Local quotes use a version explicitly bound to the fast-model test profile, both 480p and 720p rates are authoritative, and configurations outside the fast model's 2-12 second contract are rejected before reservation or submission."
    - "Browser/API responses continue to expose only semantic capability availability and ordinary quote data; provider/model identifiers and output hosts remain server-only per D-20 and D-22."
    - "The change does not waive human quality calibration, private-storage checks, technical validation, exact settlement, or the Phase 04 production canary; those existing gates continue to fail closed per D-07, D-13, D-23, and D-26."
    - "No test, build, readiness check, environment verification, or execution step in this quick task submits a paid generation request per D-24."
  artifacts:
    - path: packages/providers/src/vercel-gateway-seedance.ts
      provides: "One environment-aware Seedance adapter policy with model-specific limits and exact output-host evidence."
    - path: packages/providers/src/capability-registry.ts
      provides: "Fail-closed local-versus-shared-environment capability resolution."
    - path: apps/api/src/generation-pricing.ts
      provides: "Model-bound quote validation for the selected local fast profile."
    - path: packages/providers/src/runtime-fingerprint.ts
      provides: "API/worker agreement over environment, selected model, pricing, storage, and media policy."
    - path: infra/environments/local.example
      provides: "Reproducible local fast-model profile without secrets."
    - path: scripts/infra/verify-environment.sh
      provides: "Deployment guard that allows the fast model only in local and requires Seedance 2.5 in staging/production."
  key_links:
    - from: infra/environments/local.example
      to: packages/providers/src/capability-registry.ts
      via: "APP_ENV plus both server-only capability model variables select the local fast policy."
      pattern: "bytedance/seedance-v1.0-pro-fast"
    - from: packages/providers/src/capability-registry.ts
      to: apps/worker/src/main.ts
      via: "The registry and adapter composition use the same environment-aware model policy."
      pattern: "APP_ENV"
    - from: apps/api/src/generation-pricing.ts
      to: packages/providers/src/runtime-fingerprint.ts
      via: "Pricing version/rates and selected model participate in the API/worker readiness fingerprint."
      pattern: "GENERATION_PRICING_VERSION"
    - from: packages/providers/src/vercel-gateway-seedance.ts
      to: apps/worker/src/main.ts
      via: "Worker supplies its APP_ENV when constructing the selected adapter; direct construction defaults to production-safe policy."
      pattern: "applicationEnvironment"
---

<objective>
Switch the real local development generation pipeline to Vercel Seedance v1.0 Pro Fast for lower-cost project testing while leaving staging and production hard-locked to Seedance 2.5.

Purpose: Let the user exercise quotes, durable submission, background reconciliation, private output persistence, quality review, and dashboard recovery with the cheaper approved development model without weakening any production boundary.
Output: An environment-aware provider policy, matching quote/readiness behavior, a reproducible local profile, and zero-cost regression proof.
</objective>

<execution_context>
@/Users/muhammadzaid/Desktop/Projects/moveprompts/.codex/gsd-core/workflows/execute-plan.md
@/Users/muhammadzaid/Desktop/Projects/moveprompts/.codex/gsd-core/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@.planning/STATE.md
@.planning/phases/04-durable-generation-and-accepted-quality/04-CONTEXT.md
@.planning/phases/04-durable-generation-and-accepted-quality/04-RESEARCH.md
@packages/providers/src/vercel-gateway-seedance.ts
@packages/providers/src/capability-registry.ts
@packages/providers/src/runtime-fingerprint.ts
@apps/api/src/generation-pricing.ts
@apps/api/src/generation-availability.ts
@apps/worker/src/main.ts
@apps/worker/src/gateway-video-smoke.ts
@docs/product/VERCEL_GATEWAY_LOCAL.md

Current evidence and boundaries:

- Vercel's current catalog lists `bytedance/seedance-v1.0-pro-fast` as an image-to-video model supporting 480p, 720p, 1080p and durations from 2 through 12 seconds at approximately USD 0.01 per generated second. This task keeps the public MovPrompt contract at 480p/720p.
- A previous guarded local smoke artifact records the exact fast-model output host `ark-content-generation-ap-southeast-1.tos-ap-southeast-1.volces.com` and a two-second 480p charge of approximately USD 0.0194. Reuse only that exact observed host for the local model; do not introduce wildcards or guessed hosts per D-06.
- The existing guarded CLI already recognizes the fast model, but the durable adapter and capability registry currently accept only `bytedance/seedance-2.5`. This plan extends only the real local pipeline; it does not alter the production capability contract per D-01 and D-02.
- Human quality calibration is still a separate blocking Phase 04 requirement. The cheap-model switch may remove model/pricing mismatch as a local blocker, but it must not fabricate calibration evidence, report production acceptance, or relax final media/quality settlement gates.
- The user will initiate any real paid generation manually after this change. Automated verification in this plan is strictly zero-cost and must never set `MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO=YES`.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Wire one explicit local fast-model operation through capability resolution and the durable adapter</name>
  <files>packages/providers/src/vercel-gateway-seedance.ts, packages/providers/src/vercel-gateway-seedance.test.ts, packages/providers/src/capability-registry.ts, packages/providers/src/capability-registry.test.ts, apps/worker/src/main.ts</files>
  <behavior>
    - Local policy: APP_ENV=local plus the exact fast-model ID resolves both semantic video aliases and constructs an adapter whose private Gateway request header contains that exact ID.
    - Shared-environment policy: APP_ENV=staging or production plus the fast-model ID leaves the capability unavailable and adapter construction throws before any fetcher is called.
    - Production policy: Seedance 2.5 remains accepted in local, staging, and production so local selection is explicit rather than an automatic downgrade.
    - Unknown IDs remain unavailable and never trigger a second-model attempt.
    - Fast-model duration accepts integers 2-12 and rejects values outside that range before the fetcher; Seedance 2.5 retains its established 4-30 second contract.
    - Public capability serialization contains aliases/availability only and contains neither model ID nor reviewed output hostname.
  </behavior>
  <action>Start with failing provider and registry tests, then make the smallest production-quality policy change that passes them. In `vercel-gateway-seedance.ts`, retain the existing Seedance 2.5 constant and add one explicit development fast-model constant plus model-specific exact output-host evidence. Replace the single hard-coded model assertion with a typed model policy selected from `{ applicationEnvironment, modelId }`: `bytedance/seedance-v1.0-pro-fast` is valid only when `applicationEnvironment` is exactly `local`; Seedance 2.5 remains valid in all environments; every other value fails closed. Add `applicationEnvironment` to adapter construction and default omitted values to a production-safe environment, so tests or future call sites cannot obtain local behavior accidentally. Apply model-specific duration validation before start submission and keep the current 480p/720p public contract, asynchronous start/status operation persistence, idempotency header, safe telemetry, and same-operation reconciliation unchanged. Do not add a fallback list or catch-and-resubmit behavior per D-02 and D-05.

Update `capability-registry.ts` to use the same policy and the exact output host associated with the selected model. The local fast model is ready only when `APP_ENV=local`, the exact fast-model host is in `PROVIDER_OUTPUT_ALLOWED_HOSTS`, and all existing Gateway/storage/media/quality prerequisites are present. Staging and production accept only Seedance 2.5 with its reviewed host. Keep provider/model/host details out of `listPublic()` per D-20 and D-22. In `apps/worker/src/main.ts`, pass `config.environment` into both Vercel adapter registrations and preserve the existing requirement that both aliases register successfully before the worker advertises generation readiness. This is an explicit local selection, not a change to the production registry per D-01 and D-02.</action>
  <verify>
    <automated>env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run --cwd packages/providers test --run src/vercel-gateway-seedance.test.ts src/capability-registry.test.ts</automated>
  </verify>
  <done>A fixture-backed local fast-model submit/status path reaches the durable adapter with the exact private model selection, while staging/production reject the fast model before network access and public capability output remains provider-agnostic.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Bind quote validation and API-worker readiness to the selected local model</name>
  <files>apps/api/src/generation-pricing.ts, apps/api/src/generation-pricing.test.ts, apps/api/src/generation-availability.test.ts, packages/providers/src/runtime-fingerprint.ts, packages/providers/src/runtime-fingerprint.test.ts</files>
  <behavior>
    - A complete local fast-model profile with matching pricing, storage, quality settings, and fresh worker fingerprint is generation-ready.
    - A local fast-model quote accepts 2-12 seconds at the configured 480p or 720p rate and rejects 1 or 13 seconds before reservation/submission.
    - A missing rate for either installed resolution remains `pricing_unavailable`; no client-side fallback price appears.
    - Changing APP_ENV, either capability model ID, pricing version, either resolution rate, or worker tier changes the secret-free runtime fingerprint.
    - A heartbeat generated from a Seedance 2.5 profile cannot unlock a fast-model API profile, and vice versa.
    - Staging/production fast-model configurations remain `capability_unavailable`, not ready.
  </behavior>
  <action>Add model-aware video contract validation inside authoritative server pricing, using the already supplied environment rather than accepting a browser model field. For each video alias, derive the server-selected model from its capability environment key. When the selected model is the local fast model, enforce the documented 2-12 second range during `price`; keep the established general/Seedance 2.5 validation otherwise. Do not invent a browser-visible model parameter and do not silently clamp duration. Preserve immutable pricing version, quote TTL, resolution-specific integer rates, configuration hash binding, and error mapping.

Extend the runtime fingerprint with normalized `APP_ENV`; it already includes both capability model IDs and all pricing inputs, so do not duplicate secrets or raw credentials. Add API availability tests using `createCapabilityRegistryFromEnvironment` for a complete local fast profile: both 480p and 720p prices must exist, private storage/quality prerequisites must pass, and only an identically fingerprinted fresh worker may unlock generation per D-23. Add negative tests for local duration overflow, missing resolution pricing, fast-model selection in staging/production, and cross-model heartbeat mismatch. Do not loosen the human-calibration requirement in `apps/worker/src/main.ts`, the quality-model requirement, or any storage/FFmpeg/FFprobe check; this task aligns the selected model but does not waive Phase 04 acceptance evidence per D-07, D-13, and D-26.</action>
  <verify>
    <automated>env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run --cwd apps/api test --run src/generation-pricing.test.ts src/generation-availability.test.ts &amp;&amp; env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run --cwd packages/providers test --run src/runtime-fingerprint.test.ts</automated>
  </verify>
  <done>The local fast profile produces stable authoritative quotes only for supported configurations, API and worker must agree on the exact environment/model/pricing fingerprint, and shared environments cannot become ready with the development model.</done>
</task>

<task type="auto">
  <name>Task 3: Publish the reproducible local fast profile and prove shared-environment isolation without spending</name>
  <files>scripts/infra/verify-environment.sh, infra/environments/local.example, .env.example, docs/product/VERCEL_GATEWAY_LOCAL.md</files>
  <action>Update `scripts/infra/verify-environment.sh` so its generation model gate is environment-aware: when `APP_ENV=local`, each enabled Vercel video capability may use the exact fast-model ID or Seedance 2.5; in every other environment, the only accepted model remains `bytedance/seedance-2.5`. Require both enabled aliases to select the same model and require the selected model's exact reviewed output host. Keep all existing authentication, assets, pricing, worker, storage, quality, FFmpeg, and no-wildcard checks. Do not treat `NODE_ENV=production` inside local Docker containers as a shared deployment; the authoritative boundary is the explicit `APP_ENV` carried in the API/worker fingerprint.

Make `infra/environments/local.example` the reproducible cheap test profile: select `bytedance/seedance-v1.0-pro-fast` for both server-only aliases, set the worker tier to 480p, keep provider-native audio false by default, enable both video capabilities and generation for the full application profile, use the exact observed fast-model output host, use a 15-minute quote TTL, and set a clearly local pricing version. Configure both 480p and 720p capability rates to 3 credits per second, derived from approximately USD 0.01/second and the established USD 0.004 contribution-margin divisor; mark these rates as local test economics, not production pricing evidence. Keep `GENERATION_STARTER_ONLY=true`, `image.product` disabled, and every secret blank. In `.env.example`, document the same local override without changing the staging/production Seedance 2.5 examples or embedding a key.

Update `VERCEL_GATEWAY_LOCAL.md` with a no-secret startup recipe that layers the tracked local profile with the ignored `.env.local`, explains that project generations now use the fast model only under `APP_ENV=local`, tells the tester to select 480p and disable audio for the cheapest first run, and states that a real Generate click still incurs Gateway and quality-review cost. Explicitly retain: no silent fallback, no automatic paid test, no model/provider text in the UI, calibration/quality readiness still fail closed, and staging/production remain Seedance 2.5. Do not edit or print `.env.local`; preserve the existing key and unrelated local settings. Do not set `MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO=YES` anywhere.

Run only mocked/unit/environment/config/type/build verification. Check that staging and production example files still contain Seedance 2.5 for both aliases and contain no fast-model ID. Render Docker Compose configuration without starting containers or contacting the provider. Preserve unrelated dirty-tree files and stage only the files listed by this plan.</action>
  <verify>
    <automated>env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run --cwd packages/providers test --run src/vercel-gateway-seedance.test.ts src/capability-registry.test.ts src/runtime-fingerprint.test.ts &amp;&amp; env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run --cwd apps/api test --run src/generation-pricing.test.ts src/generation-availability.test.ts &amp;&amp; env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run typecheck:workspaces &amp;&amp; env -u MOVPROMPT_GATEWAY_CONFIRM_PAID_VIDEO bun run build:workspaces &amp;&amp; docker compose --env-file infra/environments/local.example --env-file .env.local config --quiet &amp;&amp; test "$(awk -F= '/^MOVPROMPT_CAPABILITY_VIDEO_(CINEMATIC|PRODUCT_FIDELITY)_MODEL_ID=bytedance\/seedance-2\.5$/ {count++} END {print count+0}' infra/environments/staging.example)" -eq 2 &amp;&amp; test "$(awk -F= '/^MOVPROMPT_CAPABILITY_VIDEO_(CINEMATIC|PRODUCT_FIDELITY)_MODEL_ID=bytedance\/seedance-2\.5$/ {count++} END {print count+0}' infra/environments/production.example)" -eq 2 &amp;&amp; ! awk -F= '/^MOVPROMPT_CAPABILITY_VIDEO_(CINEMATIC|PRODUCT_FIDELITY)_MODEL_ID=/ {print $2}' infra/environments/staging.example infra/environments/production.example | rg -q '^bytedance/seedance-v1\.0-pro-fast$' &amp;&amp; git diff --check -- packages/providers apps/api/src/generation-pricing.ts apps/api/src/generation-pricing.test.ts apps/api/src/generation-availability.test.ts apps/worker/src/main.ts scripts/infra/verify-environment.sh infra/environments/local.example .env.example docs/product/VERCEL_GATEWAY_LOCAL.md</automated>
  </verify>
  <done>The tracked local profile selects and prices the cheap model, zero-cost checks prove it is wired consistently, staging/production remain Seedance 2.5-only, and no paid generation was made by implementation or verification.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|---|---|
| Environment to API/worker composition | Server-controlled model and pricing values choose billable behavior. |
| API to browser | Public capability and quote responses must not reveal provider routing. |
| Worker to Vercel Gateway | A model-specific request can incur real cost and returns an untrusted operation/output URL. |
| Provider output to private storage | Model-specific output origin must pass the exact reviewed host and existing SSRF/media checks. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|---|---|---|---|---|---|
| T-tat-01 | Tampering / Elevation | `APP_ENV` and capability model variables | critical | mitigate | One shared typed policy plus environment verifier: fast model only when APP_ENV is exactly local; staging/production require Seedance 2.5 before fetch. |
| T-tat-02 | Tampering | API-worker heartbeat fingerprint | high | mitigate | Include APP_ENV, model IDs, pricing version/rates and existing runtime policy so cross-profile heartbeats cannot unlock submissions. |
| T-tat-03 | Information Disclosure | Public feature flags and quote responses | high | mitigate | Retain semantic aliases only; negative serialization tests forbid model IDs and output hosts. |
| T-tat-04 | Tampering / Denial of Service | Fast-model duration and resolution | medium | mitigate | Validate 2-12 seconds and 480p/720p against server policy before reservation/provider submission; never clamp silently. |
| T-tat-05 | SSRF | Fast-model output URL | critical | mitigate | Require the exact previously observed host and preserve HTTPS, public DNS, pinning, redirect, byte, MIME, MP4 and private-storage checks per D-06. |
| T-tat-06 | Repudiation / Financial | Test or build triggers a paid call | critical | mitigate | All verification unsets the confirmation guard, uses mocks/config rendering only, and never invokes `gateway:video`; the user manually initiates any real generation. |
| T-tat-07 | Elevation | Local profile bypasses calibration or settlement | critical | mitigate | Preserve worker calibration, quality, storage, technical media and exactly-once gates; cheap model selection removes no acceptance prerequisite. |
| T-tat-SC | Tampering | Package supply chain | low | accept | No dependency installation or lockfile change is in scope. |
</threat_model>

<source_coverage>
## Multi-Source Coverage Audit

| Source | Item | Coverage |
|---|---|---|
| GOAL | Switch actual local development video generation to the cheaper Vercel Seedance v1.0 Pro Fast model | Tasks 1-3 cover adapter, capability, pricing, readiness, environment, and documentation. |
| GOAL | Keep staging and production on Seedance 2.5 | Tasks 1 and 3 enforce and test the shared-environment lock. |
| GOAL | No paid provider generation during implementation | Every task verification unsets the paid guard; Task 3 explicitly forbids the paid command. |
| REQ | No roadmap requirement IDs are assigned to this quick task | Covered as an intentional quick-task absence; `requirements` remains empty. |
| RESEARCH | Reuse existing React/Hono/PostgreSQL/pg-boss/S3 and Gateway adapter seams; install no package | All tasks modify established seams and add no dependency. |
| RESEARCH | Seedance v1 fast is development-only and cannot satisfy production acceptance | Tasks 1 and 3 enforce D-02; must-have truth preserves Phase 04 gates. |
| CONTEXT | D-01 production aliases remain Seedance 2.5 and server-only | Tasks 1 and 3. |
| CONTEXT | D-02 fast model is development-only and never a fallback | Tasks 1 and 3. |
| CONTEXT | D-05 uncertain/failing operations reconcile; they do not resubmit through another model | Task 1 leaves durable same-operation behavior unchanged and adds no fallback. |
| CONTEXT | D-06 exact reviewed output hosts only | Tasks 1 and 3 use the exact observed fast-model host. |
| CONTEXT | D-07/D-13 quality acceptance remains fail-closed | Tasks 2 and 3 preserve calibration and quality readiness. |
| CONTEXT | D-20/D-22 provider internals stay out of public responses | Task 1 adds negative public-serialization coverage. |
| CONTEXT | D-23 kill switch and runtime fingerprint gate new work | Task 2 binds environment/model/pricing into readiness. |
| CONTEXT | D-24 automated checks never spend | All verification commands are zero-cost. |
| CONTEXT | D-26 Phase 04 still requires a real approved production-model canary | Must-have truth and Tasks 2-3 explicitly preserve the later Seedance 2.5 canary. |

Result: all applicable goal, research, and locked-context items are covered; no deferred Phase 04 provider or acceptance feature is introduced.
</source_coverage>

<verification>
- [ ] Local fast-model provider and capability tests pass without network access.
- [ ] Staging and production reject the fast model before capability advertisement or fetch.
- [ ] Local quotes accept only 2-12 seconds and have both 480p/720p authoritative rates.
- [ ] API and worker fingerprints differ across environment, model, tier, or pricing changes.
- [ ] Docker Compose renders the layered local profile without starting services.
- [ ] Workspace typecheck/build passes.
- [ ] Staging/production examples remain exactly Seedance 2.5 for both video aliases.
- [ ] No command sets the paid confirmation guard or invokes a provider generation endpoint.
</verification>

<success_criteria>
- A tester can start the local full-stack profile and manually create a cheaper Seedance v1.0 Pro Fast project render after all pre-existing storage/worker/quality prerequisites are genuinely present.
- The resulting quote, job, output persistence, quality review, settlement, and dashboard state continue through the same durable pipeline; only the explicitly local provider model changes.
- Shared environments cannot load the fast model even through configuration error, and the browser cannot discover which provider/model was selected.
- The quick task completes with zero paid-generation calls and does not claim Phase 04 production acceptance.
</success_criteria>

<output>
After execution, create `.planning/quick/260821-tat-switch-local-development-video-generatio/260821-tat-SUMMARY.md` and state explicitly that no paid provider generation was made.
</output>
