# Phase 1 Existing Patterns

| New/verified concern | Closest existing implementation | Rule |
|---|---|---|
| Availability | `apps/api/src/generation-availability.ts` | Extend the existing ordered fail-closed evaluator. |
| Safe public flags | `packages/contracts/src/api.ts` and `apps/api/src/app.ts` | Return only semantic reason/retryability. |
| Runtime parity | `packages/providers/src/runtime-fingerprint.ts` | Hash non-secret configuration; compare with heartbeat. |
| Worker liveness | `apps/worker/src/service-heartbeat.ts` | Persist ready/stopping, use a 45-second freshness gate. |
| Pricing | `apps/api/src/generation-pricing.ts` | Server-only versioned integer credit rates by resolution. |
| Quote/start invariants | `packages/db/src/generation-service.ts` | Use transaction, idempotency key, reservation, and outbox. |
| Run projection | `apps/api/src/generation-service.ts` | Map persisted stages and safe errors to contracts. |
| Beginner UI state | `apps/web/src/features/create/CreateStudio.tsx` | One primary action; keep draft editable/recoverable. |
| Project recovery | `apps/web/src/pages/CreatorProjects.tsx` | Cloud state is authoritative; refresh signed output URLs. |
| Theme/RTL tokens | `apps/web/src/features/create/creator.css` | Reuse logical properties and existing creator variables. |

