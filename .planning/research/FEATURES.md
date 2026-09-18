# Feature Research

**Domain:** Beginner-first AI social-content creation for Kuwait businesses
**Researched:** 2026-08-17
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Link/photo/footage import | Competitors reduce preparation by extracting existing business assets | HIGH | Must be accurate, editable, SSRF-safe, and support services as well as products |
| Template outcome selection | Non-editors understand “get bookings” better than prompts/models | MEDIUM | Recommend templates by vertical, goal, assets, and language |
| Real playable previews | Users must know what a template will produce | HIGH | Never show a play icon on static concept art |
| Arabic/English/bilingual | Kuwait businesses publish in all three modes | HIGH | Interface language and campaign language must be independent |
| Brand controls | Logo, colors, price, offer, CTA, subtitles | MEDIUM | Deterministic layers, not text generated inside video pixels |
| Reliable background generation | Users leave or reload during multi-minute jobs | HIGH | Durable worker state and truthful stages |
| Project history | Users expect drafts, retries, outputs, and downloads later | HIGH | Immutable working and accepted versions |
| Multi-format exports | Social content appears in Reels, Stories, feed, and landscape contexts | HIGH | Independent 9:16, 1:1, 4:5, 16:9 artifacts |
| Simple editor | Users need factual corrections without regenerating | HIGH | Scene cards, no timeline |
| Transparent price and failure handling | Generative results can fail or need retries | HIGH | One quote covers one accepted result; exact-once refund |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Kuwait Campaign Autopilot | One business input becomes market-correct content, not a generic AI clip | HIGH | KWD, Kuwait phones, WhatsApp, Gulf Arabic, local seasons |
| Full content-outcome catalog | Supports education, announcements, trust, stories, offers, bookings, and sales | HIGH | Broader than product-only URL-to-ad tools while remaining template-led |
| Business Truth Lock | Protects exact price, offer, logo, claims, labels, and CTA | HIGH | Facts carry provenance: imported, confirmed, or manually entered |
| Complete social pack | Delivers videos, captions, subtitles, poster, QR, and CTA assets together | HIGH | A business outcome rather than a provider output |
| Accepted Output Guarantee | Customer pays for usable output, not internal failures | HIGH | Quality retries included within bounded quote economics |
| Clinic safety mode | Prevents invented claims, deceptive transformations, and patient privacy violations | HIGH | Compliance gate before generation/export |
| Beginner/Advanced bridge | Start with a template, fork into professional control without losing data | MEDIUM | Advanced is an escape hatch, not the default |
| Performance learning | Recommend recipes using accepted-output rate and user outcomes | HIGH | Begin with internal quality telemetry; avoid unsupported “virality” claims |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Every AI model in a dropdown | Looks powerful | Confuses beginners and destabilizes quality/cost | Server capability routing |
| Full timeline | Familiar from editors | Increases cognitive load and mobile complexity | Guided scene cards |
| Fake instant preview of generated scenes | Makes demos look complete | Misrepresents sample media as user output | Truthful static storyboard until render completes |
| One-click social publishing | Feels complete | Adds OAuth, permissions, review, failure, and account-risk complexity | Validated Download All pack first |
| Guaranteed virality/performance | Attractive marketing claim | Cannot be promised from creative alone | Quality/readiness scoring and A/B-ready variants |
| Automatic clinic before/after generation | Strong visual transformation | Deceptive and high-risk | Consented real footage with clear provenance |

## Feature Dependencies

```text
Portable project/version API
    └──requires──> Auth + owner-scoped PostgreSQL + private storage
                         └──requires──> migrations + RLS + stable object keys

Real generation
    └──requires──> quote + worker heartbeat + provider adapter + output copy + quality gate

Guided editor
    └──requires──> accepted output + immutable versions + shared Remotion composition

Social pack
    └──requires──> editor composition + export worker + four artifact records

Advanced Mode ──forks──> immutable Template version
```

### Dependency Notes

