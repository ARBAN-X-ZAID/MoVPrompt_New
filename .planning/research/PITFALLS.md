# Pitfalls Research

**Domain:** Production AI video creation for non-technical business users
**Researched:** 2026-08-17
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: A Provider Says Complete but the Product Never Completes

**What goes wrong:** The external dashboard shows success while MovPrompt remains at an artificial progress percentage.

**Why it happens:** The output URL was not persisted, the host was rejected, download/transcode/quality failed, or the worker stopped reconciling.

**How to avoid:** Persist the provider operation before polling; expose real internal stages; reconcile the same operation; copy and validate output before completion; alert on stale stage/heartbeat.

**Warning signs:** A run remains processing after provider terminal time, repeated 92% UI, missing output key, stale heartbeat, or unknown output host.

**Phase to address:** Foundation and golden-path generation phases.

---

### Pitfall 2: Demo Media Is Mistaken for User Output

**What goes wrong:** An AirPods project displays Kinza or stock template media, destroying trust.

**Why it happens:** UI fallbacks use template poster/video when a project has no accepted output.

**How to avoid:** Separate source, direction art, preview, and generated output types; render empty/progress states honestly; reject demo URLs from saved outputs.

**Warning signs:** Multiple projects share a video URL, poster fallback appears in editor, play controls exist for static art.

**Phase to address:** Golden-path UI and template publication.

---

### Pitfall 3: “Easy” UI Hides Missing State

**What goes wrong:** Campaign language, CTA, price, offer, audio, subtitles, or uploaded images disappear after auth or Generate.

**Why it happens:** Draft, project, quote, and provider configurations use different partial schemas.

**How to avoid:** One normalized campaign contract, exact claim tests, configuration hash coverage, and review screen sourced from the same payload submitted to the API.

**Warning signs:** Hardcoded “Get bookings,” quote unaffected by field changes, or UI summary differs from project JSON.

**Phase to address:** Data contract and golden-path phases.

---

### Pitfall 4: Users Pay for Internal Failures

**What goes wrong:** Retries double-charge, provider failures consume entitlement, or refunds occur twice/not at all.

**Why it happens:** Browser retries and worker retries are not bound to one idempotent run and ledger.

**How to avoid:** Quote-bound idempotency, transactional reservation/outbox, provider acceptance boundary, attempt-level cost, and exactly-once terminal settlement.

**Warning signs:** More ledger debits than accepted outputs, duplicate provider request IDs, or negative available credit.

**Phase to address:** Generation economics before beta.

---

### Pitfall 5: Arabic Looks Translated, Not Native

**What goes wrong:** Incorrect RTL, punctuation, line breaks, mixed numbers, subtitles, or formal copy makes content unusable in Kuwait.

**Why it happens:** Direction-only RTL and machine-translated strings are treated as localization.

**How to avoid:** Independent interface/campaign language, Arabic typography, bidi-safe components, Kuwaiti copy review, safe-zone and rendered-video QA.

**Warning signs:** Mirrored media controls, reversed KWD/phone strings, clipped subtitles, untranslated fallback errors.

**Phase to address:** Kuwait localization and template QA.

---

### Pitfall 6: Clinic Content Creates Legal or Trust Harm

**What goes wrong:** Invented claims, implied guaranteed results, deceptive before/after, or identifiable patient information appears.

**Why it happens:** Retail templates and generic prompt generation are reused for medical services.

**How to avoid:** Clinic identity/attestation, claim allowlist, real-footage consent, privacy review, no generated transformation, and export compliance gate.

**Warning signs:** “Guaranteed,” diagnostic language, patient footage without consent record, unverified qualification or price.

