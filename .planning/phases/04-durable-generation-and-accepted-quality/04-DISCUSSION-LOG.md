# Phase 4: Durable Generation and Accepted Quality - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 04-durable-generation-and-accepted-quality
**Areas discussed:** Provider operation recovery, private output acceptance, quality and retry policy, cancellation and exact settlement
**Mode:** Autonomous, using the user's standing instruction to research and select recommended defaults

---

## Provider operation recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Reconcile the same operation | Persist provider acceptance before polling and resume that operation after interruption. | ✓ |
| Submit a replacement operation | Start another provider request when status or output is uncertain. | |

**Choice:** Reconcile the same operation.
**Notes:** Prevents duplicate cost and preserves an auditable one-request chain. Unknown output hosts park the original run for review.

---

## Private output acceptance

| Option | Description | Selected |
|--------|-------------|----------|
| Complete after private acceptance | Require safe acquisition, MovPrompt storage, normalization, full decode, and quality approval. | ✓ |
| Complete on provider success | Show completion as soon as the provider reports an output. | |

**Choice:** Complete after private acceptance.
**Notes:** Provider success is intermediate; the customer result must remain accessible from MovPrompt-owned storage.

---

## Quality and retry policy

| Option | Description | Selected |
|--------|-------------|----------|
| One quote covers bounded retries | Allow the initial attempt plus at most two internal quality retries for one accepted result and one charge. | ✓ |
| Charge each attempt | Treat every provider attempt as a separate customer purchase. | |

**Choice:** One quote covers bounded retries.
**Notes:** A failed technical or internal quality attempt is not customer value. Failed candidates never become accepted output.

---

## Cancellation and exact settlement

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm before cancelling | Immediate release before acceptance; after acceptance wait for provider confirmation or terminal reconciliation. | ✓ |
| Assume cancellation succeeded | Mark cancelled when the customer clicks cancel even if the provider continues. | |

**Choice:** Confirm before cancelling.
**Notes:** The current Gateway contract has no proven cancellation endpoint, so the product must not fabricate success.

---

## the agent's Discretion

- Polling cadence, backoff, internal stage names, FFmpeg arguments, and precise quality thresholds within the locked safety and evidence contract.

## Deferred Ideas

- Omni activation, campaign-pack exports, Advanced multi-direction generation, and production rollout operations remain in later phases.
