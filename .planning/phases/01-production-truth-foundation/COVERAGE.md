# External API Coverage: Phase 1

| Vercel Gateway operation | Phase 1 status | Evidence/owner |
|---|---|---|
| Model/capability configuration | Integrated | Server capability registry and runtime fingerprint. |
| Readiness/key presence | Integrated without secret exposure | Availability service and worker heartbeat metadata. |
| Start async video generation | Deferred to Phase 4 | Phase 1 proves submit idempotency and queue handoff, not provider acceptance. |
| Poll/reconcile provider operation | Deferred to Phase 4 | Worker contract exists; live provider proof belongs to durable generation phase. |
| Download/copy provider output | Deferred to Phase 4 | Phase 1 only proves safe readiness gating. |
| Cancel provider operation | Deferred to Phase 4 | Cancellation state is persisted; live provider semantics require canary proof. |
| Provider cost/usage telemetry | Contract only | Phase 1 ensures fields and safe persistence; accepted-output economics need Phase 4 samples. |

Phase 1 must not make a paid provider call merely to turn on the UI. It validates that generation is available only when the later provider/output gates are configured and fresh.

