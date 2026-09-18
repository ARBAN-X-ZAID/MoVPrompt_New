---
phase: 03
slug: product-and-service-golden-paths
status: approved
shadcn_initialized: false
preset: none
created: 2026-08-20
---

# Phase 03 — UI Design Contract

> Visual and interaction contract for the beginner Product and Service Golden Paths. This phase extends the existing creator shell; it does not introduce a new visual language, dashboard, model picker, or timeline.

---

## UX Brief

| Item | Contract |
|------|----------|
| Primary user | Kuwait business owner or staff member with no video-making, prompt, model, or editing knowledge. |
| User goal | Turn a real product or service into a truthful ready-to-generate social campaign without re-entering information. |
| Business goal | Demonstrate a support-free first completion path before authentication while preserving every fact and source asset. |
| Top tasks | 1. Add what is being promoted. 2. Confirm business facts. 3. Choose a campaign result and generate. |
| Main anxieties | “Will it use the right product/service?”, “Will it invent information?”, “What do I do next?”, and “Will I lose my work?” |
| Desired action | Complete the final review and select **Generate campaign**; authentication appears only then. |
| Success signal | The next action is understandable within five seconds; product and service paths reach the same final review with exact facts, provenance, settings, and assets intact. |
| Constraints | Kuwait only, KWD to three decimal places, independent interface/campaign language, guest-first auth handoff, no model/provider/prompt/timeline terminology, light/dark/RTL and WCAG 2.2 AA. |

### Information Architecture and Flow

```text
Create (source-first)                         Create (template-first)
What are you promoting?                       Chosen template + required inputs
        ↓                                                    ↓
Review the facts and their source  ←──────── normalized campaign draft ───────┐
        ↓                                                                      │
Choose the result                                                               │
        ↓                                                                      │
Recommended templates (up to three) / Browse all                               │
        ↓                                                                      │
Set up campaign: presenter, CTA, language, delivery                            │
        ↓                                                                      │
Review campaign: source, facts, rights, price, delivery                        │
        ↓                                                                      │
Generate campaign → existing auth / claim / quote / submit path                │
```

Each screen has one primary job. Do not show a separate “dashboard”, a technical settings side panel, or a duplicated review payload. The review is derived from the normalized draft that is persisted, quoted, claimed, and submitted.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing local shadcn-style primitives; no initialization in this phase |
| Preset | Not applicable — `components.json` is absent, but the product already has local Radix-based primitives and semantic theme tokens. Preserve them rather than introducing a second system. |
| Component library | Existing Radix-based `apps/web/src/components/ui/*` primitives, Tailwind utilities, and creator-specific CSS |
| Icon library | Lucide React; icons support labels and never carry the meaning alone |
| Font | Inter for Latin UI/body, Inter Tight for display/headings, Noto Sans Arabic for Arabic UI/campaign content |
| Theme source | `apps/web/src/index.css` and `apps/web/src/features/create/creator.css` semantic variables |

### Visual Thesis

Premium editorial restraint: a calm, light or dark canvas with the user’s real product, service, or business media as the dominant visual anchor. The creator reads as one focused studio session—not as a crowded SaaS dashboard. Use generous negative space, one strong title, quiet grouped sections, and a single amber action path. Do not copy Apple, Higgsfield, or any competitor; retain MovPrompt’s neutral surfaces, editorial typography, and warm amber action language.

### Layout and Interaction Thesis

- **Composition:** a persistent creator shell, visible step position, one task-focused main pane, and only contextual secondary information. On desktop, the selected source or template media may anchor the companion column; it must never replace real form information.
- **Status:** save, import, quote, and generation state are textual and specific. Never use a simulated percentage, generic “AI is thinking”, or a success-looking placeholder.
- **Motion:** 160–180ms opacity/translate transitions for step entry and selection only; 160ms hover/focus affordances; skeletons for remote data. Under `prefers-reduced-motion: reduce`, render state changes immediately and stop decorative/skeleton movement.
- **Progress:** reuse `CreatorProgress`; expose the active step with `aria-current="step"`. Moving forward is explicit through the primary button. Back is always available and preserves the current draft.

