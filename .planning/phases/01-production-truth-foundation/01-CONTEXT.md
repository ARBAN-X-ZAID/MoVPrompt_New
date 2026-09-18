# Phase 1 Context: Production Truth Foundation

## Outcome

Make the existing generation journey honest and operational: availability, quote, submission, worker execution, progress, and recovery must come from one persisted server state.

## Locked Decisions

- Template Mode remains the default beginner path. Provider/model details stay hidden.
- Generation fails closed when pricing, worker heartbeat, capability registry, private storage, FFmpeg/FFprobe, or quality review is unavailable.
- A guest may configure everything before authentication. Generate is the authentication boundary.
- There is no client-side fallback price and no simulated success in production.
- Repeated Generate actions must resolve to one project version, one run, and one entitlement reservation/charge.
- Starter value is one accepted curated Template render for an eligible account, not daily credits.
- Browser progress uses named persisted stages: preparing, rendering, securing output, quality review, ready, cancelling, failed, or cancelled.
- A failed new run never replaces the last accepted output.
- Source media, sample media, template previews, direction artwork, and generated output remain separately labeled and stored.
- Seedance 2.5 is the only enabled production video capability in this phase. Omni remains disabled until a real video adapter is proven.

## UX Contract

### Primary user

A Kuwait business owner with no prompting, model, timeline, codec, or editing knowledge.

### User job

Know whether the campaign can be generated, what it costs, what is happening now, and how to recover without losing work.

### Interaction states

- Ready: authoritative quote is visible and Generate is enabled.
- Pricing failure: “We couldn’t confirm the current price. Try again.” with Retry price and a support request ID.
- Worker unavailable: “Generation is temporarily paused. Your project is saved.”
- Configuration disabled: “Video generation is temporarily unavailable.”
- Price changed: old and new price are shown and the user reconfirms.
- Generating: one dominant named server stage; no fabricated exact percentage.
- Failed/cancelled: project remains saved with a precise recovery action.
- Ready: only the MovPrompt-owned accepted output is presented as generated.

## Visual Direction

- Reuse the current creator shell, typography, surfaces, amber action accent, theme variables, and RTL system.
- Do not introduce a new card language or dashboard redesign.
- Keep one dominant generation state and one primary recovery action.
- Progress must be understandable without color and must support reduced motion.

## Accessibility Contract

- Progress stage is announced semantically, not only drawn.
- Dialog focus, keyboard dismissal, retry, cancel, and support details are keyboard accessible.
- Primary targets remain at least 44 by 44 CSS pixels.
- Verify 375, 768, 1024, and 1440 widths in light/dark and English/Arabic.

## Deferred

- Provider output acquisition and full quality acceptance beyond the Phase 1 truth tracer remain Phase 4 work.
- Deterministic multi-format Campaign Pack export remains Phase 6.
- Database-published production template previews remain Phase 7.

