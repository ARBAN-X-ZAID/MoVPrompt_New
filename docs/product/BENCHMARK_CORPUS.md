# MovPrompt Kuwait campaign benchmark

This scorecard is the gate for enabling a production capability or making a
public claim against another product. UI polish or a single successful sample
is not evidence of category leadership.

## Corpus

The fixed corpus contains 48 briefs: four verticals × four scenarios × three
campaign languages.

The executable corpus and approval score are defined in
`packages/creative-engine/src/benchmark.ts`. An adapter cannot be marked
approved with fewer than all 48 observations.

| Vertical | Scenario 1 | Scenario 2 | Scenario 3 | Scenario 4 |
|---|---|---|---|---|
| Salon | WhatsApp booking offer | Practitioner introduction | Facility trust story | Seasonal service launch |
| Clinic | General service explainer | Facility tour | Appointment campaign | Practitioner introduction |
| Retail | Premium product reveal | WhatsApp offer | New-arrival launch | Gift campaign |
| Ecommerce | Product demonstration | UGC review | Unboxing | Feature-led offer |

Every scenario is tested in Arabic, English and bilingual output. Executable
brief IDs are stable lowercase IDs such as `retail-ar-identity`; they must never
be renamed after evidence collection begins. The input pack for each brief must
include:

- Confirmed business/product name.
- Confirmed description and allowed claims.
- Price or explicit “no price”.
- Offer or explicit “no offer”.
- Verified WhatsApp/booking destination.
- Logo and brand colours.
- One hero image plus up to four detail references.
- Person-consent reference when a real person appears.
- Expected 9:16 safe zones and campaign goal.

The private `kw-48-assets-v1` manifest contains exactly 48 entries. Arabic,
English and bilingual variants of a subject reuse the same checksum-verified
asset pack so the language evaluation is isolated. The four verticals × four
challenges require at least sixteen distinct primary reference checksums.
Before any paid request, the CLI verifies each object exists in private storage
and that its MIME type, byte size and `sha256-hex` object metadata match.

Clinic briefs must never contain generated before/after imagery, patient health
information, guaranteed results or unverified qualifications.

## Blind comparison

1. Freeze every brief and asset pack before running any provider.
2. Generate at least three outputs for each capability/provider combination.
3. Compare complete campaign results, not raw clips, against the current
   Higgsfield, Creatify/Pippit and HeyGen workflows.
4. Hide tool/provider identity from reviewers and randomize order.
5. Use at least five Kuwait-based reviewers for the campaign-readiness vote.
6. Store the brief version, provider configuration hash, latency, provider cost,
   retries and technical outcome with every review.

## Executable staging gate

The paid gate is implemented by `apps/worker/src/benchmark-cli.ts`. It exercises
the real asynchronous adapter, private reference signing, output download and
normalization, deterministic Kuwait voice, FFprobe validation and a structured
Gemini video review routed through Vercel AI Gateway. It deliberately bypasses
the provider `READY` flag because passing this
gate is the evidence required before that flag may be enabled.

Prepare the private reference corpus first. The source directory must contain
sixteen folders named `{vertical}-{challenge}` (for example
`retail-identity` and `clinic-arabic`). Every folder requires exactly one
`primary.jpg`, `primary.png` or `primary.webp`, plus up to eight optional
detail images or MP4 references. The preparation command validates file
signatures and sizes, uploads checksum-addressed private objects, and writes a
mode-0600 manifest:

```bash
bun run --cwd apps/worker benchmark:prepare
```

It refuses to upload unless `MOVPROMPT_BENCHMARK_RIGHTS_ATTESTED=YES`. This
attestation must cover commercial-use rights and consent for any identifiable
person.

```bash
bun run --cwd apps/worker benchmark:live
```