---

## Spacing Scale

Declared values (all multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps; provenance marker spacing |
| sm | 8px | Label/help/error stacks; compact controls |
| md | 16px | Default field and card internal spacing |
| lg | 24px | Form groups, section card padding, desktop grid gaps |
| xl | 32px | Step-to-step separation and page-header gap |
| 2xl | 48px | Major creator section break |
| 3xl | 64px | Desktop page-level separation only |

Exceptions: 44px minimum interactive target; 68px existing creator header height; 72px mobile sticky action bar safe area. These are minimum usability dimensions, not additional spacing tokens.

### Responsive Composition

| Viewport | Contract |
|----------|----------|
| 375px | One-column flow; source choices and template recommendations stack; the current step label is visible in progress; a sticky primary action sits above the safe area with a fade boundary; review groups are full-width; no horizontal scroll. |
| 768px | Source choices and outcome options become two columns; template recommendations become two columns; fields with short paired values may share a row; actions remain easy to reach without relying on hover. |
| 1024px | Source choices use a four-option row when labels fit; recommendations use three columns; campaign setup and final review may use an 8/4 main/summary composition. The summary/quote column can be sticky only while all controls remain visible. |
| 1440px | Keep the existing `min(1480px, 100%)` creator shell and 32px horizontal padding. Preserve generous whitespace; do not increase information density merely because space is available. |

Use logical CSS properties (`margin-inline`, `padding-inline`, `text-align: start`) and reverse directional arrows in RTL. Arabic and English mixed values must wrap without reordering a price, WhatsApp number, URL, or CTA destination.

---

## Typography

New Phase 03 surfaces use exactly two weights: regular 400 and semibold 600. Existing global legacy headings may retain their current styling, but new components must not introduce another weight.

| Role | Size | Weight | Line Height | Contract |
|------|------|--------|-------------|----------|
| Body | 16px | 400 | 1.5 | Field values, descriptions, helper copy, and review facts. |
| Label | 12px | 600 | 1.2 | Uppercase English metadata with 0.08em tracking; Arabic labels are not uppercased and use normal tracking. |
| Heading | 24px | 600 | 1.2 | Step titles, review group titles, recommendation title. |
| Display | 48px | 600 | 1.0–1.2 | Page title only; one display title per creator screen. |

Long fact values and Arabic content wrap to two lines where practical. Product/service name cards use two-line clamp followed by accessible full text in a title/description or detail view; never clip a legal fact, CTA URL, phone number, price, or validation error.

---

## Color

Use the existing semantic variables; do not hardcode per-component colors. Values below identify the currently established light/dark intent.

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `--creator-canvas` — light `hsl(40 18% 97%)`, dark `hsl(240 8% 5%)` | Page background and breathing space. |
| Secondary (30%) | `--creator-panel` / `--creator-soft` — light white / warm neutral, dark charcoal surfaces | Task sections, review groups, field containers, sticky action area, shell navigation. |
| Accent (10%) | `--creator-action` — light `hsl(37 88% 48%)`, dark `hsl(38 91% 55%)` | Primary action, selected source/outcome/template border or marker, active step, valid quote emphasis, visible focus ring. |
| Success | `--creator-success` | Confirmed facts, successful import/save, rights complete; always pair with text/icon. |
| Warning | Existing semantic warning token | Missing optional fact, unavailable compatibility, changed quote; never used as a fake positive state. |
| Destructive | `--creator-danger` — light `hsl(0 65% 44%)`, dark `hsl(0 72% 64%)` | Discard, remove source/media, invalid rights, irreversible error. |

Accent is reserved for **the one primary next action; selected source, outcome, and template; active creator progress; a confirmed current quote; and the keyboard focus ring**. It is not used for every secondary control, static badge, background gradient, decorative icon, or unavailable feature. The existing cyan brand token remains limited to the logo/established brand applications; Phase 03 does not expand it.

---

## Screen and Component Contract

| Surface | Purpose and anatomy | Variants / states | Accessibility and responsive rule |
|---------|---------------------|-------------------|-----------------------------------|
| `CreatorShell` + `CreatorProgress` | Retain shell, save indicator, language control, account entry, and one visible current step. | Default, saving, saved, offline-saved, claim-recovering. | Skip link targets main content. Progress uses ordered list semantics and `aria-current="step"`; mobile shows current step text rather than clipped step names. |
| `SourceChoiceStep` | H1 “What are you promoting?”; four equal source choices: **Product link**, **Business or service link**, **Upload photos or footage**, **Enter details manually**. Each has one-sentence outcome-oriented help. | Idle, selected, link input, upload drag/validation, manual entry, loading import, import error. | Source choices are real radio controls or labelled buttons in a group. Upload is keyboard-triggerable; file type/size/error is field-associated. No customer-facing sample option. |
| `FactReviewStep` | Shows a source summary and source-specific facts, each rendered as `label → value → provenance` with an explicit Edit action. Product emphasizes product name/description/brand/price/offer/logo/colors/media. Service emphasizes business/service name/description/location/booking/WhatsApp/price/offer/logo/colors/real media. | Imported, confirmed, manually added, optional-not-added, required-missing, scan warning, editable. | Provenance is text plus icon, never color alone. “Confirm details” changes only untouched imported facts used by the campaign. Editing marks the edited fact “Added by you.” |
| `OutcomeStep` | One question: “What do you want this campaign to do?” Outcome cards use plain-language labels: WhatsApp orders, bookings, promote an offer, launch something new, demonstrate it, explain it, make an announcement, build trust, tell your brand story. | No selection, selected, unsupported-by-current-input, loading recommendations. | Use a labelled radio group. Unsupported options state why and the one needed recovery action; do not silently change selection. |
| `TemplateRecommendation` | Show at most three ranked recommendation cards first. Every selectable card states expected result, required inputs, duration, supported formats, presenter compatibility, preview type, and live quote state. “Why this fits” is short, deterministic, and grounded in visible facts. | Verified-motion preview, static direction, unavailable/non-selectable, quote loading, quote unavailable, selected. | Only verified motion gets Play and opens the existing dialog. Static direction shows “View direction” with no play icon/progress. Use selected state with text and `aria-pressed`, not color alone. |
| `BrowseTemplates` | Secondary escape from recommendations; preserve the selected source, facts, outcome, and scroll/filter state. | Loading, empty after filters, one, many, selected. | Keep existing truthful preview grouping and template filters. At 375px cards stack; at 1024px use at most three columns. |
| `CampaignSetupStep` | Progressive controls: campaign language, CTA destination, tone, subtitles, audio, resolution, ratio; conditionally price/offer, WhatsApp, booking link, and location. Kuwait appears as a fixed market note, not a selector. Presenter selection belongs here after template selection. | Default recommendations applied, field invalid, capability unavailable, speaker rights incomplete, quote updating. | Labels always persist above fields. Related delivery settings use `fieldset`/`legend`. CTA destination format validation is adjacent to the value. |
| `PresenterChoice` | Three plain choices: **No presenter** (default), **AI UGC presenter**, **Uploaded spokesperson**. | AI option hidden when not catalogue/server-approved; uploaded spokesperson blocked until footage and explicit rights; Digital Twins absent. | Explain why an unavailable option is not offered; do not show an inert control. Rights checkbox has descriptive copy and its error is linked. |
| `CampaignReviewStep` | A calm summary with six groups: Source; Campaign; Presenter and media; Delivery; Rights; Price. Each group has one Edit action that returns to the precise step and preserves review state. | Valid, missing required setup, quote loading, quote expired/changed/unavailable, worker paused, offline-saved, auth-required. | Use definition-list or semantic grouped summary. Every fact used to generate is visible alongside provenance. The final action is disabled only with a named reason and recovery action. |
| Auth and preview dialogs | Reuse existing Radix dialog primitives for verified preview and Generate-time account creation. | Open, closed, form error, pending, cancelled. | Trap focus, provide labelled close control, return focus to trigger, fit within 100dvh at 375px, and keep the complete draft unchanged on cancel. |

### Component Rules

- Prefer existing `Button`, `Card`, `Dialog`, `Input`, `Textarea`, `RadioGroup`, `Select`, `Checkbox`, `Skeleton`, and `CreatorProgress` primitives. New phase components compose these primitives; do not add a UI library or third-party block.
- A selected option receives a 2px accent border/marker, an accessible selected state, and a short textual confirmation. Hover never becomes the only way to discover a choice.
- Every form field has a visible label, optional helper, and field-level error directly below it. Placeholder text is illustrative only and never substitutes for a label.
- Related setup values are prefilled from draft defaults. Prefilling is never presented as an imported business fact and must not alter provenance.
- Preserve all entered values after scan, validation, quote, upload, auth, capability, worker, or network failure. A source replacement is the only action that can supersede facts, and it is explicitly confirmed.
- The source image/video shown in any summary comes from the selected draft asset; use neutral empty media treatment when none exists. Never show a perfume, soda, or other demonstration asset as if it were the user’s imported product.

---

## Copywriting Contract

Use short, concrete business language. Avoid “prompt”, “model”, “render settings”, “pipeline”, “AI magic”, “processing intelligence”, and competitor terminology in Template Mode.

| Element | Copy |
|---------|------|
| Source heading | **What are you promoting?** |
| Source link helper | **Paste a public product, business, or service link. We’ll bring back facts for you to check.** |
| Fact-review CTA | **Confirm details** |
| Outcome heading | **What do you want this campaign to do?** |
| Recommendation CTA | **Use this template** |
| Setup CTA | **Review campaign** |
| Final primary CTA | **Generate campaign** — shown only for a valid, unexpired quote and complete rights. |
| Final disabled explanation | **Complete the highlighted details to generate your campaign.** |
| Missing optional fact | **Not added** |
| Recommendation empty heading | **No template fits this setup yet** |
| Recommendation empty body | **Add the missing input or choose a different campaign result. Your details are saved.** |
| Import failure | **We couldn’t read that link. Check the address or add your own photos instead.** Primary recovery: **Try another link**. |
| Upload failure | **That file wasn’t added. Choose a supported photo or video and try again. Your draft is unchanged.** |
| Quote unavailable | **We couldn’t confirm the current price. Your campaign is saved.** Primary recovery: **Retry price**. |
| Quote changed | **The price changed from {old price} to {new price}. Review the new price before continuing.** Primary recovery: **Review new price**. |
| Capability unavailable | **This option is temporarily unavailable. Choose another template or try again later.** |
| Worker paused | **Generation is temporarily paused. Your campaign is saved and ready to continue.** |
| Offline | **You’re offline. Keep editing; we’ll save this campaign in this browser until you’re connected.** |
| Auth handoff | **Your campaign is ready to create. Create an account to start generation; your details will return exactly as you left them.** |
| Source replacement confirmation | **Replace source? You’ll review the new facts before continuing. Your current campaign settings will stay saved.** Actions: **Replace source** / **Keep current source**. |
| Remove uploaded media | Provide immediate **Undo** after removal. If an asset is required by the chosen template or presenter, show confirmation: **Remove this required media? You’ll need to add another before generating.** |
| Discard draft confirmation | **Discard this campaign? Your saved details and uploaded files in this browser will be removed.** Actions: **Discard campaign** / **Keep editing**. |

Pluralise template counts correctly in English and Arabic. For Arabic, do not uppercase, do not force Latin punctuation order, and use a verified Arabic translation rather than machine-transliterating campaign labels.

---

## State and Recovery Contract

Every state has one visible primary recovery action and a non-destructive secondary escape. A retry never clears fields, uploads, selected template, presenter, or campaign settings.

| State | Visible behavior | Primary action | Safe escape |
|-------|------------------|----------------|-------------|
| Initial source | Four clearly named choices; no sample selected. | Choose a source | Browse templates / go back |
| Link scan loading | Keep submitted URL visible; show a compact skeleton and “Checking the link…” status. | Cancel check (if request is cancellable) | Use photos instead |
| Link scan partial | Show returned facts plus missing values as “Not added” and scanner warnings in plain language. | Confirm details | Edit facts |
| Link scan error | Show exact recovery copy from Copywriting Contract. | Try another link | Upload photos or footage |
| Upload in progress | File names, per-file status, cancel where supported; do not imply remote ownership before claim. | Continue when validation completes | Remove file |
| Fact validation | Leave values in place; inline error follows the affected field; first invalid field receives focus on Continue. | Fix {field label} | Return to fact review |
| Recommendations loading | Use 1–3 card skeletons that match final card geometry. | Checking recommendations | Change outcome |
| Recommendations empty | Use documented empty copy; never choose an unsuitable template automatically. | Add missing input / Change outcome | Browse all templates |
| Static direction | Show poster, expected result, and “View direction”; no playable-looking controls. | View direction | Choose template |
| Quote loading | Final review remains available; price area uses a labelled skeleton. | Retry price on failure | Keep editing |
| Quote invalid/expired/changed | Name the reason, show saved status, and disable Generate only. | Retry price / Review new price | Keep editing |
| Rights incomplete | Surface the required attestation in the Presenter and media or Rights group. | Confirm rights | Choose no presenter |
| Auth cancelled | Close dialog, restore focus to Generate campaign, retain exact local draft. | Generate campaign | Keep editing |
| Generation handoff | Hand off to existing persisted generation progress; never show a fake completion or invented percentage. | View project status | Return to campaign |

---

## Accessibility, RTL, and Motion

- Meet WCAG 2.2 AA in English and Arabic at 375, 768, 1024, and 1440px in light and dark themes.
- Use native controls first: radio groups for source/outcome/presenter, checkboxes for rights/subtitle/audio, buttons for in-place actions, links only for navigation.
- All input errors use `aria-invalid`, `aria-describedby`, and `role="alert"` only for the current error. Page/step changes announce a concise title through a polite live region; avoid repeating every field value.
- Imported, Confirmed by you, and Added by you have text labels plus their visible status treatment. Required/optional state, quote state, selected state, and disabled state never depend only on color.
- Ensure 44×44px minimum pointer targets, 3px visible focus outline using the existing action token, meaningful `alt` for user media, and decorative icons with `aria-hidden="true"`.
- Dialogs retain the existing Radix focus trap, escape handling, close label, and focus return. The source/file picker does not trap keyboard focus.
- Use `dir="rtl"` on Arabic surfaces and logical properties throughout. Render KWD numerals, phone numbers, URLs, and prices in a direction-safe span; format KWD with three decimals.
- Respect `prefers-reduced-motion`: remove transform/opacity entrance effects, stop non-essential animation, and expose equivalent textual save/loading/progress states.

---

## UI Considerations

Applicable state considerations resolved: 16 covered, 4 backstop, 0 unresolved.

| Category | Element(s) | Status | Resolution / Reason |
|----------|------------|--------|---------------------|
| empty | Source form | ✅ covered | Initial state uses the four documented source choices with no customer-facing sample content. |
| loading | Link scan, upload control, recommendation list, quote panel | ✅ covered | Each operation has a truthful labelled pending state that preserves draft values and exposes only a valid cancel/retry action. |
| error | Link scan, upload, quote, capability, rights | ✅ covered | Uses the exact recovery copy above plus a primary retry/fallback action; errors never clear the draft. |
| partial | Fact review and campaign setup forms | ✅ covered | Missing optional facts display “Not added”; outcome-required facts get adjacent field errors and retain values. |
| populated | Fact summary, recommendations, final review | ✅ covered | Review is derived from normalized draft facts and provenance, not a separate summary payload. |
| zero-one-many | Template recommendations and browse list | ✅ covered | Recommendations show 0 recovery state, 1 full-width card, or 2–3 ranked cards; template counts use locale-aware singular/plural. |
| overflow | Creator progress/navigation | 🧪 backstop | At 375px show active-step text rather than overflowing all step labels; verify in browser with English and Arabic. |
| overflow | Recommendation cards and review groups | 🧪 backstop | Cards stack or reflow at specified breakpoints; test long names, Arabic and bilingual values without horizontal scrolling. |
| long-text | Fact values, errors, CTA destinations, URLs, WhatsApp numbers | 🧪 backstop | Essential text wraps or uses direction-safe formatting; no ellipsis for values needed to make a business decision. |
| long-text | Static direction and template descriptions | ✅ covered | Clamp non-essential display copy to two lines and expose full content through a labelled details view. |
| empty | Template preview media | ✅ covered | Missing/unsupported media renders a neutral “Preview unavailable” state; Play never appears without verified motion. |
| loading | Preview dialog media | ✅ covered | Dialog shows a labelled media loading state without a false play/progress treatment. |
| error | Preview dialog media | ✅ covered | “Preview unavailable. You can still review the template details.” retains selection and offers close/view details. |
| populated | Uploaded source media | ✅ covered | Displays the actual draft asset with remove/undo and rights context; never substitutes bundled demo media. |
| partial | Presenter controls | ✅ covered | AI UGC is hidden until server/catalog availability is real; uploaded spokesperson explicitly states missing footage/rights requirements. |
| overflow | Sticky mobile action bar | 🧪 backstop | At 375px it must not cover form errors, browser controls, or safe-area content; validate through rendered browser evidence. |
| long-text | Arabic/English title and metadata | ✅ covered | Uses `text-align: start`, logical layout, Arabic font fallback, and normal Arabic tracking. |
| zero-one-many | Source assets | ✅ covered | One primary media item anchors the review; multiple assets show a labelled count and controllable list; zero assets shows the documented neutral treatment. |
| error | Authentication dialog | ✅ covered | Cancel/error returns to the complete draft and restores focus to the Generate trigger. |
| loading | Step navigation | ✅ covered | Primary action becomes pending only during its own operation; Back remains available whenever it does not risk double submission. |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| Existing local component primitives | Existing Radix-based `components/ui` primitives only | Existing repository code; no registry import in Phase 03 |
| shadcn official | None added | Not required |
| Third-party | None | Not applicable |

---

## Acceptance Evidence Required

The executor and checker must demonstrate, not merely code-review:

1. Product-link/product-upload and business/service-link/manual paths show distinct source-specific fact review while producing the same normalized final review shape.
2. Editing an imported fact changes the label to **Added by you**; confirming untouched imported facts changes only campaign-used facts to **Confirmed by you**.
3. All nine outcomes lead to deterministic recommendations or one clear non-selectable recovery state; no model/provider/prompt/timeline wording appears in Template Mode.
4. Only verified motion previews can be played. Static directions cannot visually resemble a finished video.
5. No presenter is default; AI UGC is absent when unsupported; uploaded spokesperson requires footage and rights; Digital Twin is absent.
6. The final review includes all six groups and exact Edit navigation, persists an invalid/expired quote state, and retains its complete draft after a retry/cancelled auth flow.
7. Keyboard, focus, screen-reader status, reduced-motion, English/Arabic RTL, light/dark, and 375/768/1024/1440 rendered-browser checks pass with no clipped primary action or horizontal overflow.

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-08-20