- **Generation requires full runtime readiness:** a model appearing in a catalog is not a working product pipeline.
- **Editing requires owned output:** factual overlays cannot be reliably exported from an expiring provider URL.
- **Social packs require deterministic composition:** native provider ratios alone cannot guarantee identical text/logo across formats.
- **Clinic launch requires compliance policy:** templates cannot be enabled before identity, claim, privacy, and consent gates.

## MVP Definition

### Launch With (v1)

- [ ] One reliable product journey and one reliable service journey.
- [ ] Kuwait English, Arabic, and bilingual campaign settings.
- [ ] Outcome/template recommendation with truthful preview and price.
- [ ] Generate-time auth with exact draft recovery.
- [ ] Durable background generation and project recovery.
- [ ] Guided factual editor and one accepted output history.
- [ ] Four-format social pack with captions, subtitles, poster, and WhatsApp assets.
- [ ] Launch template set covering salons, clinics, shops, and ecommerce.
- [ ] Credits/starter entitlement, supportable errors, monitoring, and refund correctness.

### Add After Validation (v1.x)

- [ ] More template recipes based on observed customer demand.
- [ ] A/B content variations and campaign bundles.
- [ ] Reusable brand kits and catalog items across projects.
- [ ] Team sharing and client approval links.
- [ ] Social scheduling after Download All usage is proven.

### Future Consideration (v2+)

- [ ] Digital Twins and reusable people studio after consent/provider deletion is fully proven.
- [ ] Scene-level locked regeneration and stitching.
- [ ] Saudi Arabia and UAE localization.
- [ ] Automated publishing, analytics feedback, and ad-platform integrations.
- [ ] Enterprise governance, SSO, and public API.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Reliable template golden path | HIGH | HIGH | P1 |
| Accurate business/source import | HIGH | HIGH | P1 |
| Arabic/RTL/KWD/WhatsApp | HIGH | HIGH | P1 |
| Background generation recovery | HIGH | HIGH | P1 |
| Honest editor + exports | HIGH | HIGH | P1 |
| Full 50-template polished catalog | MEDIUM | HIGH | P2 after launch set |
| Advanced parity | MEDIUM | HIGH | P2 |
| Digital Twins | MEDIUM | HIGH | P3 |
| Social publishing | MEDIUM | HIGH | P3 |

## Competitor Feature Analysis

| Feature | Higgsfield | HeyGen/Canva | Our Approach |
|---------|------------|---------------|--------------|
| Product-to-video | Single image/URL, high-end presets, cinematic tools | Product placement/presenters and template workflows | Products plus service businesses, Kuwait facts, outcomes, and complete social pack |
| Advanced control | Cinema Studio, multi-shot, camera/genre controls | Presenter/script/brand workflows; Canva editor/resize | Separate Advanced Mode with semantic controls and immutable template fork |
| Localization | Broad global tools | HeyGen offers broad language/presenter coverage | Deep Kuwait Arabic/English/bilingual, KWD, WhatsApp, local vertical recipes |
| Brand editing | Template asset replacement | Brand kits, fonts, colors, resize | Deterministic truth-locked business facts in actual exported video |
| Deliverable | Generated video/creative | Video plus platform exports/designs | One approved master plus complete conversion-ready social pack |

## Sources

- https://higgsfield.ai/blog/The-Fastest-Way-to-Create-Cinematic-Product-Commercials — template-led product ads.
- https://higgsfield.ai/blog/how-to-make-100-creative-ads — URL import, editable extraction, and template limits.
- https://higgsfield.ai/blog/cinema-studio-guide — professional multi-shot control.
- https://www.heygen.com/tool/ai-product-placement — product/presenter, language, template, brand, and export features.
- https://www.canva.com/en_in/pro/brand-kit/ — brand kits, templates, resize, and social content workflow.
- https://www.facebook.com/business/ads/facebook-instagram-reels-ads — 9:16/audio/safe-zone performance guidance.
- https://www.facebook.com/business/ads/click-to-message-ads — WhatsApp and messaging conversion journeys.

---
*Feature research for: beginner-first Kuwait social content*
*Researched: 2026-08-17*