The command requires the benchmark variables documented in `.env.example` and
refuses to start unless `MOVPROMPT_BENCHMARK_CONFIRM_PAID_RUN=YES`. One JSONL
checkpoint is written immediately after provider acceptance and another after
the scored sample. Re-running the same run ID resumes an already accepted task
instead of submitting it again, then runs only missing briefs. Stable request
keys also narrow the remaining submit/accept checkpoint window; the provider's
own idempotency semantics must still be confirmed in the live bake-off. A comma-separated
`MOVPROMPT_BENCHMARK_BRIEF_IDS` subset may be used for a smoke run, but no subset
can receive approval.

Automated provider approval requires all of the following in the code-owned
scorecard:

- All 48 distinct brief IDs exactly once; duplicated or unexpected IDs fail.
- At least 98% technical success.
- At least 80% first-render usable output.
- Weighted provider quality score of at least 85.
- At least 95% of samples scoring 80+ on product identity.
- At least 95% of Arabic/bilingual samples scoring 85+ on Kuwait dialect.

This automated approval is necessary but not sufficient for a public competitor
claim. The generated report always records that the five-person blind Kuwait
review remains required.

## Human blind-review score

| Dimension | Weight | Automatic gate |
|---|---:|---|
| Product/business identity fidelity | 25% | Reject altered logo, label, product shape or invented fact |
| Arabic/English copy accuracy | 20% | Reject incorrect price, offer, CTA or unreadable Arabic |
| Campaign-goal effectiveness | 15% | — |
| Visual quality and motion | 15% | Reject broken frames or material artifacts |
| Kuwait/RTL readiness | 10% | Reject unsafe price, logo, subtitle or mixed-direction layout |
| Reference/prompt adherence | 10% | — |
| Audio, pronunciation and lip sync | 5% | Reject missing/corrupt audio when required |

Reliability and economics are measured separately:

- Technical success rate.
- First-render acceptance.
- Accepted within one revision.
- p50/p95 latency.
- Provider cost and MovPrompt cost per accepted output.
- Contribution margin per accepted output.

## Enablement gates

A capability stays disabled unless all of these are true:

- Provider commercial rights, data retention and deletion terms are approved.
- At least 80% first-render acceptance on its applicable corpus.
- At least 98% technically successful jobs in staging.
- Exact price, offer and CTA accuracy is 100%.
- Arabic/RTL safe-zone pass is at least 99%.
- The accepted-output contribution margin is at least 60%.
- A fallback provider, if configured, passes the same capability contract.

MovPrompt may use “better for Kuwait campaign readiness” only after complete
MovPrompt campaign packs receive at least 60% blind preference over the named
comparison workflow on the frozen corpus.

## Evidence record

Each run records:

```text
brief_id
brief_version
capability_alias
provider_adapter_id (server-only)
provider_model_id (server-only)
configuration_hash
input_asset_checksums
started_at / completed_at
latency_ms
provider_cost_minor
internal_retry_count
technical_status
quality_gate_results
reviewer_scores
accepted / rejected
rejection_reason
```

Provider and model IDs never appear in the public API or beginner interface.

## Research basis

- Higgsfield's preset approach demonstrates the value of encoding repeatable
  camera, pacing and style structures instead of asking beginners to engineer
  prompts: <https://openai.com/index/higgsfield/>.
- Seedance 2.0 documents multimodal text, image, audio and video references plus
  camera, motion and audio control. These are treated as provider capabilities,
  not assumptions that a specific adapter is production-ready:
  <https://seed.bytedance.com/en/seedance2_0>.
- BytePlus ModelArk provides the asynchronous Seedance 2.0 task ID, polling,
  callback, output URL and cancellation contract used by the durable worker:
  <https://docs.byteplus.com/en/docs/modelark/1520757>.
- The Vercel AI Gateway and AI SDK structured-output contract route the bounded
  video and reference review without a second provider key:
  <https://vercel.com/docs/ai-gateway> and
  <https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data>.
- Kuwait ecommerce guidance identifies food, personal care, electronics and
  home services as relevant sectors and notes widespread WhatsApp usage:
  <https://www.trade.gov/country-commercial-guides/kuwait-ecommerce>.
