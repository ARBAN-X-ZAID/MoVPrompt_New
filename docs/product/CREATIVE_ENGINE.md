# MovPrompt premium creative engine

## What is implemented

MovPrompt now ships a structured catalog of 50 distinct Kuwait campaign
categories in `packages/creative-engine/src/catalog.ts`. A template is not a
display card. Each immutable recipe includes:

- Target vertical and conversion goal.
- Three to five time-balanced scenes.
- Shot, camera, lighting and continuity direction.
- English and Kuwait-Arabic headlines and voiceover.
- Protected identity, logo, price, offer, CTA and subtitle layers.
- Compliance rules and required source inputs.
- A premium acceptance score and two internal quality retries.
- Four ratios and Arabic, English and bilingual output policies.

The same recipes are published into PostgreSQL through
`0007_kuwait_campaign_catalog.sql`, returned by the public template API and
used by the web creator. Templates remain in `review` until they have unique
real previews and pass the frozen benchmark; code completion alone does not
change them to `approved`.

## Kuwaiti Arabic, not generic Arabic

`packages/creative-engine/src/kuwaiti-arabic.ts` applies a versioned
`ar-KW-campaign-2026.08` policy with five controls:

1. The campaign locale is explicitly `ar-KW`.
2. The copy compiler uses a controlled Kuwait lexicon and polished or
   conversational register.
3. Cross-dialect leakage from common Egyptian, Levantine, Maghrebi, Iraqi and
   Saudi campaign phrasing is detected, normalized and reported.
4. Over-formal MSA conversion phrases are rewritten for conversational
   campaigns while clinic copy keeps a factual polished register.
5. Provider submission is blocked when the complete script score is below 90;
   all fifty template scripts are covered by this preflight test.

The five launch recipes preserve confirmed facts and predefined visual directions. Audio uses the configured Gateway model's native capabilities only; separate narration is disabled in this phase. Generated speech and Kuwaiti dialect must be inspected before quality claims. Do not assume a detached voice track or guaranteed text rendering exists.

Kuwaiti Arabic is treated as a distinct dialect rather than a Gulf-Arabic
label. This follows dialect-corpus research including MADAR and Gumar:
<https://aclanthology.org/L18-1535/> and
<https://aclanthology.org/L16-1679/>.
The first published conversational Kuwaiti Arabic WhatsApp corpus also shows
that Kuwaiti Arabic is low-resource and socially variable, so the product
policy is intentionally versioned and still requires Kuwait-based human review
rather than presenting a small replacement dictionary as a complete linguistic
classifier: <https://aclanthology.org/2022.wanlp-1.35/>.

## Accepted-output engine

The worker compiles the structured brief into a provider-ready, timecoded
direction with product lock, continuity anchors, safe zones, negative
constraints and an approved Kuwait voice script.

Every completed provider candidate is copied to MovPrompt-owned storage before
review. Provider files are normalized through FFmpeg to MP4/H.264/AAC with
fast-start metadata before they are eligible for acceptance. Independent
analyzers must supply evidence for:

- Technical validity.
- Product/business identity.
- Prompt adherence.
- Motion realism.
- Visual artifacts.
- Brand safety.
- Kuwaiti dialect fidelity.
- Visible-speech synchronization when a presenter speaks.
- Overlay safe zones.
- Compliance.

Campaign finishing renders the confirmed call to action and any nonempty offer,
booking link and WhatsApp number in a closing card during the final four seconds.
These exact strings come from the immutable generation brief (historical booking
links can use the validated campaign context), never stale display fields. The
provider prompt reserves space and excludes baked-in text; Canvas rasterizes
English/Arabic text and FFmpeg composites it before the clean R2 master and
watermarked preview are saved. Blank values produce no placeholder. Overlong
text fails explicitly rather than silently dropping or shortening a destination.
Previously generated files are not rewritten automatically.
The worker explicitly loads DejaVu Sans on Linux (included in Dockerfile.worker)
or Arial on macOS/Windows and checks font availability before advertising ready.

Missing evidence scores zero, so a partially configured reviewer fails closed.
Rejected candidates are stored in `render_attempts`. Up to two targeted quality
retries use new provider idempotency keys and durable outbox jobs without a
second user charge. Only an accepted attempt becomes the render output. If no
attempt passes, the existing exactly-once refund or starter-entitlement restore
path applies.

### Executable provider and review path

`packages/providers/src/byteplus-seedance.ts` implements the official
asynchronous BytePlus ModelArk task contract for Dreamina Seedance 2.0:

- Server-only model and API credentials.
- Text plus signed private image, video and audio references.
- Native audio, ratio, resolution and watermark controls.
- Durable provider task IDs, polling, terminal errors and queued cancellation.
- No provider or model IDs in browser/public contracts.

`apps/worker/src/media-quality-analyzers.ts` combines two independent checks:

- FFprobe validates the real duration, streams, dimensions, frame cadence and
  H.264/AAC delivery.
- Gateway-native audio is retained; no external speech synthesis service is active.
- A Google Gemini language model routed through Vercel AI Gateway receives the
  bounded MP4 FilePart, confirmed brief and up to five product references, then
  returns schema-validated evidence for identity, prompt adherence, motion,
  artifacts, brand safety, Kuwaiti dialect, visible speech sync, safe zones and
  compliance. It reuses the Gateway key and never calls a provider-specific
  Files API or silently falls back to another model.

The worker registers the Seedance adapter only when storage, an exact output
host allowlist, the provider key, the explicit Gateway quality model and both
capability configuration values are present. Missing any one keeps generation
fail-closed.

## Production activation gate

The engine intentionally has no default provider. A live adapter stays disabled
until all 48 frozen briefs are run and the adapter meets the quality,
reliability, latency, rights and accepted-output-cost gates in
`BENCHMARK_CORPUS.md`. Current provider availability, model versions, quality
and pricing must be measured live; a marketing page or recalled model name is
not activation evidence.

The gate is executable: `benchmark:prepare` validates and uploads sixteen
rights-attested private subject packs into the fixed 48-brief manifest, and
`benchmark:live` resumes accepted provider task IDs, stores every paid
observation, and refuses approval for missing, duplicate or partial coverage.

Current primary API references used by the implementation:

- BytePlus create/retrieve task API:
  <https://docs.byteplus.com/en/docs/modelark/1520757> and
  <https://docs.byteplus.com/en/docs/ModelArk/1521309>.
- AI SDK structured output and Vercel AI Gateway:
  <https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data> and
  <https://vercel.com/docs/ai-gateway>.
# Template-supported campaign controls

The creator loads the selected template's published purposes, languages and aspect ratios from the API before requesting an estimate. Quality choices use the shared server campaign-resolution contract: all current launch templates support 720p and 480p. Image uploads and manual source entry preserve the chosen purpose and call to action.

Older drafts with incompatible settings require an explicit supported selection in Campaign purpose, language, format or quality. The creator preserves images and confirmed facts, blocks estimates and generation until the settings agree, and provides a retry if the template catalog cannot be loaded. Backend eligibility checks remain authoritative.
