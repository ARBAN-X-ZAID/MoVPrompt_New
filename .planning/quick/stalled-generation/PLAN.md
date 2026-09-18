# Recover stalled generation polling

Continue approved GSD bypass; keep edits local.

Evidence: the existing Gateway operation reports completed, while its MongoDB run remains processing and no follow-up worker job exists. `singletonNextSlot` is accepted but ignored by MongoWorker; an active reconciliation job blocks its own successor under the unique singleton index.

1. Add a failing regression for active singleton → exactly one queued successor, including duplicate scheduling.
2. Transfer the singleton key from the active owned job to its successor in one MongoDB transaction.
3. Resume reconciliation of the existing accepted provider request only. Do not submit a new generation.
4. Verify completion/storage/browser or report the specific remaining failure.