**Phase to address:** Template compliance before clinic launch.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| LocalStorage project truth | Fast UI prototype | Lost cross-device state and masked backend bugs | Guest prototype only; not authenticated projects |
| Provider URL as output | Fast demo playback | Expiry, loss, security, no QA | Never for accepted output |
| Hardcoded quote | Enables a button | Incorrect economics and customer mistrust | Never |
| Same poster across templates | Fills catalog quickly | Templates appear fake and indistinguishable | Static direction may be reused only when clearly labeled and semantically matched |
| Parallel legacy/portable mutation | Avoids finishing APIs | Divergent auth/data/state | Only behind explicit migration flags with one authoritative branch |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel AI Gateway | Treating model listing as generation proof | Run bounded canary, persist operation, inspect actual output contract/cost |
| Seedance | Sending unsupported ratio/reference combinations | Compile provider-specific canvas and deterministic delivery crop |
| S3/R2 | Persisting signed URLs or assuming full AWS feature parity | Store keys, sign on demand, verify R2-supported operations |
| Better Auth | Losing safe return path or guest draft during callback | Stable pending ID, same-origin next, idempotent claim |
| UPayments | Crediting from browser success redirect | Verify signed webhook/status server-side and process idempotently |
| Meta/Instagram | Exporting arbitrary landscape video | Make 9:16, audio, and safe zones first-class for Reels |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Polling every project/run aggressively | DB/API load and battery drain | Backoff, visibility-aware polling, event/subscription where reliable | Hundreds of active clients |
| Autoplaying all template previews | Slow LCP, data use, mobile jank | Poster-first; play only visible/selected preview | Dozens of media cards |
| Transcoding in API process | Slow requests and memory pressure | Dedicated worker and bounded temp storage | First concurrent renders |
| Loading Advanced code in Template Mode | Large initial bundle | Route-level split and feature-specific imports | Immediately on mobile |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Remote URL fetch without per-hop validation | SSRF and metadata access | DNS/IP/redirect revalidation, pinned public transport, byte/time limits |
| Trusting client object keys/MIME | Cross-user access or spoofed media | DB ownership row, namespace, S3 metadata, checksum, magic-byte validation |
| Leaking provider operation/model details | Abuse and vendor coupling | Public aliases and sanitized support IDs |
| Weak Digital Twin consent | Impersonation | Live challenge, person match, audit, revocation, deletion proof |
| Exposed local/deployment secrets | Provider/account compromise | Rotation, ignored secrets, manager-only deployment values, scanning |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Ask for account too early | User leaves before seeing value | Authenticate only at Generate |
| Show technical model names | User cannot choose confidently | Recommend outcome/template |
| Fake progress percentage | Feels frozen and dishonest | Named stages, elapsed time, saved-state reassurance, support ID |
| Generic error “try again” | User does not know what is saved | Explain exact failure, retryability, and preserved project |
| Too many templates at once | Choice paralysis | Goal/vertical recommendations and a small launch set |
| Editing destroys old output | Fear of experimenting | Immutable versions and accepted-output protection |

## "Looks Done But Isn't" Checklist

- [ ] **Generation:** Provider complete is not enough — verify private MP4, full decode, quality pass, accepted pointer, and fresh signed download.
- [ ] **Template:** A poster is not a preview — verify playable unique video or label it static direction.
- [ ] **Editor:** Browser overlay is not exported — verify the final MP4 pixels/audio.
- [ ] **Arabic:** `dir=rtl` is not localization — verify mixed text, KWD, phone, subtitles, errors, and every viewport.
- [ ] **Auth recovery:** Returning to a draft is not enough — verify all blobs/settings/checksum and exactly one run.
- [ ] **Refund:** A status label is not settlement — reconcile the append-only ledger exactly once.
- [ ] **Project history:** A card is not recovery — reload exact URL after browser closure and expire signed URLs.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Completed provider/stuck app | MEDIUM | Stop resubmission, reconcile stored operation, recover/copy output, then settle one run |
| Lost guest draft | HIGH | Preserve IndexedDB until verified claim; if already deleted, restore only from retained server assets/history |
| Wrong template/output media | LOW | Sanitize fallback, remove false play state, invalidate stale output, rebind correct source |
| Duplicate charge | HIGH | Freeze submissions, audit idempotency/ledger, issue one compensating refund, add concurrency regression |
| Bad clinic content | HIGH | Block export, remove asset, audit consent/claims, notify customer, update policy/tests |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Provider complete/app stuck | Phase 1-2 | Same-operation recovery test and real canary |
| Demo media leakage | Phase 2-3 | Source/preview/output type tests and browser QA |
| Lost campaign settings | Phase 2 | Contract hash and auth recovery E2E |
| Double charge/refund | Phase 1 | PostgreSQL concurrency tests |
| Arabic/RTL quality | Phase 5 | Human and automated four-viewport/video QA |
| Clinic harm | Phase 5 | Compliance fixtures and export-block tests |

## Sources

- https://vercel.com/docs/ai-gateway/getting-started/video — current video contract.
- https://www.facebook.com/help/1038071743007909 — Reels ratio/resolution requirements.
- https://www.facebook.com/business/ads/facebook-instagram-reels-ads — safe-zone/audio guidance.
- https://www.facebook.com/business/ads/review-policy-guidelines — review includes creative and destination.
- https://higgsfield.ai/blog/how-to-make-100-creative-ads — URL-import limitations and required review.
- `.planning/codebase/CONCERNS.md` — verified repository risks.

---
*Pitfalls research for: production AI social-content creation*
*Researched: 2026-08-17*
